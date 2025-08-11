/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/events',
        destination: '/api/events',
      },
      {
        source: '/events/count',
        destination: '/api/events/count',
      },
      // Mañana, cuando migremos las otras rutas, las añadiremos aquí.
      // Por ejemplo:
      // {
      //   source: '/generate-night-plan',
      //   destination: '/api/generate-night-plan',
      // },
    ]
  },
}

export default nextConfig;
