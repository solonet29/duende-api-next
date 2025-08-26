// RUTA: /src/pages/api/generate-night-plan.js
// VERSIÓN FINAL CON PROMPT MAESTRO

import { connectToDatabase } from '@/lib/database.js';
import { ObjectId } from 'mongodb';
import { GoogleGenerativeAI } from '@google/generative-ai';
import cors from 'cors';

// --- INICIALIZACIÓN DE SERVICIOS ---
if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY no está definida.');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// --- MIDDLEWARE DE CORS (sin cambios) ---
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


// =======================================================================
// --- PROMPT MAESTRO (VERSIÓN FINAL Y REFORZADA) ---
// =======================================================================
const nightPlanPromptTemplate = (event, formattedDate) => `
    **REGLA INICIAL:** Tu respuesta DEBE empezar con la siguiente información, seguida de una línea horizontal ('---'). No añadas ningún saludo o introducción antes de esto.
    **Artista:** ${event.artist}
    **Fecha:** ${formattedDate}
    ---
    
    Eres "Duende", un conocedor local y aficionado al flamenco.
    Tu tarea es generar una mini-guía detallada y de alta calidad para una noche de flamenco.

    **REGLAS DE ESTILO (MUY IMPORTANTE):**
    - **PÁRRAFOS CORTOS:** Escribe en párrafos de 2-3 frases como máximo. Usa puntos y aparte con frecuencia para que el texto respire y sea fácil de leer.
    - **NEGRITAS:** Usa negritas (formato Markdown '**palabra**') para resaltar nombres de artistas, de lugares, de palos flamencos o conceptos clave. No abuses, pero úsalas para dar énfasis.

    EVENTO DE REFERENCIA:
    - Nombre: ${event.name}
    - Artista: ${event.artist}
    - Lugar: ${event.venue}, ${event.city}
    
    ESTRUCTURA OBLIGATORIA DE LA GUÍA:
    1.  **Un Pellizco de Sabiduría:** Aporta un dato curioso o una anécdota interesante sobre el artista o el lugar.
    2.  **Calentando Motores (Antes del Espectáculo):** Recomienda 1 o 2 restaurantes o bares de tapas cercanos. **REGLA OBLIGATORIA:** Para CADA lugar, formatea su nombre como un enlace de Google Maps. Ejemplo: [Casa Manolo](http://googleusercontent.com/maps/google.com/7).
    3.  **El Templo del Duende (El Espectáculo):** Describe la experiencia emocional que se vivirá en el concierto.
    4.  **Para Alargar la Magia (Después del Espectáculo):** Sugiere 1 lugar cercano para tomar algo después. **REGLA OBLIGATORIA:** El lugar DEBE estar formateado como un enlace de Google Maps.
    5.  **Enlaces de Interés:** En esta sección final, crea una lista solo con los NOMBRES de los lugares que mencionaste en las secciones 2 y 4.

    Usa un tono cercano, inspirador y práctico.
`;

async function generateAndSavePlan(db, event) {
    console.log(`🔥 Generando nuevo contenido "Planear Noche" para: ${event.name}`);

    // --- INICIO DE LA MEJORA ---
    // 1. Formateamos la fecha para pasarla al prompt
    const eventDate = new Date(event.date);
    const dateOptions = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' };
    const formattedDate = eventDate.toLocaleDateString('es-ES', dateOptions);

    // 2. Llamamos al prompt mejorado, pasándole la fecha
    const prompt = nightPlanPromptTemplate(event, formattedDate);
    // --- FIN DE LA MEJORA ---

    const result = await model.generateContent(prompt);
    let generatedContent = result.response.text();

    if (!generatedContent || !generatedContent.includes('##') && !generatedContent.includes('---')) {
        throw new Error("La respuesta de la IA no tiene el formato esperado (falta cabecera o títulos).");
    }

    // --- (El FIX para los enlaces de Markdown se mantiene por si acaso) ---
    generatedContent = generatedContent.replace(/(\b[A-Z][a-zA-Z\s,.'-ñÑáéíóúÁÉÍÓÚ]+)\]\((https:\/\/www\.google\.com\/maps\/search\/\?[^)]+)\)/g, '[$1]($2)');

    await db.collection('events').updateOne(
        { _id: event._id },
        { $set: { nightPlan: generatedContent } }
    );
    console.log(`💾 Contenido para "${event.name}" guardado en la base de datos.`);
    return generatedContent;
}


// --- HANDLER DE LA RUTA (sin cambios en su lógica principal) ---
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

        const generatedContent = await generateAndSavePlan(db, event);
        return res.status(200).json({ content: generatedContent, source: 'generated' });

    } catch (error) {
        console.error("Error en el endpoint de 'Planear Noche':", error);
        return res.status(500).json({ error: 'Error al generar el contenido.' });
    }
}