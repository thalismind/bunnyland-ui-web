import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
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
      },
      formats: ['es'],
    },
    rollupOptions: {
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
    sourcemap: true,
  },
});
