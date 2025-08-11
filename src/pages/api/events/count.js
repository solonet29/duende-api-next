// src/pages/api/events/count.js

import { connectToDatabase } from '@/lib/database.js';
import cors from 'cors';

// Helper para poder usar middlewares de Express en Next.js
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

// Configuración de CORS específica para este endpoint
const corsMiddleware = cors({
  origin: ['https://buscador.afland.es', 'https://duende-frontend.vercel.app', 'http://localhost:3000', 'https://afland.es', 'http://127.0.0.1:5500'],
  methods: ['GET', 'OPTIONS'],
});

export default async function handler(req, res) {
  // Ejecutamos el middleware de CORS al principio de la función
  await runMiddleware(req, res, corsMiddleware);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.setHeader('Cache-control', 'no-store, max-age=0');
  try {
    const db = await connectToDatabase();
    const eventsCollection = db.collection("events");
    const todayString = new Date().toISOString().split('T')[0];
    const count = await eventsCollection.countDocuments({
      date: { $gte: todayString },
      name: { $ne: null, $nin: ["", "N/A"] },
      artist: { $ne: null, $nin: ["", "N/A"] },
      time: { $ne: null, $nin: ["", "N/A"] },
      venue: { $ne: null, $nin: ["", "N/A"] }
    });
    res.status(200).json({ total: count });
  } catch (error) {
    console.error("Error al contar eventos:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
}