export default async function handler(req, res) {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID;
    const token = process.env.AIRTABLE_PAT;

    const pageSize = Math.min(Number(req.query.pageSize || 24), 50);
    const offset = req.query.offset || undefined;

    const params = new URLSearchParams({
      pageSize: String(pageSize),
      view: "Public",
      sort: JSON.stringify([{ field: "Title", direction: "asc" }])
    });
    if (offset) params.set("offset", offset);

    const resp = await fetch(
      `https://api.airtable.com/v0/${baseId}/Properties?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!resp.ok) {
      const t = await resp.text();
      return res.status(resp.status).json({ error: t || "Airtable error" });
    }
    const data = await resp.json();

    const items = (data.records || []).map(r => {
      const f = r.fields || {};
      const hero =
        Array.isArray(f.Photos) && f.Photos.length ? f.Photos[0].url : null;
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
    return res.status(500).json({ error: "Server error" });
  }
}
