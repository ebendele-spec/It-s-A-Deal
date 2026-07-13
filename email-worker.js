/**
 * MHS Deal Sheet — email sender (Cloudflare Worker)
 * --------------------------------------------------
 * Receives  POST JSON: { to:[emails], subject, filename, pdf(base64), summary{} }
 * Sends     a real email FROM elisha@mhsrv.com TO the recipients,
 *           with the PDF attached, via the SendGrid API.
 *
 * SETUP (full walkthrough in EMAIL-SETUP.md):
 *   1. Edit ALLOWED_ORIGINS and FROM_EMAIL below if needed.
 *   2. Paste this file into a new Cloudflare Worker.
 *   3. Add secret SENDGRID_API_KEY (Settings → Variables and Secrets).
 *   4. Deploy, copy the Worker URL into SEND_ENDPOINT in index.html.
 */

// Only these websites may use this Worker:
const ALLOWED_ORIGINS = [
  "https://ebendele-spec.github.io",
  // "https://deal.mhsrv.com",          // uncomment / edit when the custom domain is live
];

// Must be a verified sender in SendGrid (Single Sender Verification):
const FROM_EMAIL = "elisha@mhsrv.com";
const FROM_NAME  = "MHS Deal Sheet";

const MAX_RECIPIENTS = 8;
const MAX_PDF_BYTES  = 8 * 1024 * 1024; // 8 MB cap (deal sheets are ~0.2–0.5 MB)

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST")    return json({ error: "POST only" }, 405, cors);
    if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: "Origin not allowed" }, 403, cors);
    if (!env.SENDGRID_API_KEY) return json({ error: "Worker is missing the SENDGRID_API_KEY secret" }, 500, cors);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: "Body must be JSON" }, 400, cors); }

    // ---- Validate ----
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const to = Array.isArray(body.to) ? body.to.map(String).map(s => s.trim()).filter(Boolean) : [];
    if (!to.length)                    return json({ error: "No recipients" }, 400, cors);
    if (to.length > MAX_RECIPIENTS)    return json({ error: "Too many recipients (max " + MAX_RECIPIENTS + ")" }, 400, cors);
    const bad = to.filter(e => !emailRe.test(e));
    if (bad.length)                    return json({ error: "Invalid address: " + bad.join(", ") }, 400, cors);

    const pdf = String(body.pdf || "");
    if (!pdf)                          return json({ error: "Missing PDF" }, 400, cors);
    if (pdf.length * 0.75 > MAX_PDF_BYTES) return json({ error: "PDF too large" }, 400, cors);

    const subject  = String(body.subject || "It's a Deal — MHS Deal Sheet").slice(0, 200);
    const filename = (String(body.filename || "Its-A-Deal.pdf").replace(/[^\w.\-]/g, "_")).slice(0, 120);

    const summary = body.summary && typeof body.summary === "object" ? body.summary : {};
    const lines = Object.entries(summary)
      .slice(0, 10)
      .map(([k, v]) => String(k).slice(0, 40) + ": " + String(v).slice(0, 200));
    const text =
      "Deal sheet attached.\n\n" +
      (lines.length ? lines.join("\n") + "\n\n" : "") +
      "Sent from the MHSRV It's a Deal form.";

    // ---- Send via SendGrid ----
    const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + env.SENDGRID_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: to.map(email => ({ email })) }],
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject,
        content: [{ type: "text/plain", value: text }],
        attachments: [{
          content: pdf,
          filename,
          type: "application/pdf",
          disposition: "attachment",
        }],
      }),
    });

    if (sgRes.status === 202) return json({ sent: true }, 200, cors);

    const detail = await sgRes.text().catch(() => "");
    return json({ sent: false, error: "SendGrid returned " + sgRes.status, detail: detail.slice(0, 400) }, 502, cors);
  },
};

// ---------- helpers ----------
function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
