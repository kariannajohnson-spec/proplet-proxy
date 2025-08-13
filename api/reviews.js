export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).end("Method Not Allowed");
    }
    const webhook = process.env.MAKE_FEEDBACK_WEBHOOK_URL;
    if (!webhook) return res.status(500).json({ error: "Webhook not configured" });

    const body = await new Promise((resolve) => {
      let data = "";
      req.on("data", c => (data += c));
      req.on("end", () => resolve(data));
    });

    const fwd = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });
    const text = await fwd.text();
    return res.status(200).send(text);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error (feedback)" });
  }
}
