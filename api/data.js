// Lee los resúmenes de la demo desde Supabase usando la llave de servidor.
// La llave solo vive en variables de entorno de Vercel; el navegador nunca la ve.
const FUNCIONES = {
  direccion: 'demo_direccion',
  planta: 'demo_planta',
  calidad: 'demo_calidad',
  comercial: 'demo_comercial',
  campo: 'demo_operacion_campo',
  claude: 'demo_claude',
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');

  const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!base || !key) {
    return res.status(500).json({
      error: 'config',
      mensaje: 'Faltan las variables SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en Vercel.',
    });
  }

  const codigo = process.env.DEMO_ACCESS_CODE;
  if (codigo && req.headers['x-access-code'] !== codigo) {
    return res.status(401).json({ error: 'auth', mensaje: 'Código de acceso requerido.' });
  }

  const area = String(req.query?.area || 'direccion');
  const fn = FUNCIONES[area];
  if (!fn) return res.status(400).json({ error: 'area', mensaje: 'Área no válida.' });

  const headers = { apikey: key, 'Content-Type': 'application/json' };
  // Las llaves nuevas (sb_secret_...) no son JWT: solo van en apikey.
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;

  try {
    const r = await fetch(`${base}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: '{}' });
    if (!r.ok) {
      return res.status(502).json({ error: 'supabase', mensaje: `Supabase respondió ${r.status}.` });
    }
    return res.status(200).json(await r.json());
  } catch {
    return res.status(502).json({ error: 'red', mensaje: 'No se pudo contactar a Supabase.' });
  }
}
