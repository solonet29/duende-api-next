// RUTA: /src/pages/api/generate-night-plan.js
// VERSIÓN FINAL CON PROMPT MAESTRO Y MEJORAS DE ROBUSTEZ

import { connectToDatabase } from '@/lib/database.js';
import { ObjectId } from 'mongodb';
import { GoogleGenerativeAI } from '@google/generative-ai';
import cors from 'cors';

// --- INICIALIZACIÓN DE SERVICIOS ---
if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY no está definida.');
const genAI = new GoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY
});
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });


// --- MEJORA 1: MIDDLEWARE DE CORS MÁS ROBUSTO ---
const allowedOrigins = [
    'https://buscador.afland.es',
    'https://duende-frontend.vercel.app',
    'https://afland.es',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    // Expresión regular para aceptar TODAS las URLs de preview de Vercel del frontend
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

// =======================================================================
// --- PROMPT MAESTRO (Sin cambios, sigue siendo excelente) ---
// =======================================================================
const nightPlanPromptTemplate = (event, formattedDate) => `
    // ... (Tu prompt completo aquí, no necesita cambios) ...
`;

async function generateAndSavePlan(db, event) {
    console.log(`🔥 Generando nuevo contenido "Planear Noche" para: ${event.name}`);

    const eventDate = new Date(event.date);
    const dateOptions = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' };
    const formattedDate = eventDate.toLocaleDateString('es-ES', dateOptions);

    const prompt = nightPlanPromptTemplate(event, formattedDate);

    const result = await model.generateContent(prompt);
    let generatedContent = result.response.text();

    if (!generatedContent || !generatedContent.includes('---')) {
        throw new Error("La respuesta de la IA no tiene el formato esperado.");
    }

    await db.collection('events').updateOne(
        { _id: event._id },
        { $set: { nightPlan: generatedContent } }
    );
    console.log(`💾 Contenido para "${event.name}" guardado en la base de datos.`);
    return generatedContent;
}

// --- HANDLER DE LA RUTA ---
export default async function handler(req, res) {
    await runMiddleware(req, res, corsMiddleware);

    let dbClient; // Variable para guardar el cliente de la BBDD
    try {
        const { eventId } = req.query;
        if (!eventId || !ObjectId.isValid(eventId)) {
            return res.status(400).json({ error: 'El ID del evento no es válido.' });
        }

        const { db, client } = await connectToDatabase();
        dbClient = client; // Guardamos el cliente para cerrarlo después

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
        console.error("Error en el endpoint de 'Planear Noche':", error);
        return res.status(500).json({ error: 'Error al generar el contenido.' });
    } finally {
        // --- MEJORA 2: CIERRE SEGURO DE LA CONEXIÓN A LA BBDD ---
        if (dbClient) {
            await dbClient.close();
            console.log("Conexión a la base de datos cerrada.");
        }
    }
}