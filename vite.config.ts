import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig(({ mode }) => ({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 100000,
    // `vite build --mode artifact`: one JS file (no lazy chunks) so it can be inlined into a
    // single shareable HTML page; output in dist-artifact/.
    ...(mode === 'artifact' ? { outDir: 'dist-artifact', rollupOptions: { output: { inlineDynamicImports: true } } } : {}),
  },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
}));
