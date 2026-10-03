import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual } from "node:crypto";
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const cl = (v, n) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);
const pad = () => String(Date.now()).padStart(15, "0");
export default async (req) => {
  const store = getStore({ name: "bfesp", consistency: "strong" });
  const p = new URL(req.url).pathname.replace(/^\/adm\//, "");
  if (p === "list") {
    const ks = (await store.list({ prefix: "adm/" })).blobs.map((x) => decodeURIComponent(x.key.slice(4)));
    return J({ names: ks });
  }
  if (req.method !== "POST") return J({ error: "not found" }, 404);
  const b = await req.json().catch(() => ({}));
  const name = cl(b.name, 24), tok = cl(b.token, 60);
  const acc = name && tok ? await store.get("n/" + encodeURIComponent(name.toLowerCase()), { type: "json" }) : null;
  if (!acc || acc.token !== tok) return J({ error: "Registre seu nome primeiro" }, 403);
  const ak = "adm/" + encodeURIComponent(name.toLowerCase());
  const isAdm = !!(await store.get(ak, { type: "json" }));
  if (p === "me") return J({ admin: isAdm });
  if (p === "login") {
    const PASS = process.env.ADMIN_PASS;
    if (!PASS) return J({ error: "A senha ADMIN_PASS ainda não foi configurada no Netlify" }, 500);
    if (isAdm) return J({ admin: true });
    const fk = "af/" + encodeURIComponent(name.toLowerCase());
    const f = (await store.get(fk, { type: "json" })) || { c: 0, t: 0 };
    const recent = Date.now() - f.t < 900000;
    if (recent && f.c >= 5) return J({ error: "Muitas tentativas. Tente de novo em 15 minutos." }, 429);
    const h = (s) => createHash("sha256").update(String(s)).digest();
    if (!timingSafeEqual(h(b.pass || ""), h(PASS))) {
      await store.setJSON(fk, { c: (recent ? f.c : 0) + 1, t: Date.now() });
      return J({ error: "Senha incorreta" }, 403);
    }
    await store.setJSON(ak, { name: acc.name, ts: Date.now() });
    await store.delete(fk);
    return J({ admin: true });
  }
  if (!isAdm) return J({ error: "Sem permissão" }, 403);
  if (p === "log") {
    const ks = (await store.list({ prefix: "lg/" })).blobs.map((x) => x.key).sort().slice(-60).reverse();
    return J(await Promise.all(ks.map((k) => store.get(k, { type: "json" }))));
  }
  if (p === "del") {
    const id = cl(b.id, 80), isMsg = id.startsWith("m/");
    if (!isMsg && !id.startsWith("b/")) return J({ error: "inválido" }, 400);
    const m = await store.get(id, { type: "json" });
    if (!m) return J({ ok: true });
    await store.delete(id);
    if (isMsg) {
      if (m.img) await store.delete("i/" + id);
      const x = /^\[\[vid:([\w-]{1,40})\]\]$/.exec(m.text || "");
      if (x) {
        const ks = (await store.list({ prefix: `v/${x[1]}/` })).blobs;
        await Promise.all(ks.map((k) => store.delete(k.key)));
        await store.delete("vm/" + x[1]);
      }
      await store.set("x/" + pad() + "|" + id, "1");
    }
    await store.setJSON("lg/" + pad() + "-" + Math.random().toString(36).slice(2, 6), {
      by: acc.name, kind: isMsg ? "mensagem" : "blacklist", owner: isMsg ? m.name : m.by,
      text: isMsg ? (m.text || (m.img ? "[imagem]" : "")) : m.name + " — " + m.reason, ts: Date.now(),
    });
    return J({ ok: true });
  }
  return J({ error: "not found" }, 404);
};
export const config = { path: "/adm/*" };
