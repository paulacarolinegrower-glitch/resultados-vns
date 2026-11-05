/* Resultados VNS – service worker (instalação como app e funcionamento offline da interface)
   Ao publicar uma nova versão do app, aumente o número em VERSAO. */
const VERSAO = "vns-v1";
const ARQUIVOS = [
  "./", "index.html", "css/app.css", "manifest.webmanifest",
  "js/config.js", "js/dados.js", "js/nematoides.js", "js/biologica.js", "js/foliar.js", "js/graos.js", "js/app.js",
  "icons/icon-192.png", "icons/icon-512.png"
];
const CDNS = ["cdn.jsdelivr.net", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  /* Dados do Supabase nunca ficam em cache */
  if (url.hostname.endsWith("supabase.co")) return;
  if (url.origin === location.origin){
    /* Arquivos do app: tenta a rede primeiro (pega atualizações) e usa o cache se estiver offline */
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(VERSAO).then(x => x.put(req, c)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match("index.html"))));
  } else if (CDNS.includes(url.hostname)){
    /* Bibliotecas e fontes com versão fixa: cache primeiro */
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const c = res.clone(); caches.open(VERSAO).then(x => x.put(req, c)); return res; })));
  }
});
