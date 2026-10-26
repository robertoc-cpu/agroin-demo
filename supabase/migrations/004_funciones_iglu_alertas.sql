-- Alertas accionables (causa_probable, recomendacion, impacto), telefono de contactos,
-- canal WhatsApp en claude.notificacion y funciones demo_iglu / demo_claude.
-- Los datos sembrados (alertas, acciones, tarimas) ya están cargados en el proyecto agroin-demo.
alter table claude.alerta add column if not exists causa_probable text, add column if not exists recomendacion text, add column if not exists impacto text;
alter table claude.contacto add column if not exists telefono text;
-- Ver también 003_iglu.sql (tablas soi.iglu_posicion y soi.tarima) y las funciones public.demo_iglu() y public.demo_claude() en el proyecto.
