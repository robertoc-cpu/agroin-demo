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

// ---------- origen de los datos (doble clic o botón "Origen") ----------
const REAL = {
  SAP: 'Con sus sistemas reales, este dato se lee de SAP mediante una vista de solo lectura sobre las tablas equivalentes. La pantalla y las preguntas a Claude no cambian.',
  SOI: 'Con sus sistemas reales, este dato se lee del SOI (la estructura exacta se define al conectar). La pantalla y las preguntas a Claude no cambian.',
  MIX: 'Con sus sistemas reales, Claude cruza SAP y SOI en una sola consulta, algo que hoy exige juntar reportes de dos sistemas a mano.',
  CLAUDE: 'Esta capa la genera Claude: evalúa las reglas de alerta sobre los datos de SAP y SOI, y registra alertas, acciones, avisos y minutas.',
};
const META = {
  cajas: { sis: 'SAP', sistema: 'SAP · Producción', per: 'Últimos 30 días', tablas: [['sap.afko', 'Órdenes de producción, una por línea y día']],
    calc: 'Suma de cajas_producidas. Cada caja pesa 5 kg.', q: '¿Cuántas cajas producimos este mes frente al anterior?' },
  ventas30: { sis: 'SAP', sistema: 'SAP · Ventas', per: 'Últimos 30 días', tablas: [['sap.factura', 'Facturas a clientes, en USD']],
    calc: 'Suma de monto_usd de las facturas emitidas en los últimos 30 días.', q: '¿Cuánto facturamos en los últimos 30 días y cómo se compara con el mes anterior?' },
  merma30: { sis: 'SAP', sistema: 'SAP · Producción', per: 'Últimos 30 días', tablas: [['sap.afko', 'Órdenes de producción']],
    calc: 'merma_kg ÷ kg_entrada, ponderado por kilos de todas las órdenes del periodo.', q: '¿Qué línea tiene más merma y en qué días ocurre?' },
  costo30: { sis: 'SAP', sistema: 'SAP · Producción y costos', per: 'Últimos 30 días', tablas: [['sap.afko', 'Costos de materia prima, mano de obra y energía por orden']],
    calc: '(costo_mp + costo_mo + costo_energia) ÷ kg_salida, todo en MXN.', q: '¿Por qué subió el costo por kilo de abril a octubre y qué parte es controlable?' },
  alertasCrit: { sis: 'CLAUDE', sistema: 'Capa de Claude', per: 'Estado al 26-oct-2026', tablas: [['claude.alerta', 'Alertas generadas por las reglas'], ['claude.regla_alerta', 'Umbrales por área']],
    calc: 'Alertas con severidad Crítica cuyo estado no es Cerrada.', q: 'Revisa los datos y genera las alertas críticas de hoy con responsable y fecha compromiso.' },
  cartera: { sis: 'SAP', sistema: 'SAP · Finanzas', per: 'Al 26-oct-2026', tablas: [['sap.factura', 'Facturas con fecha de vencimiento y de pago']],
    calc: 'Suma de monto_usd de facturas sin fecha_pago y con vencimiento anterior a hoy.', q: '¿Qué clientes tienen pagos atrasados y cuánto es su riesgo contra el límite de crédito?' },
  accionesVenc: { sis: 'CLAUDE', sistema: 'Capa de Claude', per: 'Estado al 26-oct-2026', tablas: [['claude.accion', 'Compromisos con responsable y fecha']],
    calc: 'Acciones cuyo estado es Vencida (pasó la fecha compromiso sin completarse).', q: '¿Qué acciones están vencidas o vencen esta semana y quién es el responsable?' },
  costoMes: { sis: 'SAP', sistema: 'SAP · Producción y costos', per: 'Ene–oct 2026', tablas: [['sap.afko', 'Órdenes de producción con costos']],
    calc: 'Promedio ponderado mensual de (costo_mp + costo_mo + costo_energia) ÷ kg_salida.', q: '¿Por qué subió el costo por kilo de abril a octubre?' },
  mermaMes: { sis: 'SAP', sistema: 'SAP · Producción', per: 'Ene–oct 2026', tablas: [['sap.afko', 'Órdenes de producción']],
    calc: 'merma_kg ÷ kg_entrada por mes, ponderado por kilos.', q: '¿Cómo ha evolucionado la merma y qué la explica?' },
  ventasMes: { sis: 'SAP', sistema: 'SAP · Ventas', per: 'Ene–oct 2026 (octubre al día 25)', tablas: [['sap.factura', 'Facturas a clientes']],
    calc: 'Suma de monto_usd por mes de emisión de la factura. Octubre está incompleto: llega hasta el 25.', q: '¿Cómo van las ventas de este año contra el año pasado?' },
  mermaLinea: { sis: 'SAP', sistema: 'SAP · Producción', per: 'Abr–oct 2026', tablas: [['sap.afko', 'Órdenes de producción por línea']],
    calc: 'merma_kg ÷ kg_entrada por línea y mes. El pico de septiembre en Línea 2 son tres órdenes con ajuste de pelado ya corregido.', q: 'Compara Línea 1 contra Línea 2 en rendimiento, paros y costo por kg en los últimos 3 meses.' },
  costoLinea: { sis: 'SAP', sistema: 'SAP · Producción y costos', per: 'Abr–oct 2026', tablas: [['sap.afko', 'Órdenes con costos por línea']],
    calc: 'Costo total ÷ kg_salida por línea y mes.', q: '¿Qué línea cuesta más por kilo y por qué?' },
  parosDia: { sis: 'SOI', sistema: 'SOI · Planta', per: 'Mar–oct 2026', tablas: [['soi.paro_linea', 'Paros de línea con duración y causa']],
    calc: 'Conteo de paros por línea y día de la semana (ISO: 1 = lunes) y minutos promedio por evento.', q: '¿Hay un patrón por día de la semana en los paros de línea?' },
  parosCausas: { sis: 'SOI', sistema: 'SOI · Planta', per: 'Jul–oct 2026', tablas: [['soi.paro_linea', 'Paros de línea con duración y causa']],
    calc: 'Suma de duracion_min y conteo por causa, ordenado por minutos perdidos.', q: '¿Qué causas de paro nos cuestan más minutos?' },
  rechazos: { sis: 'MIX', sistema: 'SAP + SOI · Calidad', per: 'Jul–oct 2026', tablas: [['sap.qals', 'Pruebas de calidad por lote'], ['soi.lote', 'Lote y recepción de origen'], ['soi.recepcion_campo', 'Parcela de origen'], ['sap.lfa1', 'Productor']],
    calc: 'Cada prueba se rastrea lote → recepción → parcela → productor. Rechazos = resultado «Rechazado»; observaciones = «Liberado con observación».', q: '¿Qué lotes fueron rechazados desde julio y de qué parcelas vino el chile?' },
  danoMes: { sis: 'SOI', sistema: 'SOI · Recepción de campo', per: 'Abr–oct 2026', tablas: [['soi.recepcion_campo', 'Recepción de chile con % de daño'], ['sap.lfa1', 'Productor']],
    calc: 'Promedio mensual de pct_dano por productor (sin ponderar por kilos).', q: '¿Qué productor ha empeorado más en calidad de chile y qué impacto tiene en merma y rechazos?' },
  certs: { sis: 'SOI', sistema: 'SOI · Calidad', per: 'Al 26-oct-2026', tablas: [['soi.certificacion', 'Certificaciones y vigencias']],
    calc: 'Días restantes = fecha de vigencia − hoy. Se marca en ámbar con 60 días o menos.', q: '¿Qué certificaciones vencen pronto y qué acciones debemos iniciar?' },
  rechDetalle: { sis: 'MIX', sistema: 'SAP + SOI · Calidad', per: 'Más recientes', tablas: [['sap.qals', 'Pruebas de calidad'], ['soi.lote', 'Lote'], ['soi.parcela', 'Parcela']],
    calc: 'Los 10 lotes rechazados más recientes con su productor y parcela de origen.', q: 'Dame el detalle del último lote rechazado y todos los clientes que recibieron producto de esa misma parcela.' },
  carteraCli: { sis: 'SAP', sistema: 'SAP · Finanzas', per: 'Al 26-oct-2026', tablas: [['sap.factura', 'Facturas'], ['sap.kna1', 'Clientes y límite de crédito']],
    calc: 'Vencido = facturas sin pago con vencimiento anterior a hoy. El porcentaje se calcula contra limite_credito_usd del cliente.', q: '¿Qué clientes tienen pagos atrasados y cuánto es su riesgo contra el límite de crédito?' },
  ventasCli: { sis: 'SAP', sistema: 'SAP · Ventas', per: 'Ene–oct 2026 (acumulado)', tablas: [['sap.factura', 'Facturas'], ['sap.kna1', 'Clientes']],
    calc: 'Suma de monto_usd facturado por cliente de enero al 25 de octubre. Es el acumulado del año, por eso no se compara con las ventas de 30 días de Dirección.', q: '¿Qué clientes compran más y cuál es su concentración?' },
  embarques: { sis: 'MIX', sistema: 'SOI · Logística + SAP', per: 'Ago–oct 2026', tablas: [['soi.embarque', 'Embarques con cruce, fechas y temperatura'], ['sap.vbak', 'Pedido de venta']],
    calc: 'Tardío = llegada real más de 1 día después de la prometida. Excursión = temperatura máxima sobre −12 °C durante el trayecto.', q: '¿Cuántos embarques llegaron tarde en septiembre, por qué cruce y hubo problemas de temperatura?' },
  camKwh: { sis: 'SOI', sistema: 'SOI · Mantenimiento', per: 'Jun–oct 2026', tablas: [['soi.lectura_camara_dia', 'Lectura diaria de cada cámara'], ['soi.camara', 'Catálogo de cámaras']],
    calc: 'Promedio mensual de kWh por día de las cámaras CF-03 y CF-04 (almacenes de congelado).', q: '¿Hay alguna cámara de frío con comportamiento anormal? ¿Cuánta energía de más estamos gastando?' },
  camTemp: { sis: 'SOI', sistema: 'SOI · Mantenimiento', per: 'Jun–oct 2026', tablas: [['soi.lectura_camara_dia', 'Lectura diaria de cada cámara']],
    calc: 'Máximo mensual de temp_max_c por cámara. El límite operativo del almacén congelado es −15 °C.', q: 'Redacta la notificación de la alerta de la cámara CF-04 para el jefe de mantenimiento y la gerente de planta.' },
  agua: { sis: 'SOI', sistema: 'SOI · Campo', per: 'Mar–sep 2026', tablas: [['soi.consumo_agua', 'Consumo mensual de agua y bombeo por parcela'], ['soi.parcela', 'Hectáreas por parcela']],
    calc: 'Suma de m³ de marzo a septiembre ÷ hectáreas de la parcela.', q: '¿Qué parcela usa más agua por hectárea y cuánto bombeo eléctrico representa?' },
  queso: { sis: 'SAP', sistema: 'SAP · Compras', per: 'Mar–oct 2026', tablas: [['sap.ekpo', 'Posiciones de compra con precio y fechas de entrega'], ['sap.ekko', 'Pedidos de compra']],
    calc: 'Precio unitario promedio del material R-002 (queso) y retraso = entrega real − entrega prometida.', q: '¿Cómo ha cambiado el precio y la puntualidad de entrega del queso?' },
  alertaAcc: { sis: 'CLAUDE', sistema: 'Capa de Claude', per: 'Estado al 26-oct-2026', tablas: [['claude.alerta', 'Alerta con causa probable, recomendación e impacto'], ['claude.accion', 'Acciones con responsable y fecha']],
    calc: 'Claude cruza SAP y SOI, detecta la desviación y propone una causa probable y una recomendación basadas en los datos. La causa es una hipótesis que la persona responsable valida.', q: 'Dame las alertas abiertas con su causa probable y qué recomiendas hacer primero.' },
  igluKpi: { sis: 'SOI', sistema: 'SOI · Iglú (administración de almacén)', per: 'Existencias al 26-oct-2026', tablas: [['soi.tarima', 'Una fila por tarima: lote, cajas y posición'], ['soi.iglu_posicion', 'Mapa de posiciones: cámara, pasillo, columna y nivel'], ['soi.camara', 'Capacidad en tarimas']],
    calc: 'Tarimas con posición asignada ÷ capacidad de las cámaras CF-03 y CF-04. Cada posición guarda una tarima (hasta 60 cajas).', q: '¿Cuántas tarimas hay en el iglú, qué ocupación tiene cada cámara y qué producto es?' },
  igluMapa: { sis: 'SOI', sistema: 'SOI · Iglú', per: 'Existencias al 26-oct-2026', tablas: [['soi.iglu_posicion', 'Pasillo, columna y nivel'], ['soi.tarima', 'Tarimas por posición'], ['soi.lote', 'Fecha de caducidad del lote']],
    calc: 'Cada cuadro es una columna de un pasillo con 5 niveles; el color indica cuántos niveles están ocupados. En rojo, columnas con tarimas que caducan en menos de 30 días.', q: '¿Dónde están ubicados los lotes que caducan este mes?' },
  igluProd: { sis: 'MIX', sistema: 'SOI + SAP · Iglú y materiales', per: 'Existencias al 26-oct-2026', tablas: [['soi.tarima', 'Cajas por tarima'], ['sap.mara', 'Descripción del producto']],
    calc: 'Suma de cajas por producto terminado de todas las tarimas del iglú.', q: '¿Cuántas cajas tenemos por producto en el iglú?' },
  igluVencer: { sis: 'MIX', sistema: 'SOI + SAP · Iglú, lotes y caducidad', per: 'Caducan en menos de 30 días', tablas: [['soi.tarima', 'Tarima y posición'], ['soi.lote', 'fecha_caducidad'], ['sap.mara', 'Producto']],
    calc: 'Tarimas cuyo lote caduca antes de 30 días contados desde hoy (26-oct-2026), ordenadas por fecha y ubicación.', q: '¿Qué lotes del iglú van a caducar en las próximas 4 semanas y dónde están ubicados?' },
  alerta: { sis: 'CLAUDE', sistema: 'Capa de Claude', per: 'Registrada el 26-oct-2026', tablas: [['claude.alerta', 'Alerta'], ['claude.accion', 'Acciones con responsable'], ['claude.notificacion', 'Aviso redactado para los responsables']],
    calc: 'Claude evalúa las reglas de claude.regla_alerta sobre SAP y SOI; al detectar una desviación registra la alerta, asigna acciones y redacta el aviso. En la demo el correo se guarda, no se envía.', q: 'Revisa los datos y genera las alertas críticas de hoy con responsable, acción y fecha compromiso.' },
  minuta: { sis: 'CLAUDE', sistema: 'Capa de Claude', per: 'Semana 43 · 26-oct-2026', tablas: [['claude.minuta', 'Minutas'], ['claude.alerta', 'Alertas de la semana'], ['claude.accion', 'Acciones y pendientes']],
    calc: 'Claude lee alertas, acciones y datos de la semana y redacta resumen y acuerdos por responsable.', q: 'Genera la minuta de la junta semanal de operaciones con acuerdos y pendientes por responsable.' },
};

