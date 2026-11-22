// arede.online · AVISO NO CELULAR (21/11/2026): o padrão dos navegadores (Web Push, RFC 8291 e RFC 8292), só com a criptografia nativa.
// A mensagem vai cifrada para o aparelho: o serviço do navegador (Google, Mozilla, Apple) entrega, mas não consegue ler.
const te = new TextEncoder();
export const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const deB64u = (s: string) => { const t = s.replace(/-/g, "+").replace(/_/g, "/"); const p = t + "===".slice((t.length + 3) % 4); return Uint8Array.from(atob(p), (c) => c.charCodeAt(0)); };
const junta = (...xs: Uint8Array[]) => { const o = new Uint8Array(xs.reduce((a, x) => a + x.length, 0)); let i = 0; for (const x of xs) { o.set(x, i); i += x.length; } return o; };
async function hmac(chave: Uint8Array, dado: Uint8Array) {
  const k = await crypto.subtle.importKey("raw", chave, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, dado));
}

// chaves do servidor (VAPID): geradas uma vez; a privada fica só no banco, em JWK
export async function novasChaves() {
  const par = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", par.privateKey);
  return { publica: b64u(pub), privada: JSON.stringify(jwk) };
}

// assinatura que prova ao serviço do navegador que o aviso vem de arede.online
export async function vapid(endpoint: string, publica: string, privadaJwk: string) {
  const aud = new URL(endpoint).origin;
  const cab = b64u(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const corpo = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:contato@arede.online" })));
  const k = await crypto.subtle.importKey("jwk", JSON.parse(privadaJwk), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const ass = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, k, te.encode(cab + "." + corpo)));
  return `vapid t=${cab}.${corpo}.${b64u(ass)}, k=${publica}`;
}

// cifra a mensagem para um aparelho (aes128gcm)
export async function cifra(p256dh: string, authB64: string, texto: string) {
  const ua = deB64u(p256dh), segredo = deB64u(authB64);
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", ua, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256));
  const prkKey = await hmac(segredo, ecdh);
  const ikm = (await hmac(prkKey, junta(te.encode("WebPush: info\0"), ua, asPub, new Uint8Array([1])))).slice(0, 32);
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(sal, ikm);
  const cek = (await hmac(prk, junta(te.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, junta(te.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
  const k = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const claro = junta(te.encode(texto), new Uint8Array([2]));
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, k, claro));
  const cab = new Uint8Array(21); cab.set(sal, 0); new DataView(cab.buffer).setUint32(16, 4096); cab[20] = asPub.length;
  return junta(cab, asPub, cifrado);
}
