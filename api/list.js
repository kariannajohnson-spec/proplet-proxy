export default async function handler(req, res) {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID;
    const token  = process.env.AIRTABLE_PAT;

    const TABLE = process.env.AIRTABLE_PROPERTIES_TABLE || "Properties";
    const VIEW  = process.env.AIRTABLE_PROPERTIES_VIEW   || ""; // optional

    const pageSize = Math.min(Number(req.query.pageSize || 24), 50);
    const offset   = req.query.offset || undefined;

    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLE)}`);
    url.searchParams.set("pageSize", String(pageSize));
    url.searchParams.set("sort[0][field]", "Title");
    url.searchParams.set("sort[0][direction]", "asc");
    if (VIEW) url.searchParams.set("view", VIEW);
    if (offset) url.searchParams.set("offset", offset);

    const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ error: t || "Airtable error (list)" });
    }

    const data = await r.json();

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

    const items = (data.records || []).map(rec => {
      const f = rec.fields || {};
      // Build a cleaned fields object with only allowed fields
      const fields = {};
      for (const k in f) if (allow.has(k)) fields[k] = f[k];

      // Hero image from Images[0]
      const imgs = Array.isArray(f["Images"]) ? f["Images"] : [];
      const hero = imgs.length ? imgs[0].url : null;

      // Minimal top-level props that the Squarespace listings grid expects
      return {
        id: rec.id,
        slug: f["Slug"] || "",
        title: f["Title"] || "",
        city: f["City"] || "",
        price: f["Price"] ?? null,
        hero,
        fields // full (filtered) set for future use if needed
      };
    });

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=600");
    return res.json({ items, nextOffset: data.offset || null });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error (list)" });
  }
}
