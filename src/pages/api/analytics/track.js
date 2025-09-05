// pages/api/analytics/track.js

import { getUserInteractionModel } from '@/lib/database'; // ❗Ajusta la ruta a tu archivo de conexión DB

export default async function handler(req, res) {
    // Solo permitimos peticiones POST a este endpoint
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        const { type, sessionId, details } = req.body;

        // Validación básica
        if (!type || !sessionId || !details) {
            return res.status(400).json({ msg: 'Faltan datos en la petición' });
        }

        // Creamos la nueva instancia de la interacción
        // El modelo de Mongoose funciona exactamente igual aquí
        const UserInteractionModel = await getUserInteractionModel();
        const newInteraction = new UserInteractionModel({
            type,
            sessionId,
            details,
        });

        // Guardamos en la base de datos `duende_analytics`
        await newInteraction.save();

        // Respondemos con éxito. 201 significa "Created".
        return res.status(201).json({ msg: 'Interacción registrada con éxito' });

    } catch (err) {
        console.error('Error al registrar interacción:', err.message);
        return res.status(500).json({ msg: 'Error del servidor' });
    }
}