import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const rawGeminiKey = (
    env.GEMINIAPIKEY ||
    process.env.GEMINIAPIKEY ||
    env.VITE_GEMINIAPIKEY ||
    env.VITE_GEMINI_API_KEY ||
    env.GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ''
  ).trim();
  const resolvedGeminiKey = rawGeminiKey === 'MY_GEMINI_API_KEY' ? '' : rawGeminiKey;

  return {
    plugins: [react(), tailwindcss()],
    envPrefix: ['VITE_', 'GEMINI'],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    define: {
      'import.meta.env.GEMINIAPIKEY': JSON.stringify(resolvedGeminiKey),
      'import.meta.env.GEMINI_API_KEY': JSON.stringify(resolvedGeminiKey),
      'process.env.GEMINIAPIKEY': JSON.stringify(resolvedGeminiKey),
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      strictPort: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
    },
  };
});
