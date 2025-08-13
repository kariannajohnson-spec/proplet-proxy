export default async function handler(req, res) {
  try {
    const { slug } = req.query;
    if (!slug) return res.status(400).json({ error: "Missing slug" });

    const baseId = process.env.AIRTABLE_BASE_ID;
    const token = process.env.AIRTABLE_PAT;
    const TABLE = process.env.AIRTABLE_PROPERTIES_TABLE || "Properties";
    const VIEW = process.env.AIRTABLE_PROPERTIES_VIEW || ""; // optional

    // Safer, case-insensitive match on Slug
    const formula = `LOWER({Slug})='${String(slug).toLowerCase().replace(/'/g, "''")}'`;

    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLE)}`);
    url.searchParams.set("filterByFormula", formula);
    url.searchParams.set("maxRecords", "1");
    if (VIEW) url.searchParams.set("view", VIEW);

    const propResp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!propResp.ok) {
      const t = await propResp.text();
      return res.status(propResp.status).json({ error: t || "Airtable error (property)" });
    }
    const propData = await propResp.json();
    const record = propData.records?.[0];
    if (!record) return res.status(404).json({ error: "Property Not Found" });

    const p = record.fields;

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=600");
    return res.json({
      id: record.id,
      slug: p.Slug,
      title: p.Title || "",
      address: p.Address || "",
      price: p.Price || null,
      beds: p.Beds || null,
      baths: p.Baths || null,
      sqft: p.SqFt || null,
      description: p.Description || "",
      photos: (p.Photos || []).map(ph => ph.url),
      features: p.Features || [],
      avgRating: p["Avg Rating"] || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error (property)" });
  }
}
