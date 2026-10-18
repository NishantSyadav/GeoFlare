
import { defineConfig, loadEnv } from 'vite';
import process from 'node:process';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
  define: {
    __USE_MOCK_HOTSPOTS__: JSON.stringify(mode === 'development' && env.VITE_USE_MOCK_HOTSPOTS === 'true'),
  },
  plugins: [react(), tailwindcss()],
  };
});
