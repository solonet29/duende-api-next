// RUTA: /src/pages/api/generate-night-plan.js
// VERSIÓN MIGRADADA A GROQ

import { connectToDatabase } from '@/lib/database.js';
import { ObjectId } from 'mongodb';
import Groq from 'groq-sdk'; // CAMBIO 1: Importamos Groq en lugar de Gemini
import cors from 'cors';

// --- INICIALIZACIÓN DE SERVICIOS ---
// CAMBIO 2: Verificamos y usamos la API Key de Groq
if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY no está definida.');

// CAMBIO 3: Inicializamos el cliente de Groq
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// --- MIDDLEWARE DE CORS (Sin cambios) ---
const allowedOrigins = [
    'https://buscador.afland.es',
    'https://duende-frontend.vercel.app',
    'https://afland.es',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    /https:\/\/duende-frontend-git-.*\.vercel\.app$/
];
const corsMiddleware = cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.some(allowed =>
            (typeof allowed === 'string' ? allowed === origin : allowed.test(origin))
        )) {
            callback(null, true);
        } else {
            callback(new Error('Origen no permitido por CORS'));
        }
    },
    methods: ['GET', 'OPTIONS'],
});

function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) { return reject(result); }
            return resolve(result);
        });
    });
}

// --- PROMPT MAESTRO (Sin cambios) ---
const nightPlanPromptTemplate = (event, formattedDate) => `
    // ... (Tu prompt completo aquí, no necesita cambios) ...
`;

async function generateAndSavePlan(db, event) {
    console.log(`🔥 Generando nuevo contenido con Groq para: ${event.name}`);

    const eventDate = new Date(event.date);
    const dateOptions = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' };
    const formattedDate = eventDate.toLocaleDateString('es-ES', dateOptions);

    const prompt = nightPlanPromptTemplate(event, formattedDate);

    // CAMBIO 4: Adaptamos la llamada a la API de Groq
    const chatCompletion = await groq.chat.completions.create({
        messages: [{
            role: 'user',
            content: prompt,
        }],
        model: 'llama3-8b-8192', // CAMBIO 5: Seleccionamos un modelo de Groq (ej. Llama 3)
    });

    // CAMBIO 6: Extraemos la respuesta del formato de Groq
    let generatedContent = chatCompletion.choices[0]?.message?.content || '';

    if (!generatedContent || !generatedContent.includes('---')) {
        console.warn("La respuesta de Groq no tiene el formato esperado. Contenido recibido:", generatedContent);
        throw new Error("La respuesta de la IA no tiene el formato esperado.");
    }

    await db.collection('events').updateOne(
        { _id: event._id },
        { $set: { nightPlan: generatedContent } }
    );
    console.log(`💾 Contenido de Groq para "${event.name}" guardado en la base de datos.`);
    return generatedContent;
}

// --- HANDLER DE LA RUTA (Sin cambios en la lógica principal) ---
export default async function handler(req, res) {
    await runMiddleware(req, res, corsMiddleware);

    try {
        const { eventId } = req.query;
        if (!eventId || !ObjectId.isValid(eventId)) {
            return res.status(400).json({ error: 'El ID del evento no es válido.' });
        }

        const { db } = await connectToDatabase(); // Obtenemos solo 'db' según nuestro lib/database.js

        const eventsCollection = db.collection('events');
        const event = await eventsCollection.findOne({ _id: new ObjectId(eventId) });

        if (!event) {
            return res.status(404).json({ error: 'Evento no encontrado.' });
        }

        if (event.nightPlan) {
            console.log(`✅ Devolviendo contenido cacheado para: ${event.name}`);
            return res.status(200).json({ content: event.nightPlan, source: 'cache' });
        }

        const generatedContent = await generateAndSavePlan(db, event);
        return res.status(200).json({ content: generatedContent, source: 'generated' });

    } catch (error) {
        console.error("Error en el endpoint de 'Planear Noche' con Groq:", error);
        return res.status(500).json({ error: 'Error al generar el contenido.' });
    }
    // Nota: Eliminamos el bloque 'finally' para usar la conexión cacheada de la BBDD
}