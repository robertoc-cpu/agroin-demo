-- Funciones de lectura para la app web. Devuelven JSON ya resumido.
-- Solo las puede ejecutar service_role (la llave de servidor de Vercel); anon/authenticated no.
-- "Hoy" de la demo: 2026-10-26 (fijo, porque los datos son simulados hasta el 25-oct-2026).

create or replace function public.demo_direccion() returns jsonb language sql security definer set search_path = '' as $$
select jsonb_build_object(
 'kpis', (select jsonb_build_object(
    'cajas_30d', (select coalesce(sum(cajas_producidas),0) from sap.afko where fecha > date '2026-10-25' - 30),
    'ventas_usd_30d', (select coalesce(round(sum(monto_usd)),0) from sap.factura where fecha_factura > date '2026-10-25' - 30),
    'merma_pct_30d', (select round(100*sum(merma_kg)/nullif(sum(kg_entrada),0),1) from sap.afko where fecha > date '2026-10-25' - 30),
    'costo_kg_30d', (select round(sum(costo_mp_mxn+costo_mo_mxn+costo_energia_mxn)/nullif(sum(kg_salida),0),1) from sap.afko where fecha > date '2026-10-25' - 30),
    'alertas_abiertas', (select count(*) from claude.alerta where estado <> 'Cerrada'),
    'alertas_criticas', (select count(*) from claude.alerta where estado <> 'Cerrada' and severidad='Crítica'),
    'acciones_vencidas', (select count(*) from claude.accion where estado='Vencida'),
    'cartera_vencida_usd', (select coalesce(round(sum(monto_usd)),0) from sap.factura where fecha_pago is null and fecha_vencimiento < date '2026-10-26'))),
 'costo_kg_mensual', (select coalesce(jsonb_agg(t order by mes),'[]') from (
    select to_char(date_trunc('month',fecha),'YYYY-MM') mes,
           round(sum(costo_mp_mxn+costo_mo_mxn+costo_energia_mxn)/sum(kg_salida),1) mxn_kg,
           round(100*sum(merma_kg)/sum(kg_entrada),1) merma_pct
    from sap.afko where fecha >= '2026-01-01' group by 1) t),
 'ventas_mensual_usd', (select coalesce(jsonb_agg(t order by mes),'[]') from (
    select to_char(date_trunc('month',fecha_factura),'YYYY-MM') mes, round(sum(monto_usd)) usd
    from sap.factura where fecha_factura >= '2026-01-01' group by 1) t)
);
$$;

create or replace function public.demo_planta() returns jsonb language sql security definer set search_path = '' as $$
select jsonb_build_object(
 'merma_linea_mensual', (select coalesce(jsonb_agg(t order by mes, linea),'[]') from (
    select to_char(date_trunc('month',fecha),'YYYY-MM') mes, linea,
           round(100*sum(merma_kg)/sum(kg_entrada),1) merma_pct,
           round(sum(costo_mp_mxn+costo_mo_mxn+costo_energia_mxn)/sum(kg_salida),1) mxn_kg
    from sap.afko where fecha >= '2026-04-01' group by 1,2) t),
 'paros_dia_semana', (select coalesce(jsonb_agg(t order by linea, dow),'[]') from (
    select linea, extract(isodow from fecha)::int dow, count(*) paros, round(avg(duracion_min)) min_prom
    from soi.paro_linea where fecha >= '2026-03-02' group by 1,2) t),
 'paros_causas', (select coalesce(jsonb_agg(t order by minutos desc),'[]') from (
    select causa, count(*) paros, sum(duracion_min) minutos from soi.paro_linea where fecha >= '2026-07-01' group by 1) t)
);
$$;

create or replace function public.demo_calidad() returns jsonb language sql security definer set search_path = '' as $$
select jsonb_build_object(
 'rechazos_productor', (select coalesce(jsonb_agg(t order by rechazos desc),'[]') from (
    select f.nombre productor, count(*) filter (where q.resultado='Rechazado') rechazos,
           count(*) filter (where q.resultado='Liberado con observación') observaciones, count(*) pruebas
    from sap.qals q join soi.lote l using (charg) join soi.recepcion_campo r using (recepcion_id)
    join soi.parcela p using (parcela_id) join sap.lfa1 f on f.lifnr = p.lifnr
    where q.fecha >= '2026-07-01' group by 1) t),
 'dano_mensual', (select coalesce(jsonb_agg(t order by mes, productor),'[]') from (
    select to_char(date_trunc('month',r.fecha),'YYYY-MM') mes, f.nombre productor, round(avg(r.pct_dano),1) pct_dano
    from soi.recepcion_campo r join soi.parcela p using (parcela_id) join sap.lfa1 f on f.lifnr = p.lifnr
    where r.fecha >= '2026-04-01' group by 1,2) t),
 'rechazos_detalle', (select coalesce(jsonb_agg(t order by fecha desc),'[]') from (
    select q.fecha, q.charg lote, q.tipo_prueba, q.defecto, f.nombre productor, p.nombre parcela
    from sap.qals q join soi.lote l using (charg) join soi.recepcion_campo r using (recepcion_id)
    join soi.parcela p using (parcela_id) join sap.lfa1 f on f.lifnr = p.lifnr
    where q.resultado='Rechazado' order by q.fecha desc limit 20) t),
 'certificaciones', (select coalesce(jsonb_agg(t order by vigencia_fin),'[]') from (
    select tipo, entidad, vigencia_fin, (vigencia_fin - date '2026-10-26') dias_restantes from soi.certificacion) t)
);
$$;

