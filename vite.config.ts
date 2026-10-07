import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** Dev-only: POST a PNG data URL to /__shot?name=x and it lands in .shots/x.png (for automated visual checks). */
function devScreenshots(): Plugin {
  return {
    name: 'dev-screenshots',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__shot', (req, res) => {
        const name = new URL(req.url ?? '', 'http://x').searchParams.get('name')?.replace(/[^\w-]/g, '') || 'shot';
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          const dir = join(server.config.root, '.shots');
          mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, `${name}.png`), Buffer.from(body.replace(/^data:image\/png;base64,/, ''), 'base64'));
          res.end('ok');
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [devScreenshots()],
});
