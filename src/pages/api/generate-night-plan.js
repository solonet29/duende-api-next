// RUTA: /src/pages/api/generate-night-plan.js

import { connectToDatabase } from '@/lib/database.js';
import { ObjectId } from 'mongodb';
import { GoogleGenerativeAI } from '@google/generative-ai';
import cors from 'cors';

// --- INICIALIZACIÓN DE SERVICIOS ---
if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY no está definida.');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// --- MIDDLEWARE DE CORS ---
const corsMiddleware = cors({
    origin: ['https://buscador.afland.es', 'https://duende-frontend.vercel.app', 'http://localhost:3000', 'https://afland.es', 'http://127.0.0.1:5500'],
    methods: ['GET', 'OPTIONS'],
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

// --- PROMPT TEMPLATE ---
const nightPlanPromptTemplate = (event) => `
    Eres "Duende", un conocedor local y aficionado al flamenco.
    Tu tarea es generar una mini-guía para una noche perfecta centrada en un evento de flamenco.
    Sé cercano, usa un lenguaje evocador y estructura el plan en secciones con Markdown (usando ## para los títulos).
    EVENTO:
    - Nombre: ${event.name}
    - Artista: ${event.artist}
    - Lugar: ${event.venue}, ${event.city}
    ESTRUCTURA DE LA GUÍA:
    1.  **Un Pellizco de Sabiduría:** Aporta un dato curioso o una anécdota sobre el artista, el lugar o algún palo del flamenco relacionado.
    2.  **Calentando Motores (Antes del Espectáculo):** Recomienda 1 o 2 bares de tapas o restaurantes cercanos al lugar del evento, describiendo el ambiente. Envuelve el nombre de los lugares que recomiendes entre corchetes, por ejemplo: [Restaurante el Salero].
    3.  **El Templo del Duende (El Espectáculo):** Describe brevemente qué se puede esperar del concierto, centrando en la emoción.
    4.  **Para Alargar la Magia (Después del Espectáculo):** Sugiere un lugar cercano para tomar una última copa en un ambiente relajado. Envuelve el nombre de los lugares que recomiendes entre corchetes, por ejemplo: [Bar La Plazuela].

    Usa un tono inspirador y práctico.
`;


// --- HANDLER DE LA RUTA ---
export default async function handler(req, res) {
    await runMiddleware(req, res, corsMiddleware);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    
    const { eventId } = req.query;

    if (!eventId) {
        return res.status(400).json({ error: 'Falta el ID del evento.' });
    }

    try {
        const db = await connectToDatabase();
        const eventsCollection = db.collection('events');
        
        let oid;
        try {
            oid = new ObjectId(eventId);
        } catch (e) {
            return res.status(400).json({ error: 'El ID del evento no es válido.' });
        }
        
        const event = await eventsCollection.findOne({ _id: oid });

        if (!event) {
            return res.status(404).json({ error: 'Evento no encontrado.' });
        }

        if (event.nightPlan) {
            console.log(`✅ Devolviendo contenido cacheado para el evento: ${event.name}`);
            return res.status(200).json({ content: event.nightPlan, source: 'cache' });
        }

        console.log(`🔥 Generando nuevo contenido "Planear Noche" para: ${event.name}`);
        const prompt = nightPlanPromptTemplate(event);
        const result = await model.generateContent(prompt);
        const generatedContent = result.response.text();

        await eventsCollection.updateOne(
            { _id: oid },
            { $set: { nightPlan: generatedContent } }
        );
        console.log(`💾 Contenido para "${event.name}" guardado en la base de datos.`);

        return res.status(200).json({ content: generatedContent, source: 'generated' });

    } catch (error) {
        console.error("Error en el endpoint de 'Planear Noche':", error);
        return res.status(500).json({ error: 'Error al generar el contenido.' });
    }
}