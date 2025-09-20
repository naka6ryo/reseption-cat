import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // VOICEVOX Engine (default: http://127.0.0.1:50021)
      '/api/voicevox': {
        target: 'http://127.0.0.1:50021',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/voicevox/, ''),
      },
    },
  },
});
