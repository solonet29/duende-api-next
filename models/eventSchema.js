// models/eventSchema.js
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        default: 'Evento de Flamenco',
    },
    artist: {
        type: String,
        required: true,
        trim: true,
        index: true, // Indexamos para búsquedas rápidas por artista
    },
    description: {
        type: String,
        trim: true,
    },
    date: {
        type: Date,
        required: true,
        index: true, // Indexamos para búsquedas rápidas por fecha
    },
    time: {
        type: String,
    },
    venue: {
        type: String,
        trim: true,
    },
    city: {
        type: String,
        trim: true,
    },
    country: {
        type: String,
        trim: true,
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
        },
        coordinates: {
            type: [Number], // [longitud, latitud]
        },
    },
    imageUrl: {
        type: String,
    },
    sourceUrl: {
        type: String,
        required: true,
    },
    blogPostUrl: {
        type: String,
    },
    featured: {
        type: Boolean,
        default: false,
    },
    contentStatus: {
        type: String,
        enum: ['pending', 'published'],
        default: 'pending',
    }
}, {
    timestamps: true, // Añade automáticamente createdAt y updatedAt
});

// Creamos un índice geoespacial para las búsquedas "Cerca de Mí"
eventSchema.index({ location: '2dsphere' });

module.exports = eventSchema;