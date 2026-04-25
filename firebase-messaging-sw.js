const CACHE_NAME = 'ep-portal-cache-v8';
const ASSETS_TO_CACHE = [
  '/mon-dossier.html',
  '/mon-dossier-v10.html',
  '/manifest.json',
  '/pwa-icon-512.png',
  '/pwa-icon-192.png'
];

// 1. FIREBASE MESSAGING
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCPtTKjhtrNoRdED5xp-HuSS11PW8J1D1k",
  authDomain: "evanpatruno-pwa.firebaseapp.com",
  projectId: "evanpatruno-pwa",
  storageBucket: "evanpatruno-pwa.firebasestorage.app",
  messagingSenderId: "873208257496",
  appId: "1:873208257496:web:7cf7ff8eb863bc7029b0ad"
});

const messaging = firebase.messaging();

// Intercepteur universel de messages (Arrière-plan)
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Message reçu:', payload);
});

// Gérer le clic sur la notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});

// 2. CACHE LOGIC
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // On tente de tout cacher, mais on ne bloque pas si un fichier échoue
      return Promise.all(ASSETS_TO_CACHE.map(url => {
        return cache.add(url).catch(err => console.warn(`[SW] Failed to cache ${url}:`, err));
      }));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k))))
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('fcm') || event.request.url.includes('googleapis')) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
