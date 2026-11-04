// Consulta diaria muy ligera para que Supabase (plan gratis) no pause el proyecto por inactividad.
// La dispara el cron de vercel.json. No devuelve datos.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!base || !key) return res.status(500).json({ ok: false });
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;
  try {
    const r = await fetch(`${base}/rest/v1/rpc/demo_direccion`, { method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(15000) });
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok });
  } catch {
    return res.status(502).json({ ok: false });
  }
}
