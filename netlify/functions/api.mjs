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
