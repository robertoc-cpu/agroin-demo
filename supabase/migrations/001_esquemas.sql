-- Esquemas de la demo (datos 100% ficticios).
-- sap = ERP simulado; soi = sistema interno operativo simulado; claude = capa de inteligencia.
create schema if not exists sap;
create schema if not exists soi;
create schema if not exists claude;

-- ============ SAP (nombres tipo SAP) ============
create table sap.mara (matnr text primary key, descripcion text not null, tipo text not null check (tipo in ('ROH','HALB','FERT','VERP')), unidad text not null, costo_std numeric(12,4));
create table sap.lfa1 (lifnr text primary key, nombre text not null, municipio text, estado text default 'Aguascalientes', categoria text not null);
create table sap.kna1 (kunnr text primary key, nombre text not null, pais text not null, estado_region text, plazo_pago_dias int not null, limite_credito_usd numeric(14,2));
create table sap.ekko (ebeln text primary key, lifnr text references sap.lfa1, fecha date not null, moneda text default 'MXN');
create table sap.ekpo (ebeln text references sap.ekko, ebelp int, matnr text references sap.mara, cantidad numeric(14,2) not null, unidad text, precio_unit numeric(12,4) not null, fecha_entrega_prometida date, fecha_entrega_real date, primary key (ebeln, ebelp));
create table sap.vbak (vbeln text primary key, kunnr text references sap.kna1, fecha date not null, moneda text default 'USD');
create table sap.vbap (vbeln text references sap.vbak, posnr int, matnr text references sap.mara, cajas int not null, precio_caja_usd numeric(10,2) not null, primary key (vbeln, posnr));
create table sap.factura (belnr text primary key, vbeln text references sap.vbak, kunnr text references sap.kna1, fecha_factura date not null, fecha_vencimiento date not null, fecha_pago date, monto_usd numeric(14,2) not null);
create table sap.afko (aufnr text primary key, matnr text references sap.mara, linea text not null, fecha date not null, kg_entrada numeric(12,2) not null, kg_salida numeric(12,2) not null, merma_kg numeric(12,2) not null, cajas_producidas int not null, costo_mp_mxn numeric(14,2), costo_mo_mxn numeric(14,2), costo_energia_mxn numeric(14,2));
create table sap.qals (prueba_id bigserial primary key, charg text not null, tipo_prueba text not null, resultado text not null check (resultado in ('Aprobado','Rechazado','Liberado con observación')), defecto text, fecha date not null);

-- ============ SOI (suposición de estructura) ============
create table soi.parcela (parcela_id text primary key, lifnr text references sap.lfa1, nombre text not null, municipio text, hectareas numeric(8,2), variedad text);
create table soi.recepcion_campo (recepcion_id bigserial primary key, fecha date not null, parcela_id text references soi.parcela, kg_recibidos numeric(12,2) not null, kg_aceptados numeric(12,2) not null, pct_dano numeric(5,2), temp_recepcion_c numeric(5,1));
create table soi.lote (charg text primary key, fecha date not null, aufnr text references sap.afko, recepcion_id bigint references soi.recepcion_campo, matnr text references sap.mara, cajas int, fecha_caducidad date);
create table soi.camara (camara_id text primary key, nombre text not null, tipo text, capacidad_tarimas int);
create table soi.lectura_camara_dia (camara_id text references soi.camara, fecha date, temp_prom_c numeric(5,1), temp_max_c numeric(5,1), kwh numeric(10,1), horas_fuera_rango numeric(4,1) default 0, primary key (camara_id, fecha));
create table soi.paro_linea (paro_id bigserial primary key, linea text not null, fecha date not null, duracion_min int not null, causa text not null);
create table soi.embarque (embarque_id text primary key, vbeln text references sap.vbak, fecha_salida date, cruce text, transportista text, fecha_llegada_prometida date, fecha_llegada_real date, temp_max_c numeric(5,1));
create table soi.consumo_agua (parcela_id text references soi.parcela, mes date, m3 numeric(12,1), kwh_bombeo numeric(10,1), primary key (parcela_id, mes));
create table soi.certificacion (cert_id serial primary key, tipo text not null, entidad text, vigencia_inicio date, vigencia_fin date, alcance text);

-- ============ CLAUDE (alertas, acciones, notificaciones, minutas, guía) ============
create table claude.contacto (contacto_id serial primary key, nombre text not null, puesto text, area text not null, correo text);
create table claude.regla_alerta (regla_id serial primary key, area text not null, metrica text not null, condicion text not null, severidad text not null check (severidad in ('Informativa','Media','Crítica')), destinatarios text);
create table claude.alerta (alerta_id bigserial primary key, ts timestamptz not null default now(), severidad text not null, area text not null, regla_id int references claude.regla_alerta, titulo text not null, detalle text, estado text not null default 'Abierta' check (estado in ('Abierta','En atención','Cerrada')));
create table claude.accion (accion_id bigserial primary key, alerta_id bigint references claude.alerta, descripcion text not null, responsable text, area text, fecha_compromiso date, estado text not null default 'Pendiente' check (estado in ('Pendiente','En proceso','Completada','Vencida')));
create table claude.notificacion (notif_id bigserial primary key, alerta_id bigint references claude.alerta, destinatario text, canal text default 'correo', asunto text, cuerpo text, ts timestamptz default now());
create table claude.minuta (minuta_id bigserial primary key, fecha date not null, titulo text not null, asistentes text, resumen text, acuerdos text);
create table claude.guia (seccion text primary key, contenido text not null);
create table claude.pregunta_demo (id serial primary key, area text not null, pregunta text not null, que_demuestra text);

-- Seguridad: RLS activado en todo. La app lee solo por funciones (002) con llave de servidor.
do $$
declare r record;
begin
  for r in select schemaname, tablename from pg_tables where schemaname in ('sap','soi','claude') loop
    execute format('alter table %I.%I enable row level security', r.schemaname, r.tablename);
  end loop;
end $$;