const drawer = (() => {
  let last = null;
  const scrim = h('div', { class: 'scrim', hidden: '' });
  const panel = h('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Origen de los datos', hidden: '', tabindex: '-1' });
  document.body.append(scrim, panel);
  const close = () => { panel.hidden = true; scrim.hidden = true; document.body.classList.remove('lock'); last?.focus?.(); };
  scrim.onclick = close;
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
  const csv = (rows) => {
    const cols = Object.keys(rows[0]);
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return '﻿' + [cols.map(q).join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n');
  };
  const cell = (v) => (typeof v === 'number' ? nf.format(v) + (Number.isInteger(v) ? '' : '') : v == null ? '' : String(v));
  return (title, m, rows) => {
    last = document.activeElement;
    const list = Array.isArray(rows) ? rows : [];
    const cols = list[0] ? Object.keys(list[0]) : [];
    const shown = list.slice(0, 12);
    const dl = list.length > 0 && h('button', { class: 'btn', onclick: () => {
      const url = URL.createObjectURL(new Blob([csv(list)], { type: 'text/csv;charset=utf-8' }));
      const a = h('a', { href: url, download: `agroin-demo-${(m.sistema || 'datos').replace(/\W+/g, '-').toLowerCase()}.csv` });
      document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } }, 'Descargar CSV');
    panel.replaceChildren(
      h('div', { class: 'dr-head' },
        h('div', {}, h('p', { class: 'dr-kicker' }, 'Origen de los datos'), h('h3', {}, title)),
        h('button', { class: 'x', 'aria-label': 'Cerrar', onclick: close }, '×')),
      h('div', { class: 'dr-body' },
        h('section', {}, h('h4', {}, 'De dónde viene'), h('p', {}, m.sistema),
          h('ul', { class: 'tables' }, m.tablas.map(([t, d]) => h('li', {}, h('code', {}, t), ' ', d)))),
        h('section', {}, h('h4', {}, 'Cómo se calcula'), h('p', {}, m.calc)),
        h('section', {}, h('h4', {}, 'Periodo'), h('p', {}, m.per)),
        h('section', { class: 'real' }, h('h4', {}, 'Con sus sistemas reales'), h('p', {}, m.real || REAL[m.sis] || REAL.MIX)),
        shown.length > 0 && h('section', {}, h('h4', {}, `Datos que alimentan esta tarjeta (${shown.length}${list.length > shown.length ? ' de ' + list.length : ''})`),
          h('div', { class: 'tw' }, h('table', {}, h('thead', {}, h('tr', {}, cols.map((c) => h('th', {}, c.replace(/_/g, ' '))))),
            h('tbody', {}, shown.map((r) => h('tr', {}, cols.map((c) => h('td', {}, cell(r[c])))))))), dl),
        m.q && h('section', { class: 'ask' }, h('h4', {}, 'Pregúntale a Claude'), h('p', {}, `«${m.q}»`))));
    panel.hidden = false; scrim.hidden = false; document.body.classList.add('lock');
    panel.querySelector('.x').focus();
  };
})();

