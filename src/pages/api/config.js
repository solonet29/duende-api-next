import { connectToMainDb } from '@/lib/database.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        const db = await connectToMainDb();

        const config = await db.collection('config').findOne({ _id: 'main_config' });

        if (!config) {
            return res.status(200).json({ welcomeModal_enabled: false });
        }

        res.status(200).json(config);

    } catch (error) {
        console.error("Error al obtener la configuración:", error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}