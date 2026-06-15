import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
  worker: {
    format: 'es',
  },
  plugins: [
    viteSingleFile(),
  ],
}));