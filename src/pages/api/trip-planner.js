// RUTA: /src/pages/api/trip-planner.js

import { connectToDatabase } from '@/lib/database.js';
import Cors from 'cors';

// --- MIDDLEWARE DE CORS ---
const corsMiddleware = Cors({
    origin: ['https://buscador.afland.es', 'https://duende-frontend.vercel.app', 'http://localhost:3000', 'https://afland.es', 'http://127.0.0.1:5500'],
    methods: ['POST', 'OPTIONS'],
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

// --- HANDLER DE LA RUTA ---
export default async function handler(req, res) {
    await runMiddleware(req, res, corsMiddleware);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'POST') {
        const { destination, startDate, endDate } = req.body;

        if (!destination || !startDate || !endDate) {
            return res.status(400).json({ error: 'Faltan datos para el plan de viaje.' });
        }

        try {
            const db = await connectToDatabase();
            const eventsCollection = db.collection("events");
            const filter = {
                city: { $regex: new RegExp(destination, 'i') },
                date: { $gte: startDate, $lte: endDate }
            };
            const events = await eventsCollection.find(filter).sort({ date: 1 }).toArray();

            if (events.length === 0) {
                return res.status(200).json({ text: "¡Qué pena! No se han encontrado eventos de flamenco para estas fechas y destino. Te sugiero probar con otro rango de fechas o explorar peñas flamencas y tablaos locales en la ciudad." });
            }

            const eventList = events.map(ev => `- ${new Date(ev.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}: "${ev.name}" con ${ev.artist} en ${ev.venue}.`).join('\n');

            const tripPrompt = `Actúa como el mejor planificador de viajes de flamenco de Andalucía. Eres amigable, experto y apasionado. Un viajero quiere visitar ${destination} desde el ${startDate} hasta el ${endDate}. Su lista de espectáculos disponibles es:\n${eventList}\n\nTu tarea es crear un itinerario detallado y profesional. Sigue ESTRICTAMENTE estas reglas:\n\n1.  **Estructura por Días:** Organiza el plan por día.\n2.  **Títulos Temáticos:** Dale a cada día un título temático y evocador (ej. "Martes: Inmersión en el Sacromonte", "Miércoles: Noche de Cante Jondo").\n3.  **Días con Eventos:** Haz que el espectáculo de la lista sea el punto culminante del día, sugiriendo actividades que lo complementen.\n4.  **Días Libres:** Para los días sin espectáculos, ofrece dos alternativas claras: un "Plan A" (una actividad cultural principal como visitar un museo, un barrio emblemático o una tienda de guitarras) y un "Plan B" (una opción más relajada o diferente, como una clase de compás o un lugar con vistas para relajarse).\n5.  **Glosario Final:** Al final de todo el itinerario, incluye una sección \`### Glosario Flamenco para el Viajero\` donde expliques brevemente 2-3 términos clave que hayas usado (ej. peña, tablao, duende, tercio).\n\nUsa un tono inspirador y práctico. Sigue envolviendo los nombres de lugares recomendados entre corchetes: [Nombre del Lugar].`;

            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
            const payload = { contents: [{ role: "user", parts: [{ text: tripPrompt }] }] };
            const geminiResponse = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!geminiResponse.ok) {
                const errorData = await geminiResponse.text();
                console.error("Error de la API de Gemini:", errorData);
                throw new Error('La IA no pudo generar el plan de viaje.');
            }

            const data = await geminiResponse.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

            res.status(200).json({ text: text });

        } catch (error) {
            console.error("Error en el planificador de viajes:", error);
            res.status(500).json({ error: "Error interno del servidor." });
        }
    } else {
        res.setHeader('Allow', ['POST', 'OPTIONS']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}