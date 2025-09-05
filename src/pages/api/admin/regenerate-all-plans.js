// RUTA: /src/pages/api/admin/regenerate-all-plans.js
// VERSIÓN "CARRERA DE RELEVOS" PARA EVITAR TIMEOUTS

import { connectToMainDb } from '@/lib/database.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- CONFIGURACIÓN Y LÓGICA DE GENERACIÓN (Igual que antes) ---
const BATCH_SIZE = 20; // Un lote pequeño para que cada ejecución sea rápida
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const nightPlanPromptTemplate = (event) => `
    Eres "Duende", un conocedor local...
    (Aquí pegas tu prompt completo)
`;

async function generateAndSavePlan(db, event) {
    // ... (Esta función se mantiene exactamente igual que en la versión anterior)
}

// --- HANDLER PRINCIPAL (AHORA CON LÓGICA DE RELEVOS) ---
export default async function handler(req, res) {
    // 1. SEGURIDAD: Comprobamos la clave secreta
    if (req.query.secret !== process.env.ADMIN_SECRET_KEY) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    // 2. EL TESTIGO: Leemos el offset para saber por dónde empezar
    const offset = parseInt(req.query.offset) || 0;

    // Solo la primera ejecución (offset 0) borra los planes antiguos
    if (offset === 0) {
        console.log('--- INICIANDO REGENERACIÓN MASIVA DE TODOS LOS PLANES (LOTE 1) ---');
        try {
            const db = await connectToMainDb();
            console.log('Borrando todos los nightPlan antiguos...');
            await db.collection('events').updateMany({ nightPlan: { $exists: true } }, { $unset: { nightPlan: "" } });
            console.log('Planes antiguos eliminados.');
        } catch (error) {
            console.error("Error borrando los planes antiguos:", error);
            return res.status(500).json({ error: 'Fallo al borrar planes antiguos.' });
        }
    }

    console.log(`--- Procesando lote desde el evento #${offset} ---`);
    try {
        const db = await connectToMainDb();
        const eventsCollection = db.collection('events');

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const eventsToProcess = await eventsCollection.find({
            date: { $gte: today.toISOString().split('T')[0] }
        }).sort({ date: 1 }).skip(offset).limit(BATCH_SIZE).toArray();

        if (eventsToProcess.length === 0) {
            console.log('--- REGENERACIÓN MASIVA FINALIZADA ---');
            return res.status(200).json({ message: `Regeneración completada. No hay más eventos que procesar.` });
        }

        console.log(`Se encontraron ${eventsToProcess.length} eventos en este lote. Procesando...`);

        for (const event of eventsToProcess) {
            // ... (la lógica de procesar cada evento se mantiene igual)
        }

        // 3. PASAR EL TESTIGO: Si hemos procesado un lote completo, nos auto-invocamos para el siguiente.
        if (eventsToProcess.length === BATCH_SIZE) {
            const nextOffset = offset + BATCH_SIZE;
            const currentUrl = new URL(req.url, `https://${req.headers.host}`);
            const nextUrl = `${currentUrl.origin}${currentUrl.pathname}?secret=${process.env.ADMIN_SECRET_KEY}&offset=${nextOffset}`;

            console.log(`Lote completado. Pasando el testigo al siguiente corredor en la URL: ${nextUrl}`);
            // Hacemos fetch a nosotros mismos para iniciar el siguiente lote, pero no esperamos (fire and forget)
            fetch(nextUrl);
        } else {
            console.log('--- REGENERACIÓN MASIVA FINALIZADA (último lote procesado) ---');
        }

        return res.status(200).json({ message: `Lote desde ${offset} procesado. ${eventsToProcess.length} eventos actualizados.` });

    } catch (error) {
        console.error(`Error fatal en el lote desde ${offset}:`, error);
        return res.status(500).json({ error: `El proceso ha fallado en el lote desde ${offset}.` });
    }
}