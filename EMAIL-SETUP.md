# Email-with-attachment Setup — SendGrid + Cloudflare Worker

Why this exists: free form relays (FormSubmit etc.) deliver text fields but
**strip file attachments**. Actually emailing a PDF requires a real email
service. This setup is free (SendGrid free tier = 100 emails/day) and takes
about 25 minutes, one time.

How it flows once set up:

```
Deal sheet → builds PDF in the browser → your Cloudflare Worker
           → SendGrid → email FROM elisha@mhsrv.com TO the typed
             recipients, PDF attached
```

Until it's set up, the Email PDF button still works: it hands the PDF to
your device's share sheet (on phones, Mail/Gmail opens with it attached),
or downloads it and opens a pre-addressed draft on desktop.

---

## Step 1 — SendGrid account + verified sender

1. Sign up at **signup.sendgrid.com** (free plan).
2. Go to **Settings → Sender Authentication → Verify a Single Sender**.
3. Enter **elisha@mhsrv.com** as the from address (fill in the business
   details), submit, then click the confirmation link that arrives in the
   elisha@mhsrv.com inbox. This is what lets SendGrid send *as* that address —
   no DNS changes needed.
4. Go to **Settings → API Keys → Create API Key**. Name it `mhs-deal-mailer`,
   permission: **Restricted Access → Mail Send: Full Access**. Copy the key
   (starts with `SG.`) — it's shown only once.

## Step 2 — Cloudflare Worker

1. Log in at **dash.cloudflare.com** (free plan is fine).
2. **Workers & Pages → Create → Create Worker** → name it `mhs-deal-mailer`
   → Deploy (it deploys a hello-world first).
3. **Edit code** → delete everything → paste the full contents of
   `email-worker.js` → check `ALLOWED_ORIGINS` at the top (your github.io
   address is pre-listed; add the custom domain when it's live) → **Deploy**.
4. **Settings → Variables and Secrets → Add**: type **Secret**, name
   `SENDGRID_API_KEY` (exactly), value = the `SG.` key from Step 1. Save.

## Step 3 — Connect the website

1. Copy the Worker URL from its overview page —
   `https://mhs-deal-mailer.YOUR-ACCOUNT.workers.dev`.
2. In `index.html`, find (near the bottom, in the script):

   ```js
   const SEND_ENDPOINT = 'PASTE-YOUR-WORKER-URL-HERE';
   ```

   Replace the placeholder with the Worker URL (keep the quotes).
3. Commit & push via GitHub Desktop. Test by emailing a filled sheet to
   yourself — confirm the PDF is attached and the sender is elisha@mhsrv.com.

---

## Troubleshooting

- **"Origin not allowed"** — the site URL isn't in `ALLOWED_ORIGINS` in the
  Worker (exact scheme + host, no trailing slash). Edit and redeploy.
- **"SendGrid returned 401"** — bad/revoked API key; update the secret.
- **"SendGrid returned 403" mentioning sender** — Step 1's single-sender
  verification isn't complete for elisha@mhsrv.com.
- **Mail lands in spam** — likely at first, since only the single sender is
  verified. The fix is **Domain Authentication** in SendGrid (a few DNS
  records on mhsrv.com — same team that handles the custom-domain DNS).
  Worth doing once deal sheets go to customers.
- **Nothing sends, share sheet opens instead** — `SEND_ENDPOINT` is still
  the placeholder, or the Worker call failed (check the browser console).

## Limits & safety

- SendGrid free: 100 emails/day. Cloudflare free: 100k requests/day.
- The Worker only accepts requests from your site's origin and caps
  recipients (8) and PDF size (8 MB).
- The generated PDF always masks the card number to its last 4 digits.
- Optional hardening: Cloudflare → Security → rate-limit the Worker route
  (e.g. 10 requests/minute per IP).
