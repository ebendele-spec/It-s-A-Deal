/* It's a Deal — service worker.
   Same-origin: network-first (pushed updates always win), cache fallback offline.
   CDN libraries: cache-first (they're versioned and never change). */
const CACHE = 'iad-v1';
const CORE = ['./', 'index.html', 'inventory.js', 'manifest.webmanifest',
              'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});
self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET') return;
  const sameOrigin = new URL(req.url).origin === location.origin;
  if(sameOrigin){
    e.respondWith(
      fetch(req).then(res=>{
        const copy = res.clone();
        caches.open(CACHE).then(c=>c.put(req, copy));
        return res;
      }).catch(()=>caches.match(req).then(m=>m || caches.match('index.html')))
    );
  }else{
    e.respondWith(
      caches.match(req).then(m=>m || fetch(req).then(res=>{
        const copy = res.clone();
        caches.open(CACHE).then(c=>c.put(req, copy));
        return res;
      }))
    );
  }
});
