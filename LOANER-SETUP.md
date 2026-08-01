# Loaner cross-device sync — Cloudflare Worker + KV

Why this exists: the Loaner Vehicle tool saves its records in each device's
browser storage. Without a shared backend, a vehicle checked out on one phone
is invisible on every other device. This setup gives all devices one shared
record list. It uses the same free Cloudflare account as the email worker and
takes about 5 minutes, one time.

How it flows once set up:

```
loaner.html  →  your Cloudflare Worker (mhs-loaner-sync)  →  Cloudflare KV
   any device that opens the tool pushes its changes and
   pulls everyone else's — check-outs, check-ins, deletes
```

Until it's set up, the tool keeps working the way it does today:
records stay on the device that created them, and the home screen
says so under the New Check-Out button.

---

## Step 1 — KV namespace (the shared storage)

1. Log in at **dash.cloudflare.com**.
2. **Storage & Databases → KV → Create a namespace** → name it `mhs-loaner`
   → Add.

## Step 2 — the Worker

1. **Workers & Pages → Create → Create Worker** → name it `mhs-loaner-sync`
   → Deploy (it deploys a hello-world first).
2. **Edit code** → delete everything → paste the full contents of
   `loaner-worker.js` → **Deploy**.
3. Back on the Worker's page: **Settings → Bindings → Add → KV namespace**
   → Variable name `LOANER_KV` (exactly) → select `mhs-loaner` → Save.
   (Re-deploy if it prompts you.)

## Step 3 — connect the website

1. Copy the Worker URL from its overview page —
   `https://mhs-loaner-sync.YOUR-ACCOUNT.workers.dev`.
2. In `loaner.html`, find (near the top of the script):

   ```js
   var SYNC_ENDPOINT = 'PASTE-YOUR-LOANER-WORKER-URL-HERE';
   ```

   Replace the placeholder with the Worker URL (keep the quotes).
3. Commit & push via GitHub Desktop. After the site redeploys, open the
   loaner tool — the line under New Check-Out should say
   **"✓ Synced across devices"**.
4. Test: check a vehicle out on one device, then open the tool on another —
   it should appear under Vehicles Out within a few seconds (tap ↻ Refresh
   if you don't want to wait for the automatic poll).

---

## How syncing behaves

- Records already saved on a device from before sync was set up are uploaded
  automatically the first time that device opens the tool.
- Every device polls for changes when the page opens, when it comes back to
  the foreground, and once a minute while on the home screen. The ↻ Refresh
  button forces a check.
- Offline is fine: changes queue on the device and push automatically when
  the connection returns; the status line shows this.
- Deleting a record removes it from every device.
- If the same record is edited on two devices at once, the last save wins.

## Troubleshooting

- **"Origin not allowed"** in the browser console — the site URL isn't in
  `ALLOWED_ORIGINS` at the top of the Worker. Edit and redeploy.
- **"Worker is missing the LOANER_KV KV binding"** — Step 2.3 wasn't
  completed, or the variable name isn't exactly `LOANER_KV`.
- **Status stuck on "Offline"** — `SYNC_ENDPOINT` is still the placeholder,
  the Worker URL is wrong, or the device truly has no signal.

## Limits & safety

- Cloudflare free tier: 100k Worker requests/day, 1k KV writes/day,
  100k KV reads/day — far beyond what a loaner desk generates.
- The Worker only accepts requests from your site's origins and requires the
  shared token.
- **Only the minimal record is ever stored in the cloud**: vehicle
  description, VIN/Car #, date out, borrower name, status, and date
  returned. The Worker strips every other field server-side, so license
  photos, signatures, addresses, and phone numbers can never reach KV even
  if a client sends them. The full agreement exists only in the emailed /
  printed PDF at check-out time.
- Heads-up: this repo is public, so the sync token in the source is
  obfuscated, not secret — same posture as the tool logins. The real
  gatekeepers are the origin allowlist and the minimal, low-sensitivity data.
- Delete old returned records from the tool when they're no longer needed.
