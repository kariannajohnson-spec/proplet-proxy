export default async function handler(req, res) {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID;
    const token  = process.env.AIRTABLE_PAT;

    const TABLE  = process.env.AIRTABLE_PROPERTIES_TABLE || "Properties";
    const VIEW   = process.env.AIRTABLE_PROPERTIES_VIEW || "";

    const ORIGIN = process.env.PUBLIC_SITE_ORIGIN || "";
    const DETAIL = process.env.DETAIL_PATH || "/property";

    const pageSize = Math.min(Number(req.query.pageSize || 24), 50);
    const offset   = req.query.offset || undefined;

    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLE)}`);
    url.searchParams.set("pageSize", String(pageSize));
    if (VIEW) url.searchParams.set("view", VIEW);
    if (offset) url.searchParams.set("offset", offset);

    const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    const raw = await r.text();
    if (!r.ok) return res.status(r.status).json({ error: raw || "Airtable error (list)" });
    const data = JSON.parse(raw);

    const items = (data.records || []).map(rec => {
      const f = rec.fields || {};
      const imgs = Array.isArray(f["Images"]) ? f["Images"] : [];
      const hero = imgs.length ? imgs[0].url : null;

      const detailUrl =
        f["Detail URL"] ||
        (f["Slug"] && ORIGIN ? `${ORIGIN}${DETAIL}?slug=${encodeURIComponent(f["Slug"])}` : null) ||
        (f["Slug"] ? `${DETAIL}?slug=${encodeURIComponent(f["Slug"])}` : null);

      return {
        id: rec.id,
        slug: f["Slug"] || "",
        title: f["Title"] || "",
        city: f["City"] || "",
        price: f["Price"] ?? null,
        status: f["Status"] || "",
        hero,
        detailUrl
      };
    });

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=600");
    return res.json({ items, nextOffset: data.offset || null });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: `Server error (list): ${e?.message || e}` });
  }
}
