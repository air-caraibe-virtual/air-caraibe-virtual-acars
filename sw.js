// Garde l'appli disponible même avec une connexion faible (les données en direct restent en ligne)
const CACHE = 'acv-mobile-v7';
const SHELL = ['./', 'index.html', 'app.css', 'app.js', 'manifest.webmanifest', 'lib/leaflet.js', 'lib/leaflet.css',
  'img/icon-192.png', 'img/icon-512.png', 'img/apple-touch-icon.png', 'img/photo.jpg'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // données en direct : toujours le réseau
  // Fichiers de l'appli : réseau d'abord (pour avoir la dernière version), cache si hors ligne
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((res) => {
    const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res;
  }).catch(() => caches.match(e.request)));
});
