// RUTA: /lib/webPush.js
const webpush = require('web-push');

if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.log(process.env.VAPID_PUBLIC_KEY)
  console.log(process.env.VAPID_PRIVATE_KEY)
  throw new Error('Las variables de entorno VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY son obligatorias.');
}

webpush.setVapidDetails(
  'mailto:your-email@example.com', // Reemplaza esto con tu email
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

module.exports = webpush;