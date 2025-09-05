// RUTA: /src/pages/api/generate-night-plan.js (Versión Final Corregida)

import { connectToMainDb } from '@/lib/database.js';
import { ObjectId } from 'mongodb';
import Groq from 'groq-sdk';
import cors from 'cors';

// --- INICIALIZACIÓN DE SERVICIOS ---
if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY no está definida.');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// --- MIDDLEWARE DE CORS ---
const allowedOrigins = [
    'https://buscador.afland.es',
    'https://duende-frontend.vercel.app',
    'https://afland.es',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
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
// --- LÓGICA DE GENERACIÓN DE CONTENIDO (SECCIÓN CORREGIDA) ---
// =======================================================================

async function generateAndSavePlan(db, event) {
    console.log(`🔥 Generando nuevo contenido con Groq para: ${event.name}`);

    // --- LÓGICA DE FECHAS Y ENLACE DE GOOGLE MAPS ---
    const eventDate = new Date(event.date);
    const dateOptions = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' };
    const formattedDate = eventDate.toLocaleDateString('es-ES', dateOptions);

    // Reconstruimos aquí la lógica para el enlace de Google Maps
    const mapQuery = [
        event.name,
        event.venue,
        event.city
    ].filter(Boolean).join(', ');

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;

    // --- LLAMADA AL PROMPT ---
    // Pasamos la 'mapsUrl' como un nuevo argumento a la plantilla
    const prompt = nightPlanPromptTemplate(event, formattedDate, mapsUrl);

    const chatCompletion = await groq.chat.completions.create({
        messages: [{
            role: 'user',
            content: prompt,
        }],
        model: 'llama-3.1-8b-instant',
    });

    let generatedContent = chatCompletion.choices[0]?.message?.content || '';

    if (!generatedContent || !generatedContent.includes('---')) {
        console.warn("La respuesta de Groq no tiene el formato esperado. Contenido recibido:", generatedContent);
        throw new Error("La respuesta de la IA no tiene el formato esperado.");
    }

    await db.collection('events').updateOne(
        { _id: event._id },
        { $set: { nightPlan: generatedContent } }
    );
    console.log(`💾 Contenido de Groq para "${event.name}" guardado en la base de datos.`);
    return generatedContent;
}

// =======================================================================
// --- PROMPT MAESTRO (VERSIÓN FINAL CON PRINCIPIO DE PRUDENCIA) ---
// =======================================================================
const nightPlanPromptTemplate = (event, formattedDate, mapsUrl) => `
# REGLA DE ORO: FORMATO Y ESTRUCTURA
Tu misión principal es generar una respuesta que siga ESTRICTAMENTE el formato Markdown y la estructura de 3 secciones separadas por "---". No añadas texto antes de la primera sección o después de la última. La estructura es INNEGOCIABLE.

# INSTRUCCIONES
Eres "Duende Planner", un asistente experto en flamenco y cultura andaluza. Tu objetivo es crear un plan de noche atractivo y útil para un usuario que asistirá a un evento de flamenco. El tono debe ser cercano, apasionado y un poco poético, usando lenguaje que evoque la magia del flamenco.

// --- NUEVA DIRECTRIZ DE CALIDAD ---
- **Principio de Prudencia:** Tu credibilidad es clave. Si no tienes información 100% segura sobre un dato fáctico del artista (biografía, familia, lugar de nacimiento, etc.), **NO LO INVENTES**. En su lugar, enfócate en la emoción del arte flamenco: habla del duende, la pasión, el sentimiento del cante o la fuerza del baile. Tu misión es generar expectación, no ser una enciclopedia.

# CONTEXTO DEL EVENTO
- **Artista Principal:** ${event.artist || 'Artista por confirmar'}
- **Nombre del Evento:** ${event.name}
- **Fecha:** ${formattedDate}
- **Lugar:** ${event.venue || 'Lugar por confirmar'}, ${event.city || ''}
- **Descripción:** ${event.description || 'Sin descripción detallada.'}

# ESTRUCTURA DE LA RESPUESTA (OBLIGATORIA)

### 🔮 Una Noche con Duende: ${event.artist || event.name}
* **La Previa Perfecta:** Describe el ambiente ideal para empezar la noche, como una taberna andaluza o un bar de tapas animado. Sugiere una o dos tapas y una bebida típica (ej: "un buen vino de Jerez"). Indícale al usuario que puede encontrar lugares así explorando los alrededores del recinto en el mapa. **No inventes un nombre específico para el bar.**
* **El Atuendo Ideal:** Sugiere un código de vestimenta. Debe ser elegante pero cómodo, algo que respete la ocasión sin ser excesivamente formal. Piensa en el "smart casual" con un toque andaluz.
* **El Momento Cumbre:** Describe con emoción qué puede esperar el espectador del artista o del evento. Usa lenguaje evocador. Si no tienes datos concretos del artista, aplica el "Principio de Prudencia" y habla sobre la magia del palo flamenco (si se conoce) o del flamenco en general.
* **Después de los Aplausos:** De forma similar a la previa, describe un tipo de lugar con encanto para tomar la última copa y anímale a explorar el mapa para encontrarlo. **No inventes un nombre específico.**

---
### 💡 Consejos del Duende
- **Puntualidad:** Recomienda llegar con tiempo para encontrar un buen sitio y disfrutar del ambiente previo.
- **Respeto y Silencio:** Menciona la importancia de guardar silencio durante el espectáculo para respetar a los artistas y al "duende".
- **Disfruta el Momento:** Anima al usuario a dejarse llevar por la música y la emoción.

---
### 🎟️ Ficha Rápida
- **Qué:** ${event.name}
- **Quién:** ${event.artist || 'Artista por confirmar'}
- **Cuándo:** ${formattedDate} a las ${event.time || 'hora por confirmar'}
- **Dónde:** ${event.venue || 'Lugar por confirmar'}, ${event.city || ''}
- **Cómo llegar:** [Ver en Google Maps](${mapsUrl})
`;


// --- HANDLER DE LA RUTA ---
export default async function handler(req, res) {
    await runMiddleware(req, res, corsMiddleware);

    try {
        const { eventId } = req.query;
        if (!eventId || !ObjectId.isValid(eventId)) {
            return res.status(400).json({ error: 'El ID del evento no es válido.' });
        }

        const db = await connectToMainDb();

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
        console.error("Error en el endpoint de 'Planear Noche' con Groq:", error);
        return res.status(500).json({ error: 'Error al generar el contenido.' });
    }
}
