import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  server: {
    fs: {
      allow: ['.']
    }
  },
  plugins: [
    {
      name: 'serve-root-assets',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Normalize URL by removing query params
          const urlPath = req.url.split('?')[0];
          
          if (urlPath.startsWith('/blesses/') || urlPath === '/output.csv') {
            const filePath = path.join(process.cwd(), urlPath);
            if (fs.existsSync(filePath)) {
              if (urlPath.endsWith('.csv')) {
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
              } else if (urlPath.endsWith('.png')) {
                res.setHeader('Content-Type', 'image/png');
              }
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }
          next();
        });
      },
      closeBundle() {
        const distDir = path.join(process.cwd(), 'dist');
        if (!fs.existsSync(distDir)) return;
        
        // Copy output.csv
        const csvSrc = path.join(process.cwd(), 'output.csv');
        const csvDest = path.join(distDir, 'output.csv');
        if (fs.existsSync(csvSrc)) {
          fs.copyFileSync(csvSrc, csvDest);
          console.log('✓ Copied output.csv to dist');
        }
        
        // Copy blesses directory
        const blessesSrc = path.join(process.cwd(), 'blesses');
        const blessesDest = path.join(distDir, 'blesses');
        if (fs.existsSync(blessesSrc)) {
          if (!fs.existsSync(blessesDest)) {
            fs.mkdirSync(blessesDest);
          }
          const files = fs.readdirSync(blessesSrc);
          let count = 0;
          for (const file of files) {
            const srcFile = path.join(blessesSrc, file);
            if (fs.statSync(srcFile).isFile()) {
              fs.copyFileSync(srcFile, path.join(blessesDest, file));
              count++;
            }
          }
          console.log(`✓ Copied ${count} assets from blesses to dist`);
        }
      }
    }
  ]
});
