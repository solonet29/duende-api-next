// RUTA: /lib/database.js
// VERSIÓN COMPLETA CON TODOS LOS MODELOS NECESARIOS

import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI;
const ANALYTICS_DB_URI = process.env.ANALYTICS_DB_URI;

if (!MONGO_URI || !ANALYTICS_DB_URI) {
    throw new Error('Por favor, define MONGO_URI y ANALYTICS_DB_URI en tus variables de entorno.');
}

// Usamos una variable global para guardar las promesas de conexión y reutilizarlas.
let cached = global.mongooseConnections;
if (!cached) {
    cached = global.mongooseConnections = { main: null, analytics: null };
}

// --- GESTOR DE CONEXIÓN A LA BD PRINCIPAL ---
export async function connectToMainDb() {
    if (cached.main) {
        return cached.main;
    }
    if (!cached.main) {
        const opts = { bufferCommands: false };
        cached.main = mongoose.createConnection(MONGO_URI, opts).asPromise();
    }
    await cached.main;
    return cached.main;
}

// --- GESTOR DE CONEXIÓN A LA BD DE ANALÍTICAS ---
export async function connectToAnalyticsDb() {
    if (cached.analytics) {
        return cached.analytics;
    }
    if (!cached.analytics) {
        const opts = { bufferCommands: false };
        cached.analytics = mongoose.createConnection(ANALYTICS_DB_URI, opts).asPromise();
    }
    await cached.analytics;
    return cached.analytics;
}

// --- DEFINICIÓN Y EXPORTACIÓN DE MODELOS ---

// Modelo para la BD Principal
export const getEventModel = async () => {
    const mainConnection = await connectToMainDb();
    return mainConnection.models.Event || mainConnection.model('Event', require('../models/eventSchema')); // Ajusta la ruta a tu schema
};

// Modelos para la BD de Analíticas
export const getUserInteractionModel = async () => {
    const analyticsConnection = await connectToAnalyticsDb();
    return analyticsConnection.models.UserInteraction || analyticsConnection.model('UserInteraction', require('../models/userInteraction')); // Ajusta la ruta a tu schema
};

// ▼▼▼ FUNCIÓN AÑADIDA ▼▼▼
export const getEventMetricsModel = async () => {
    const analyticsConnection = await connectToAnalyticsDb();
    return analyticsConnection.models.EventMetrics || analyticsConnection.model('EventMetrics', require('../models/eventMetrics')); // Ajusta la ruta a tu schema
};
// ▲▲▲ FIN DE LA FUNCIÓN AÑADIDA ▲▲▲