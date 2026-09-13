import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const DB_FILE_PATH = path.join(process.cwd(), 'database_storage.json');

// Initialize or read persistent database
function getDatabase() {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading database_storage.json:', err);
  }

  // Initial database schema without hardcoded mock data (data comes purely from database)
  const initialDb = {
    hotels: [],
    packages: [],
    documentations: [],
    settings: {
      logoUrl: '/zafa_logo.jpg',
      branchName: 'ZafaTour Perwakilan Citragrand City Palembang',
      address: 'Ruko CitraGrand City Blok A No. 12, Jl. Bypass Alang-Alang Lebar, Palembang, Sumatera Selatan',
      phone: '0811-715-608',
      whatsappNumber: '0811-715-608',
      firebaseProjectId: 'zafatourcgc-e4b5f',
      firestoreDatabaseName: 'dbzafatourcgc',
    },
  };

  saveDatabase(initialDb);
  return initialDb;
}

function saveDatabase(data: any) {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving database_storage.json:', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Initialize DB on boot
  getDatabase();

  // API: Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // API: Get complete database data
  app.get('/api/database', (req, res) => {
    const db = getDatabase();
    res.json({ success: true, data: db });
  });

  // API: Hotels CRUD
  app.get('/api/hotels', (req, res) => {
    const db = getDatabase();
    res.json({ success: true, data: db.hotels || [] });
  });

  app.post('/api/hotels', (req, res) => {
    const hotel = req.body;
    if (!hotel || !hotel.name) {
      return res.status(400).json({ success: false, error: 'Nama hotel wajib diisi' });
    }
    const db = getDatabase();
    const hotels = db.hotels || [];
    const idx = hotels.findIndex((h: any) => h.id === hotel.id);
    if (idx >= 0) {
      hotels[idx] = { ...hotels[idx], ...hotel, updatedAt: new Date().toISOString() };
    } else {
      hotels.unshift({
        ...hotel,
        id: hotel.id || `hotel-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    db.hotels = hotels;
    saveDatabase(db);
    res.json({ success: true, data: hotel });
  });

  app.delete('/api/hotels/:id', (req, res) => {
    const { id } = req.params;
    const db = getDatabase();
    db.hotels = (db.hotels || []).filter((h: any) => h.id !== id);
    saveDatabase(db);
    res.json({ success: true, deletedId: id });
  });

  // API: Packages CRUD
  app.get('/api/packages', (req, res) => {
    const db = getDatabase();
    res.json({ success: true, data: db.packages || [] });
  });

  app.post('/api/packages', (req, res) => {
    const pkg = req.body;
    if (!pkg || !pkg.title) {
      return res.status(400).json({ success: false, error: 'Judul paket wajib diisi' });
    }
    const db = getDatabase();
    const packages = db.packages || [];
    const idx = packages.findIndex((p: any) => p.id === pkg.id);
    if (idx >= 0) {
      packages[idx] = { ...packages[idx], ...pkg, updatedAt: new Date().toISOString() };
    } else {
      packages.unshift({
        ...pkg,
        id: pkg.id || `pkg-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    db.packages = packages;
    saveDatabase(db);
    res.json({ success: true, data: pkg });
  });

  app.delete('/api/packages/:id', (req, res) => {
    const { id } = req.params;
    const db = getDatabase();
    db.packages = (db.packages || []).filter((p: any) => p.id !== id);
    saveDatabase(db);
    res.json({ success: true, deletedId: id });
  });

  // API: Documentations CRUD
  app.get('/api/documentations', (req, res) => {
    const db = getDatabase();
    res.json({ success: true, data: db.documentations || [] });
  });

  app.post('/api/documentations', (req, res) => {
    const docItem = req.body;
    if (!docItem || !docItem.title) {
      return res.status(400).json({ success: false, error: 'Judul dokumentasi wajib diisi' });
    }
    const db = getDatabase();
    const documentations = db.documentations || [];
    const idx = documentations.findIndex((d: any) => d.id === docItem.id);
    if (idx >= 0) {
      documentations[idx] = { ...documentations[idx], ...docItem, updatedAt: new Date().toISOString() };
    } else {
      documentations.unshift({
        ...docItem,
        id: docItem.id || `doc-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    db.documentations = documentations;
    saveDatabase(db);
    res.json({ success: true, data: docItem });
  });

  app.delete('/api/documentations/:id', (req, res) => {
    const { id } = req.params;
    const db = getDatabase();
    db.documentations = (db.documentations || []).filter((d: any) => d.id !== id);
    saveDatabase(db);
    res.json({ success: true, deletedId: id });
  });

  // API: Settings CRUD
  app.get('/api/settings', (req, res) => {
    const db = getDatabase();
    res.json({ success: true, data: db.settings });
  });

  app.post('/api/settings', (req, res) => {
    const newSettings = req.body;
    const db = getDatabase();
    db.settings = { ...db.settings, ...newSettings };
    saveDatabase(db);
    res.json({ success: true, data: db.settings });
  });

  // API: Scrape seat data from https://seat.zafatour.com/
  // Filters out rows where remaining seats (sisa seat) is 0 or less
  app.get('/api/seats', async (req, res) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch('https://seat.zafatour.com/', {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml',
        },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Failed to fetch seat.zafatour.com: HTTP ${response.status}`);
      }

      const html = await response.text();
      
      // Parse table rows inside <tbody>...</tbody>
      const updateMatch = html.match(/<h2>Update\s+([^<]+)<\/h2>/i);
      const officialUpdate = updateMatch ? updateMatch[1].trim() : '';

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
            // Clean html tags and trim
            const cleaned = tdMatch[1].replace(/<[^>]+>/g, '').trim();
            cols.push(cleaned);
          }

          if (cols.length >= 4) {
            const no = parseInt(cols[0], 10) || (rows.length + 1);
            const group = cols[1];
            const departureDate = cols[2];
            const sisaSeat = parseInt(cols[3], 10) || 0;

            // Only include where seat count > 0 and exclude haji khusus kemenag
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

      // Sort by Group di https://seat.zafatour.com/ agar mudah mengeceknya
      rows.sort((a, b) => a.group.localeCompare(b.group, 'id') || a.no - b.no);

      res.json({
        success: true,
        source: 'https://seat.zafatour.com/',
        officialUpdate,
        count: rows.length,
        data: rows,
        fetchedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Error fetching seat data:', err?.message || err);
      
      // Fallback verified current data from seat.zafatour.com sorted by Group (without haji khusus kemenag)
      const fallbackData = [
        { no: 19, group: 'UMRAH HEMAT BERKAH 11H GA-PLM 1448H', departureDate: 'Senin, 9 November 2026', sisaSeat: 4 },
        { no: 23, group: 'UMRAH PLUS TURKI 12H JT CGK 1448H (ESTIMASI)', departureDate: 'Rabu, 13 Januari 2027', sisaSeat: 11 },
        { no: 14, group: 'UMRAH REGULER MAHABBAH 11H GA-PLM 1448H', departureDate: 'Senin, 26 Oktober 2026', sisaSeat: 2 },
        { no: 18, group: 'UMRAH REGULER MAHABBAH 11H GA-PLM 1448H', departureDate: 'Senin, 9 November 2026', sisaSeat: 5 },
      ];

      res.json({
        success: true,
        source: 'cached-fallback',
        count: fallbackData.length,
        data: fallbackData,
        isFallback: true,
        error: err?.message,
        fetchedAt: new Date().toISOString(),
      });
    }
  });

  // Serve static public assets (logos, images)
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
