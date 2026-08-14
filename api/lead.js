// Vercel serverless function: receives the form POST and relays the lead
// to the SmileOx intake address via SMTP2go (server-side, TLS enforced).
//
// Required environment variable (Vercel > Project > Settings > Environment Variables):
//   SMTP2GO_API_KEY = your SMTP2go API key
// Optional:
//   LEAD_SENDER     = verified sender address (default no-reply@belladental.com.au)

const SMILEOX_INTAKE =
  "free-veneers-consultation+40dfb2a5-b291-47a4-8c60-3a1f9d5ed63e@intake.smileox.com.au";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const apiKey = process.env.SMTP2GO_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: "Server not configured" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const { firstName, lastName, email, phoneNumber, treatment, source, pageUrl } = body || {};

  if (!firstName || !lastName || !email || !phoneNumber) {
    return res.status(400).json({ ok: false, error: "Missing required fields" });
  }

  const payload = {
    firstName: String(firstName).slice(0, 100),
    lastName: String(lastName).slice(0, 100),
    email: String(email).slice(0, 200),
    phoneNumber: String(phoneNumber).slice(0, 30),
    treatment: String(treatment || "").slice(0, 100),
    source: String(source || "Veneers Landing Page").slice(0, 100),
    pageUrl: String(pageUrl || "").slice(0, 300),
  };

  try {
    const r = await fetch("https://api.smtp2go.com/v3/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        sender: process.env.LEAD_SENDER || "no-reply@belladental.com.au",
        to: [SMILEOX_INTAKE],
        subject: "Website form submission",
        text_body: JSON.stringify(payload),
      }),
    });
    const data = await r.json();
    if (!r.ok || !data || !data.data || data.data.succeeded < 1) {
      console.error("SMTP2go send failed", data);
      return res.status(502).json({ ok: false, error: "Send failed" });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Lead relay error", err);
    return res.status(500).json({ ok: false, error: "Send failed" });
  }
}
