// RUTA: /src/pages/api/admin/run-batch-generator.js
// VERSIÓN FINAL Y CORREGIDA

import { connectToMainDb } from '@/lib/database.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- CONFIGURACIÓN ---
const BATCH_SIZE = 25;

// --- LÓGICA DE GEMINI ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });


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
    2.  **Calentando Motores (Antes del Espectáculo):** Recomienda 1 o 2 restaurantes o bares de tapas cercanos. **REGLA OBLIGATORIA:** Para CADA lugar, formatea su nombre como un enlace de Google Maps. Ejemplo: [Casa Manolo](http://googleusercontent.com/maps.google.com/8).
    3.  **El Templo del Duende (El Espectáculo):** Describe la experiencia emocional que se vivirá en el concierto.
    4.  **Para Alargar la Magia (Después del Espectáculo):** Sugiere 1 lugar cercano para tomar algo después. **REGLA OBLIGATORIA:** El lugar DEBE estar formateado como un enlace de Google Maps.
    5.  **Enlaces de Interés:** En esta sección final, crea una lista solo con los NOMBRES de los lugares que mencionaste en las secciones 2 y 4.

    Usa un tono cercano, inspirador y práctico.
`;

async function generateAndSavePlan(db, event) {
    console.log(`🔥 Generando plan para: "${event.name}"`);

    // 1. Formateamos la fecha para pasarla al prompt
    const eventDate = new Date(event.date);
    const dateOptions = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' };
    const formattedDate = eventDate.toLocaleDateString('es-ES', dateOptions);

    // 2. Llamamos al prompt mejorado
    const prompt = nightPlanPromptTemplate(event, formattedDate);
    const result = await model.generateContent(prompt);
    let generatedContent = result.response.text();

    if (!generatedContent || !generatedContent.includes('---')) {
        throw new Error(`Respuesta inválida de la IA para el evento ${event.name}`);
    }

    await db.collection('events').updateOne(
        // BUG FIX: Corregido __id a _id
        { _id: event._id },
        { $set: { nightPlan: generatedContent } }
    );
    console.log(`💾 Contenido para "${event.name}" guardado.`);
}


// --- HANDLER PRINCIPAL DE LA RUTA ---
export default async function handler(req, res) {
    if (req.query.secret !== process.env.ADMIN_SECRET_KEY) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    try {
        const db = await connectToMainDb();
        const eventsCollection = db.collection('events');

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const eventsToProcess = await eventsCollection.find({
            nightPlan: { $exists: false },
            date: { $gte: today.toISOString().split('T')[0] }
        }).limit(BATCH_SIZE).toArray();

        if (eventsToProcess.length === 0) {
            console.log('✅ ¡Proceso completado! No quedan más eventos por generar.');
            return res.status(200).json({ message: '¡Proceso completado! No quedan más eventos por generar.' });
        }

        console.log(`⚙️ Se encontraron ${eventsToProcess.length} eventos. Procesando lote...`);

        for (const event of eventsToProcess) {
            try {
                await generateAndSavePlan(db, event);
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`Error procesando el evento ${event._id}:`, error.message);
            }
        }

        const message = `${eventsToProcess.length} planes generados en este lote. Posiblemente queden más. Vuelve a ejecutar para continuar.`;
        console.log(message);
        return res.status(200).json({ message: message });

    } catch (error) {
        console.error("Error fatal en la generación del lote:", error);
        return res.status(500).json({ error: 'El proceso ha fallado.' });
    }
}