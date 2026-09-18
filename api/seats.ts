import type { IncomingMessage, ServerResponse } from 'http';

interface SeatRow {
  no: number;
  group: string;
  departureDate: string;
  sisaSeat: number;
}

// Fallback verified snapshot from https://seat.zafatour.com/ (18 September 2026)
const CURRENT_FALLBACK_SEATS: SeatRow[] = [
  { no: 16, group: 'UMRAH HEMAT BERKAH 11H GA-PLM 1448H', departureDate: 'Senin, 9 November 2026', sisaSeat: 1 },
  { no: 17, group: 'UMRAH REGULER MAHABBAH 11H GA-PLM 1448H', departureDate: 'Senin, 16 November 2026', sisaSeat: 2 },
  { no: 19, group: 'UMRAH PLUS TURKI 12H JT CGK 1448H (ESTIMASI)', departureDate: 'Rabu, 13 Januari 2027', sisaSeat: 11 },
];

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Set CORS headers so this endpoint can be fetched from any domain/client
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // Cache on Vercel Edge for 60 seconds to provide instant response and prevent overloading seat.zafatour.com
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch('https://seat.zafatour.com/', {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`seat.zafatour.com returned HTTP ${response.status}`);
    }

    const html = await response.text();

    // Parse Update string from <h2>Update ...</h2>
    const updateMatch = html.match(/<h2>Update\s+([^<]+)<\/h2>/i);
    const officialUpdate = updateMatch ? updateMatch[1].trim() : 'Terbaru';

    // Parse table rows from <tbody>...</tbody>
    const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
    const rows: SeatRow[] = [];

    if (tbodyMatch && tbodyMatch[1]) {
      const trRegex = /<tr>([\s\S]*?)<\/tr>/gi;
      let match: RegExpExecArray | null;

      while ((match = trRegex.exec(tbodyMatch[1])) !== null) {
        const rowContent = match[1];
        const tdRegex = /<td>([\s\S]*?)<\/td>/gi;
        const cols: string[] = [];
        let tdMatch: RegExpExecArray | null;

        while ((tdMatch = tdRegex.exec(rowContent)) !== null) {
          const cleaned = tdMatch[1].replace(/<[^>]+>/g, '').trim();
          cols.push(cleaned);
        }

        if (cols.length >= 4) {
          const no = parseInt(cols[0], 10) || 0;
          const group = cols[1];
          const departureDate = cols[2];
          const sisaSeat = parseInt(cols[3], 10) || 0;

          // Filter: Sisa Seat > 0 dan BUKAN Haji Khusus Kemenag
          const cleanGroup = group.toLowerCase();
          const isHajiKemenag =
            cleanGroup.includes('haji khusus kemenag') ||
            (cleanGroup.includes('haji') && cleanGroup.includes('kemenag'));

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

    // Urutkan berdasarkan Group secara alfabetis (Sort by Group), lalu nomor
    rows.sort((a, b) => a.group.localeCompare(b.group, 'id') || a.no - b.no);

    if (rows.length > 0) {
      res.statusCode = 200;
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
    }

    // Jika parsing 0 baris, kirimkan fallback snapshot
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: true,
        source: 'https://seat.zafatour.com/ (fallback snapshot)',
        officialUpdate,
        count: CURRENT_FALLBACK_SEATS.length,
        data: CURRENT_FALLBACK_SEATS,
        isFallback: true,
        fetchedAt: new Date().toISOString(),
      })
    );
  } catch (err: any) {
    clearTimeout(timeout);
    console.error('Error fetching live seats on Vercel Serverless Function:', err);
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: true,
        source: 'https://seat.zafatour.com/ (error fallback)',
        officialUpdate: '18 September 2026 - 08:53:16',
        count: CURRENT_FALLBACK_SEATS.length,
        data: CURRENT_FALLBACK_SEATS,
        isFallback: true,
        error: err?.message,
        fetchedAt: new Date().toISOString(),
      })
    );
  }
}
