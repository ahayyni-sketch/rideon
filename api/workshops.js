const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
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

  const query = `[out:json][timeout:15];(node[shop=motorcycle](around:${radius},${lat},${lng});way[shop=motorcycle](around:${radius},${lat},${lng});relation[shop=motorcycle](around:${radius},${lat},${lng}););out center tags;`;
  let lastError = null;
  for (const endpoint of ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 18000);
      const upstream = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Accept': 'application/json' },
        body: query,
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!upstream.ok) {
        lastError = new Error(`Workshop provider returned ${upstream.status}`);
        continue;
      }
      const data = await upstream.json();
      return json(res, 200, data);
    } catch (err) {
      lastError = err;
    }
  }
  console.error('RIDEON workshops proxy failed:', lastError?.message || lastError);
  return json(res, 502, { error: 'Workshop map service is temporarily unavailable.' });
};
