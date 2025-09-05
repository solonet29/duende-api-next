import { connectToMainDb } from '@/lib/database.js';
import Cors from 'cors';

// --- MIDDLEWARE DE CORS ---
// Configuración para permitir peticiones desde tus dominios específicos.
const corsMiddleware = Cors({
    origin: [
        'https://buscador.afland.es',
        'https://duende-frontend.vercel.app',
        'http://localhost:3000',
        'https://afland.es',
        'http://127.0.0.1:5500'
    ],
    methods: ['POST', 'OPTIONS'], // Solo se permiten estos métodos
});

// Función helper para ejecutar el middleware de forma asíncrona
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

// --- HANDLER PRINCIPAL DE LA RUTA ---
export default async function handler(req, res) {
    // Primero, ejecuta el middleware de CORS. Él se encargará de la petición OPTIONS.
    await runMiddleware(req, res, corsMiddleware);

    // Comprueba si el método de la petición es POST.
    if (req.method === 'POST') {
        try {
            // 1. Obtiene y valida los datos del cuerpo de la petición.
            const { destination, startDate, endDate } = req.body;

            if (!destination || !startDate || !endDate) {
                return res.status(400).json({ error: 'Faltan datos para el plan de viaje.' });
            }

            // 2. Busca eventos en la base de datos que coincidan con los criterios.
            const db = await connectToMainDb();
            const eventsCollection = db.collection("events");

            // MEJORA: Se convierten las fechas a objetos Date para una consulta más segura.
            const filter = {
                city: { $regex: new RegExp(destination, 'i') },
                date: { $gte: new Date(startDate), $lte: new Date(endDate) }
            };
            const events = await eventsCollection.find(filter).sort({ date: 1 }).toArray();

            // 3. Si no hay eventos, devuelve una respuesta amigable.
            if (events.length === 0) {
                const noEventsContent = "¡Qué pena! No he encontrado eventos de flamenco para estas fechas y destino. Te sugiero probar con otro rango de fechas o explorar peñas flamencas y tablaos locales en la ciudad para empaparte del ambiente.";
                return res.status(200).json({ content: noEventsContent });
            }

            // 4. Prepara la lista de eventos para el prompt de la IA.
            const eventList = events.map(ev => `- ${new Date(ev.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}: "${ev.name}" con ${ev.artist} en ${ev.venue}.`).join('\n');

            // 5. Construye el prompt detallado para Gemini.
            const tripPrompt = `Actúa como el mejor planificador de viajes de flamenco de Andalucía. Eres amigable, experto y apasionado. Un viajero quiere visitar ${destination} desde el ${startDate} hasta el ${endDate}. Su lista de espectáculos disponibles es:\n${eventList}\n\nTu tarea es crear un itinerario detallado y profesional. Sigue ESTRICTAMENTE estas reglas:\n\n1.  **Estructura por Días:** Organiza el plan por día.\n2.  **Títulos Temáticos:** Dale a cada día un título temático y evocador (ej. "Martes: Inmersión en el Sacromonte", "Miércoles: Noche de Cante Jondo").\n3.  **Días con Eventos:** Haz que el espectáculo de la lista sea el punto culminante del día, sugiriendo actividades que lo complementen.\n4.  **Días Libres:** Para los días sin espectáculos, ofrece dos alternativas claras: un "Plan A" (una actividad cultural principal como visitar un museo, un barrio emblemático o una tienda de guitarras) y un "Plan B" (una opción más relajada o diferente, como una clase de compás o un lugar con vistas para relajarse).\n5.  **Glosario Final:** Al final de todo el itinerario, incluye una sección \`### Glosario Flamenco para el Viajero\` donde expliques brevemente 2-3 términos clave que hayas usado (ej. peña, tablao, duende, tercio).\n\nUsa un tono inspirador y práctico. Sigue envolviendo los nombres de lugares recomendados entre corchetes: [Nombre del Lugar].`;

            // 6. Llama a la API de Gemini.
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

            // 7. Procesa la respuesta y la envía al cliente.
            const data = await geminiResponse.json();
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

            res.status(200).json({ content: content });

        } catch (error) {
            console.error("Error en el planificador de viajes:", error);
            res.status(500).json({ error: "Error interno del servidor." });
        }
    } else {
        // Si el método no es POST, rechaza la petición con el error 405.
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}