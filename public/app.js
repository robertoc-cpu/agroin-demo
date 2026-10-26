// Centro de control Agroin (demo). Sin dependencias: DOM + SVG propios.
const NS = 'http://www.w3.org/2000/svg';
const h = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === false || v == null) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e[k] = v;
    else e.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
};
const s = (tag, attrs = {}, ...kids) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
};

const nf = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const usd = (n) => '$' + nf.format(n ?? 0);
const usdK = (n) => (n >= 1e6 ? '$' + nf1.format(n / 1e6) + ' M' : '$' + nf.format(n / 1e3) + ' mil');
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mes = (ym) => `${MESES[+ym.slice(5, 7) - 1]} ${ym.slice(2, 4)}`;
const fecha = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}` : '');
const fechaHora = (t) =>
  new Date(t).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const uniq = (a) => [...new Set(a)];
const COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)'];

// ---------- gráficas ----------
function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}
function range(vals, zero) {
  const a = vals.filter((v) => v != null);
  let lo = Math.min(...a), hi = Math.max(...a);
  if (zero) lo = Math.min(0, lo);
  if (hi === lo) { hi += 1; lo -= zero ? 0 : 1; }
  const step = niceStep((hi - lo) / 4);
  lo = zero && lo === 0 ? 0 : Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  return [lo, hi, step];
}
function axes(svg, W, H, pad, lo, hi, step, fmt) {
  for (let v = lo; v <= hi + step / 1000; v += step) {
    const y = pad.t + (H - pad.t - pad.b) * (1 - (v - lo) / (hi - lo));
    svg.append(s('line', { class: 'grid-line', x1: pad.l, x2: W - pad.r, y1: y, y2: y }));
    svg.append(s('text', { x: pad.l - 6, y: y + 4, 'text-anchor': 'end' }, fmt(v)));
  }
}
function legend(series) {
  return h('div', { class: 'legend' }, series.map((x) => h('span', {}, h('i', { style: `background:${x.color}` }), x.name)));
}

function lineChart({ labels, series, fmt = (v) => nf.format(v), label = '' }) {
  const W = 640, H = 220, pad = { l: 48, r: 56, t: 12, b: 26 };
  const [lo, hi, step] = range(series.flatMap((x) => x.values), false);
  const X = (i) => pad.l + ((W - pad.l - pad.r) * i) / Math.max(1, labels.length - 1);
  const Y = (v) => pad.t + (H - pad.t - pad.b) * (1 - (v - lo) / (hi - lo));
  const svg = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label });
  axes(svg, W, H, pad, lo, hi, step, fmt);
  labels.forEach((l, i) => {
    if (labels.length > 8 && i % 2) return;
    svg.append(s('text', { x: X(i), y: H - 6, 'text-anchor': 'middle' }, l));
  });
  // las series atenuadas primero, para que las destacadas queden encima
  [...series].sort((a, b) => (b.dim ? 1 : 0) - (a.dim ? 1 : 0)).forEach((x) => {
    let d = '';
    x.values.forEach((v, i) => { if (v != null) d += `${d ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`; });
    svg.append(s('path', { d, fill: 'none', stroke: x.color, 'stroke-width': x.dim ? 1.5 : 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    if (!x.dim) {
      const li = x.values.map((v) => v != null).lastIndexOf(true);
      if (li >= 0) {
        svg.append(s('circle', { cx: X(li), cy: Y(x.values[li]), r: 3.5, fill: x.color }));
        svg.append(s('text', { class: 'dot-label', x: X(li) + 7, y: Y(x.values[li]) + 4 }, fmt(x.values[li])));
      }
    }
  });
  return svg;
}

function colChart({ labels, series, fmt = (v) => nf.format(v), label = '' }) {
  const W = 640, H = 220, pad = { l: 48, r: 12, t: 12, b: 26 };
  const [lo, hi, step] = range(series.flatMap((x) => x.values), true);
  const slot = (W - pad.l - pad.r) / labels.length;
  const bw = Math.min(34, (slot * 0.7) / series.length);
  const Y = (v) => pad.t + (H - pad.t - pad.b) * (1 - (v - lo) / (hi - lo));
  const svg = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label });
  axes(svg, W, H, pad, lo, hi, step, fmt);
  labels.forEach((l, i) => {
    const cx = pad.l + slot * (i + 0.5);
    svg.append(s('text', { x: cx, y: H - 6, 'text-anchor': 'middle' }, l));
    series.forEach((x, k) => {
      const v = x.values[i] ?? 0;
      const bx = cx - (bw * series.length) / 2 + bw * k;
      svg.append(s('rect', { x: bx, y: Y(v), width: bw - 2, height: Math.max(0, Y(0) - Y(v)), rx: 3, fill: x.color }));
    });
  });
  return svg;
}

const card = (title, sub, ...body) => h('section', { class: 'card' }, h('h3', {}, title), sub && h('p', { class: 'sub' }, sub), body);
const kpi = (label, value, note, tone = '') =>
  h('div', { class: `card kpi ${tone}` }, h('div', { class: 'label' }, label), h('div', { class: 'value' }, value), note && h('div', { class: 'note' }, note));
const badge = (text, tone) => h('span', { class: `badge b-${tone}` }, text);
const tone = { Crítica: 'crit', Media: 'warn', Informativa: 'gray', Abierta: 'warn', 'En atención': 'gray', Cerrada: 'ok',
  Pendiente: 'warn', 'En proceso': 'gray', Completada: 'ok', Vencida: 'crit' };
function bars(items, { max, tone: tf = () => '' }) {
  const m = max ?? Math.max(...items.map((i) => i.value), 1);
  return h('div', { class: 'rows' }, items.map((i) =>
    h('div', { class: 'row' },
      h('span', { class: 'name', title: i.name }, i.name),
      h('span', { class: 'track' }, h('span', { class: `fill ${tf(i)}`, style: `width:${Math.max(1.5, (i.value / m) * 100)}%` })),
      h('span', { class: 'num' }, i.text))));
}
const table = (cols, rows) =>
  h('div', { class: 'tw' }, h('table', {},
    h('thead', {}, h('tr', {}, cols.map((c) => h('th', { class: c.n ? 'n' : '' }, c.t)))),
    h('tbody', {}, rows.map((r) => h('tr', {}, cols.map((c) => h('td', { class: c.n ? 'n' : '' }, c.f(r))))))));
const head = (t, lede) => [h('h2', {}, t), h('p', { class: 'lede' }, lede)];

// ---------- vistas ----------
function vDireccion([d, c]) {
  const k = d.kpis;
  const crit = c.alertas.filter((a) => a.severidad === 'Crítica' && a.estado !== 'Cerrada');
  const L = d.costo_kg_mensual.map((x) => mes(x.mes));
  return [
    head('Dirección', 'Resumen de los últimos 30 días cruzando el ERP (SAP) y el sistema operativo interno (SOI).'),
    h('div', { class: 'grid kpis' },
      kpi('Cajas producidas', nf.format(k.cajas_30d), 'Cajas de 5 kg'),
      kpi('Ventas facturadas', usdK(k.ventas_usd_30d), 'USD'),
      kpi('Merma', nf1.format(k.merma_pct_30d) + ' %', 'Del chile procesado'),
      kpi('Costo por kg', '$' + nf1.format(k.costo_kg_30d), 'MXN por kg terminado'),
      kpi('Alertas críticas', k.alertas_criticas, `De ${k.alertas_abiertas} abiertas`, k.alertas_criticas ? 'bad' : ''),
      kpi('Cartera vencida', usdK(k.cartera_vencida_usd), 'USD sin cobrar', 'warn'),
      kpi('Acciones vencidas', k.acciones_vencidas, 'Compromisos fuera de fecha', k.acciones_vencidas ? 'bad' : '')),
    crit.length > 0 && h('div', { class: 'callout' }, h('strong', {}, 'Requieren decisión hoy: '), crit.map((a) => a.titulo).join(' · ')),
    h('div', { class: 'grid two' },
      card('Costo por kg terminado', 'MXN, 2026. Sube por queso, merma y energía.',
        lineChart({ labels: L, series: [{ name: 'MXN/kg', values: d.costo_kg_mensual.map((x) => x.mxn_kg), color: COLORS[0] }], label: 'Costo por kg mensual' })),
      card('Merma mensual', '% del chile que entra a proceso.',
        lineChart({ labels: L, series: [{ name: 'Merma %', values: d.costo_kg_mensual.map((x) => x.merma_pct), color: COLORS[1] }], fmt: (v) => nf1.format(v) + '%', label: 'Merma mensual' })),
      card('Ventas facturadas por mes', 'USD, 2026.',
        colChart({ labels: d.ventas_mensual_usd.map((x) => mes(x.mes)), series: [{ name: 'USD', values: d.ventas_mensual_usd.map((x) => x.usd), color: COLORS[0] }], fmt: (v) => usdK(v), label: 'Ventas mensuales' }))),
  ];
}

function vPlanta(d) {
  const months = uniq(d.merma_linea_mensual.map((x) => x.mes));
  const lineas = uniq(d.merma_linea_mensual.map((x) => x.linea));
  const ser = (key) => lineas.map((l, i) => ({
    name: l, color: COLORS[i],
    values: months.map((m) => d.merma_linea_mensual.find((x) => x.mes === m && x.linea === l)?.[key] ?? null),
  }));
  const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const parosSer = lineas.map((l, i) => ({
    name: l, color: COLORS[i],
    values: dias.map((_, k) => d.paros_dia_semana.find((x) => x.linea === l && x.dow === k + 1)?.paros ?? 0),
  }));
  const lun = d.paros_dia_semana.find((x) => x.linea === 'Línea 2' && x.dow === 1);
  return [
    head('Planta', 'Rendimiento por línea, merma y paros. Aquí es donde el cruce SAP + SOI muestra patrones que un reporte aislado no ve.'),
    lun && h('div', { class: 'callout' }, h('strong', {}, 'Patrón detectado: '),
      `la Línea 2 acumula ${lun.paros} paros en lunes desde marzo, de ${lun.min_prom} min en promedio (falla de banda transportadora en el arranque). El resto de la semana casi no tiene paros largos.`),
    h('div', { class: 'grid two' },
      card('Merma por línea', '% mensual desde abril. El pico de septiembre en Línea 2 se corrigió.',
        lineChart({ labels: months.map(mes), series: ser('merma_pct'), fmt: (v) => nf1.format(v) + '%', label: 'Merma por línea' }), legend(ser('merma_pct'))),
      card('Costo por kg por línea', 'MXN por kg terminado.',
        lineChart({ labels: months.map(mes), series: ser('mxn_kg'), label: 'Costo por kg por línea' }), legend(ser('mxn_kg'))),
      card('Paros por día de la semana', 'Cantidad de paros desde marzo de 2026.',
        colChart({ labels: dias, series: parosSer, label: 'Paros por día' }), legend(parosSer)),
      card('Causas de paro', 'Desde julio de 2026, por minutos perdidos.',
        table([{ t: 'Causa', f: (r) => r.causa }, { t: 'Paros', n: 1, f: (r) => r.paros }, { t: 'Minutos', n: 1, f: (r) => nf.format(r.minutos) }], d.paros_causas))),
  ];
}

function vCalidad(d) {
  const months = uniq(d.dano_mensual.map((x) => x.mes));
  const prods = uniq(d.dano_mensual.map((x) => x.productor));
  const palette = [COLORS[1]];
  const series = prods.map((p) => {
    const hl = /Alamitos/.test(p);
    return { name: p, dim: !hl, color: hl ? palette[0] : 'var(--dim)',
      values: months.map((m) => d.dano_mensual.find((x) => x.mes === m && x.productor === p)?.pct_dano ?? null) };
  });
  return [
    head('Calidad e inocuidad', 'Trazabilidad de cada lote hasta la parcela y vigilancia de certificaciones.'),
    h('div', { class: 'grid two' },
      card('Lotes rechazados por productor', 'Desde julio de 2026. Se rastrea lote → recepción → parcela.',
        bars(d.rechazos_productor.map((x) => ({ name: x.productor, value: x.rechazos, text: `${x.rechazos} rech. · ${x.observaciones} obs.` })),
          { tone: (i) => (i.value >= 5 ? 'bad' : i.value > 0 ? 'warn' : 'dim') })),
      card('Daño del chile en recepción', '% promedio mensual por productor. Gris: demás productores.',
        lineChart({ labels: months.map(mes), series, fmt: (v) => nf1.format(v) + '%', label: 'Daño por productor' })),
      card('Certificaciones', 'Vigencia y días restantes.',
        table([{ t: 'Certificación', f: (r) => r.tipo }, { t: 'Vence', f: (r) => fecha(r.vigencia_fin) },
          { t: 'Estado', f: (r) => badge(r.dias_restantes < 0 ? 'Vencida' : r.dias_restantes <= 60 ? `${r.dias_restantes} días` : 'Vigente', r.dias_restantes < 0 ? 'crit' : r.dias_restantes <= 60 ? 'warn' : 'ok') }],
          d.certificaciones)),
      card('Últimos lotes rechazados', 'Con parcela de origen.',
        table([{ t: 'Fecha', f: (r) => fecha(r.fecha) }, { t: 'Lote', f: (r) => r.lote }, { t: 'Prueba', f: (r) => r.tipo_prueba }, { t: 'Origen', f: (r) => `${r.productor} · ${r.parcela}` }],
          d.rechazos_detalle.slice(0, 10)))),
  ];
}

function vComercial(d) {
  return [
    head('Ventas, cobranza y logística', 'Clientes de Estados Unidos, cartera contra límite de crédito y cumplimiento en cruces fronterizos.'),
    h('div', { class: 'grid two' },
      card('Cartera vencida por cliente', 'USD vencidos y % de su límite de crédito.',
        bars(d.cartera.map((x) => ({ name: x.cliente, value: x.vencido_usd, pct: x.vencido_usd / x.limite, text: `${usd(x.vencido_usd)} · ${Math.round((100 * x.vencido_usd) / x.limite)}%` })),
          { tone: (i) => (i.pct > 0.5 ? 'bad' : i.pct > 0.2 ? 'warn' : 'dim') })),
      card('Ventas por cliente (2026)', 'USD facturados en el año.',
        bars(d.ventas_cliente.map((x) => ({ name: x.cliente, value: x.usd, text: usdK(x.usd) })), {})),
      card('Embarques por cruce', 'Retraso mayor a 1 día o temperatura máxima sobre -12 °C.',
        table([{ t: 'Mes', f: (r) => mes(r.mes) }, { t: 'Cruce', f: (r) => r.cruce }, { t: 'Emb.', n: 1, f: (r) => r.embarques },
          { t: 'Tardíos', n: 1, f: (r) => (r.tardios ? badge(`${r.tardios}`, r.tardios / r.embarques > 0.25 ? 'crit' : 'warn') : '0') },
          { t: 'Excursión °C', n: 1, f: (r) => (r.excursiones ? badge(`${r.excursiones}`, 'crit') : '0') }],
          d.embarques_tarde_mensual.filter((r) => r.mes >= '2026-08')))),
  ];
}

function vCampo(d) {
  const ms = uniq(d.camaras_mensual.map((x) => x.mes));
  const cams = uniq(d.camaras_mensual.map((x) => x.camara));
  const ser = (key) => cams.map((c, i) => ({ name: c === 'CF-04' ? 'CF-04 (almacén B)' : 'CF-03 (almacén A)', color: c === 'CF-04' ? COLORS[1] : 'var(--dim)', dim: c !== 'CF-04',
    values: ms.map((m) => d.camaras_mensual.find((x) => x.mes === m && x.camara === c)?.[key] ?? null) }));
  const q = d.queso_mensual;
  return [
    head('Mantenimiento, agua y abasto', 'Cámaras de frío, consumo de agua en campo y proveedor crítico de queso.'),
    h('div', { class: 'grid two' },
      card('Consumo eléctrico de cámaras', 'kWh por día, promedio mensual.', lineChart({ labels: ms.map(mes), series: ser('kwh_dia'), fmt: (v) => nf.format(v), label: 'Consumo de cámaras' }), legend(ser('kwh_dia'))),
      card('Temperatura máxima en cámaras', '°C. El límite operativo del almacén es -15 °C.', lineChart({ labels: ms.map(mes), series: ser('temp_max'), fmt: (v) => nf1.format(v) + '°', label: 'Temperatura máxima' }), legend(ser('temp_max'))),
      card('Agua por hectárea', 'm³/ha de marzo a septiembre. Rojo: consumo atípico.',
        bars(d.agua_parcela.map((x) => ({ name: x.nombre, value: x.m3_ha, text: `${nf.format(x.m3_ha)} m³/ha` })), { tone: (i) => (i.value === Math.max(...d.agua_parcela.map((z) => z.m3_ha)) ? 'bad' : '') })),
      card('Queso: precio y puntualidad', 'Lácteos del Altiplano. Precio MXN/kg y días de retraso promedio.',
        lineChart({ labels: q.map((x) => mes(x.mes)), series: [{ name: 'Precio MXN/kg', values: q.map((x) => x.precio_kg), color: COLORS[0] }], fmt: (v) => nf.format(v), label: 'Precio del queso' }),
        lineChart({ labels: q.map((x) => mes(x.mes)), series: [{ name: 'Retraso (días)', values: q.map((x) => x.retraso_dias), color: COLORS[1] }], fmt: (v) => nf1.format(v), label: 'Retraso de entrega' }))),
  ];
}

function vClaude(c) {
  const orden = { Abierta: 0, 'En atención': 1, Cerrada: 2 };
  const alertas = [...c.alertas].sort((a, b) => orden[a.estado] - orden[b.estado] || (a.severidad === 'Crítica' ? -1 : 1));
  return [
    head('Alertas, acciones y minutas', 'Claude vigila los datos, avisa a los responsables, da seguimiento a los compromisos y redacta las minutas. En la demo los correos se registran, no se envían.'),
    h('div', { class: 'grid' }, alertas.map((a) => {
      const acc = c.acciones.filter((x) => x.alerta_id === a.alerta_id);
      const n = c.notificaciones.find((x) => x.alerta_id === a.alerta_id);
      return h('article', { class: `card alert ${a.severidad === 'Crítica' ? 'crit' : a.severidad === 'Media' ? 'med' : ''}` },
        h('div', { class: 'meta' }, badge(a.severidad, tone[a.severidad]), badge(a.estado, tone[a.estado]), a.area, '·', fechaHora(a.ts)),
        h('h3', {}, a.titulo), h('p', {}, a.detalle),
        acc.length > 0 && table([{ t: 'Acción', f: (r) => r.descripcion }, { t: 'Responsable', f: (r) => r.responsable }, { t: 'Compromiso', f: (r) => fecha(r.fecha_compromiso) }, { t: 'Estado', f: (r) => badge(r.estado, tone[r.estado]) }], acc),
        n && h('details', {}, h('summary', {}, `Notificación a ${n.destinatario.split(',').length} responsable(s)`),
          h('div', { class: 'mail' }, `Para: ${n.destinatario}\nAsunto: ${n.asunto}\n\n${n.cuerpo}`)));
    })),
    h('h2', { style: 'margin-top:22px' }, 'Minutas'),
    h('div', { class: 'grid' }, c.minutas.map((m) => h('article', { class: 'card minuta' },
      h('h3', {}, `${m.titulo} · ${fecha(m.fecha)}`), h('p', { class: 'sub' }, `Asistentes: ${m.asistentes}`), h('p', {}, m.resumen), h('strong', {}, 'Acuerdos'), h('pre', {}, m.acuerdos)))),
  ];
}

// ---------- aplicación ----------
const VISTAS = [
  { id: 'direccion', t: 'Dirección', load: ['direccion', 'claude'], f: vDireccion },
  { id: 'planta', t: 'Planta', load: ['planta'], f: ([d]) => vPlanta(d) },
  { id: 'calidad', t: 'Calidad', load: ['calidad'], f: ([d]) => vCalidad(d) },
  { id: 'comercial', t: 'Ventas y logística', load: ['comercial'], f: ([d]) => vComercial(d) },
  { id: 'campo', t: 'Mantenimiento y campo', load: ['campo'], f: ([d]) => vCampo(d) },
  { id: 'claude', t: 'Alertas y minutas', load: ['claude'], f: ([c]) => vClaude(c) },
];
const store = (() => { try { return window.sessionStorage; } catch { return null; } })();
let code = '';
try { code = store?.getItem('accesscode') || ''; } catch { /* sin almacenamiento */ }

async function api(area) {
  const r = await fetch(`/api/data?area=${area}`, { headers: code ? { 'x-access-code': code } : {} });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(body.mensaje || 'Error al cargar datos'), { status: r.status });
  return body;
}

const view = document.getElementById('view');
const tabs = document.getElementById('tabs');
function gate(msg) {
  const inp = h('input', { type: 'password', placeholder: 'Código de acceso', 'aria-label': 'Código de acceso' });
  const go = () => { code = inp.value; try { store?.setItem('accesscode', code); } catch { /* ok */ } show(current); };
  inp.onkeydown = (e) => e.key === 'Enter' && go();
  view.replaceChildren(h('div', { class: 'gate card' }, h('h3', {}, 'Acceso a la demo'), msg && h('p', { class: 'sub' }, msg), inp, h('button', { onclick: go }, 'Entrar')));
}

let current = (location.hash || '#direccion').slice(1);
async function show(id) {
  const v = VISTAS.find((x) => x.id === id) || VISTAS[0];
  current = v.id;
  for (const b of tabs.children) b.setAttribute('aria-current', String(b.dataset.id === v.id));
  view.replaceChildren(h('div', { class: 'state' }, 'Cargando datos…'));
  try {
    const data = await Promise.all(v.load.map(api));
    if (current !== v.id) return;
    view.replaceChildren(...v.f(data).flat(Infinity).filter(Boolean));
  } catch (e) {
    if (current !== v.id) return;
    if (e.status === 401) return gate(code ? 'Código incorrecto.' : '');
    view.replaceChildren(h('div', { class: 'state err' }, e.message));
  }
}
VISTAS.forEach((v) => tabs.append(h('button', { 'data-id': v.id, onclick: () => { location.hash = v.id; } }, v.t)));
addEventListener('hashchange', () => show(location.hash.slice(1)));
show(current);
