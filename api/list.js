export default async function handler(req, res) {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID;
    const token = process.env.AIRTABLE_PAT;

    // Customize these if your table/fields differ:
    const TABLE = process.env.AIRTABLE_PROPERTIES_TABLE || "Properties";
    const VIEW = process.env.AIRTABLE_PROPERTIES_VIEW || ""; // leave empty if you don't have "Public"

    const pageSize = Math.min(Number(req.query.pageSize || 24), 50);
    const offset = req.query.offset || undefined;

    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLE)}`);
    url.searchParams.set("pageSize", String(pageSize));
    if (VIEW) url.searchParams.set("view", VIEW);
    url.searchParams.set("sort[0][field]", "Title");
    url.searchParams.set("sort[0][direction]", "asc");
    if (offset) url.searchParams.set("offset", offset);

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!resp.ok) {
      const t = await resp.text();
      return res.status(resp.status).json({ error: t || "Airtable error (list)" });
    }

    const data = await resp.json();

    const items = (data.records || []).map(r => {
      const f = r.fields || {};
      const hero = Array.isArray(f.Photos) && f.Photos.length ? f.Photos[0].url : null;
      return {
        id: r.id,
        slug: f.Slug || "",
        title: f.Title || "",
        city: f.City || "",
        price: f.Price ?? null,
        hero
      };
    });

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=600");
    return res.json({ items, nextOffset: data.offset || null });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error (list)" });
  }
}
