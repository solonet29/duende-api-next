// src/pages/api/analytics/total-event-views.js

import { connectToAnalyticsDb } from '@/lib/database.js';
import cors from 'cors';

// Helper para ejecutar middleware de Express/Connect
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

// Configuración de CORS para permitir peticiones desde el frontend
const corsMiddleware = cors({
  origin: [
    'https://buscador.afland.es', 
    'https://duende-frontend.vercel.app', 
    'http://localhost:3000', 
    'https://afland.es', 
    'http://127.0.0.1:5500', 
    'http://localhost:5173'
  ],
  methods: ['GET', 'OPTIONS'],
});

export default async function handler(req, res) {
  // Ejecutar middleware de CORS
  await runMiddleware(req, res, corsMiddleware);

  // Manejar la petición pre-flight de CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Evitar cacheo de la respuesta
  res.setHeader('Cache-control', 'no-store, max-age=0');

  try {
    // Conectar a la base de datos
    const db = await connectToAnalyticsDb();

    // Acceder a la colección donde se guardan las interacciones
    const interactionsCollection = db.collection("interactions");

    // Contar los documentos que son de tipo 'eventView'
    const count = await interactionsCollection.countDocuments({
      type: 'eventView'
    });

    // Devolver el total en la respuesta
    res.status(200).json({ total: count });
  } catch (error) {
    console.error("Error al contar las vistas de eventos:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
}
