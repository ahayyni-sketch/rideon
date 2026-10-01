module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    return res.status(500).json({ ok: false, service: 'RIDEON', error: 'Supabase environment variables are not configured.' });
  }
  return res.status(200).json({ ok: true, service: 'RIDEON', supabaseUrl: url, supabaseAnonKey: key });
};
