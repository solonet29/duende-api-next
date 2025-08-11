// lib/cors.js

import Cors from 'cors';

// Inicializamos el middleware de CORS
const cors = Cors({
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'], // Permite estos métodos
    origin: 'http://127.0.0.1:5500', // El origen de tu frontend
});

// Helper para ejecutar el middleware
export default function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
}