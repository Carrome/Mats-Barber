// Mats Flex – service worker (app shell + cache em tempo de execução)
// A lista de arquivos (marcador ARQUIVOS) e o nome do cache são preenchidos no build pelo vite.config.js
const CACHE = "matts-flex-1790388498666";
const SHELL = [...new Set(["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./assets/react-W1izUqcL.js", "./assets/icones-DI12UFNI.js", "./assets/graficos-CIzlkYQ6.js", "./assets/index-C2TT2eqq.js", "./icons/apple-touch-icon.png", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./icons/logo-grande.png", "./icons/logo.png"])];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // cada arquivo é salvo separado: um erro isolado não impede o app de funcionar offline
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch((err) => console.warn("SW: não salvou", u, err)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("matts-flex") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Rede com limite de tempo: internet fraca não deixa o app travado abrindo
const comTempo = (p, ms) => new Promise((ok, erro) => {
  const t = setTimeout(() => erro(new Error("tempo")), ms);
  p.then((r) => { clearTimeout(t); ok(r); }, (e) => { clearTimeout(t); erro(e); });
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || !req.url.startsWith("http")) return;
  // Navegação: tenta a rede (até 3,5 s), cai para o app salvo
  if (req.mode === "navigate") {
    e.respondWith(
      comTempo(fetch(req), 3500)
        .then((res) => {
          if (res && res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put("./index.html", copia)); }
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }
  // Arquivos (JS, CSS, ícones, fontes): cache primeiro, atualiza em segundo plano
  e.respondWith(
    caches.match(req).then((hit) => {
      const rede = fetch(req).then((res) => {
        if (res && (res.ok || res.type === "opaque")) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return res;
      }).catch(() => hit);
      return hit || rede;
    })
  );
});
