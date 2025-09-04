// src/pages/api/events/count.js

import { connectToDatabase } from '@/lib/database.js';
import cors from 'cors';

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

const corsMiddleware = cors({
  origin: ['https://buscador.afland.es', 'https://duende-frontend.vercel.app', 'http://localhost:3000', 'https://afland.es', 'http://127.0.0.1:5500', 'http://localhost:5173'],
  methods: ['GET', 'OPTIONS'],
});

export default async function handler(req, res) {
  await runMiddleware(req, res, corsMiddleware);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.setHeader('Cache-control', 'no-store, max-age=0');
  try {
    const db = await connectToDatabase();
    const eventsCollection = db.collection("events");

    // --- CORRECCIÓN AQUÍ ---
    // Creamos un objeto Date para el inicio del día de hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Lo ajustamos a medianoche

    const count = await eventsCollection.countDocuments({
      // Usamos el objeto Date en la consulta, no un string
      date: { $gte: today },
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