importScripts(
  "https://www.gstatic.com/firebasejs/10.11.1/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.11.1/firebase-messaging-compat.js"
);

const firebaseConfig = {
  apiKey: 'AIzaSyAzD2lBIiXFdlngOKolF6NKmCeyyuxoZOw',
  projectId: 'timeflow-6i3eo',
  messagingSenderId: '209410404537',
  appId: '1:209410404537:web:bb2b7ff8376f1149e42b68',
}

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.data.title;
  const notificationOptions = {
    body:
      payload.data.body,
    icon: payload.data.icon || '/manowar.png',
    badge: payload.data.badge || '/manowar.png', 
    data: { url: payload.fcmOptions?.link || "/" },
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        return clients.openWindow(targetUrl);
      })
  );
});