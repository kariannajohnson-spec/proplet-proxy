export default async function handler(req, res) {
  try {
    const { slug } = req.query;
    if (!slug) return res.status(400).json({ error: "Missing slug" });

    const baseId = process.env.AIRTABLE_BASE_ID;
    const token  = process.env.AIRTABLE_PAT;

    // Override these via env if your names differ
    const TABLE = process.env.AIRTABLE_PROPERTIES_TABLE || "Properties";
    const VIEW  = process.env.AIRTABLE_PROPERTIES_VIEW   || ""; // optional

    const formula = `LOWER({Slug})='${String(slug).toLowerCase().replace(/'/g, "''")}'`;
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLE)}`);
    url.searchParams.set("filterByFormula", formula);
    url.searchParams.set("maxRecords", "1");
    if (VIEW) url.searchParams.set("view", VIEW);

    const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ error: t || "Airtable error (property)" });
    }

    const data = await r.json();
    const rec = data.records?.[0];
    if (!rec) return res.status(404).json({ error: "Property Not Found" });

    const f = rec.fields || {};
    const images = (Array.isArray(f.Images) && f.Images.length
      ? f.Images
      : (Array.isArray(f.Photos) ? f.Photos : [])
    ).map(a => a.url);

    const hero = images[0] || null;

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=600");
    return res.json({
      // flattened (easy for frontends)
      id: rec.id,
      slug: f.Slug || "",
      title: f.Title || "",
      city: f.City || "",
      address: f.Address || "",
      price: f.Price ?? null,
      beds: f.Beds ?? null,
      baths: f.Baths ?? null,
      sqft: f.SqFt ?? null,
      description: f.Description || "",
      hero,
      images,
      features: f.Features || [],
      avgRating: f["Avg Rating"] ?? null,

      // keep original fields for compatibility with your current page code
      fields: f
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error (property)" });
  }
}
