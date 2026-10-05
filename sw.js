/* ============================================================
   Service Worker — Guru Berbagi Selogiri
   Version: 4.90 (offline-first)
   ============================================================ */

const CACHE = 'gb-cache-v4.90';
const RUNTIME = 'gb-runtime-v4.90';

/* File yang di-cache saat install */
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './assetlinks.json',
  'https://cdn.jsdelivr.net/gh/slg-timkreatif/app@main/1768315347206.png'
];

/* ============================================================
   HELPER — fetch with timeout (cegah nunggu lama)
   ============================================================ */
function fetchWithTimeout(req, ms) {
  return Promise.race([
    fetch(req),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
  ]);
}

/* ============================================================
   INSTALL
   ============================================================ */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
    .then(c => Promise.allSettled(SHELL.map(u => c.add(u).catch(() => null))))
    // JANGAN skipWaiting otomatis — tunggu user klik "Muat Ulang"
    // supaya tidak ada state mismatch mid-session
  );
});

/* ============================================================
   ACTIVATE
   ============================================================ */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
    .then(keys => Promise.all(
      keys.filter(k => k !== CACHE && k !== RUNTIME).map(k => caches.delete(k))
    ))
    .then(() => self.clients.claim())
  );
});

/* ============================================================
   FETCH — Strategi per jenis request
   ============================================================ */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  
  /* 1. Supabase API
     - Auth & Functions → network only (perlu fresh untuk keamanan)
     - REST/Storage GET → StaleWhileRevalidate (data lama tampil offline)
     - REST write (POST/PUT/DELETE/PATCH) → network only (queue di app.js) */
  if (url.hostname.endsWith('supabase.co')) {
    // Auth endpoints — selalu network (token, session)
    if (url.pathname.startsWith('/auth/')) return;
    // Edge Functions — selalu network (login, verify, ult)
    if (url.pathname.startsWith('/functions/')) return;
    // Realtime (WebSocket via HTTP upgrade) — network only
    if (url.pathname.startsWith('/realtime/')) return;
    // Write operations — network only (app.js yang handle queue)
    if (req.method !== 'GET') return;
    
    // GET REST/Storage → StaleWhileRevalidate
    e.respondWith(
      caches.open(RUNTIME).then(c =>
        c.match(req).then(cached => {
          const net = fetch(req)
            .then(res => {
              if (res && res.status === 200) c.put(req, res.clone());
              return res;
            })
            .catch(() => cached);
          return cached || net;
        })
      )
    );
    return;
  }
  
  /* 2. Navigasi HTML → network first, cache fallback */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const idx = await caches.match('./index.html');
        if (idx) return idx;
        const cr = await caches.match('./creative.html');
        if (cr) return cr;
        return caches.match('./');
      })
    );
    return;
  }
  
  /* 3. Aset cross-origin (CDN, fonts, icon) → cache first, network fallback (timeout 3s) */
  if (url.origin !== location.origin) {
    e.respondWith(
      caches.open(RUNTIME).then(c =>
        c.match(req).then(cached => {
          const net = fetchWithTimeout(req, 3000)
            .then(res => {
              if (res && (res.ok || res.type === 'opaque')) {
                c.put(req, res.clone());
              }
              return res;
            })
            .catch(() => cached);
          return cached || net;
        })
      )
    );
    return;
  }
  
  /* 4. Aset same-origin (CSS, JS lokal, gambar) → cache first */
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(RUNTIME).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});

/* ============================================================
   BACKGROUND SYNC — offline queue
   ============================================================ */
self.addEventListener('sync', event => {
  if (event.tag === 'gb-sync-offline') {
    event.waitUntil((async () => {
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      clients.forEach(c => c.postMessage({ type: 'FLUSH_OFFLINE_QUEUE' }));
    })());
  }
});

/* ============================================================
   MESSAGE — komunikasi dari halaman
   ============================================================ */
self.addEventListener('message', event => {
  const data = event.data || {};
  
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  
  if (data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(keys =>
        Promise.all(keys.map(k => caches.delete(k)))
      ).then(() => {
        event.source?.postMessage({ type: 'CACHE_CLEARED' });
      })
    );
    return;
  }
});

/* ============================================================
   NOTIFICATION — handler push (persiapan)
   ============================================================ */
self.addEventListener('push', event => {
  let data = { title: 'Guru Berbagi', body: 'Ada informasi baru', url: '/' };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch (e) {}
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'https://cdn.jsdelivr.net/gh/slg-timkreatif/app@main/1768315347206.png',
      badge: 'https://cdn.jsdelivr.net/gh/slg-timkreatif/app@main/1768315347206.png',
      data: { url: data.url || '/' },
      vibrate: [100, 50, 100]
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(list => {
      for (const c of list) {
        if (c.url.includes(target) && 'focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
