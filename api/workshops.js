const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

// Best-effort warm-instance cache: reduces duplicate upstream requests in Vercel.
const cache = globalThis.__rideonWorkshopCache || (globalThis.__rideonWorkshopCache = new Map());
const CACHE_TTL_MS = 5 * 60 * 1000;

function json(res, status, body, cacheControl = 'no-store') {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl);
  return res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  const url = new URL(req.url, `https://${req.headers.host || 'rideon.local'}`);
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  const radius = Math.min(Math.max(Number(url.searchParams.get('radius')) || 7000, 1000), 15000);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return json(res, 400, { error: 'Valid latitude and longitude are required.' });
  }

  const cacheKey = `${lat.toFixed(2)}:${lng.toFixed(2)}:${radius}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
    return json(res, 200, cached.data, 'public, s-maxage=120, stale-while-revalidate=300');
  }

  const query = `[out:json][timeout:12];(node[shop=motorcycle](around:${radius},${lat},${lng});way[shop=motorcycle](around:${radius},${lat},${lng});relation[shop=motorcycle](around:${radius},${lat},${lng}););out center tags;`;
  let lastError = null;
  for (const endpoint of ENDPOINTS) {
    let timer;
    try {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), 14000);
      const upstream = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Accept': 'application/json', 'User-Agent': 'RIDEON/1.0 (workshop finder)' },
        body: query,
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!upstream.ok) {
        lastError = new Error(`Workshop provider returned ${upstream.status}`);
        // 429 means provider rate limiting; don't hammer another endpoint immediately.
        if (upstream.status === 429) break;
        continue;
      }
      const data = await upstream.json();
      cache.set(cacheKey, { time: Date.now(), data });
      return json(res, 200, data, 'public, s-maxage=120, stale-while-revalidate=300');
    } catch (err) {
      if (timer) clearTimeout(timer);
      lastError = err;
    }
  }

  // If this warm instance has older results, serve them rather than failing the customer flow.
  if (cached?.data) {
    console.warn('RIDEON workshops serving stale cache:', lastError?.message || lastError);
    return json(res, 200, { ...cached.data, rideonStale: true }, 'public, s-maxage=60, stale-while-revalidate=300');
  }
  console.warn('RIDEON workshops provider unavailable:', lastError?.message || lastError);
  // Graceful fallback: frontend can still offer Google Maps search around the user's GPS.
  return json(res, 200, {
    elements: [],
    rideonFallback: true,
    fallbackUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng} bengkel motor`)}`,
    message: 'Data bengkel sementara dibatasi. Gunakan Google Maps untuk mencari bengkel terdekat.'
  }, 'public, s-maxage=30, stale-while-revalidate=60');
};
