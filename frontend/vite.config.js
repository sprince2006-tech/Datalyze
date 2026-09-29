const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

const backend = process.env.VITE_DEV_BACKEND_URL || 'http://localhost:5000';

module.exports = defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/socket.io': { target: backend, changeOrigin: true, ws: true },
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          charts: ['recharts'],
          socket: ['socket.io-client'],
        },
      },
    },
  },
});