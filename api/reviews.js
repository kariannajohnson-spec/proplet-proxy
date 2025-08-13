export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { slug } = req.query;
      if (!slug) return res.status(400).json({ error: "Missing slug" });

      const baseId = process.env.AIRTABLE_BASE_ID;
      const token = process.env.AIRTABLE_PAT;

      // 1) Find the property by slug
      const params = new URLSearchParams({
        filterByFormula: `LOWER({Slug})='${String(slug).toLowerCase().replace(/'/g, "''")}'`,
        maxRecords: "1"
      });
      const propResp = await fetch(`https://api.airtable.com/v0/${baseId}/Properties?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const propData = await propResp.json();
      const prop = propData.records?.[0];
      if (!prop) return res.status(404).json({ error: "Property not found" });

      const reviewIds = Array.isArray(prop.fields.Reviews) ? prop.fields.Reviews : [];
      if (!reviewIds.length) {
        res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=120");
        return res.json({ reviews: [] });
      }

      // 2) Pull those reviews
      const csv = reviewIds.join(",");
      const revParams = new URLSearchParams({
        filterByFormula: `SEARCH(RECORD_ID(),'${csv}')`,
        maxRecords: "50",
        sort: '[{ "field": "Created At", "direction": "desc" }]'
      });
      const revResp = await fetch(`https://api.airtable.com/v0/${baseId}/Reviews?${revParams}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const revData = await revResp.json();

      const reviews = (revData.records || []).map(r => ({
        id: r.id,
        name: r.fields.Name || "Anonymous",
        rating: r.fields.Rating ?? null,
        comment: r.fields.Comment || "",
        createdAt: r.fields["Created At"] || null
      }));

      res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=120");
      return res.json({ reviews });
    }

    if (req.method === "POST") {
      // Forward to Make webhook so secrets stay server-side
      const webhookUrl = process.env.AIRTABLE_MAKE_WEBHOOK_URL;
      if (!webhookUrl) return res.status(500).json({ error: "Webhook not configured" });

      const body = await new Promise((resolve) => {
        let data = "";
        req.on("data", chunk => (data += chunk));
        req.on("end", () => resolve(data));
      });

      const forward = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body
      });

      const text = await forward.text();
      return res.status(200).send(text);
    }

    res.setHeader("Allow", "GET, POST");
    res.status(405).end("Method Not Allowed");
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}
