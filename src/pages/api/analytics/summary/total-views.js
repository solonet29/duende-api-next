// pages/api/analytics/summary/total-views.js

// 1. Importamos la FUNCIÓN que nos da el modelo, no el modelo directamente.
import { getUserInteractionModel } from '@/lib/database';

export default async function handler(req, res) {
    // Este endpoint solo responde a peticiones GET
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        // 2. Obtenemos el modelo. Esta llamada también se encarga
        //    de gestionar y asegurar la conexión a la base de datos de analíticas.
        const UserInteraction = await getUserInteractionModel();

        // Contamos solo las interacciones de tipo 'eventView'
        const count = await UserInteraction.countDocuments({ type: 'eventView' });

        // 3. (Mejora) Añadimos la caché para mejorar el rendimiento y ahorrar recursos
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

        // Enviamos la respuesta con el total
        return res.status(200).json({ totalViews: count });

    } catch (err) {
        console.error('Error al contar las visualizaciones de eventos:', err.message);
        return res.status(500).json({ msg: 'Error del servidor al obtener el conteo' });
    }
}