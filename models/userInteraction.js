// models/userInteraction.js

const mongoose = require('mongoose');

const userInteractionSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now,
        index: true, // Vital para análisis basados en rangos de tiempo
    },
    type: {
        type: String,
        required: true,
        enum: ['eventView', 'nearMeSearch', 'filterUse', 'planNightRequest'],
        index: true, // Para poder separar y contar interacciones por tipo rápidamente
    },
    sessionId: {
        type: String,
        required: true,
    },
    details: {
        type: mongoose.Schema.Types.Mixed, // 'Mixed' nos da total flexibilidad para el objeto de detalles
        required: true,
    },
});

module.exports = userInteractionSchema;