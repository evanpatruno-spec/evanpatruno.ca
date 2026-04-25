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
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/pwa-icon-192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
