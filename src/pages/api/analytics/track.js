// RUTA: /src/pages/api/analytics/track.js
// VERSIÓN CORREGIDA CON SU PROPIO GESTOR DE CORS

import { getUserInteractionModel } from '@/lib/database.js';
import cors from 'cors';

// --- Bloque de CORS copiado de events/index.js ---
const corsMiddleware = cors({
    origin: [
        'https://buscador.afland.es',
        'https://duende-frontend.vercel.app',
        'https://afland.es',
        'http://localhost:3000',
        'http://127.0.0.1:5500',
        'http://0.0.0.0:5500',
        'http://localhost:5173',
        'https://duende-control-panel.vercel.app'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
});

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
// --- Fin del bloque de CORS ---

export default async function handler(req, res) {
    // Ejecutamos el middleware de CORS al principio
    await runMiddleware(req, res, corsMiddleware);

    // El resto de tu lógica se mantiene igual
    if (req.method !== 'POST') {
        // En Next.js, la gestión de OPTIONS es implícita si usas un middleware de CORS,
        // pero podemos ser explícitos para asegurar.
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }
        res.setHeader('Allow', ['POST', 'OPTIONS']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        const { type, sessionId, details } = req.body;

        if (!type || !sessionId || !details) {
            return res.status(400).json({ msg: 'Faltan datos en la petición' });
        }

        const UserInteraction = await getUserInteractionModel();
        const newInteraction = new UserInteraction({ type, sessionId, details });
        await newInteraction.save();

        return res.status(201).json({ msg: 'Interacción registrada con éxito' });

    } catch (err) {
        console.error('Error al registrar interacción:', err.message);
        return res.status(500).json({ msg: 'Error del servidor' });
    }
}