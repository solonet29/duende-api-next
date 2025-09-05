// RUTA: /src/pages/api/admin/generate-for-published.js
// MISIÓN: Generar 'nightPlan' SOLO para posts que ya están en WordPress.

import { connectToMainDb } from '@/lib/database.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const BATCH_SIZE = 15; // Un lote pequeño para respetar la cuota de Gemini

// --- LÓGICA DE GEMINI Y PROMPT ---
// (Pega aquí la misma configuración de Gemini y el 'Prompt Maestro' que tenemos en los otros generadores)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
const nightPlanPromptTemplate = (event, formattedDate) => `... tu prompt maestro ...`;


async function generateAndSavePlan(db, event) {
    console.log(`🔥 Generando plan para post publicado: "${event.name}"`);
    const eventDate = new Date(event.date);
    const dateOptions = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' };
    const formattedDate = eventDate.toLocaleDateString('es-ES', dateOptions);

    const prompt = nightPlanPromptTemplate(event, formattedDate);
    const result = await model.generateContent(prompt);
    let generatedContent = result.response.text();

    if (!generatedContent || !generatedContent.includes('---')) {
        throw new Error(`Respuesta inválida para ${event.name}`);
    }

    await db.collection('events').updateOne(
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

        // ESTA ES LA BÚSQUEDA CLAVE Y ESPECÍFICA
        const eventsToProcess = await eventsCollection.find({
            wordpressPostId: { $exists: true },
            nightPlan: { $exists: false } // La condición principal
        }).limit(BATCH_SIZE).toArray();

        if (eventsToProcess.length === 0) {
            return res.status(200).json({ message: '¡Hecho! No quedan más posts publicados que necesiten un plan.' });
        }

        console.log(`⚙️ Se encontraron ${eventsToProcess.length} posts publicados sin nightPlan. Procesando...`);

        for (const event of eventsToProcess) {
            try {
                await generateAndSavePlan(db, event);
                await new Promise(resolve => setTimeout(resolve, 5000)); // Pausa de 5s para la cuota
            } catch (error) {
                console.error(`Error procesando el evento ${event._id}:`, error.message);
            }
        }

        const message = `${eventsToProcess.length} planes generados. Posiblemente queden más. Refresca para continuar.`;
        return res.status(200).json({ message: message });

    } catch (error) {
        console.error("Error fatal en la generación para publicados:", error);
        return res.status(500).json({ error: 'El proceso ha fallado.' });
    }
}