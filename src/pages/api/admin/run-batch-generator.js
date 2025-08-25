// RUTA: /src/pages/api/admin/run-batch-generator.js
import { connectToDatabase } from '@/lib/database.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- CONFIGURACIÓN ---
const BATCH_SIZE = 25; // ¡Puedes ajustar este número como quieras! 25 es un buen punto de partida.

// --- LÓGICA DE GEMINI (La que ya conocemos y funciona) ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const nightPlanPromptTemplate = (event) => `
    Eres "Duende", un conocedor local y aficionado al flamenco.
    Tu tarea es generar una mini-guía para una noche perfecta...
    (Aquí pegas tu prompt completo, el que ya tienes validado)
`;

async function generateAndSavePlan(db, event) {
    console.log(`🔥 Generando plan para: "${event.name}"`);
    const prompt = nightPlanPromptTemplate(event);
    const result = await model.generateContent(prompt);
    let generatedContent = result.response.text();

    if (!generatedContent || !generatedContent.includes('##')) {
        throw new Error(`Respuesta inválida de la IA para el evento ${event.name}`);
    }

    await db.collection('events').updateOne(
        { __id: event._id },
        { $set: { nightPlan: generatedContent } }
    );
    console.log(`💾 Contenido para "${event.name}" guardado.`);
}


// --- HANDLER PRINCIPAL DE LA RUTA ---
export default async function handler(req, res) {
    // 1. SEGURIDAD: Siempre protegido.
    if (req.query.secret !== process.env.ADMIN_SECRET_KEY) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    try {
        const db = await connectToDatabase();
        const eventsCollection = db.collection('events');

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 2. BÚSQUEDA: Buscamos el siguiente lote de eventos que necesiten un plan.
        const eventsToProcess = await eventsCollection.find({
            nightPlan: { $exists: false },
            date: { $gte: today.toISOString().split('T')[0] }
        }).limit(BATCH_SIZE).toArray();

        if (eventsToProcess.length === 0) {
            console.log('✅ ¡Proceso completado! No quedan más eventos por generar.');
            return res.status(200).json({ message: '¡Proceso completado! No quedan más eventos por generar.' });
        }

        console.log(`⚙️ Se encontraron ${eventsToProcess.length} eventos. Procesando lote...`);

        // 3. PROCESAMIENTO DEL LOTE
        for (const event of eventsToProcess) {
            try {
                await generateAndSavePlan(db, event);
                // Pequeña pausa para no saturar
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