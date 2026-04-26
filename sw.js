const CACHE_NAME = 'ep-portal-cache-v10';
const ASSETS_TO_CACHE = [
  '/',
  '/mon-dossier.html',
  '/manifest.json',
  '/pwa-icon-512.png',
  '/pwa-icon-192.png'
];

// 1. FIREBASE MESSAGING IN SW
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

messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/pwa-icon-192.png'
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 2. STANDARD PWA LOGIC
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes Firebase Messaging (pour ne pas casser le push)
  if (event.request.url.includes('fcm') || event.request.url.includes('googleapis')) {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
