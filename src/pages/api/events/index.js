import { connectToDatabase } from '@/lib/database.js';
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
        'http://localhost:5173'
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
    // Cache de Vercel: 60 segundos, con revalidación en segundo plano
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');

    try {
        const db = await connectToDatabase();
        const eventsCollection = db.collection("events");

        const {
            search = null,
            artist = null,
            city = null,
            country = null,
            dateFrom = null,
            dateTo = null,
            timeframe = null,
            preferredOption = null,
            lat = null,
            lon = null,
            radius = null
        } = req.query;

        // --- LISTAS DE REFERENCIA (PAÍSES ACTUALIZADOS) ---
        const paises = [
            // Solicitados
            'Japón', 'China', 'Corea del Sur', 'Alemania', 'EEUU', 'Reino Unido', 'Suecia',
            // Europa (UE y otros importantes)
            'España', 'Francia', 'Italia', 'Portugal', 'Países Bajos', 'Bélgica', 'Austria',
            'Bulgaria', 'Croacia', 'Chipre', 'República Checa', 'Dinamarca', 'Estonia',
            'Finlandia', 'Grecia', 'Hungría', 'Irlanda', 'Letonia', 'Lituania', 'Luxemburgo',
            'Malta', 'Polonia', 'Rumanía', 'Eslovaquia', 'Eslovenia', 'Suiza', 'Noruega',
            // Otros
            'Argentina'
        ];

        const ciudadesYProvincias = [
            'Sevilla', 'Málaga', 'Granada', 'Cádiz', 'Ceuta' 'Córdoba', 'Huelva', 'Jaén', 'Almería',
            'Madrid', 'Barcelona', 'Valencia', 'Murcia', 'Alicante', 'Bilbao', 'Zaragoza',
            'Jerez', 'Úbeda', 'Baeza', 'Ronda', 'Estepona', 'Lebrija', 'Morón de la Frontera',
            'Utrera', 'Algeciras', 'Cartagena', 'Logroño', 'Santander', 'Vitoria', 'Pamplona',
            'Vigo', 'A Coruña', 'Oviedo', 'Gijón', 'León', 'Salamanca', 'Valladolid', 'Burgos',
            'Cáceres', 'Badajoz', 'Toledo', 'Cuenca', 'Guadalajara', 'Albacete'
        ];

        // 1. INICIALIZAMOS de EL PIPELINE DE AGREGACIÓN
        let aggregationPipeline = [];

        // 2. (OPCIONAL) ETAPA GEOESPACIAL: Si hay búsqueda por ubicación, DEBE ser la primera etapa.
        if (lat && lon && radius) {
            const latitude = parseFloat(lat);
            const longitude = parseFloat(lon);
            const searchRadiusMeters = (parseFloat(req.query.radius) || 60) * 1000;

            if (isNaN(latitude) || isNaN(longitude) || isNaN(searchRadiusMeters)) {
                return res.status(400).json({ message: 'Parámetros de geolocalización inválidos.' });
            }

            aggregationPipeline.push({
                $geoNear: {
                    near: { type: 'Point', coordinates: [longitude, latitude] },
                    distanceField: 'dist.calculated',
                    maxDistance: searchRadiusMeters,
                    spherical: true
                }
            });
        }

        // 3. (OPCIONAL) ETAPA DE BÚSQUEDA DE TEXTO (ATLAS SEARCH)
        // Solo la usamos si NO hay una búsqueda geoespacial (tienen conflictos de prioridad).
        if (search && !lat) {
            const normalizedSearch = search.trim().toLowerCase();
            let searchType = null;

            if (ciudadesYProvincias.some(cp => cp.toLowerCase() === normalizedSearch)) {
                searchType = 'city';
            } else if (paises.some(p => p.toLowerCase().includes(normalizedSearch))) {
                searchType = 'country';
            } else {
                searchType = 'text';
            }

            if (searchType === 'text') {
                aggregationPipeline.push({
                    $search: {
                        index: 'buscador',
                        text: {
                            query: search,
                            path: { 'wildcard': '*' },
                            fuzzy: { "maxEdits": 1 }
                        }
                    }
                });
            }
        }

        // 4. CONSTRUIMOS EL FILTRO `$match` PARA EL RESTO DE CONDICIONES
        const matchFilter = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Filtros por defecto que casi siempre aplican
        matchFilter.date = { $gte: today.toISOString().split('T')[0] };
        matchFilter.name = { $ne: null, $nin: ["", "N/A"] };

        // Aplicamos el término de búsqueda como un filtro normal si hay geolocalización
        if (search && lat) {
            const searchRegex = new RegExp(search, 'i');
            matchFilter.$or = [
                { name: searchRegex },
                { artist: searchRegex },
                { city: searchRegex },
                { venue: searchRegex }
            ];
        }

        // Añadimos el resto de filtros de los query params
        if (city) {
            const locationRegex = new RegExp(city, 'i');
            matchFilter.city = locationRegex;
        }
        if (country) {
            matchFilter.country = { $regex: new RegExp(`^${country}$`, 'i') };
        }
        if (artist) {
            matchFilter.artist = { $regex: new RegExp(artist, 'i') };
        }
        if (dateFrom) {
            matchFilter.date.$gte = dateFrom;
        }
        if (dateTo) {
            matchFilter.date.$lte = dateTo;
        }
        if (timeframe === 'week' && !dateTo) {
            const nextWeek = new Date(today);
            nextWeek.setDate(today.getDate() + 7);
            matchFilter.date.$lte = nextWeek.toISOString().split('T')[0];
        }

        // 5. AÑADIMOS LOS FILTROS Y OTRAS ETAPAS AL PIPELINE
        aggregationPipeline.push({ $match: matchFilter });

        // Agrupamos para eliminar duplicados (mismo artista, misma fecha)
        aggregationPipeline.push({
            $group: {
                _id: { date: "$date", artist: "$artist", name: "$name" },
                firstEvent: { $first: "$$ROOT" }
            }
        });

        aggregationPipeline.push({ $replaceRoot: { newRoot: "$firstEvent" } });

        // Aseguramos que los campos de estado del blog estén presentes
        aggregationPipeline.push({
            $addFields: {
                contentStatus: '$contentStatus',
                blogPostUrl: '$blogPostUrl'
            }
        });

        // 6. (OPCIONAL) ORDENACIÓN FINAL
        // Si hubo búsqueda geoespacial, los resultados ya vienen ordenados por distancia.
        // Si no, los ordenamos por fecha.

        aggregationPipeline.push({ $sort: { date: 1 } });


        // 7. EJECUTAMOS EL PIPELINE
        const events = await eventsCollection.aggregate(aggregationPipeline).toArray();
        res.status(200).json({ events, isAmbiguous: false });

    } catch (err) {
        console.error("Error en /api/events:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
}