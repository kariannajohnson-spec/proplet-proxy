export default async function handler(req, res) {
  try {
    const { slug } = req.query;
    if (!slug) return res.status(400).json({ error: "Missing slug" });

    const baseId = process.env.AIRTABLE_BASE_ID;
    const token  = process.env.AIRTABLE_PAT;

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

    // Only include your fields (exact names)
    const allow = new Set([
      "Title","Slug","Images","Price","Price per m²","Square Meters","Bedrooms","Bathrooms",
      "Property Type","City","Province/Region","Address","Google Maps Link","Distance from Ocean (km)",
      "Distance from Mountains (km)","Distance from Train Station (km)","Distance from Airport (km)",
      "Biking Distance to Beach","Walking Distance to Train","Things That Make it Perfect","Red Flags",
      "Must-Haves","Nice-to-Haves","Renovation Needed","Source","Original Listing","Status","Date Added",
      "Updated","Agent Name","Agent Phone","Agent Email","Launguage","Location Score","Feature Score",
      "Price Score","Overall Relevance Score","My Rating","My Partner's Rating","Agreement Rating",
      "Viewing Schedule"
    ]);
    const fields = {};
    for (const k in f) if (allow.has(k)) fields[k] = f[k];

    // Images array (URLs) + hero
    const images = (Array.isArray(f["Images"]) ? f["Images"] : []).map(a => a.url);
    const hero = images[0] || null;

    // Flatten a few commonly-used fields for the Squarespace detail page
    const flat = {
      id: rec.id,
      slug: f["Slug"] || "",
      title: f["Title"] || "",
      city: f["City"] || "",
      price: f["Price"] ?? null,
      description: f["Things That Make it Perfect"] || "", // or swap to another text field you prefer
      hero,
      images
    };

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=600");
    return res.json({ ...flat, fields });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error (property)" });
  }
}
