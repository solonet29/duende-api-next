// migrate-locations.js
require('dotenv').config({ path: './.env.local' }); // Asegúrate que apunte a tu archivo .env
const { connectToMainDb, closeDatabaseConnection } = require('./lib/database.js'); // Asumo que tienes una función para cerrar la conexión
const axios = require('axios');
const { ObjectId } = require('mongodb');

// Función para introducir una pausa y no saturar la API de Google
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function migrateLocations() {
    console.log('--- 🚀 INICIANDO SCRIPT DE MIGRACIÓN DE UBICACIONES ---');
    let db;

    try {
        // --- 1. CONECTAR A LA BASE DE DATOS ---
        db = await connectToMainDb();
        const eventsCollection = db.collection('events');
        console.log('✅ Conexión a la base de datos exitosa.');

        // --- 2. BUSCAR EVENTOS SIN CAMPO 'location' ---
        const eventsToMigrate = await eventsCollection.find({
            location: { $exists: false },
            city: { $exists: true, $ne: null, $ne: "" } // Solo procesamos eventos que tengan al menos una ciudad
        }).toArray();

        if (eventsToMigrate.length === 0) {
            console.log('🎉 ¡Enhorabuena! No hay eventos que necesiten migración.');
            return;
        }

        console.log(`🔍 Se encontraron ${eventsToMigrate.length} eventos para geolocalizar.`);

        // --- 3. PROCESAR CADA EVENTO ---
        let count = 0;
        for (const event of eventsToMigrate) {
            count++;
            console.log(`\n--- ⚙️ Procesando evento ${count} de ${eventsToMigrate.length}: "${event.name}" en ${event.city} ---`);

            // Construimos una dirección limpia para la búsqueda
            const address = `${event.venue || ''}, ${event.city}, ${event.country || 'España'}`.trim();

            try {
                // --- 4. LLAMAR A LA API DE GEOCODIFICACIÓN DE GOOGLE ---
                const apiKey = process.env.GOOGLE_API_KEY;
                if (!apiKey) throw new Error('La GOOGLE_API_KEY no está definida en el archivo .env');

                const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
                const response = await axios.get(url);

                if (response.data.status === 'OK' && response.data.results.length > 0) {
                    const { lat, lng } = response.data.results[0].geometry.location;

                    // --- 5. CONSTRUIR EL OBJETO GEOJSON ---
                    const locationObject = {
                        type: 'Point',
                        coordinates: [lng, lat] // ¡Importante! [Longitud, Latitud]
                    };

                    // --- 6. ACTUALIZAR EL DOCUMENTO EN MONGODB ---
                    await eventsCollection.updateOne(
                        { _id: new ObjectId(event._id) },
                        { $set: { location: locationObject } }
                    );

                    console.log(`✅ Geolocalización exitosa: [${lng}, ${lat}]. Base de datos actualizada.`);

                } else {
                    console.warn(`⚠️ No se encontraron coordenadas para "${address}". Status: ${response.data.status}`);
                }

            } catch (error) {
                console.error(`❌ Error procesando el evento ID ${event._id}:`, error.message);
            }

            // Pausa de 200ms entre cada llamada para no superar el límite de la API (50 peticiones/segundo)
            await sleep(200);
        }

        console.log('\n\n--- ✅ MIGRACIÓN FINALIZADA ---');

    } catch (error) {
        console.error('Ha ocurrido un error fatal durante la migración:', error);
    } finally {
        // --- 7. CERRAR LA CONEXIÓN ---
        if (db) {
            // Si tienes una función para cerrar la conexión, llámala aquí.
            // await closeDatabaseConnection(); 
            console.log('🔌 Conexión a la base de datos cerrada.');
            // En Next.js, la gestión de la conexión puede ser diferente. Si no hay cierre explícito,
            // el script simplemente terminará. MongoDB Driver 4.x gestiona el pool de conexiones.
            process.exit(0);
        }
    }
}

migrateLocations();