create or replace function public.demo_comercial() returns jsonb language sql security definer set search_path = '' as $$
select jsonb_build_object(
 'cartera', (select coalesce(jsonb_agg(t order by vencido_usd desc),'[]') from (
    select k.nombre cliente, k.limite_credito_usd limite,
           round(sum(f.monto_usd) filter (where f.fecha_pago is null and f.fecha_vencimiento < date '2026-10-26')) vencido_usd,
           max(date '2026-10-26' - f.fecha_vencimiento) filter (where f.fecha_pago is null and f.fecha_vencimiento < date '2026-10-26') max_dias
    from sap.factura f join sap.kna1 k using (kunnr)
    group by 1,2 having sum(f.monto_usd) filter (where f.fecha_pago is null and f.fecha_vencimiento < date '2026-10-26') > 0) t),
 'ventas_cliente', (select coalesce(jsonb_agg(t order by usd desc),'[]') from (
    select k.nombre cliente, k.estado_region estado, round(sum(f.monto_usd)) usd
    from sap.factura f join sap.kna1 k using (kunnr) where f.fecha_factura >= '2026-01-01' group by 1,2) t),
 'embarques_tarde_mensual', (select coalesce(jsonb_agg(t order by mes, cruce),'[]') from (
    select to_char(date_trunc('month',fecha_salida),'YYYY-MM') mes, cruce, count(*) embarques,
           count(*) filter (where fecha_llegada_real > fecha_llegada_prometida + 1) tardios,
           count(*) filter (where temp_max_c > -12) excursiones
    from soi.embarque where fecha_salida >= '2026-06-01' and fecha_llegada_real is not null group by 1,2) t)
);
$$;

create or replace function public.demo_operacion_campo() returns jsonb language sql security definer set search_path = '' as $$
select jsonb_build_object(
 'camaras_mensual', (select coalesce(jsonb_agg(t order by camara, mes),'[]') from (
    select c.camara_id camara, c.nombre, to_char(date_trunc('month',l.fecha),'YYYY-MM') mes,
           round(avg(l.kwh)) kwh_dia, round(max(l.temp_max_c),1) temp_max
    from soi.lectura_camara_dia l join soi.camara c using (camara_id)
    where l.fecha >= '2026-06-01' and c.camara_id in ('CF-03','CF-04') group by 1,2,3) t),
 'agua_parcela', (select coalesce(jsonb_agg(t order by m3_ha desc),'[]') from (
    select p.parcela_id, p.nombre, round(sum(a.m3)/p.hectareas) m3_ha, round(sum(a.kwh_bombeo)) kwh_bombeo
    from soi.consumo_agua a join soi.parcela p using (parcela_id)
    where a.mes between '2026-03-01' and '2026-09-01' group by 1,2,p.hectareas) t),
 'queso_mensual', (select coalesce(jsonb_agg(t order by mes),'[]') from (
    select to_char(date_trunc('month',k.fecha),'YYYY-MM') mes, round(avg(p.precio_unit),1) precio_kg,
           round(avg(p.fecha_entrega_real - p.fecha_entrega_prometida),1) retraso_dias
    from sap.ekpo p join sap.ekko k using (ebeln)
    where p.matnr='R-002' and k.fecha >= '2026-03-01' and p.fecha_entrega_real is not null group by 1) t)
);
$$;

create or replace function public.demo_claude() returns jsonb language sql security definer set search_path = '' as $$
select jsonb_build_object(
 'alertas', (select coalesce(jsonb_agg(t order by ts desc),'[]') from (
    select alerta_id, ts, severidad, area, titulo, detalle, estado from claude.alerta) t),
 'acciones', (select coalesce(jsonb_agg(t order by fecha_compromiso),'[]') from (
    select a.accion_id, a.alerta_id, a.descripcion, a.responsable, a.area, a.fecha_compromiso, a.estado from claude.accion a) t),
 'notificaciones', (select coalesce(jsonb_agg(t order by ts desc),'[]') from (
    select notif_id, alerta_id, destinatario, canal, asunto, cuerpo, ts from claude.notificacion) t),
 'minutas', (select coalesce(jsonb_agg(t order by fecha desc),'[]') from (
    select minuta_id, fecha, titulo, asistentes, resumen, acuerdos from claude.minuta) t)
);
$$;

do $$
declare f text;
begin
  foreach f in array array['demo_direccion','demo_planta','demo_calidad','demo_comercial','demo_operacion_campo','demo_claude'] loop
    execute format('revoke all on function public.%I() from public, anon, authenticated', f);
    execute format('grant execute on function public.%I() to service_role', f);
  end loop;
end $$;
