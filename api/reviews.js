export default async function handler(req, res) {
  try {
    if (req.method === "POST") {
      const webhookUrl = process.env.AIRTABLE_MAKE_WEBHOOK_URL;
      if (!webhookUrl) {
        return res.status(500).json({ error: "Webhook not configured" });
      }

      const body = await new Promise((resolve) => {
        let data = "";
        req.on("data", chunk => data += chunk);
        req.on("end", () => resolve(data));
      });

      const forward = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body
      });

      const text = await forward.text();
      return res.status(200).send(text);
    }

    res.setHeader("Allow", "POST");
    res.status(405).end("Method Not Allowed");
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}
