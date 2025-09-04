// models/globalMetrics.js

const mongoose = require('mongoose');

const globalMetricsSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        unique: true, // Solo un documento de métricas globales por día
        index: true,
    },
    totalEventsInSystem: { type: Number, default: 0 },
    newEventsIngested: { type: Number, default: 0 },
    blogPostsCreated: { type: Number, default: 0 },
    searches: {
        total: { type: Number, default: 0 },
        byCity: { type: mongoose.Schema.Types.Mixed, default: {} },
        nearMe: { type: Number, default: 0 },
    },
});

module.exports = globalMetricsSchema;