// src/pages/api/analytics/conversion-funnel.js

import { connectToAnalyticsDb } from '@/lib/database.js';
import cors from 'cors';

// Helper para ejecutar middleware
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

// Configuración de CORS
const corsMiddleware = cors({
  origin: [
    'https://buscador.afland.es', 
    'https://duende-frontend.vercel.app', 
    'http://localhost:3000', 
    'https://afland.es', 
    'http://127.0.0.1:5500', 
    'http://localhost:5173',
    'https://dashboard-analiticas-duende.vercel.app'
  ],
  methods: ['GET', 'OPTIONS'],
});

export default async function handler(req, res) {
  await runMiddleware(req, res, corsMiddleware);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.setHeader('Cache-control', 's-maxage=3600, stale-while-revalidate'); // Cache por 1 hora

  try {
    const db = await connectToAnalyticsDb();
    const interactionsCollection = db.collection("interactions");

    const pipeline = [
        // 1. Filtrar solo los tipos de interacciones que nos interesan para el funnel
        {
            $match: {
                type: { $in: ['nearMeSearch', 'eventView', 'planNightRequest'] }
            }
        },
        // 2. Agrupar por tipo de interacción y contar cuántas hay de cada una
        {
            $group: {
                _id: '$type',
                count: { $sum: 1 }
            }
        }
    ];

    const funnelData = await interactionsCollection.aggregate(pipeline).toArray();

    // 3. Formatear el resultado en un objeto clave-valor para que sea más fácil de consumir
    const result = {
        nearMeSearch: 0,
        eventView: 0,
        planNightRequest: 0
    };

    funnelData.forEach(item => {
        if (result.hasOwnProperty(item._id)) {
            result[item._id] = item.count;
        }
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Error al calcular el funnel de conversión:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
}
