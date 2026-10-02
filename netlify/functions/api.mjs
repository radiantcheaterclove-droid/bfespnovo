import { getStore } from "@netlify/blobs";
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const cl = (v, n) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);
const key = (p) => p + String(Date.now()).padStart(15, "0") + "-" + Math.random().toString(36).slice(2, 6);
export default async (req) => {
  const store = getStore({ name: "bfesp", consistency: "strong" });
  const u = new URL(req.url), p = u.pathname.replace(/^\/api\//, "");
  const post = req.method === "POST", b = post ? await req.json().catch(() => ({})) : {};
  const all = async (pre, after) => {
    let ks = (await store.list({ prefix: pre })).blobs.map((x) => x.key).sort();
    if (after !== undefined) ks = after ? ks.filter((k) => k > after) : ks.slice(-80);
    return Promise.all(ks.map((k) => store.get(k, { type: "json" })));
  };
  if (p === "img") {
    const d = await store.get("i/" + (u.searchParams.get("id") || ""));
    if (!d) return J({ error: "not found" }, 404);
    return new Response(Buffer.from(d.split(",")[1], "base64"), { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=31536000, immutable" } });
  }
  // ===== TRANSMISSÃO DE TELA (sinalização WebRTC) =====
  const FRESH = 90000, ID = /^[\w-]{1,40}$/;
  const liveNow = async () => { const l = await store.get("s/live", { type: "json" }); return l && Date.now() - l.hb < FRESH ? l : null; };
  const auth = async (name, tok) => { if (!name || !tok) return false; const a = await store.get("n/" + encodeURIComponent(name.toLowerCase()), { type: "json" }); return !!a && a.token === tok; };
  const wipeSignals = async () => { const ks = (await store.list({ prefix: "g/" })).blobs; await Promise.all(ks.map((x) => store.delete(x.key))); };
  if (p === "stream" && !post) {
    const l = await liveNow();
    const ice = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];
    if (process.env.TURN_URL) ice.push({ urls: process.env.TURN_URL.split(",").map((s) => s.trim()), username: process.env.TURN_USER || "", credential: process.env.TURN_PASS || "" });
    return J({ live: l ? { sid: l.sid, name: l.name, since: l.since, v: l.v || [] } : null, ice });
  }
  if (p === "stream/start" && post) {
    const name = cl(b.name, 24), tok = cl(b.token, 60);
    if (!(await auth(name, tok))) return J({ error: "Registre seu nome primeiro" }, 403);
    const cur = await liveNow();
    if (cur && cur.name.toLowerCase() !== name.toLowerCase()) return J({ error: cur.name + " já está transmitindo" }, 409);
    await wipeSignals();
    const l = { sid: Math.random().toString(36).slice(2, 10) + Date.now().toString(36), name, tok, since: Date.now(), hb: Date.now(), v: [] };
    await store.setJSON("s/live", l);
    return J({ sid: l.sid });
  }
  if (p === "stream/hb" && post) {
    const l = await liveNow();
    if (!l || l.sid !== cl(b.sid, 40) || l.tok !== cl(b.token, 60)) return J({ error: "encerrada" }, 410);
    l.hb = Date.now(); l.v = Array.isArray(b.v) ? b.v.slice(0, 12).map((x) => cl(x, 24)) : [];
    await store.setJSON("s/live", l);
    return J({ ok: true });
  }
  if (p === "stream/stop" && post) {
    const l = await store.get("s/live", { type: "json" });
    if (l && l.sid === cl(b.sid, 40) && l.tok === cl(b.token, 60)) { await store.delete("s/live"); await wipeSignals(); }
    return J({ ok: true });
  }
  if (p === "sig" && !post) {
    const sid = u.searchParams.get("sid") || "", to = u.searchParams.get("to") || "";
    if (!ID.test(sid) || !ID.test(to)) return J({ error: "inválido" }, 400);
    const l = await liveNow();
    if (!l || l.sid !== sid) return J({ error: "encerrada" }, 410);
    const ks = (await store.list({ prefix: `g/${sid}/${to}/` })).blobs.map((x) => x.key).sort();
    const out = await Promise.all(ks.map(async (k) => { const v = await store.get(k, { type: "json" }); await store.delete(k); return v; }));
    return J(out.filter(Boolean));
  }
  if (p === "sig" && post) {
    const sid = String(b.sid || ""), to = String(b.to || ""), from = String(b.from || ""), type = cl(b.type, 10);
    if (!ID.test(sid) || !ID.test(to) || !ID.test(from) || !["join", "leave", "offer", "answer", "ice", "full"].includes(type)) return J({ error: "inválido" }, 400);
    if (JSON.stringify(b.data || {}).length > 30000) return J({ error: "grande demais" }, 400);
    const l = await liveNow();
    if (!l || l.sid !== sid) return J({ error: "A transmissão terminou" }, 410);
    let data = b.data || {};
    if (type === "join") {
      const name = cl(b.name, 24);
      if (!(await auth(name, cl(b.token, 60)))) return J({ error: "Registre seu nome primeiro" }, 403);
      data = { name };
    }
    await store.setJSON(`g/${sid}/${to}/` + String(Date.now()).padStart(15, "0") + "-" + Math.random().toString(36).slice(2, 6), { from, type, data });
    return J({ ok: true });
  }
  if (p === "chat") {
    if (!post) return J(await all("m/", u.searchParams.get("after") || ""));
    const name = cl(b.name, 24), text = cl(b.text, 400);
    const img = typeof b.img === "string" && b.img.length < 700000 && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(b.img) ? b.img : "";
    if (!name || (!text && !img)) return J({ error: "vazio" }, 400);
    const m = { id: key("m/"), cid: cl(b.cid, 40), name, text, ts: Date.now() };
    if (img) { await store.set("i/" + m.id, img); m.img = "/api/img?id=" + encodeURIComponent(m.id); }
    await store.setJSON(m.id, m);
    return J(m);
  }
  if (p === "delete" && post) {
    const id = cl(b.id, 80), name = cl(b.name, 24), tok = cl(b.token, 60);
    const isMsg = id.startsWith("m/");
    if ((!isMsg && !id.startsWith("b/")) || !name || !tok) return J({ error: "inválido" }, 400);
    const acc = await store.get("n/" + encodeURIComponent(name.toLowerCase()), { type: "json" });
    if (!acc || acc.token !== tok) return J({ error: "Sem permissão" }, 403);
    const m = await store.get(id, { type: "json" });
    if (!m) return J({ ok: true });
    const owner = isMsg ? m.name : m.by;
    if (String(owner).toLowerCase() !== name.toLowerCase()) return J({ error: isMsg ? "Você só pode apagar a sua própria mensagem" : "Só quem adicionou pode remover da blacklist" }, 403);
    await store.delete(id);
    if (!isMsg) return J({ ok: true });
    if (m.img) await store.delete("i/" + id);
    const now = Date.now();
    await store.set("x/" + String(now).padStart(15, "0") + "|" + id, "1");
    const old = (await store.list({ prefix: "x/" })).blobs.map((x) => x.key).filter((k) => k < "x/" + String(now - 864e5).padStart(15, "0"));
    await Promise.all(old.map((k) => store.delete(k)));
    return J({ ok: true });
  }
  if (p === "deleted") {
    const after = u.searchParams.get("after") || "";
    let ks = (await store.list({ prefix: "x/" })).blobs.map((x) => x.key).sort();
    const cursor = ks.length ? ks[ks.length - 1] : "";
    ks = after ? ks.filter((k) => k > after) : ks.slice(-200);
    return J({ ids: ks.map((k) => k.slice(k.indexOf("|") + 1)), cursor });
  }
  if (p === "blacklist") {
    if (!post) return J(await all("b/"));
    const name = cl(b.name, 60), reason = cl(b.reason, 300), by = cl(b.by, 24);
    if (!name || !reason || !by) return J({ error: "vazio" }, 400);
    const e = { id: key("b/"), name, reason, by, ts: Date.now() };
    await store.setJSON(e.id, e);
    return J(e);
  }
  if (p === "name" && post) {
    const name = cl(b.name, 24), tok = cl(b.token, 60);
    if (name.length < 2 || !tok) return J({ error: "nome inválido" }, 400);
    const k = "n/" + encodeURIComponent(name.toLowerCase()), cur = await store.get(k, { type: "json" });
    if (cur && cur.token !== tok) return J({ error: "Esse nome já está em uso" }, 409);
    if (!cur) await store.setJSON(k, { name, token: tok, ts: Date.now() });
    return J({ ok: true, name });
  }
  return J({ error: "not found" }, 404);
};
export const config = { path: "/api/*" };
