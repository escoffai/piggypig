import { defineConfig, type Plugin } from 'vite';
import { promises as fs } from 'node:fs';
import { createReadStream } from 'node:fs';
import { resolve, join, extname } from 'node:path';

// Exposes `/levels/*` as static assets served from `<root>/levels`,
// both in dev (middleware) and in build (copied into dist/levels).
function levelsDir(): Plugin {
  const dirName = 'levels';
  return {
    name: 'pixel-flow-levels',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();
        if (!req.url.startsWith('/' + dirName + '/')) return next();
        const relPath = req.url.slice(1).split('?')[0];
        const full = resolve(server.config.root, relPath);
        try {
          const stat = await fs.stat(full);
          if (!stat.isFile()) return next();
          const ext = extname(full).toLowerCase();
          const mime =
            ext === '.json' ? 'application/json' : ext === '.png' ? 'image/png' : 'application/octet-stream';
          res.setHeader('Content-Type', mime);
          res.setHeader('Cache-Control', 'no-cache');
          createReadStream(full).pipe(res);
        } catch {
          return next();
        }
      });
    },
    async closeBundle() {
      const srcDir = resolve(process.cwd(), dirName);
      const outDir = resolve(process.cwd(), 'dist', dirName);
      try {
        const files = await fs.readdir(srcDir);
        await fs.mkdir(outDir, { recursive: true });
        await Promise.all(
          files.map(async (f) => {
            await fs.copyFile(join(srcDir, f), join(outDir, f));
          }),
        );
      } catch {
        // no levels dir; nothing to copy
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [levelsDir()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
