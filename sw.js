// sw.js — Guru Berbagi Selogiri
// v4.37.1 — network-first shell, bypass Supabase, offline fallback

const VERSION       = 'gb-v4.37.1';
const SHELL_CACHE   = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const IMG_CACHE     = `${VERSION}-img`;

// Precache: hanya asset statis yang benar-benar dipakai creative.html
const SHELL_ASSETS = [
  './',
  './creative.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Playfair+Display:wght@600;800&family=Caveat:wght@600;700&display=swap',
  'https://raw.githubusercontent.com/slg-timkreatif/app/refs/heads/main/1768315347206.png'
];

// Domain yang TIDAK BOLEH di-cache (data harus selalu fresh)
const BYPASS_HOSTS = ['qamqqwfzhyiihqyzliwq.supabase.co'];

// ============ INSTALL ============
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // allSettled: 1 gagal tidak membatalkan install
    await Promise.allSettled(
      SHELL_ASSETS.map(url =>
        cache.add(new Request(url, { mode: 'no-cors' })).catch(() => null)
      )
    );
    await self.skipWaiting(); // aktif segera
  })());
});

// ============ ACTIVATE ============
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// ============ FETCH ROUTER ============
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Hanya handle GET
  if (req.method !== 'GET') return;

  // 2. Bypass Supabase (REST / auth / functions)
  if (BYPASS_HOSTS.some(h => url.hostname.includes(h))) return;

  // 3. Navigasi HTML → network-first (update cepat terdeteksi)
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(networkFirst(req, SHELL_CACHE));
    return;
  }

  // 4. Gambar → cache-first
  if (req.destination === 'image') {
    event.respondWith(cacheFirst(req, IMG_CACHE));
    return;
  }

  // 5. Script / style / font → stale-while-revalidate
  if (['script', 'style', 'font'].includes(req.destination)) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
    return;
  }

  // 6. Fallback → SWR
  event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
});

// ============ STRATEGIES ============
async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    const fallback = await cache.match('./creative.html');
    if (fallback) return fallback;
    return new Response(
      '<h1>Offline</h1><p>Koneksi tidak tersedia. Coba lagi nanti.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    return new Response('', { status: 504 });
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetching = fetch(req)
    .then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await fetching) || new Response('', { status: 504 });
}

// ============ MESSAGE (update prompt) ============
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'GET_VERSION' && event.source) {
    event.source.postMessage({ type: 'VERSION', version: VERSION });
  }
});