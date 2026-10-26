# Agroin Demo

Demostración con **datos 100% ficticios** de lo que Claude puede hacer sobre los sistemas de una agroindustria de chile relleno congelado para exportación (planta en Jesús María, Aguascalientes): SAP, un sistema interno operativo (SOI), alertas a responsables, recordatorios de acciones y minutas automáticas.

> Ninguna cifra ni nombre corresponde a la empresa real. El SOI y SAP están simulados; la estructura del SOI es una suposición.

## Piezas

| Pieza | Dónde | Para qué |
|---|---|---|
| Base de datos | Supabase, proyecto `agroin-demo` | Esquemas `sap`, `soi` y `claude` con ~18 meses de operación simulada |
| Tablero web | Vercel (`public/` + `api/data.js`) | Vistas por área; sin dependencias ni paso de compilación |
| Preguntas en español | Sesión de Claude con el conector de Supabase | Lee `claude.guia` y responde sobre los datos; guion en `claude.pregunta_demo` |
| Código | Este repositorio | Esquema, funciones y app |

## Despliegue en Vercel

1. Importar este repositorio en Vercel (Framework Preset: **Other**; no requiere Build Command).
2. En **Settings → Environment Variables** agregar:
   - `SUPABASE_URL`: `https://dtvipihhkpfggxfndfpc.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: llave de servidor (Supabase → Project Settings → API Keys). **Nunca** va en el código ni en Git.
   - `DEMO_ACCESS_CODE` (opcional): si se define, la página pide ese código.
3. Desplegar.

La llave de servidor solo la usa `api/data.js`; el navegador nunca la recibe. Las tablas tienen RLS activado y la app solo ejecuta las funciones `public.demo_*`, que ni `anon` ni `authenticated` pueden llamar.

## Base de datos

- `supabase/migrations/001_esquemas.sql`: tablas de `sap`, `soi` y `claude`.
- `supabase/migrations/002_funciones_lectura_app.sql`: funciones de lectura de la app.
- `supabase/migrations/003_iglu.sql` y `004_funciones_iglu_alertas.sql`: iglú, alertas accionables y canal WhatsApp.

Los avisos (correo y WhatsApp) solo se registran en `claude.notificacion`; el envío real de WhatsApp requiere la API de WhatsApp Business.

Los datos simulados ya están cargados en el proyecto `agroin-demo` (mayo 2025 a 25-oct-2026; "hoy" de la demo es 26-oct-2026). Historia sembrada: productor con calidad a la baja, cámara de frío con falla progresiva, paros recurrentes de lunes en Línea 2, cliente con cartera vencida, retrasos en un cruce fronterizo, alza de precio del queso y certificaciones por vencer.

## Hacia datos reales

Cuando se apruebe la conexión, el origen de datos cambia (vistas sobre SAP/SOI en lugar de tablas simuladas) y la app y las preguntas se mantienen.
