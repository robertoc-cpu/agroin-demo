// Lee los resúmenes de la demo desde Supabase usando la llave de servidor.
// La llave solo vive en variables de entorno de Vercel; el navegador nunca la ve.
const FUNCIONES = {
  direccion: 'demo_direccion',
  planta: 'demo_planta',
  calidad: 'demo_calidad',
  comercial: 'demo_comercial',
  campo: 'demo_operacion_campo',
  iglu: 'demo_iglu',
  claude: 'demo_claude',
};

// Registro de accesos (sin IP ni datos personales): hora, resultado, dispositivo y ubicación aproximada.
async function registrar(req, base, headers, resultado, area) {
  try {
    const ua = String(req.headers['user-agent'] || '');
    const dispositivo = /bot|crawl|spider|preview|slack|whatsapp|facebookexternalhit/i.test(ua) ? 'bot'
      : /ipad|tablet/i.test(ua) ? 'tablet' : /mobile|android|iphone/i.test(ua) ? 'movil' : 'escritorio';
    const navegador = /edg\//i.test(ua) ? 'Edge' : /chrome|crios/i.test(ua) ? 'Chrome' : /firefox|fxios/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'otro';
    const dec = (v) => { try { return decodeURIComponent(String(v || '')); } catch { return String(v || ''); } };
    await fetch(`${base}/rest/v1/rpc/demo_registrar_acceso`, {
      method: 'POST', headers, signal: AbortSignal.timeout(2500),
      body: JSON.stringify({
        p_resultado: resultado, p_area: area, p_dispositivo: dispositivo, p_navegador: navegador,
        p_pais: dec(req.headers['x-vercel-ip-country']), p_region: dec(req.headers['x-vercel-ip-country-region']), p_ciudad: dec(req.headers['x-vercel-ip-city']),
      }),
    });
  } catch { /* el registro nunca debe romper la demo */ }
}

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

  const headers = { apikey: key, 'Content-Type': 'application/json' };
  // Las llaves nuevas (sb_secret_...) no son JWT: solo van en apikey.
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;

  const area = String(req.query?.area || 'direccion');
  const codigo = process.env.DEMO_ACCESS_CODE;
  const enviado = req.headers['x-access-code'];
  if (codigo && enviado !== codigo) {
    await registrar(req, base, headers, enviado ? 'codigo_incorrecto' : 'sin_codigo', area);
    return res.status(401).json({ error: 'auth', mensaje: 'Código de acceso requerido.' });
  }

  const fn = FUNCIONES[area];
  if (!fn) return res.status(400).json({ error: 'area', mensaje: 'Área no válida.' });
  await registrar(req, base, headers, 'ok', area);

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
