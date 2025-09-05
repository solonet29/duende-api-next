// src/pages/api/analytics/top-artists.js

// Usamos nuestros gestores de modelos de Mongoose para mantener la consistencia
import { getUserInteractionModel, getEventMetricsModel } from '@/lib/database';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // Obtenemos los modelos (esto también gestiona la conexión a la BD de analíticas)
    const UserInteraction = await getUserInteractionModel();
    const EventMetrics = await getEventMetricsModel();

    // Creamos la "Aggregation Pipeline" para procesar los datos
    const pipeline = [
      // 1. Filtrar solo las interacciones de tipo 'eventView'
      { $match: { type: 'eventView' } },

      // 2. Agrupar por eventId para contar las vistas de cada evento
      { $group: { _id: "$details.eventId", views: { $sum: 1 } } },

      // 3. Unir con nuestra colección de MÉTRICAS (eventmetrics), no con la de producción
      {
        $lookup: {
          from: EventMetrics.collection.name, // Nombre de la colección del modelo de Mongoose
          localField: '_id',
          foreignField: 'eventId',
          as: 'metricDetails'
        }
      },

      // 4. Descomprimir el resultado y filtrar los que no tengan artista
      { $unwind: "$metricDetails" },
      { $match: { "metricDetails.artist": { $ne: null, $ne: "" } } },

      // 5. Agrupar por el nombre del artista para sumar todas sus vistas
      {
        $group: {
          _id: "$metricDetails.artist",
          totalViews: { $sum: "$views" }
        }
      },

      // 6. Ordenar de mayor a menor y limitar al top 5
      { $sort: { totalViews: -1 } },
      { $limit: 5 },

      // 7. Proyectar el formato de salida final
      {
        $project: {
          _id: 0,
          artist: "$_id",
          views: "$totalViews"
        }
      }
    ];

    const topArtists = await UserInteraction.aggregate(pipeline);

    // Añadimos caché para el rendimiento (1 hora)
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

    return res.status(200).json(topArtists);

  } catch (err) {
    console.error('Error al obtener el top de artistas:', err);
    return res.status(500).json({ msg: 'Error del servidor al obtener el top de artistas' });
  }
}

