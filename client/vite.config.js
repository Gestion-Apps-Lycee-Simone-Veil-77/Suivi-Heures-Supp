import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En dev, le frontend tourne sur son propre port (5173) et redirige les
// appels /api vers le serveur Express (3000) — en prod, c'est le même serveur
// Express qui sert tout (voir server/index.js), donc plus besoin de proxy.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
});
