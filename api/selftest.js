export default async function handler(req, res) {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID;
    const token = process.env.AIRTABLE_PAT;
    const table = process.env.AIRTABLE_PROPERTIES_TABLE || "Properties";
    const view  = process.env.AIRTABLE_PROPERTIES_VIEW || ""; // optional

    if (!baseId || !token) {
      return res.status(400).json({
        ok: false,
        error: "Missing AIRTABLE_BASE_ID or AIRTABLE_PAT",
        hint: "Set both env vars in Vercel → Project → Settings → Environment Variables."
      });
    }

    // Build a simple “max 1 record” request to the table you think exists
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`);
    url.searchParams.set("maxRecords", "1");
    if (view) url.searchParams.set("view", view);

    const r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` }
    });

    const rawText = await r.text();
    let parsed;
    try { parsed = JSON.parse(rawText); } catch { parsed = null; }

    // Pull useful details if Airtable returned an error object
    const airtableError = parsed && parsed.error ? parsed.error : null;

    return res.status(r.status).json({
      ok: r.ok,
      status: r.status,
      tableTried: table,
      viewTried: view || "(none)",
      baseIdStartsWith: baseId.slice(0, 5),
      // If success, show a tiny preview of the first record/fields (no secrets)
      sampleRecord:
        r.ok && parsed && Array.isArray(parsed.records) && parsed.records[0]
          ? {
              id: parsed.records[0].id,
              fieldsPreview: Object.keys(parsed.records[0].fields || {}).slice(0, 8)
            }
          : null,
      // If error, show the full Airtable error object (message/type)
      airtableError,            // e.g., { type: "NOT_FOUND", message: "Table ... not found" }
      responseBodyPreview:
        rawText.length > 600 ? rawText.slice(0, 600) + "…(truncated)" : rawText
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      ok: false,
      error: "Selftest server error",
      message: e?.message || String(e)
    });
  }
}
