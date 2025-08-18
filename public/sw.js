// RUTA: public/sw.js

self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Recibido.');
  console.log(`[Service Worker] Datos del push: "${event.data.text()}"`);

  const data = event.data.json(); // Asumimos que el servidor envía un JSON

  const title = data.title || 'Notificación de Duende';
  const options = {
    body: data.body || 'Tienes una nueva notificación.',
    icon: '/favicon.ico', // Opcional: icono para la notificación
    badge: '/favicon.ico' // Opcional: icono para la barra de notificaciones (Android)
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Clic en la notificación recibido.');

  event.notification.close();

  // Abre la ventana de la aplicación si no está ya abierta
  event.waitUntil(
    clients.openWindow('/')
  );
});
