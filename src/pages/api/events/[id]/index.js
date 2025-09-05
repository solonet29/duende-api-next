import { connectToMainDb } from '@/lib/database.js';
import { ObjectId } from 'mongodb'; // Importante para buscar por ID

export default async function handler(req, res) {
    // Obtenemos el ID del evento desde la URL (ej. /api/events/ID_AQUI)
    const { id } = req.query;

    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'ID de evento inválido.' });
    }

    try {
        const db = await connectToMainDb();
        const eventsCollection = db.collection("events");

        // Buscamos un único documento que coincida con el ID
        const event = await eventsCollection.findOne({ _id: new ObjectId(id) });

        if (!event) {
            return res.status(404).json({ error: 'Evento no encontrado.' });
        }

        // Aplicamos una caché de larga duración (2 horas), ya que un evento individual no cambia a menudo
        res.setHeader('Cache-Control', 's-maxage=7200, stale-while-revalidate=59');

        res.status(200).json(event); // Devolvemos solo el objeto del evento, sin { events: ... }

    } catch (err) {
        console.error(`Error en /api/events/${id}:`, err);
        res.status(500).json({ error: "Error interno del servidor", details: err.message });
    }
}