function withSource(el, title, key, rows) {
  const m = META[key];
  el.classList.add('has-src');
  el.setAttribute('title', 'Doble clic para ver el origen de los datos');
  el.ondblclick = (e) => { if (!e.target.closest('a,button,summary,input')) { getSelection()?.removeAllRanges(); drawer(title, m, rows); } };
  const btn = h('button', { class: 'src-btn', type: 'button', 'aria-label': `Ver origen de los datos: ${title}`, onclick: (e) => { e.stopPropagation(); drawer(title, m, rows); } }, 'ⓘ Origen');
  const chip = h('span', { class: 'chip' }, m.per);
  const tools = h('div', { class: 'tools' }, chip, btn);
  el.prepend(tools);
  return el;
}

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

// card(título, subtítulo, [clave de origen, filas], ...contenido)
const card = (title, sub, src, ...body) => {
  const el = h('section', { class: 'card' }, h('h3', {}, title), sub && h('p', { class: 'sub' }, sub), body);
  return src ? withSource(el, title, src[0], src[1]) : el;
};
const kpi = (label, value, note, key, tone = '') =>
  withSource(h('div', { class: `card kpi ${tone}` }, h('div', { class: 'label' }, label), h('div', { class: 'value' }, value), note && h('div', { class: 'note' }, note)), label, key, null);
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


