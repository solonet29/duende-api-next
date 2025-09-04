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
    // --- CAMBIO CLAVE AQUÍ ---
    // 1. connectToDatabase() devuelve el cliente, no la base de datos.
    const client = await connectToDatabase();
    // 2. Ahora seleccionamos la base de datos que queremos usar.
    const db = client.db("DuendeDB");
    // --- FIN DEL CAMBIO ---

    const eventsCollection = db.collection("events");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await eventsCollection.countDocuments({
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