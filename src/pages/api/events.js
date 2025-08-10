// RUTA: /src/pages/api/events.js

import { connectToDatabase } from '../../lib/database';
import cors from 'cors';

// Helper para inicializar CORS, necesario en Next.js
const corsMiddleware = cors({
    origin: ['https://buscador.afland.es', 'https://duende-frontend.vercel.app', 'http://localhost:3000', 'https://afland.es'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
});

// Helper para poder usar middlewares de Express en Next.js
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

export default async function handler(req, res) {
    // Primero ejecutamos el middleware de CORS para permitir las peticiones del frontend
    await runMiddleware(req, res, corsMiddleware);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    try {
        const db = await connectToDatabase();
        const eventsCollection = db.collection("events");
        const { search, artist, city, country, dateFrom, dateTo, timeframe, preferredOption } = req.query;
        let aggregationPipeline = [];
        
        const ciudadesYProvincias = [
            'Sevilla', 'Málaga', 'Granada', 'Cádiz', 'Córdoba', 'Huelva', 'Jaén', 'Almería', 
            'Madrid', 'Barcelona', 'Valencia', 'Murcia', 'Alicante', 'Bilbao', 'Zaragoza',
            'Jerez', 'Úbeda', 'Baeza', 'Ronda', 'Estepona', 'Lebrija', 'Morón de la Frontera',
            'Utrera', 'Algeciras', 'Cartagena', 'Logroño', 'Santander', 'Vitoria', 'Pamplona',
            'Vigo', 'A Coruña', 'Oviedo', 'Gijón', 'León', 'Salamanca', 'Valladolid', 'Burgos',
            'Cáceres', 'Badajoz', 'Toledo', 'Cuenca', 'Guadalajara', 'Albacete'
        ];
        const paises = ['Argentina', 'España', 'Francia'];
        const terminosAmbiguos = {
         'argentina': { type: 'multi', options: ['country', 'artist'] },
         'granaino': { type: 'multi', options: ['city', 'artist'] }
        };

        const matchFilter = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        matchFilter.date = { $gte: today.toISOString().split('T')[0] };
        matchFilter.name = { $ne: null, $nin: ["", "N/A"] };
        matchFilter.artist = { $ne: null, $nin: ["", "N/A"] };
        matchFilter.time = { $ne: null, $nin: ["", "N/A"] };
        matchFilter.venue = { $ne: null, $nin: ["", "N/A"] };
        
        if (search) {
            const normalizedSearch = search.trim().toLowerCase();
            
            if (terminosAmbiguos[normalizedSearch] && !preferredOption) {
                return res.status(200).json({
                    isAmbiguous: true,
                    searchTerm: search,
                    options: terminosAmbiguos[normalizedSearch].options
                });
            }

            let searchType = null;
            if (preferredOption) {
              searchType = preferredOption;
            } else if (ciudadesYProvincias.some(cp => cp.toLowerCase() === normalizedSearch)) {
              searchType = 'city';
            } else if (paises.some(p => p.toLowerCase() === normalizedSearch)) {
              searchType = 'country';
            } else {
              searchType = 'text';
            }

            if (searchType === 'city') {
                const locationRegex = new RegExp(search, 'i');
                matchFilter.$or = [{ city: locationRegex }, { provincia: locationRegex }];
            } else if (searchType === 'country') {
                matchFilter.country = { $regex: new RegExp(`^${search}$`, 'i') };
            } else if (searchType === 'artist') {
                 aggregationPipeline.push({
                     $search: {
                         index: 'buscador',
                         text: {
                             query: search,
                             path: 'artist',
                             fuzzy: { "maxEdits": 1 }
                         }
                     }
                 });
            } else { // 'text'
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
        
        if (city) {
            const locationRegex = new RegExp(city, 'i');
            matchFilter.$or = [{ city: locationRegex }, { provincia: locationRegex }];
        }
        if (country) matchFilter.country = { $regex: new RegExp(`^${country}$`, 'i') };
        if (artist) matchFilter.artist = { $regex: new RegExp(artist, 'i') };
        if (dateFrom) matchFilter.date.$gte = dateFrom;
        if (dateTo) matchFilter.date.$lte = dateTo;
        if (timeframe === 'week' && !dateTo) {
            const nextWeek = new Date(today);
            nextWeek.setDate(today.getDate() + 7);
            matchFilter.date.$lte = nextWeek.toISOString().split('T')[0];
        }
        
        aggregationPipeline.push({ $match: matchFilter });
        aggregationPipeline.push({ $sort: { date: 1 } });
        
        const events = await eventsCollection.aggregate(aggregationPipeline).toArray();
        res.status(200).json({ events, isAmbiguous: false });
    } catch (error) {
        console.error("Error al buscar eventos:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
}