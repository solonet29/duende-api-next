// RUTA: /lib/database.js

import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = "DuendeDB";

if (!MONGO_URI) {
    throw new Error('La variable de entorno MONGO_URI no está definida.');
}

let cachedDb = null;

export async function connectToDatabase() {
    if (cachedDb) {
        return cachedDb;
    }
    try {
        const client = await MongoClient.connect(MONGO_URI);
        const db = client.db(DB_NAME);
        cachedDb = db;
        return db;
    } catch (error) {
        console.error("Error al conectar con la base de datos:", error);
        throw new Error("No se pudo establecer conexión con la base de datos.");
    }
}