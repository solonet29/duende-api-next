// pages/api/analytics/summary/total-views.js

// ❗ Ajusta la ruta para que apunte a tu archivo de conexión a la BD
import { UserInteraction } from '../../../../config/db';

export default async function handler(req, res) {
    // Este endpoint solo responde a peticiones GET
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        // Usamos el método countDocuments de Mongoose para contar eficientemente
        // Contamos solo las interacciones de tipo 'eventView'
        const count = await UserInteraction.countDocuments({ type: 'eventView' });

        // Enviamos la respuesta con el total
        return res.status(200).json({ totalViews: count });

    } catch (err) {
        console.error('Error al contar las visualizaciones de eventos:', err.message);
        return res.status(500).json({ msg: 'Error del servidor al obtener el conteo' });
    }
}