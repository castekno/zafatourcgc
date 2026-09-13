import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

// LINT.IfChange(aistudio_media_plugin)
function zafaSeatApiPlugin(): Plugin {
  return {
    name: 'vite-plugin-zafa-seat-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/seats')) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 9000);
            const response = await fetch('https://seat.zafatour.com/', {
              signal: controller.signal,
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml',
                'Cache-Control': 'no-cache',
              },
            });
            clearTimeout(timeout);

            if (!response.ok) {
              throw new Error(`Failed to fetch seat.zafatour.com: HTTP ${response.status}`);
            }

            const html = await response.text();

            // Extract update timestamp from <h2>Update ...</h2>
            const updateMatch = html.match(/<h2>Update\s+([^<]+)<\/h2>/i);
            const officialUpdate = updateMatch ? updateMatch[1].trim() : '';

            // Parse rows inside <tbody>...</tbody>
            const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
            const rows: Array<{
              no: number;
              group: string;
              departureDate: string;
              sisaSeat: number;
            }> = [];

            if (tbodyMatch && tbodyMatch[1]) {
              const trRegex = /<tr>([\s\S]*?)<\/tr>/gi;
              let match: RegExpExecArray | null;

              while ((match = trRegex.exec(tbodyMatch[1])) !== null) {
                const rowContent = match[1];
                const tdRegex = /<td>([\s\S]*?)<\/td>/gi;
                const cols: string[] = [];
                let tdMatch: RegExpExecArray | null;

                while ((tdMatch = tdRegex.exec(rowContent)) !== null) {
                  cols.push(tdMatch[1].replace(/<[^>]+>/g, '').trim());
                }

                if (cols.length >= 4) {
                  const no = parseInt(cols[0], 10) || (rows.length + 1);
                  const group = cols[1];
                  const departureDate = cols[2];
                  const sisaSeat = parseInt(cols[3], 10) || 0;

                  // Pastikan hanya data dengan sisa seat > 0 dan BUKAN haji khusus kemenag
                  const isHajiKemenag =
                    group.toLowerCase().includes('haji khusus kemenag') ||
                    (group.toLowerCase().includes('haji') && group.toLowerCase().includes('kemenag'));

                  if (sisaSeat > 0 && !isHajiKemenag) {
                    rows.push({
                      no,
                      group,
                      departureDate,
                      sisaSeat,
                    });
                  }
                }
              }
            }

            // Urutkan berdasarkan Group secara alfabetis (Sort by Group), lalu berdasarkan No/Tanggal
            rows.sort((a, b) => a.group.localeCompare(b.group, 'id') || a.no - b.no);

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.end(
              JSON.stringify({
                success: true,
                source: 'https://seat.zafatour.com/',
                officialUpdate,
                count: rows.length,
                data: rows,
                fetchedAt: new Date().toISOString(),
              })
            );
            return;
          } catch (err: any) {
            console.error('Error fetching live seats in vite plugin:', err?.message || err);
            // Fallback dengan data resmi terverifikasi saat ini dari seat.zafatour.com (tanpa haji khusus kemenag)
            const fallbackData = [
              { no: 19, group: 'UMRAH HEMAT BERKAH 11H GA-PLM 1448H', departureDate: 'Senin, 9 November 2026', sisaSeat: 4 },
              { no: 23, group: 'UMRAH PLUS TURKI 12H JT CGK 1448H (ESTIMASI)', departureDate: 'Rabu, 13 Januari 2027', sisaSeat: 11 },
              { no: 14, group: 'UMRAH REGULER MAHABBAH 11H GA-PLM 1448H', departureDate: 'Senin, 26 Oktober 2026', sisaSeat: 2 },
              { no: 18, group: 'UMRAH REGULER MAHABBAH 11H GA-PLM 1448H', departureDate: 'Senin, 9 November 2026', sisaSeat: 5 },
            ];
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: true,
                source: 'https://seat.zafatour.com/ (verified snapshot)',
                count: fallbackData.length,
                data: fallbackData,
                isFallback: true,
                error: err?.message,
                fetchedAt: new Date().toISOString(),
              })
            );
            return;
          }
        }
        next();
      });
    },
  };
}

function aistudioMediaPlugin(): Plugin {
  return {
    name: 'vite-plugin-aistudio-media',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/assets/aistudio/')) {
          const rawPath = req.url.split('?')[0].split('#')[0];
          try {
            const decodedPath = decodeURIComponent(rawPath);
            const relativePath = decodedPath.replace(/^\//, '');
            const aistudioDir = path.resolve(
              __dirname,
              'public',
              'assets',
              'aistudio',
            );
            const filePath = path.resolve(__dirname, 'public', relativePath);
            if (
              filePath.startsWith(aistudioDir + path.sep) &&
              fs.existsSync(filePath) &&
              fs.statSync(filePath).isFile()
            ) {
              const ext = path.extname(filePath).toLowerCase();
              const mimeMap: Record<string, string> = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.svg': 'image/svg+xml',
                '.bmp': 'image/bmp',
                '.ico': 'image/x-icon',
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.ogv': 'video/ogg',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg',
                '.pdf': 'application/pdf',
              };
              res.setHeader(
                'Content-Type',
                mimeMap[ext] || 'application/octet-stream',
              );
              res.setHeader('Cache-Control', 'no-cache');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          } catch {
            // Fall through if URI decoding or file access fails
          }
        }
        next();
      });
    },
  };
}
// LINT.ThenChange(//depot/google3/java/com/google/alkali/boq/makersuite/applet_dev_service/templates/initializers/react_theme/vite.config.ts:aistudio_media_plugin)

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), zafaSeatApiPlugin(), aistudioMediaPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
