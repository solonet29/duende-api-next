// RUTA: /src/pages/api/subscribe.js
import { connectToMainDb } from '../../../lib/database';
import '../../../lib/webPush';

export default async function handler(req, res) {
  const allowedOrigins = ['https://buscador.afland.es', 'http://localhost:5173'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const subscription = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Subscription object is missing or invalid.' });
  }

  try {
          const db = await connectToMainDb();
    const collection = db.collection('push_subscriptions');

    await collection.updateOne(
      { endpoint: subscription.endpoint },
      { $set: subscription },
      { upsert: true }
    );

    console.log('Suscripción guardada:', subscription.endpoint);
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error al guardar la suscripción:', error);
    res.status(500).json({ error: 'Error interno del servidor al guardar la suscripción.' });
  }
}
