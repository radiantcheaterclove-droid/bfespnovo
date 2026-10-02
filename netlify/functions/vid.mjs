import { getStore } from "@netlify/blobs";
const CH = 4194304, ID = /^[\w-]{1,40}$/;
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const pad = (n) => String(n).padStart(3, "0");
export default async (req) => {
  const store = getStore({ name: "bfesp", consistency: "strong" });
  const u = new URL(req.url), p = u.pathname.replace(/^\/vid\//, ""), id = u.searchParams.get("id") || "";
  const auth = async (name, tok) => {
    name = String(name || "").slice(0, 24);
    if (!name || !tok) return null;
    const a = await store.get("n/" + encodeURIComponent(name.toLowerCase()), { type: "json" });
    return a && a.token === tok ? a.name : null;
  };
  const hdr = (k) => { try { return decodeURIComponent(req.headers.get(k) || ""); } catch { return ""; } };
  const wipe = async (vid) => {
    const ks = (await store.list({ prefix: `v/${vid}/` })).blobs;
    await Promise.all(ks.map((x) => store.delete(x.key)));
    await store.delete("vm/" + vid);
  };
  if (p === "get") {
    const m = ID.test(id) ? await store.get("vm/" + id, { type: "json" }) : null;
    if (!m) return J({ error: "not found" }, 404);
    const r = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") || "");
    let a = r && r[1] !== "" ? +r[1] : 0, b = r && r[2] !== "" ? +r[2] : m.size - 1;
    if (r && r[1] === "" && r[2] !== "") a = Math.max(0, m.size - +r[2]);
    if (a >= m.size) return new Response(null, { status: 416, headers: { "content-range": `bytes */${m.size}` } });
    const ci = Math.floor(a / CH);
    b = Math.min(b, m.size - 1, (ci + 1) * CH - 1);
    const buf = await store.get(`v/${id}/${pad(ci)}`, { type: "arrayBuffer" });
    if (!buf) return J({ error: "not found" }, 404);
    return new Response(buf.slice(a - ci * CH, b - ci * CH + 1), { status: 206, headers: { "content-type": "video/mp4", "accept-ranges": "bytes", "content-range": `bytes ${a}-${b}/${m.size}`, "cache-control": "public, max-age=31536000, immutable" } });
  }
  if (req.method !== "POST") return J({ error: "not found" }, 404);
  if (p === "del") {
    const b = await req.json().catch(() => ({})), vid = String(b.vid || "");
    const name = await auth(b.name, b.token);
    if (!name || !ID.test(vid)) return J({ error: "inválido" }, 400);
    const m = await store.get("vm/" + vid, { type: "json" });
    if (m && String(m.by).toLowerCase() === name.toLowerCase()) await wipe(vid);
    return J({ ok: true });
  }
  const name = await auth(hdr("x-name"), req.headers.get("x-token"));
  if (!name) return J({ error: "Registre seu nome primeiro" }, 403);
  const n = +u.searchParams.get("n");
  if (p === "up") {
    if (!ID.test(id) || !Number.isInteger(n) || n < 0 || n > 9) return J({ error: "inválido" }, 400);
    const buf = await req.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > CH) return J({ error: "tamanho inválido" }, 400);
    if (n === 0 && (buf.byteLength < 8 || new TextDecoder().decode(new Uint8Array(buf, 4, 4)) !== "ftyp")) return J({ error: "Não é um MP4 válido" }, 400);
    await store.set(`v/${id}/${pad(n)}`, buf);
    return J({ ok: true });
  }
  if (p === "done") {
    const size = +u.searchParams.get("size");
    if (!ID.test(id) || !Number.isInteger(n) || n < 1 || n > 10 || !(size > (n - 1) * CH && size <= n * CH)) return J({ error: "inválido" }, 400);
    const have = (await store.list({ prefix: `v/${id}/` })).blobs.length;
    if (have !== n) return J({ error: "Envio incompleto" }, 400);
    await store.setJSON("vm/" + id, { n, size, by: name, ts: Date.now() });
    return J({ ok: true });
  }
  return J({ error: "not found" }, 404);
};
export const config = { path: "/vid/*" };
