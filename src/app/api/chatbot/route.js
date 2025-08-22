
import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import Groq from 'groq-sdk';

// --- Configuración ---
const mongoUri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || 'DuendeDB';
const eventsCollectionName = 'events';
const groqApiKey = process.env.GROQ_API_KEY;

// Verificación de variables de entorno críticas
if (!mongoUri || !groqApiKey) {
    console.error("Error: Faltan variables de entorno críticas (MONGO_URI o GROQ_API_KEY).");
    // No lanzamos un error en tiempo de carga, pero lo manejaremos en la petición
}

// --- Inicialización de Clientes ---
const groq = new Groq({ apiKey: groqApiKey });
let client;

// Función para conectar a MongoDB de forma reutilizable
async function connectToDatabase() {
    if (client && client.topology && client.topology.isConnected()) {
        return client.db(dbName);
    }
    client = new MongoClient(mongoUri);
    await client.connect();
    return client.db(dbName);
}

// --- Prompt para la IA ---
const createPrompt = (question, context) => `
    Eres "El Duende", un asistente de IA experto en flamenco y eventos culturales en España.
    Tu objetivo es responder a las preguntas del usuario de forma amable, concisa y útil, basándote en el contexto que te proporciono.

    REGLAS:
    1.  Responde únicamente con la información del "CONTEXTO". Si la respuesta no está en el contexto, di amablemente que no tienes esa información.
    2.  Sé breve y directo. No inventes detalles.
    3.  Si el contexto está vacío, indica que no has encontrado eventos relacionados con la pregunta.
    4.  Habla en español.

    CONTEXTO (Eventos encontrados en la base de datos):
    ---
    ${context}
    ---

    PREGUNTA DEL USUARIO:
    "${question}"

    Respuesta:
`;

export async function POST(request) {
    // Verificar si las variables de entorno están cargadas
    if (!mongoUri || !groqApiKey) {
        return NextResponse.json({ error: 'El servidor no está configurado correctamente.' }, { status: 500 });
    }

    try {
        const { pregunta } = await request.json();

        if (!pregunta) {
            return NextResponse.json({ error: 'La pregunta es obligatoria.' }, { status: 400 });
        }

        // 1. Buscar contexto en MongoDB
        const db = await connectToDatabase();
        const eventsCollection = db.collection(eventsCollectionName);

        // Búsqueda por texto. Asegúrate de tener un índice de texto en tu colección.
        // Ejemplo: db.events.createIndex({ title: "text", description: "text" })
        const events = await eventsCollection.find(
            { $text: { $search: pregunta } },
            { projection: { title: 1, description: 1, date: 1, location: 1, _id: 0 } }
        ).limit(5).toArray();

        // 2. Formatear el contexto
        const context = events.length > 0
            ? events.map(e => `Evento: ${e.title}. Descripción: ${e.description}. Fecha: ${e.date}. Ciudad: ${e.location?.city}`).join('\n---\n')
            : "No se encontraron eventos relevantes.";

        // 3. Construir el prompt y llamar a Groq
        const chatPrompt = createPrompt(pregunta, context);

        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: chatPrompt }],
            model: 'llama3-8b-8192', // Un modelo rápido y eficiente
        });

        const aiResponse = completion.choices[0]?.message?.content || "Lo siento, no he podido generar una respuesta.";

        // 4. Devolver la respuesta
        return NextResponse.json({ respuesta: aiResponse });

    } catch (error) {
        console.error("Error en /api/chatbot:", error);
        return NextResponse.json({ error: 'Ha ocurrido un error al procesar tu solicitud.' }, { status: 500 });
    }
}
