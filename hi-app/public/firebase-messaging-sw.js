/* eslint-disable no-undef */
// Import scripts for firebase
importScripts(
  "https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js"
);

// Initialize Firebase in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyD9Qu-nSOfIE8g5BswnzMnJ0oa2DYJmMqM",
  authDomain: "hi-app-4f799.firebaseapp.com",
  projectId: "hi-app-4f799",
  storageBucket: "hi-app-4f799.appspot.com",
  messagingSenderId: "376315716692",
  appId: "1:376315716692:web:0146b76463c5190af7f9c1",
});

// Retrieve an instance of Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(function (payload) {
  console.log(
    "[firebase-messaging-sw.js] Received background message ",
    payload
  );

  const notificationTitle = payload.notification?.title || "New Message";
  const notificationOptions = {
    body: payload.notification?.body || "You have a new chirp!",
    icon: "/icons/icon-192x192.png", // path to your PWA icon
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
