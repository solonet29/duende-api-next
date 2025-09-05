import { getEventModel } from '@/lib/database.js';

// NOTA: La gestión de CORS es mejor centralizarla en `next.config.js`.
// Si ya lo tienes ahí, puedes eliminar este bloque de CORS de aquí.
// Si no, lo mantenemos para asegurar que funcione.
import cors from 'cors';

const corsMiddleware = cors({
    origin: [
        'https://buscador.afland.es',
        'https://duende-frontend.vercel.app',
        'https://afland.es',
        'http://localhost:3000',
        'http://127.0.0.1:5500',
        'http://0.0.0.0:5500',
        'http://localhost:5173',
        'https://duende-frontend-git-new-fro-50ee05-angel-picon-caleros-projects.vercel.app'
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
// --- FIN DEL BLOQUE CORS ---


export default async function handler(req, res) {
    await runMiddleware(req, res, corsMiddleware);

    try {
        // --- LOG DE DEPURACIÓN 1: Ver los parámetros de entrada ---
        console.log("API /events: Petición recibida con query:", req.query);

        const Event = await getEventModel(); // Obtenemos el modelo de Mongoose

        const {
            search = null, artist = null, city = null, country = null,
            dateFrom = null, dateTo = null, timeframe = null, lat = null,
            lon = null, radius = null, sort = null, featured = null
        } = req.query;

        // --- LISTAS DE REFERENCIA (se mantienen igual) ---
        const featuredArtists = [
            'Farruquito', 'Pedro el Granaino', 'Miguel Poveda', 'Argentina',
            'Marina Heredia', 'Tomatito', 'Alba Heredia', 'Ivan Vargas'
        ];
        const paises = [
            'Japón', 'China', 'Corea del Sur', 'Alemania', 'EEUU', 'Reino Unido', 'Suecia',
            'España', 'Francia', 'Italia', 'Portugal', 'Países Bajos', 'Bélgica', 'Austria',
            'Bulgaria', 'Croacia', 'Chipre', 'República Checa', 'Dinamarca', 'Estonia',
            'Finlandia', 'Grecia', 'Hungría', 'Irlanda', 'Letonia', 'Lituania', 'Luxemburgo',
            'Malta', 'Polonia', 'Rumanía', 'Eslovaquia', 'Eslovenia', 'Suiza', 'Noruega',
            'Argentina'
        ];
        const ciudadesYProvincias = [
            'Sevilla', 'Málaga', 'Granada', 'Cádiz', 'Ceuta', 'Córdoba', 'Huelva', 'Jaén', 'Almería',
            'Madrid', 'Barcelona', 'Valencia', 'Murcia', 'Alicante', 'Bilbao', 'Zaragoza',
            'Jerez', 'Úbeda', 'Baeza', 'Ronda', 'Estepona', 'Lebrija', 'Morón de la Frontera',
            'Utrera', 'Algeciras', 'Cartagena', 'Logroño', 'Santander', 'Vitoria', 'Pamplona',
            'Vigo', 'A Coruña', 'Oviedo', 'Gijón', 'León', 'Salamanca', 'Valladolid', 'Burgos',
            'Cáceres', 'Badajoz', 'Toledo', 'Cuenca', 'Guadalajara', 'Albacete'
        ];

        let aggregationPipeline = [];

        // ETAPA GEOESPACIAL
        if (lat && lon) {
            // Tu lógica de $geoNear se mantiene idéntica
        }

        // ETAPA DE BÚSQUEDA Y FILTRADO
        const matchFilter = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        matchFilter.date = { $gte: today };
        matchFilter.name = { $ne: null, $nin: ["", "N/A"] };

        // El resto de tu lógica de filtros se mantiene idéntica
        if (search && !lat) {
            const normalizedSearch = search.trim().toLowerCase();
            if (ciudadesYProvincias.some(cp => cp.toLowerCase() === normalizedSearch)) {
                matchFilter.city = { $regex: new RegExp(`^${normalizedSearch}$`, 'i') };
            } else if (paises.some(p => p.toLowerCase().includes(normalizedSearch))) {
                matchFilter.country = { $regex: new RegExp(`^${normalizedSearch}$`, 'i') };
            } else {
                matchFilter.$or = [
                    { name: { $regex: new RegExp(search, 'i') } },
                    { artist: { $regex: new RegExp(search, 'i') } },
                    { city: { $regex: new RegExp(search, 'i') } },
                    { venue: { $regex: new RegExp(search, 'i') } }
                ];
            }
        }
        if (featured === 'true') {
            matchFilter.artist = { $in: featuredArtists };
        }
        // ... (etc, todos tus otros if para artist, city, country, dateFrom...)
        aggregationPipeline.push({ $match: matchFilter });

        // ... (tus etapas de $group, $replaceRoot, $addFields se mantienen idénticas)

        // ORDENACIÓN FINAL
        let sortOrder = { date: 1 };
        // ... (tu lógica de sortOrder se mantiene idéntica)
        aggregationPipeline.push({ $sort: sortOrder });

        // --- LOG DE DEPURACIÓN 2: Ver el pipeline final ---
        console.log("API /events: Pipeline de agregación final:", JSON.stringify(aggregationPipeline, null, 2));

        const events = await Event.aggregate(aggregationPipeline);

        // --- LOG DE DEPURACIÓN 3: Ver el resultado ---
        console.log(`API /events: Consulta finalizada. Eventos encontrados: ${events.length}`);
        if (events.length === 0) {
            console.log("ADVERTENCIA: La consulta no devolvió eventos.");
        }

        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
        res.status(200).json({ events, isAmbiguous: false });

    } catch (err) {
        // --- LOG DE DEPURACIÓN 4: Capturar cualquier error ---
        console.error("Error FATAL en /api/events:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
}