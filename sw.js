/* ネットなしで開くための保管係。手書きはここを通らない（iPad の IndexedDB に直接保存する）。
   プログラムを直したら VERSION を上げる。 */
const VERSION = "techo-v1";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) =>
      Promise.all(FILES.map((f) => fetch(f, { cache: "reload" }).then((r) => {
        if (!r.ok) throw new Error(f);
        return c.put(f, r);
      })))
    )
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async (c) => {
      if (req.mode === "navigate") return (await c.match("./")) || fetch(req);
      return (await c.match(req, { ignoreSearch: true })) || fetch(req);
    })
  );
});
