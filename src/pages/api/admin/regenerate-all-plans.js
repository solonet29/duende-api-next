// RUTA: /src/pages/api/admin/regenerate-all-plans.js
// VERSIÓN PARA REGENERACIÓN MASIVA

import { connectToDatabase } from '@/lib/database.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- LÓGICA DE GENERACIÓN (Autocontenida para este script) ---
// Copiamos la lógica aquí para que este script sea independiente y fácil de mantener.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const nightPlanPromptTemplate = (event) => `
    Eres "Duende", un conocedor local y aficionado al flamenco.
    Tu tarea es generar una mini-guía para una noche perfecta centrada en un evento de flamenco.
    Sé cercano, usa un lenguaje evocador y estructura el plan en secciones con Markdown (usando ## para los títulos).

    **REGLA MUY IMPORTANTE: Tu respuesta debe empezar DIRECTAMENTE con el primer título en Markdown (##). No incluyas saludos, introducciones o texto conversacional antes de la guía.**

    EVENTO:
    - Nombre: ${event.name}
    - Artista: ${event.artist}
    - Lugar: ${event.venue}, ${event.city}
    ESTRUCTURA DE LA GUÍA:
    1.  **Un Pellizco de Sabiduría:** Aporta un dato curioso o una anécdota sobre el artista, el lugar o algún palo del flamenco relacionado.
    2.  **Calentando Motores (Antes del Espectáculo):** Recomienda 1 o 2 bares de tapas o restaurantes cercanos al lugar del evento, describiendo el ambiente. Para cada lugar, crea un enlace de Google Maps usando Markdown.
    3.  **El Templo del Duende (El Espectáculo):** Describe brevemente qué se puede esperar del concierto, centrando en la emoción.
    4.  **Para Alargar la Magia (Después del Espectáculo):** Sugiere un lugar cercano para tomar una última copa en un ambiente relajado.

    Usa un tono inspirador y práctico.
`;

async function generateAndSavePlan(db, event) {
    console.log(`🔥 Regenerando "Planear Noche" para: ${event.name}`);
    const prompt = nightPlanPromptTemplate(event);
    const result = await model.generateContent(prompt);
    let generatedContent = result.response.text();

    if (!generatedContent || !generatedContent.includes('##')) {
        throw new Error(`Respuesta inválida de la IA para el evento ${event.name}`);
    }

    await db.collection('events').updateOne(
        { _id: event._id },
        { $set: { nightPlan: generatedContent } }
    );
    console.log(`💾 Contenido para "${event.name}" regenerado y guardado.`);
}


// --- HANDLER PRINCIPAL DE LA RUTA ---
export default async function handler(req, res) {
    // 1. SEGURIDAD: Protegemos el endpoint con una clave secreta para que solo tú puedas usarlo.
    if (req.query.secret !== process.env.ADMIN_SECRET_KEY) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    console.log('--- INICIANDO REGENERACIÓN MASIVA DE TODOS LOS PLANES ---');
    try {
        const db = await connectToDatabase();
        const eventsCollection = db.collection('events');

        // 2. BORRADO (Opcional pero recomendado): Eliminamos todos los nightPlan existentes para empezar de cero.
        console.log('Borrando todos los nightPlan antiguos...');
        const deleteResult = await eventsCollection.updateMany(
            { nightPlan: { $exists: true } },
            { $unset: { nightPlan: "" } }
        );
        console.log(`${deleteResult.modifiedCount} planes antiguos eliminados.`);

        // 3. SELECCIÓN: Buscamos todos los eventos futuros.
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const eventsToProcess = await eventsCollection.find({
            date: { $gte: today.toISOString().split('T')[0] }
        }).toArray();

        console.log(`Se encontraron ${eventsToProcess.length} eventos para regenerar.`);
        // Enviamos una respuesta inmediata al navegador para que no se quede esperando el proceso completo.
        res.status(202).json({ message: `Iniciando la regeneración de ${eventsToProcess.length} eventos. Revisa los logs de Vercel para ver el progreso.` });

        // 4. EJECUCIÓN: Procesamos todos los eventos en secuencia.
        for (const event of eventsToProcess) {
            try {
                // Pequeña pausa de 1 segundo entre cada llamada para no saturar la API de Gemini.
                await new Promise(resolve => setTimeout(resolve, 1000));
                await generateAndSavePlan(db, event);
            } catch (error) {
                // Si un evento falla, lo registramos y continuamos con el siguiente.
                console.error(`Error procesando el evento ${event._id} ("${event.name}"):`, error.message);
            }
        }

        console.log('--- REGENERACIÓN MASIVA FINALIZADA ---');

    } catch (error) {
        console.error("Error fatal en la regeneración masiva:", error);
        // No enviamos respuesta aquí porque ya hemos enviado una (202). El error se verá en los logs.
    }
}