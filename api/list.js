// api/list.js
export default async function handler(req, res) {
  // --- CORS: permissive while we debug ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    const { AIRTABLE_BASE_ID, AIRTABLE_PAT } = process.env;
    const TABLE = process.env.AIRTABLE_PROPERTIES_TABLE || "Properties";
    const VIEW  = process.env.AIRTABLE_PROPERTIES_VIEW || "";
    const ORIGIN = process.env.PUBLIC_SITE_ORIGIN || "";
    const DETAIL = process.env.DETAIL_PATH || "/property";

    if (!AIRTABLE_BASE_ID || !AIRTABLE_PAT) {
      return res.status(500).json({ error: "Missing env: AIRTABLE_BASE_ID or AIRTABLE_PAT" });
    }

    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE)}`);
    url.searchParams.set("pageSize", "24");
    if (VIEW) url.searchParams.set("view", VIEW);

    const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
    const raw = await r.text();

    if (!r.ok) {
      // Pass Airtable’s error through so you can see it in the browser/console
      return res.status(r.status).json({ errorFromAirtable: raw || "Airtable error (list)" });
    }

    const data = JSON.parse(raw);

    const items = (data.records || []).map(rec => {
      const f = rec.fields || {};
      const imgs = Array.isArray(f.Images) ? f.Images : [];
      const hero = imgs.length ? imgs[0].url : null;

      const detailUrl =
        f["Detail URL"] ||
        (f["Slug"] && ORIGIN ? `${ORIGIN}${DETAIL}?slug=${encodeURIComponent(f["Slug"])}` : null) ||
        (f["Slug"] ? `${DETAIL}?slug=${encodeURIComponent(f["Slug"])}` : null);

      return {
        id: rec.id,
        slug: f.Slug || "",
        title: f.Title || "",
        city: f.City || "",
        price: f.Price ?? null,
        status: f.Status || "",
        hero,
        detailUrl
      };
    });

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=600");
    return res.status(200).json({ items, nextOffset: data.offset || null });
  } catch (e) {
    console.error("list.js fatal:", e);
    return res.status(500).json({ error: "Server error (list.js)", message: e?.message || String(e) });
  }
}
