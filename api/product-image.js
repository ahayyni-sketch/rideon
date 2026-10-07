const ALLOWED_HOSTS = new Set([
  'shoptr.motul.com',
  'www.lubrificantiricambi.com',
  'down-my.img.susercontent.com',
  'down-id.img.susercontent.com',
  'www.cst.com.tw',
  'www.reifen.com',
  'astraotoshop.com',
  'www.rustysmotorcyclebarn.com',
  'www.ngkntk.com',
  'images.unsplash.com'
]);

function fallbackSvg(label) {
  const safe = String(label || 'RIDEON').replace(/[&<>\"']/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#132a21"/><text x="300" y="285" text-anchor="middle" fill="#c5f36a" font-family="Arial" font-size="42" font-weight="700">${safe}</text><text x="300" y="335" text-anchor="middle" fill="#f3f7f4" font-family="Arial" font-size="22">Product image unavailable</text></svg>`;
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host || 'rideon.local'}`);
  const source = url.searchParams.get('url');
  const label = url.searchParams.get('label') || 'RIDEON';
  if (!source) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    return res.end(fallbackSvg(label));
  }
  let target;
  try { target = new URL(source); } catch {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    return res.end(fallbackSvg(label));
  }
  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    return res.end(fallbackSvg(label));
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const upstream = await fetch(target, { headers: { 'User-Agent': 'RIDEON Product Image Proxy/1.0', 'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' }, signal: controller.signal });
    clearTimeout(timer);
    const contentType = upstream.headers.get('content-type') || '';
    if (!upstream.ok || !contentType.startsWith('image/')) throw new Error(`upstream ${upstream.status} ${contentType}`);
    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.length > 8 * 1024 * 1024) throw new Error('image too large');
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType.split(';')[0]);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.end(buffer);
  } catch (err) {
    console.warn('RIDEON product image proxy fallback:', target.hostname, err?.message || err);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.end(fallbackSvg(label));
  }
};
