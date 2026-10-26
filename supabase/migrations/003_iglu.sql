-- Administración del iglú (almacén en frío): posiciones y tarimas por lote.
-- Estructura SUPUESTA para la demo; con datos reales se ajusta al módulo del SOI.
create table if not exists soi.iglu_posicion (
  posicion_id text primary key,            -- CF-04-C-07-3
  camara_id   text not null references soi.camara(camara_id),
  pasillo     text not null,               -- A..H
  columna     int  not null,               -- 1..10
  nivel       int  not null                -- 1..5
);
create table if not exists soi.tarima (
  tarima_id     text primary key,          -- T-000123
  charg         text not null references soi.lote(charg),
  matnr         text not null,
  cajas         int  not null,
  posicion_id   text unique references soi.iglu_posicion(posicion_id),  -- una tarima por posición
  fecha_ingreso date not null,
  estado        text not null default 'Disponible'   -- Disponible | Retenida por calidad
);
alter table soi.iglu_posicion enable row level security;
alter table soi.tarima enable row level security;

insert into soi.iglu_posicion
select c.camara_id||'-'||p||'-'||lpad(col::text,2,'0')||'-'||n, c.camara_id, p, col, n
from soi.camara c, unnest(array['A','B','C','D','E','F','G','H']) p, generate_series(1,10) col, generate_series(1,5) n
where c.camara_id in ('CF-03','CF-04')
on conflict do nothing;

-- Existencias: lotes recientes (PEPS) + lotes viejos olvidados en CF-04 (hallazgo sembrado).
with nuevos as (
  select l.charg, l.matnr, l.fecha, l.cajas, ceil(l.cajas/60.0)::int np,
         sum(ceil(l.cajas/60.0)::int) over (order by l.fecha desc, l.charg) acum
  from soi.lote l where l.fecha >= date '2026-10-01'
), sel as (select * from nuevos where acum - np < 560),
viejos as (
  select l.charg, l.matnr, l.fecha, l.cajas, 3 np from soi.lote l
  where l.fecha < date '2025-06-10' and l.matnr in ('F-001','F-002') order by l.fecha limit 8
), todos as (
  select charg, matnr, fecha, cajas, np, 0 viejo from sel
  union all select charg, matnr, fecha, cajas, np, 1 from viejos
), pal as (
  select t.*, g.i from todos t, lateral generate_series(1, t.np) g(i)
), num as (
  select p.*, row_number() over (order by viejo, fecha desc, charg, i) rn,
         count(*) filter (where viejo = 0) over () nuevas from pal p
), pos as (
  select posicion_id, row_number() over (order by case camara_id when 'CF-03' then 0 else 1 end, pasillo, columna, nivel) pn
  from soi.iglu_posicion
)
insert into soi.tarima (tarima_id, charg, matnr, cajas, posicion_id, fecha_ingreso, estado)
select 'T-'||lpad(n.rn::text,6,'0'), n.charg, n.matnr,
       case when n.i < n.np then 60 else greatest(n.cajas - 60*(n.np-1), 12) end,
       case when n.viejo = 1 then
              (select posicion_id from soi.iglu_posicion where camara_id='CF-04' and pasillo='H' and columna = 6 + ((n.rn - n.nuevas - 1) % 5) and nivel = 1 + ((n.rn - n.nuevas - 1) / 5) limit 1)
            else p.posicion_id end,
       n.fecha + 1,
       case when exists (select 1 from sap.qals q where q.charg=n.charg and q.resultado='Rechazado') then 'Retenida por calidad' else 'Disponible' end
from num n left join pos p on p.pn = n.rn and n.viejo = 0
on conflict do nothing;
