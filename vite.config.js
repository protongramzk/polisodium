import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        two: resolve(__dirname, 'two/index.html'), // Memberi tahu Vite untuk ikut mem-build folder two
      },
    },
  },
});
