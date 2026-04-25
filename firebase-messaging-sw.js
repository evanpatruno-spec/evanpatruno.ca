const CACHE_NAME = 'ep-portal-cache-v7';
const ASSETS_TO_CACHE = [
  '/',
  '/mon-dossier.html',
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
  console.log('[SW] Message reçu en arrière-plan:', payload);
  
  const title = payload.notification?.title || payload.data?.title || "Nouveau message";
  const body = payload.notification?.body || payload.data?.body || "Consultez votre dossier.";
  
  const options = {
    body: body,
    icon: '/pwa-icon-192.png',
    badge: '/pwa-icon-192.png',
    vibrate: [200, 100, 200],
    data: {
        url: 'https://dossier.evanpatruno.ca/mon-dossier.html'
    }
  };

  return self.registration.showNotification(title, options);
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
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)));
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
