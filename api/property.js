export default async function handler(req, res) {
if (applyCORS(req, res)) return;
  try {
    const { slug } = req.query;
    if (!slug) return res.status(400).json({ error: "Missing slug" });

    const baseId = process.env.AIRTABLE_BASE_ID;
    const token  = process.env.AIRTABLE_PAT;
    const TABLE  = process.env.AIRTABLE_PROPERTIES_TABLE || "Properties";
    const VIEW   = process.env.AIRTABLE_PROPERTIES_VIEW || "";

    const formula = `LOWER({Slug})='${String(slug).toLowerCase().replace(/'/g, "''")}'`;
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLE)}`);
    url.searchParams.set("filterByFormula", formula);
    url.searchParams.set("maxRecords", "1");
    if (VIEW) url.searchParams.set("view", VIEW);

    const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    const raw = await r.text();
    if (!r.ok) return res.status(r.status).json({ error: raw || "Airtable error (property)" });
    const data = JSON.parse(raw);
    const rec = data.records?.[0];
    if (!rec) return res.status(404).json({ error: "Property Not Found" });

    const f = rec.fields || {};
    const images = (Array.isArray(f["Images"]) ? f["Images"] : []).map(a => a.url);
    const hero = images[0] || null;

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=600");
    return res.json({
      id: rec.id,
      slug: f["Slug"] || "",
      title: f["Title"] || "",
      city: f["City"] || "",
      price: f["Price"] ?? null,
      hero,
      images,
      originalUrl: f["Original Listing"] || "",
      bedrooms: f["Bedrooms"] ?? null,
      bathrooms: f["Bathrooms"] ?? null,
      squareMeters: f["Square Meters"] ?? null,
      // computed scores / distances:
      distanceOceanKm: f["Distance from Ocean (km)"] ?? null,
      distanceMountainsKm: f["Distance from Mountains (km)"] ?? null,
      distanceTrainKm: f["Distance from Train Station (km)"] ?? null,
      distanceAirportKm: f["Distance from Airport (km)"] ?? null,
      // existing notes/ratings you want editable/visible:
      myRating: f["My Rating"] ?? null,
      perfectNotes: f["Things That Make it Perfect"] || "",
      redFlags: f["Red Flags"] || "",
      // keep full fields just in case:
      fields: f
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error (property)" });
  }
}
