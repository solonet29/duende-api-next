// RUTA: /lib/database.js
// VERSIÓN PRO CON CACHÉ DE CLIENTE Y GESTIÓN CENTRALIZADA

import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = "DuendeDB"; // Asegúrate que este es el nombre correcto de tu BBDD

if (!MONGO_URI) {
    throw new Error('La variable de entorno MONGO_URI no está definida.');
}

// Usamos una variable global para guardar la promesa de conexión y reutilizarla
// Esto es una best practice para entornos como Vercel/Next.js
let cachedClientPromise = null;

export async function connectToDatabase() {
    if (cachedClientPromise) {
        console.log("✅ Usando conexión de base de datos cacheada.");
        return cachedClientPromise;
    }

    try {
        console.log("🔥 Creando nueva conexión a la base de datos...");
        const client = new MongoClient(MONGO_URI);
        const clientPromise = client.connect();

        // Guardamos la promesa en la variable de caché
        cachedClientPromise = clientPromise.then(cli => {
            return {
                client: cli,
                db: cli.db(DB_NAME),
            };
        });

        return await cachedClientPromise;
    } catch (error) {
        console.error("Error al conectar con la base de datos:", error);
        throw new Error("No se pudo establecer conexión con la base de datos.");
    }
}