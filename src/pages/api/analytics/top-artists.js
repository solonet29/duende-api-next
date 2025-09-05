// src/pages/api/analytics/top-artists.js

import { connectToDatabase } from '@/lib/database.js';
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
    const { db } = await connectToDatabase();
    const interactionsCollection = db.collection("interactions");

    const pipeline = [
      // 1. Filtrar solo las vistas de eventos
      {
        $match: {
          type: 'eventView',
          'details.eventId': { $exists: true }
        }
      },
      // 2. Convertir el eventId de string a ObjectId para el join
      {
        $addFields: {
          convertedEventId: { $toObjectId: '$details.eventId' }
        }
      },
      // 3. Unir con la colección de eventos
      {
        $lookup: {
          from: 'events',
          localField: 'convertedEventId',
          foreignField: '_id',
          as: 'eventDetails'
        }
      },
      // 4. Descomprimir el array y filtrar si no hay artista
      {
        $unwind: '$eventDetails'
      },
      {
        $match: {
          'eventDetails.artist': { $exists: true, $ne: null, $ne: "" }
        }
      },
      // 5. Agrupar por artista y contar las vistas
      {
        $group: {
          _id: '$eventDetails.artist',
          viewCount: { $sum: 1 }
        }
      },
      // 6. Ordenar de más a menos vistas
      {
        $sort: {
          viewCount: -1
        }
      },
      // 7. Limitar al top 10
      {
        $limit: 10
      },
      // 8. Proyectar el formato final
      {
        $project: {
          _id: 0,
          artist: '$_id',
          viewCount: '$viewCount'
        }
      }
    ];

    const topArtists = await interactionsCollection.aggregate(pipeline).toArray();

    res.status(200).json(topArtists);
  } catch (error) {
    console.error("Error al obtener los artistas más vistos:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
}
