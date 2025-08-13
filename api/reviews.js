export default async function handler(req, res) {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID;
    const token = process.env.AIRTABLE_PAT;
    const TABLE = process.env.AIRTABLE_PROPERTIES_TABLE || "Properties";
    const REVIEWS = process.env.AIRTABLE_REVIEWS_TABLE || "Reviews";
    const VIEW = process.env.AIRTABLE_PROPERTIES_VIEW || ""; // optional

    if (req.method === "GET") {
      const { slug } = req.query;
      if (!slug) return res.status(400).json({ error: "Missing slug" });

      const formula = `LOWER({Slug})='${String(slug).toLowerCase().replace(/'/g, "''")}'`;
      const propUrl = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLE)}`);
      propUrl.searchParams.set("filterByFormula", formula);
      propUrl.searchParams.set("maxRecords", "1");
      if (VIEW) propUrl.searchParams.set("view", VIEW);

      const propResp = await fetch(propUrl.toString(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!propResp.ok) {
        const t = await propResp.text();
        return res.status(propResp.status).json({ error: t || "Airtable error (reviews/property)" });
      }
      const propData = await propResp.json();
      const prop = propData.records?.[0];
      if (!prop) return res.status(404).json({ error: "Property Not Found" });

      const reviewIds = Array.isArray(prop.fields.Reviews) ? prop.fields.Reviews : [];
      if (!reviewIds.length) {
        res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=120");
        return res.json({ reviews: [] });
      }

      // Build OR(RECORD_ID()='rec1', RECORD_ID()='rec2', ...)
      const or = `OR(${reviewIds.map(id => `RECORD_ID()='${id}'`).join(",")})`;
      const revUrl = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(REVIEWS)}`);
      revUrl.searchParams.set("filterByFormula", or);
      revUrl.searchParams.set("maxRecords", "50");
      revUrl.searchParams.set("sort[0][field]", "Created At");
      revUrl.searchParams.set("sort[0][direction]", "desc");

      const revResp = await fetch(revUrl.toString(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!revResp.ok) {
        const t = await revResp.text();
        return res.status(revResp.status).json({ error: t || "Airtable error (reviews/list)" });
      }
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
    return res.status(405).end("Method Not Allowed");
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error (reviews)" });
  }
}
