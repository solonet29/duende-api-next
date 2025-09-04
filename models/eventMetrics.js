// models/eventMetrics.js

const mongoose = require('mongoose');

const eventMetricsSchema = new mongoose.Schema({
    // Referencia al evento original en la base de datos de producción
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event', // Asumiendo que tu modelo de eventos se llama 'Event'
        required: true,
        index: true, // Indexamos para búsquedas rápidas por evento
        unique: true, // Solo puede haber un documento de métricas por evento
    },
    eventDate: {
        type: Date,
        required: true,
    },
    artist: {
        type: String,
        index: true, // Indexamos para poder hacer rankings de artistas eficientemente
    },
    venue: String,
    city: {
        type: String,
        index: true, // Clave para filtrar por ciudades
    },
    province: String,
    location: {
        type: {
            type: String,
            enum: ['Point'],
            required: true,
        },
        coordinates: {
            type: [Number], // [longitud, latitud]
            required: true,
        },
    },
    metrics: {
        views: { type: Number, default: 0 },
        planNightRequests: { type: Number, default: 0 },
        nearMeAppearances: { type: Number, default: 0 },
        blogPostGenerated: { type: Boolean, default: false },
    },
    lastUpdated: {
        type: Date,
        default: Date.now,
    },
});

// Importante para las búsquedas geoespaciales
eventMetricsSchema.index({ location: '2dsphere' });

// El modelo será exportado y utilizado por la conexión de analíticas
module.exports = eventMetricsSchema;
