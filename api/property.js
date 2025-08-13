export default async function handler(req, res) {
  try {
    const { slug } = req.query;
    if (!slug) {
      return res.status(400).json({ error: "Missing slug" });
    }

    const baseId = process.env.AIRTABLE_BASE_ID;
    const token = process.env.AIRTABLE_PAT;

    const params = new URLSearchParams({
      filterByFormula: `LOWER({Slug})='${String(slug).toLowerCase().replace(/'/g, "''")}'`,
      maxRecords: "1"
    });

    const airtableUrl = `https://api.airtable.com/v0/${baseId}/Properties?${params}`;
    const propResp = await fetch(airtableUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const propData = await propResp.json();

    const record = propData.records?.[0];
    if (!record) {
      return res.status(404).json({ error: "Property not found" });
    }

    const p = record.fields;

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=600");
    res.json({
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
    res.status(500).json({ error: "Server error" });
  }
}
