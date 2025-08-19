require('dotenv').config({ path: './.env.local' });
const { MongoClient } = require('mongodb');
const webpush = require('./lib/webPush');

const mongoUri = process.env.MONGO_URI;
const dbName = 'DuendeDB';

async function sendTestNotification() {
    console.log('🚀 Iniciando envío de notificaciones de prueba...');
    const client = new MongoClient(mongoUri);

    try {
        await client.connect();
        const db = client.db(dbName);
        const subscriptionsCollection = db.collection('push_subscriptions');

        const subscriptions = await subscriptionsCollection.find({}).toArray();

        if (subscriptions.length === 0) {
            console.log('✅ No hay suscriptores a los que notificar.');
            return;
        }

        console.log(`ℹ️ ${subscriptions.length} suscriptores encontrados. Enviando notificación de prueba...`);

        const payload = JSON.stringify({
            title: '📣 Notificación de Prueba de Duende Finder',
            body: '¡El sistema de notificaciones funciona correctamente! Gracias por suscribirte.',
            icon: 'https://buscador.afland.es/favicon.png',
            url: 'https://buscador.afland.es/'
        });

        let successCount = 0;
        let failureCount = 0;

        const notificationPromises = subscriptions.map(async (sub) => {
            try {
                await webpush.sendNotification(sub, payload);
                successCount++;
            } catch (error) {
                failureCount++;
                console.error(`Error enviando notificación a ${sub.endpoint.substring(0, 50)}...`, error);
                if (error.statusCode === 410 || error.statusCode === 404) {
                    console.log('   -> Suscripción no válida. Eliminando de la BBDD.');
                    await subscriptionsCollection.deleteOne({ _id: sub._id });
                }
            }
        });

        await Promise.all(notificationPromises);

        console.log(`
🎉 Proceso de envío finalizado.`);
        console.log(`   -> ${successCount} notificaciones enviadas con éxito.`);
        console.log(`   -> ${failureCount} envíos fallidos.`);

    } catch (error) {
        console.error('❌ Ha ocurrido un error general en el script de envío:', error);
    } finally {
        await client.close();
        console.log('✅ Conexión a MongoDB cerrada.');
    }
}

sendTestNotification();
