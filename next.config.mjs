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
      {
        // LA REGLA QUE FALTABA
        source: '/generate-night-plan',
        destination: '/api/generate-night-plan',
      },
    ]
  },
}

// Si tu archivo es .mjs, usa export default. Si es .js, usa module.exports
export default nextConfig; 
// module.exports = nextConfig;