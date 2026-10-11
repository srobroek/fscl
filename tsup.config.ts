import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  external: ['@actual-app/api'],
  outDir: 'dist',
  format: ['esm'],
  sourcemap: false,
  clean: true,
  minify: false,
  splitting: true,
  target: 'node22',
  shims: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
