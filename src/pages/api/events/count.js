// RUTA: /src/pages/api/events/count.js

import { connectToDatabase } from '../../../../lib/database';

export default async function handler(req, res) {
    res.setHeader('Cache-control', 'no-store, max-age=0');
    try {
        const db = await connectToDatabase();
        const eventsCollection = db.collection("events");
        const todayString = new Date().toISOString().split('T')[0];
        const count = await eventsCollection.countDocuments({
            date: { $gte: todayString },
            name: { $ne: null, $nin: ["", "N/A"] },
            artist: { $ne: null, $nin: ["", "N/A"] },
            time: { $ne: null, $nin: ["", "N/A"] },
            venue: { $ne: null, $nin: ["", "N/A"] }
        });
        res.status(200).json({ total: count });
    } catch (error) {
        console.error("Error al contar eventos:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
}