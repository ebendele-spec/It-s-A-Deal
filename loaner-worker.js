/**
 * MHS Loaner Vehicle — shared record store (Cloudflare Worker + KV)
 * ------------------------------------------------------------------
 * Lets every device see the same "vehicles out" list. The loaner page
 * POSTs its pending changes (check-outs, check-ins, deletes) and gets
 * back everything that changed since its last sync.
 *
 * Receives  POST JSON: { token, since, ops:[{op:'put',rec}|{op:'del',id}] }
 * Returns        JSON: { now, ids:[all record ids], records:[changed records] }
 *
 * SETUP (full walkthrough in LOANER-SETUP.md):
 *   1. Create a KV namespace named  mhs-loaner .
 *   2. Paste this file into a new Cloudflare Worker (mhs-loaner-sync).
 *   3. Bind the namespace to the Worker as variable  LOANER_KV .
 *   4. Deploy, copy the Worker URL into SYNC_ENDPOINT in loaner.html.
 */

// Only these websites may use this Worker:
const ALLOWED_ORIGINS = [
  "https://ebendele-spec.github.io",
  "https://mhsrv.app",
  "https://www.mhsrv.app",
];

// Must match SYNC_TOKEN in loaner.html.
const AUTH = atob("bG9hbmVyU3luYzUxNTB1bmxvY2s=");

const MAX_OPS = 50;            // changes accepted per sync
const MAX_REC_BYTES = 16384;   // per-record cap — records are tiny text-only

// The ONLY fields ever stored. Photos, signatures, addresses, phone
// numbers etc. are stripped here even if a client sends them.
const ALLOWED_FIELDS = ["id", "status", "vehicle", "vin", "dateOut", "borrower", "dateIn"];

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST")    return json({ error: "POST only" }, 405, cors);
    if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: "Origin not allowed" }, 403, cors);
    if (!env.LOANER_KV) return json({ error: "Worker is missing the LOANER_KV KV binding" }, 500, cors);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: "Body must be JSON" }, 400, cors); }
    if (String(body.token || "") !== AUTH) return json({ error: "Bad token" }, 403, cors);

    // ---- Apply this device's pending changes ----
    const ops = Array.isArray(body.ops) ? body.ops.slice(0, MAX_OPS) : [];
    for (const op of ops) {
      if (!op) continue;
      if (op.op === "put" && op.rec && op.rec.id != null) {
        const id = cleanId(op.rec.id);
        if (!id) continue;
        const rec = {};
        for (const f of ALLOWED_FIELDS) {
          if (op.rec[f] != null) rec[f] = String(op.rec[f]).slice(0, 200);
        }
        const s = JSON.stringify(rec);
        if (s.length > MAX_REC_BYTES) continue;
        await env.LOANER_KV.put("rec:" + id, s, { metadata: { u: Date.now() } });
      } else if (op.op === "del" && op.id != null) {
        const id = cleanId(op.id);
        if (id) await env.LOANER_KV.delete("rec:" + id);
      }
    }

    // ---- Return every id (so deletes propagate) + records changed since last sync ----
    const since = Number(body.since) || 0;
    const ids = [], records = [];
    let cursor;
    do {
      const page = await env.LOANER_KV.list({ prefix: "rec:", cursor });
      for (const k of page.keys) {
        ids.push(k.name.slice(4));
        const u = k.metadata && k.metadata.u;
        if (!u || u > since) {
          const v = await env.LOANER_KV.get(k.name);
          if (v) { try { records.push(JSON.parse(v)); } catch {} }
        }
      }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);

    return json({ now: Date.now(), ids, records }, 200, cors);
  },
};

// ---------- helpers ----------
function cleanId(id) {
  return String(id).replace(/[^\w.\-]/g, "").slice(0, 40);
}
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
