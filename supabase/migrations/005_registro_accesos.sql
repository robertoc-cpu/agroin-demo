-- Registro de accesos a la demo (sin IP ni datos personales).
create table if not exists claude.acceso_log (
  id bigserial primary key,
  ts timestamptz not null default now(),
  resultado text not null,   -- ok | codigo_incorrecto | sin_codigo
  area text, dispositivo text, navegador text, pais text, region text, ciudad text
);
alter table claude.acceso_log enable row level security;
-- Función public.demo_registrar_acceso(...) solo ejecutable por service_role; la llama api/data.js.