// ---------- alertas accionables ----------
const wa = (n) => h('div', { class: 'wa' },
  h('div', { class: 'wa-to' }, `WhatsApp · ${n.destinatario}`),
  h('div', { class: 'wa-bubble' }, n.cuerpo),
  h('div', { class: 'wa-foot' }, `${fechaHora(n.ts)} ✓✓`));
const accionable = (a, acc, extra = []) => h('div', { class: 'acc' },
  a.impacto && h('p', {}, h('strong', {}, 'Impacto: '), a.impacto),
  a.causa_probable && h('p', {}, h('strong', {}, 'Causa probable: '), a.causa_probable),
  a.recomendacion && h('p', { class: 'reco' }, h('strong', {}, 'Recomendación: '), a.recomendacion),
  acc.length > 0 && h('p', { class: 'sub' }, 'Responsables: ', uniq(acc.map((x) => x.responsable)).join(', ')),
  extra);

// ---------- vistas ----------
function vDireccion([d, c]) {
  const k = d.kpis;
  const crit = c.alertas.filter((a) => a.severidad === 'Crítica' && a.estado !== 'Cerrada');
  const L = d.costo_kg_mensual.map((x) => mes(x.mes));
  return [
    head('Dirección', 'Resumen cruzando el ERP (SAP) y el sistema operativo interno (SOI). Los indicadores de arriba cubren los últimos 30 días (26-sep al 25-oct de 2026); las gráficas, de enero a octubre.'),
    h('div', { class: 'grid kpis' },
      kpi('Cajas producidas', nf.format(k.cajas_30d), 'Cajas de 5 kg · 30 días', 'cajas'),
      kpi('Ventas facturadas', usdK(k.ventas_usd_30d), 'USD · últimos 30 días', 'ventas30'),
      kpi('Merma', nf1.format(k.merma_pct_30d) + ' %', 'Del chile procesado · 30 días', 'merma30'),
      kpi('Costo por kg', '$' + nf1.format(k.costo_kg_30d), 'MXN por kg terminado · 30 días', 'costo30'),
      kpi('Alertas críticas', k.alertas_criticas, `De ${k.alertas_abiertas} abiertas · hoy`, 'alertasCrit', k.alertas_criticas ? 'bad' : ''),
      kpi('Cartera vencida', usdK(k.cartera_vencida_usd), 'USD sin cobrar · al 26-oct', 'cartera', 'warn'),
      kpi('Acciones vencidas', k.acciones_vencidas, 'Compromisos fuera de fecha', 'accionesVenc', k.acciones_vencidas ? 'bad' : '')),
    crit.length > 0 && h('div', { class: 'callout' }, h('strong', {}, 'Requieren decisión hoy: '), crit.map((a) => a.titulo).join(' · ')),
    h('h2', { style: 'margin-top:6px' }, 'Alertas accionables'),
    h('p', { class: 'lede' }, 'Cada alerta trae su impacto, la causa probable que detecta Claude y qué recomienda hacer primero. Los responsables reciben aviso por correo y WhatsApp.'),
    h('div', { class: 'grid two', style: 'margin-bottom:14px' }, c.alertas.filter((a) => a.estado !== 'Cerrada' && a.severidad === 'Crítica').map((a) => {
      const acc = c.acciones.filter((x) => x.alerta_id === a.alerta_id);
      const el = h('article', { class: 'card alert crit' },
        h('div', { class: 'meta' }, badge(a.severidad, 'crit'), badge(a.estado, tone[a.estado]), a.area),
        h('h3', {}, a.titulo), accionable(a, acc));
      return withSource(el, a.titulo, 'alertaAcc', acc.length ? acc : [{ alerta_id: a.alerta_id, area: a.area }]);
    })),
    h('div', { class: 'grid two' },
      card('Costo por kg terminado', 'MXN por kg, mensual. Sube por queso, merma y energía.', ['costoMes', d.costo_kg_mensual],
        lineChart({ labels: L, series: [{ name: 'MXN/kg', values: d.costo_kg_mensual.map((x) => x.mxn_kg), color: COLORS[0] }], label: 'Costo por kg mensual' })),
      card('Merma mensual', '% del chile que entra a proceso, mensual.', ['mermaMes', d.costo_kg_mensual],
        lineChart({ labels: L, series: [{ name: 'Merma %', values: d.costo_kg_mensual.map((x) => x.merma_pct), color: COLORS[1] }], fmt: (v) => nf1.format(v) + '%', label: 'Merma mensual' })),
      card('Ventas facturadas por mes', 'USD por mes. Octubre está incompleto: llega al día 25.', ['ventasMes', d.ventas_mensual_usd],
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
      card('Merma por línea', '% mensual. El pico de septiembre en Línea 2 se corrigió.', ['mermaLinea', d.merma_linea_mensual],
        lineChart({ labels: months.map(mes), series: ser('merma_pct'), fmt: (v) => nf1.format(v) + '%', label: 'Merma por línea' }), legend(ser('merma_pct'))),
      card('Costo por kg por línea', 'MXN por kg terminado, mensual.', ['costoLinea', d.merma_linea_mensual],
        lineChart({ labels: months.map(mes), series: ser('mxn_kg'), label: 'Costo por kg por línea' }), legend(ser('mxn_kg'))),
      card('Paros por día de la semana', 'Cantidad de paros acumulados de marzo a octubre.', ['parosDia', d.paros_dia_semana],
        colChart({ labels: dias, series: parosSer, label: 'Paros por día' }), legend(parosSer)),
      card('Causas de paro', 'De julio a octubre, ordenadas por minutos perdidos.', ['parosCausas', d.paros_causas],
        table([{ t: 'Causa', f: (r) => r.causa }, { t: 'Paros', n: 1, f: (r) => r.paros }, { t: 'Minutos', n: 1, f: (r) => nf.format(r.minutos) }], d.paros_causas))),
  ];
}

function vCalidad(d) {
  const months = uniq(d.dano_mensual.map((x) => x.mes));
  const prods = uniq(d.dano_mensual.map((x) => x.productor));
  const series = prods.map((p) => {
    const hl = /Alamitos/.test(p);
    return { name: p, dim: !hl, color: hl ? COLORS[1] : 'var(--dim)',
      values: months.map((m) => d.dano_mensual.find((x) => x.mes === m && x.productor === p)?.pct_dano ?? null) };
  });
  return [
    head('Calidad e inocuidad', 'Trazabilidad de cada lote hasta la parcela y vigilancia de certificaciones.'),
    h('div', { class: 'grid two' },
      card('Lotes rechazados por productor', 'De julio a octubre. Se rastrea lote → recepción → parcela.', ['rechazos', d.rechazos_productor],
        bars(d.rechazos_productor.map((x) => ({ name: x.productor, value: x.rechazos, text: `${x.rechazos} rech. · ${x.observaciones} obs.` })),
          { tone: (i) => (i.value >= 5 ? 'bad' : i.value > 0 ? 'warn' : 'dim') })),
      card('Daño del chile en recepción', '% promedio mensual por productor. En gris, los demás productores.', ['danoMes', d.dano_mensual],
        lineChart({ labels: months.map(mes), series, fmt: (v) => nf1.format(v) + '%', label: 'Daño por productor' })),
      card('Certificaciones', 'Vigencia y días restantes.', ['certs', d.certificaciones],
        table([{ t: 'Certificación', f: (r) => r.tipo }, { t: 'Vence', f: (r) => fecha(r.vigencia_fin) },
          { t: 'Estado', f: (r) => badge(r.dias_restantes < 0 ? 'Vencida' : r.dias_restantes <= 60 ? `${r.dias_restantes} días` : 'Vigente', r.dias_restantes < 0 ? 'crit' : r.dias_restantes <= 60 ? 'warn' : 'ok') }],
          d.certificaciones)),
      card('Últimos lotes rechazados', 'Con parcela de origen.', ['rechDetalle', d.rechazos_detalle.slice(0, 10)],
        table([{ t: 'Fecha', f: (r) => fecha(r.fecha) }, { t: 'Lote', f: (r) => r.lote }, { t: 'Prueba', f: (r) => r.tipo_prueba }, { t: 'Origen', f: (r) => `${r.productor} · ${r.parcela}` }],
          d.rechazos_detalle.slice(0, 10)))),
  ];
}

function vComercial(d) {
  const emb = d.embarques_tarde_mensual.filter((r) => r.mes >= '2026-08');
  return [
    head('Ventas, cobranza y logística', 'Clientes de Estados Unidos, cartera contra límite de crédito y cumplimiento en cruces fronterizos.'),
    h('div', { class: 'grid two' },
      card('Cartera vencida por cliente', 'Al 26-oct-2026: USD vencidos y % de su límite de crédito.', ['carteraCli', d.cartera],
        bars(d.cartera.map((x) => ({ name: x.cliente, value: x.vencido_usd, pct: x.vencido_usd / x.limite, text: `${usd(x.vencido_usd)} · ${Math.round((100 * x.vencido_usd) / x.limite)}%` })),
          { tone: (i) => (i.pct > 0.5 ? 'bad' : i.pct > 0.2 ? 'warn' : 'dim') })),
      card('Ventas por cliente · acumulado 2026', 'USD facturados de enero al 25 de octubre. Es el acumulado del año, por eso no coincide con las ventas de 30 días del tablero de Dirección.', ['ventasCli', d.ventas_cliente],
        bars(d.ventas_cliente.map((x) => ({ name: x.cliente, value: x.usd, text: usdK(x.usd) })), {})),
      card('Embarques por cruce', 'De agosto a octubre. Tardío: más de 1 día de retraso. Excursión: temperatura máxima sobre −12 °C.', ['embarques', emb],
        table([{ t: 'Mes', f: (r) => mes(r.mes) }, { t: 'Cruce', f: (r) => r.cruce }, { t: 'Emb.', n: 1, f: (r) => r.embarques },
          { t: 'Tardíos', n: 1, f: (r) => (r.tardios ? badge(`${r.tardios}`, r.tardios / r.embarques > 0.25 ? 'crit' : 'warn') : '0') },
          { t: 'Excursión °C', n: 1, f: (r) => (r.excursiones ? badge(`${r.excursiones}`, 'crit') : '0') }],
          emb))),
  ];
}

function vCampo(d) {
  const ms = uniq(d.camaras_mensual.map((x) => x.mes));
  const cams = uniq(d.camaras_mensual.map((x) => x.camara));
  const ser = (key) => cams.map((c) => ({ name: c === 'CF-04' ? 'CF-04 (almacén B)' : 'CF-03 (almacén A)', color: c === 'CF-04' ? COLORS[1] : 'var(--dim)', dim: c !== 'CF-04',
    values: ms.map((m) => d.camaras_mensual.find((x) => x.mes === m && x.camara === c)?.[key] ?? null) }));
  const q = d.queso_mensual;
  return [
    head('Mantenimiento, agua y abasto', 'Cámaras de frío, consumo de agua en campo y proveedor crítico de queso.'),
    h('div', { class: 'grid two' },
      card('Consumo eléctrico de cámaras', 'kWh por día, promedio mensual.', ['camKwh', d.camaras_mensual],
        lineChart({ labels: ms.map(mes), series: ser('kwh_dia'), fmt: (v) => nf.format(v), label: 'Consumo de cámaras' }), legend(ser('kwh_dia'))),
      card('Temperatura máxima en cámaras', '°C. El límite operativo del almacén es −15 °C.', ['camTemp', d.camaras_mensual],
        lineChart({ labels: ms.map(mes), series: ser('temp_max'), fmt: (v) => nf1.format(v) + '°', label: 'Temperatura máxima' }), legend(ser('temp_max'))),
      card('Agua por hectárea', 'm³/ha de marzo a septiembre. En rojo, el consumo atípico.', ['agua', d.agua_parcela],
        bars(d.agua_parcela.map((x) => ({ name: x.nombre, value: x.m3_ha, text: `${nf.format(x.m3_ha)} m³/ha` })), { tone: (i) => (i.value === Math.max(...d.agua_parcela.map((z) => z.m3_ha)) ? 'bad' : '') })),
      card('Queso: precio y puntualidad', 'Lácteos del Altiplano. Precio en MXN/kg y días de retraso promedio.', ['queso', q],
        lineChart({ labels: q.map((x) => mes(x.mes)), series: [{ name: 'Precio MXN/kg', values: q.map((x) => x.precio_kg), color: COLORS[0] }], fmt: (v) => nf.format(v), label: 'Precio del queso' }),
        lineChart({ labels: q.map((x) => mes(x.mes)), series: [{ name: 'Retraso (días)', values: q.map((x) => x.retraso_dias), color: COLORS[1] }], fmt: (v) => nf1.format(v), label: 'Retraso de entrega' }))),
  ];
}

function vClaude(c) {
  const orden = { Abierta: 0, 'En atención': 1, Cerrada: 2 };
  const alertas = [...c.alertas].sort((a, b) => orden[a.estado] - orden[b.estado] || (a.severidad === 'Crítica' ? -1 : 1));
  return [
    head('Alertas, acciones y minutas', 'Claude vigila los datos, avisa a los responsables, da seguimiento a los compromisos y redacta las minutas. Cada aviso sale por correo y por WhatsApp. En la demo los avisos se registran, no se envían.'),
    h('div', { class: 'grid' }, alertas.map((a) => {
      const acc = c.acciones.filter((x) => x.alerta_id === a.alerta_id);
      const ns = c.notificaciones.filter((x) => x.alerta_id === a.alerta_id);
      const el = h('article', { class: `card alert ${a.severidad === 'Crítica' ? 'crit' : a.severidad === 'Media' ? 'med' : ''}` },
        h('div', { class: 'meta' }, badge(a.severidad, tone[a.severidad]), badge(a.estado, tone[a.estado]), a.area, '·', fechaHora(a.ts)),
        h('h3', {}, a.titulo), h('p', {}, a.detalle), accionable(a, []),
        acc.length > 0 && table([{ t: 'Acción', f: (r) => r.descripcion }, { t: 'Responsable', f: (r) => r.responsable }, { t: 'Compromiso', f: (r) => fecha(r.fecha_compromiso) }, { t: 'Estado', f: (r) => badge(r.estado, tone[r.estado]) }], acc),
        ns.length > 0 && h('div', { class: 'chans' }, ns.map((n) => badge(n.canal === 'whatsapp' ? 'WhatsApp' : 'Correo', n.canal === 'whatsapp' ? 'ok' : 'gray'))),
        ns.map((n) => h('details', {}, h('summary', {}, n.canal === 'whatsapp' ? `Vista del WhatsApp · ${n.destinatario.split('),').length} destinatario(s)` : `Correo a ${n.destinatario.split(',').length} responsable(s)`),
          n.canal === 'whatsapp' ? wa(n) : h('div', { class: 'mail' }, `Para: ${n.destinatario}\nAsunto: ${n.asunto}\n\n${n.cuerpo}`))));
      return withSource(el, a.titulo, 'alerta', acc.length ? acc : [{ alerta_id: a.alerta_id, area: a.area, severidad: a.severidad, estado: a.estado }]);
    })),
    h('h2', { style: 'margin-top:22px' }, 'Minutas'),
    h('div', { class: 'grid' }, c.minutas.map((m) => withSource(h('article', { class: 'card minuta' },
      h('h3', {}, `${m.titulo} · ${fecha(m.fecha)}`), h('p', { class: 'sub' }, `Asistentes: ${m.asistentes}`), h('p', {}, m.resumen), h('strong', {}, 'Acuerdos'), h('pre', {}, m.acuerdos)),
      m.titulo, 'minuta', [{ minuta_id: m.minuta_id, fecha: m.fecha, titulo: m.titulo }]))),
  ];
}


function vIglu(d) {
  const k = d.kpis;
  const pct = Math.round((100 * k.tarimas) / k.capacidad);
  const mapaCam = (cam) => {
    const pas = uniq(d.mapa.filter((x) => x.camara === cam).map((x) => x.pasillo));
    return h('div', { class: 'ig' }, pas.map((p) => h('div', { class: 'ig-row' }, h('span', { class: 'ig-p' }, p),
      d.mapa.filter((x) => x.camara === cam && x.pasillo === p).map((x) =>
        h('span', { class: `ig-c l${x.ocupadas} ${x.por_vencer ? 'venc' : ''}`, title: `${cam} · pasillo ${p} · columna ${x.columna}: ${x.ocupadas} de 5 niveles${x.por_vencer ? ` · ${x.por_vencer} por vencer` : ''}` })))));
  };
  const oc = d.ocupacion;
  return [
    head('Iglú · almacén en frío', 'Cada tarima tiene su lote, su cantidad y su posición (cámara, pasillo, columna y nivel). Claude lee esa ubicación y la cruza con caducidad, calidad y pedidos.'),
    h('div', { class: 'grid kpis' },
      kpi('Ocupación', pct + ' %', `${nf.format(k.tarimas)} de ${nf.format(k.capacidad)} tarimas`, 'igluKpi', pct > 85 ? 'warn' : ''),
      kpi('Cajas almacenadas', nf.format(k.cajas), 'Producto terminado', 'igluProd'),
      kpi('Por vencer', k.por_vencer_30d, 'Tarimas · menos de 30 días', 'igluVencer', k.por_vencer_30d ? 'bad' : ''),
      kpi('Con más de 90 días', k.antiguas_90d, 'Tarimas · rompen PEPS', 'igluVencer', k.antiguas_90d ? 'warn' : ''),
      kpi('Retenidas por calidad', k.retenidas, 'Tarimas', 'igluKpi')),
    k.por_vencer_30d > 0 && h('div', { class: 'callout' }, h('strong', {}, 'Detectado: '), `${k.por_vencer_30d} tarimas caducan en menos de 30 días y están al fondo del pasillo H de CF-04. Mientras tanto CF-03 está al 100%, por lo que CF-04 funciona como bodega de desborde.`),
    h('div', { class: 'grid two' },
      ...oc.map((o) => card(`${o.camara} · ${o.nombre}`, `${nf.format(o.tarimas)} de ${nf.format(o.capacidad)} tarimas · ${nf.format(o.cajas)} cajas. Cada cuadro es una columna (5 niveles); más oscuro = más lleno; rojo = caduca pronto.`, ['igluMapa', d.mapa.filter((x) => x.camara === o.camara)], mapaCam(o.camara))),
      card('Producto en el iglú', 'Cajas de 5 kg por producto terminado.', ['igluProd', d.por_producto],
        bars(d.por_producto.map((x) => ({ name: x.producto, value: x.cajas, text: `${nf.format(x.cajas)} cajas` })), {})),
      card('Tarimas por vencer', 'Ordenadas por fecha de caducidad, con su ubicación exacta.', ['igluVencer', d.proximas_a_vencer],
        table([{ t: 'Posición', f: (r) => r.posicion }, { t: 'Lote', f: (r) => r.lote }, { t: 'Producto', f: (r) => r.producto }, { t: 'Cajas', n: 1, f: (r) => r.cajas }, { t: 'Caduca', f: (r) => badge(fecha(r.caduca), r.dias < 14 ? 'crit' : 'warn') }], d.proximas_a_vencer.slice(0, 10)))),
  ];
}

function vGuia() {
  const msg = `Usa el proyecto de Supabase agroin-demo (id \`dtvipihhkpfggxfndfpc\`). Antes de responder, lee la tabla \`claude.guia\`: ahí está cómo se organizan los datos y cómo debes responder. Hoy es 26 de octubre de 2026. Los datos son ficticios, de la empresa Agroindustria de Aguascalientes (SAP, SOI e iglú). Responde en español, con cifras y qué recomiendas hacer. Puedes registrar alertas, acciones, avisos (correo y WhatsApp) y minutas en el esquema \`claude\`, pero confírmame antes de escribir y no modifiques \`sap\` ni \`soi\`.`;
  const ej = ['¿Por qué subió el costo por kilo de abril a octubre y qué parte es controlable?', '¿Qué lotes del iglú van a caducar en las próximas 4 semanas y dónde están ubicados?', 'Dame las alertas abiertas con su causa probable y qué recomiendas hacer primero.', '¿Qué clientes tienen pagos atrasados y cuánto es su riesgo contra el límite de crédito?', 'Genera la minuta de la junta semanal de operaciones con acuerdos y pendientes por responsable.', 'Redacta y registra un WhatsApp para los responsables de las alertas críticas de hoy.'];
  const ta = h('textarea', { readonly: '', rows: '9', 'aria-label': 'Mensaje inicial' }); ta.value = msg;
  const ok = h('span', { class: 'sub', role: 'status' });
  const copy = async () => { try { await navigator.clipboard.writeText(msg); } catch { ta.select(); document.execCommand('copy'); } ok.textContent = 'Copiado ✓'; };
  return [
    head('Pregúntale a Claude', 'Cada área puede hacer sus propias preguntas sobre estos datos ficticios, o pedir que se cree algo nuevo (una alerta, una minuta, un reporte), en una conversación nueva de Claude conectada a la base de datos de la demo.'),
    h('div', { class: 'grid two' },
      card('1 · Abre una conversación nueva de Claude', 'Con el conector de Supabase activo. Pega este mensaje como primer mensaje:', null, ta, h('button', { class: 'btn', onclick: copy }, 'Copiar mensaje'), ' ', ok),
      card('2 · Preguntas para empezar', 'Una por área; después pueden preguntar lo que quieran.', null, h('ul', { class: 'ej' }, ej.map((e) => h('li', {}, e)))),
      card('Qué se queda y qué no', null, null, h('ul', { class: 'ej' }, [
        'Todo lo que pregunten se responde con los datos ficticios de la demo.',
        'Lo que Claude registre (alertas, minutas, avisos) queda en el esquema claude y aparece en "Alertas y minutas".',
        'Los avisos por correo y WhatsApp se registran; no se envían. El envío real se conecta junto con los sistemas reales.',
        'Los datos de SAP y SOI no se modifican nunca.'].map((e) => h('li', {}, e))))),
  ];
}

// ---------- aplicación ----------
const VISTAS = [
  { id: 'direccion', t: 'Dirección', load: ['direccion', 'claude'], f: vDireccion },
  { id: 'planta', t: 'Planta', load: ['planta'], f: ([d]) => vPlanta(d) },
  { id: 'iglu', t: 'Iglú', load: ['iglu'], f: ([d]) => vIglu(d) },
  { id: 'calidad', t: 'Calidad', load: ['calidad'], f: ([d]) => vCalidad(d) },
  { id: 'comercial', t: 'Ventas y logística', load: ['comercial'], f: ([d]) => vComercial(d) },
  { id: 'campo', t: 'Mantenimiento y campo', load: ['campo'], f: ([d]) => vCampo(d) },
  { id: 'claude', t: 'Alertas y minutas', load: ['claude'], f: ([c]) => vClaude(c) },
  { id: 'guia', t: 'Pregúntale a Claude', load: [], f: () => vGuia() },
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
  // Ojo: un manejador DOM0 que devuelve false cancela la tecla; por eso las llaves y el if.
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
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
