import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', scripts: 'src/scripts.ts' },
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: true,
  // the shared package is TypeScript source — bundle it in
  noExternal: ['@mrak8/shared'],
});
