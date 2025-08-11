// RUTA: /src/pages/api/healthcheck.js

export default function handler(req, res) {
  res.status(200).json({ 
    status: 'ok', 
    project: 'duende-api-next', // Mensaje para identificar el proyecto
    timestamp: new Date().toISOString() 
  });
}