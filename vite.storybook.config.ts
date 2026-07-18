import { resolve } from 'node:path';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [preact()],
  build: {
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'storybook/preact-story.tsx'),
      formats: ['es'],
      fileName: () => 'preact-story.js',
    },
    outDir: resolve(__dirname, '.storybook-build'),
    sourcemap: true,
  },
});
