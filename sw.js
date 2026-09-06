// Service worker: приложение открывается мгновенно и работает офлайн,
// а сводка (digest.json) всегда берётся свежая из сети, если сеть есть.
// ВАЖНО: при любом изменении index.html / config.js / иконок — увеличить номер версии,
// иначе на телефоне останется закэшированная старая версия приложения.
const SHELL_CACHE = "svodka-shell-v6";
const DATA_CACHE = "svodka-data-v6";
const SHELL = ["./", "./index.html", "./config.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => ![SHELL_CACHE, DATA_CACHE].includes(k)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.endsWith("/digest.json")) {
    // сводка: сначала сеть, при её отсутствии — последняя сохранённая копия
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((resp) => {
          const copy = resp.clone();
          caches.open(DATA_CACHE).then((c) => c.put("./digest.json", copy));
          return resp;
        })
        .catch(() => caches.match("./digest.json"))
    );
    return;
  }

  // оболочка приложения: из кэша, с фоновым обновлением
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      const network = fetch(event.request)
        .then((resp) => {
          if (resp.ok) caches.open(SHELL_CACHE).then((c) => c.put(event.request, resp.clone()));
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
