// arede.online · SITE INSTALÁVEL E AVISOS NO CELULAR (21/11/2026, Amanda)
// 1. Guarda a casca do site (a página e as partes /a/ da versão em uso) para abrir sem internet. As notícias já ficam guardadas no aparelho.
//    Nada de fora do site é guardado aqui (servidor, imagens das fontes, vídeos): só o que é de arede.online.
// 2. Recebe os avisos do celular (cifrados pelo servidor) e abre a rede no lugar certo ao tocar.
const CASCA = "arede-casca-1";
const PARTES = /^\/a\/[\w.-]+$/;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CASCA).then((c) => c.add("/")).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CASCA) await caches.delete(k);
    await self.clients.claim();
  })());
});

// guarda a página nova e tira as partes de versões antigas (só fica o que a página em uso pede)
async function guardaPagina(res) {
  const c = await caches.open(CASCA);
  const html = await res.clone().text();
  await c.put("/", res);
  const usadas = new Set([...html.matchAll(/\/a\/[\w.-]+/g)].map((m) => m[0]));
  for (const req of await c.keys()) { const p = new URL(req.url).pathname; if (PARTES.test(p) && !usadas.has(p)) await c.delete(req); }
}

self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) return;
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).then((res) => { if (res.ok && res.type === "basic") e.waitUntil(guardaPagina(res.clone())); return res; })
      .catch(async () => (await caches.match("/")) || Response.error()));
    return;
  }
  if (PARTES.test(u.pathname)) {
    e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => {
      if (res.ok) { const cp = res.clone(); e.waitUntil(caches.open(CASCA).then((c) => c.put(r, cp))); }
      return res;
    })));
  }
});

// aviso que chega do servidor: só texto curto e um endereço interno da rede
const LINK = /^#[\w./@=-]{1,200}$/;
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = {}; }
  const texto = String(d.t || "Você tem um aviso novo.").slice(0, 160);
  const link = LINK.test(d.l || "") ? d.l : "#notificacoes";
  e.waitUntil(self.registration.showNotification("arede.online", {
    body: texto, icon: "/marca/icone-192.png", badge: "/marca/icone-aviso-96.png", tag: link, lang: "pt-BR", data: { link } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const link = (e.notification.data && LINK.test(e.notification.data.link || "")) ? e.notification.data.link : "#notificacoes";
  e.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of janelas) {
      if (new URL(w.url).origin === self.location.origin) { w.postMessage({ ir: link }); return w.focus(); }
    }
    return self.clients.openWindow("/" + link);
  })());
});
