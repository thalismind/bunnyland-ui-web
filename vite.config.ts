import { resolve } from 'node:path';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [preact()],
  build: {
    emptyOutDir: false,
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        api: resolve(__dirname, 'src/api.ts'),
        play: resolve(__dirname, 'src/play.ts'),
        theme: resolve(__dirname, 'src/theme.ts'),
        widgets: resolve(__dirname, 'src/widgets.ts'),
        'player-widgets': resolve(__dirname, 'src/player-widgets.ts'),
        'admin-widgets': resolve(__dirname, 'src/admin-widgets.ts'),
        preact: resolve(__dirname, 'src/preact.ts'),
      },
      formats: ['es'],
    },
    rolldownOptions: {
      external: /^preact(?:\/.*)?$/,
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
    sourcemap: true,
  },
});
