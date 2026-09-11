/* Service Worker — Guru Berbagi Selogiri */
const CACHE = 'gb-cache-v4.37';
const SHELL = [
  './',
  './index.html',
  './creative.html',
  './manifest.json',
  'https://raw.githubusercontent.com/slg-timkreatif/app/refs/heads/main/1768315347206.png'
];

/* INSTALL: precache app-shell (toleran bila ada yang gagal) */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

/* ACTIVATE: buang cache versi lama, ambil kendali tab */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;               // POST/PUT (login, insert) selalu network
  const url = new URL(req.url);

  /* 1) NAVIGASI: network-first → fallback offline ke shell index.html */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(async () => {
          const m = await caches.match(req);
          if (m) return m;
          const i = await caches.match('./index.html');
          if (i) return i;
          return caches.match('./');
        })
    );
    return;
  }

  /* 2) API SUPABASE: network-only (data dinamis, jangan stale) */
  if (url.hostname.endsWith('supabase.co')) return;

  /* 3) CROSS-ORIGIN STATIS (CDN Tailwind/Lucide/font, gambar): stale-while-revalidate */
  if (url.origin !== location.origin) {
    e.respondWith(
      caches.open(CACHE).then(c =>
        c.match(req).then(cached => {
          const network = fetch(req)
            .then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  /* 4) SAME-ORIGIN (index/creative/aset lokal): cache-first */
  e.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      })
    )
  );
});