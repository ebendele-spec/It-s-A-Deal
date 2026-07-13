# It's a Deal! — MHSRV Deal Sheet

Online fillable version of the MHS "It's a Deal!" worksheet, with instant
stock-number lookup from the NetSource inventory export.

## What's in this folder

| File | Purpose | Deploy? |
|---|---|---|
| `index.html` | The deal sheet itself | Yes |
| `inventory.js` | Stock lookup data (1,224 units, generated July 11, 2026) | Yes |
| `update-inventory.py` | Regenerates inventory.js from a new CSV | No — keep locally |
| `email-worker.js` | Cloudflare Worker that sends the emailed PDFs | No — deploy to Cloudflare |
| `EMAIL-SETUP.md` | One-time setup for real email sending | No — keep locally |
| `README.md` | This file | Optional |

`index.html` and `inventory.js` must sit in the same folder.

## Deploying / updating (GitHub Desktop)

1. Copy `index.html` and `inventory.js` into your local repo folder,
   replacing the old files.
2. GitHub Desktop shows the changes → write a summary → **Commit to main**.
3. **Push origin**. GitHub Pages redeploys in about a minute.

## Refreshing inventory (do this whenever stock/prices change)

1. Get a fresh NetSource Media CSV export.
2. In a terminal, from this folder:
   `python3 update-inventory.py path/to/new_export.csv`
3. Commit & push the new `inventory.js` (step above).

Or skip the terminal: upload the new CSV to Claude and ask it to regenerate
`inventory.js` for the deal sheet.

The lookup message on the form always shows the inventory date, so salespeople
can tell how fresh the data is.

## How the lookup behaves

- Stock numbers are case-insensitive; typing just the digits (e.g. `44361`)
  also matches `MHS44361`.
- A hit fills Description, Sales Price, Amount of Deposit (via the tier
  formula), and Last 8 of VIN (when the export has it). All stay editable.
  Miles is always entered by hand.
- Deposit tiers: under $100k → $2,000 · $100–199,999 → $3,000 ·
  $200–399,999 → $4,000 · $400k+ → $5,000. Typing a price manually also
  recalculates the deposit.
- A miss shows the inventory date and says to fill fields manually — usually
  means the unit sold or arrived after the last refresh.

## Notes

- **Email PDF button**: builds a PDF of the filled sheet in the browser and
  emails it with the PDF attached to one or more addresses (comma-separated,
  up to 8 per send), sent from elisha@mhsrv.com — once the send service is
  connected (one-time setup: see EMAIL-SETUP.md, deploy email-worker.js).
  If a send fails, an error message says why and nothing is sent. The card
  number is always masked to its last 4 digits in the generated PDF.
  Requires internet (the PDF library loads from a CDN on first use).
- The dealer **Cost** column is never read or written by the generator.
- Nothing typed into the form is transmitted anywhere unless you use Email
  PDF; the CC# field otherwise exists only so it appears on the printed page.
- **Print / Save PDF and Email PDF produce the same vector PDF** (drawn from
  the form data, identical on every device). The printed office copy shows the
  full card number for the deal jacket; the emailed copy masks it to last 4.
  Print opens the PDF in a new tab with the print dialog; if the browser
  blocks the popup, the PDF downloads instead.
- **Front/Back of ID Photo buttons** (phones/tablets only, next to Scan ID for
  Buyer and Co-Buyer): opens a guided in-page camera with a license-shaped
  gold frame — fit the card in the frame, tap the shutter, and the photo is
  cropped exactly to the frame, deterministically, on every device. Compressed
  to ~1600px JPEG. If the camera is blocked, it falls back to the native
  camera with a conservative auto-crop. Captured photos are appended as
  labeled extra pages to both printed and emailed PDFs.
- **Scan ID buttons** (phones/tablets only): scan the PDF417 barcode on the
  BACK of a driver's license to fill the buyer or co-buyer's full legal name
  and address. Decoding happens entirely on the device — no photo or data is
  uploaded. Needs HTTPS (GitHub Pages provides it) and camera permission.
  The scanner library loads from a CDN on first use.
- Address autocomplete uses OpenStreetMap (free, no key). Date auto-fills on
  load. Print with browser headers/footers turned off for a clean one-pager.
