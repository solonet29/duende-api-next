// RUTA: /src/pages/api/unsubscribe.js
import { connectToMainDb } from '../../../lib/database';

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

  const { endpoint } = req.body;

  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint is missing in request body.' });
  }

  try {
    const db = await connectToMainDb();
    const collection = db.collection('push_subscriptions');

    const result = await collection.deleteOne({ endpoint: endpoint });

    if (result.deletedCount === 0) {
        console.log('No se encontró la suscripción a eliminar:', endpoint);
        return res.status(404).json({ error: 'Subscription not found.' });
    }

    console.log('Suscripción eliminada:', endpoint);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error al eliminar la suscripción:', error);
    res.status(500).json({ error: 'Error interno del servidor al eliminar la suscripción.' });
  }
}
