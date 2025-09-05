import { getEventModel } from '@/lib/database.js';
import cors from 'cors';

// --- CONFIGURACIÓN DE CORS ---
const corsMiddleware = cors({
    origin: [
        'https://buscador.afland.es',
        'https://duende-frontend.vercel.app',
        'https://afland.es',
        'http://localhost:3000',
        'http://127.0.0.1:5500',
        'http://0.0.0.0:5500',
        'http://localhost:5173',
        'https://duende-frontend-git-new-fro-50ee05-angel-picon-caleros-projects.vercel.app',
        'https://duende-control-panel.vercel.app'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
});

function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
}

// --- MANEJADOR PRINCIPAL DE LA API ---
export default async function handler(req, res) {
    await runMiddleware(req, res, corsMiddleware);

    try {
        console.log("API /events: Petición recibida con query:", req.query);

        const Event = await getEventModel();

        const {
            search = null, artist = null, city = null, country = null,
            dateFrom = null, dateTo = null, timeframe = null, lat = null,
            lon = null, radius = null, sort = null, featured = null
        } = req.query;

        const featuredArtists = [
            'Farruquito', 'Pedro el Granaino', 'Miguel Poveda', 'Argentina',
            'Marina Heredia', 'Tomatito', 'Alba Heredia', 'Ivan Vargas'
        ];
        const paises = [
            'Japón', 'China', 'Corea del Sur', 'Alemania', 'EEUU', 'Reino Unido', 'Suecia', 'España', 'Francia', 'Italia', 'Portugal', 'Países Bajos', 'Bélgica', 'Austria', 'Bulgaria', 'Croacia', 'Chipre', 'República Checa', 'Dinamarca', 'Estonia', 'Finlandia', 'Grecia', 'Hungría', 'Irlanda', 'Letonia', 'Lituania', 'Luxemburgo', 'Malta', 'Polonia', 'Rumanía', 'Eslovaquia', 'Eslovenia', 'Suiza', 'Noruega', 'Argentina'
        ];
        const ciudadesYProvincias = [
            'Sevilla', 'Málaga', 'Granada', 'Cádiz', 'Ceuta', 'Córdoba', 'Huelva', 'Jaén', 'Almería', 'Madrid', 'Barcelona', 'Valencia', 'Murcia', 'Alicante', 'Bilbao', 'Zaragoza', 'Jerez', 'Úbeda', 'Baeza', 'Ronda', 'Estepona', 'Lebrija', 'Morón de la Frontera', 'Utrera', 'Algeciras', 'Cartagena', 'Logroño', 'Santander', 'Vitoria', 'Pamplona', 'Vigo', 'A Coruña', 'Oviedo', 'Gijón', 'León', 'Salamanca', 'Valladolid', 'Burgos', 'Cáceres', 'Badajoz', 'Toledo', 'Cuenca', 'Guadalajara', 'Albacete'
        ];

        let aggregationPipeline = [];

        if (lat && lon) {
            const latitude = parseFloat(lat);
            const longitude = parseFloat(lon);
            const searchRadiusMeters = (parseFloat(radius) || 60) * 1000;
            if (!isNaN(latitude) && !isNaN(longitude) && !isNaN(searchRadiusMeters)) {
                aggregationPipeline.push({
                    $geoNear: {
                        near: { type: 'Point', coordinates: [longitude, latitude] },
                        distanceField: 'dist.calculated',
                        maxDistance: searchRadiusMeters,
                        spherical: true
                    }
                });
            }
        }

        const matchFilter = {};

        // ▼▼▼ CAMBIO DE DEPURACIÓN ▼▼▼
        console.log("--- MODO DEPURACIÓN: Filtro de fecha DESACTIVADO ---");
        // const today = new Date();
        // today.setHours(0, 0, 0, 0);
        // const todayString = today.toISOString().split('T')[0];
        // matchFilter.date = { $gte: todayString };
        // ▲▲▲ FIN DEL CAMBIO ▲▲▲

        matchFilter.name = { $ne: null, $nin: ["", "N/A"] };

        if (search && !lat) {
            const normalizedSearch = search.trim().toLowerCase();
            if (ciudadesYProvincias.some(cp => cp.toLowerCase() === normalizedSearch)) {
                matchFilter.city = { $regex: new RegExp(`^${normalizedSearch}$`, 'i') };
            } else if (paises.some(p => p.toLowerCase().includes(normalizedSearch))) {
                matchFilter.country = { $regex: new RegExp(`^${normalizedSearch}$`, 'i') };
            } else {
                matchFilter.$or = [
                    { name: { $regex: new RegExp(search, 'i') } }, { artist: { $regex: new RegExp(search, 'i') } },
                    { city: { $regex: new RegExp(search, 'i') } }, { venue: { $regex: new RegExp(search, 'i') } }
                ];
            }
        }
        if (featured === 'true') {
            matchFilter.artist = { $in: featuredArtists };
        }
        if (artist) matchFilter.artist = { $regex: new RegExp(artist, 'i') };
        if (city) matchFilter.city = { $regex: new RegExp(city, 'i') };
        if (country) matchFilter.country = { $regex: new RegExp(`^${country}$`, 'i') };
        if (dateFrom) matchFilter.date = { ...(matchFilter.date || {}), $gte: dateFrom };
        if (dateTo) matchFilter.date = { ...(matchFilter.date || {}), $lte: dateTo };

        // Lógica de timeframe movida aquí para no interferir con el filtro desactivado
        if (timeframe === 'week' && !dateTo) {
            const todayForWeek = new Date();
            todayForWeek.setHours(0, 0, 0, 0);
            const nextWeek = new Date(todayForWeek);
            nextWeek.setDate(todayForWeek.getDate() + 7);
            matchFilter.date = { ...(matchFilter.date || {}), $lte: nextWeek.toISOString().split('T')[0] };
        }

        aggregationPipeline.push({ $match: matchFilter });
        aggregationPipeline.push({ $group: { _id: { date: "$date", artist: "$artist", name: "$name" }, firstEvent: { $first: "$$ROOT" } } });
        aggregationPipeline.push({ $replaceRoot: { newRoot: "$firstEvent" } });
        aggregationPipeline.push({ $addFields: { contentStatus: '$contentStatus', blogPostUrl: '$blogPostUrl' } });

        let sortOrder = { date: 1 };
        if (sort === 'date' && req.query.order === 'desc') sortOrder = { date: -1 };
        if (search && !lat) sortOrder = { score: { $meta: "textScore" } };
        if (!lat) aggregationPipeline.push({ $sort: sortOrder });

        console.log("API /events: Pipeline de agregación final:", JSON.stringify(aggregationPipeline, null, 2));

        const events = await Event.aggregate(aggregationPipeline);

        console.log(`API /events: Consulta finalizada. Eventos encontrados: ${events.length}`);

        if (events.length > 0) {
            console.log("API /events: Mostrando los 3 primeros resultados encontrados:");
            console.log(JSON.stringify(events.slice(0, 3), null, 2));
        }

        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
        res.status(200).json({ events, isAmbiguous: false });

    } catch (err) {
        console.error("Error FATAL en /api/events:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
}