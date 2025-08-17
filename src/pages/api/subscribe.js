// RUTA: /src/pages/api/subscribe.js
import { connectToDatabase } from '../../../lib/database';
import '../../../lib/webPush'; // Importa para asegurar que la configuración de web-push se ejecute

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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
    const db = await connectToDatabase();
    const collection = db.collection('push_subscriptions');

    // Opcional: Evitar duplicados basados en el endpoint
    await collection.updateOne(
      { endpoint: subscription.endpoint },
      { $set: subscription },
      { upsert: true } // Inserta si no existe, actualiza si ya está
    );

    console.log('Suscripción guardada:', subscription.endpoint);
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error al guardar la suscripción:', error);
    res.status(500).json({ error: 'Error interno del servidor al guardar la suscripción.' });
  }
}
