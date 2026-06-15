/**
 * config.js — Configuración de la app y del origen de datos.
 *
 * Origen de datos (en orden de prioridad):
 *   1) `proxyBase`: URL de un proxy (Cloudflare Worker). Es lo más fiable y, además,
 *      esconde la key. Opcional. Ver worker/README.md.
 *   2) `apiKey`: key directa de football-data.org. La página la usa a través de un
 *      proxy CORS público (`legacyCorsProxy`) porque football-data no permite
 *      llamadas directas desde el navegador.
 *
 * Nota: en un sitio estático la key SIEMPRE queda visible en el navegador. Aquí se
 * deja a propósito porque es una key gratuita y de bajo riesgo. Si algún día la
 * página empieza a fallar al cargar (el proxy público a veces cae), define `proxyBase`
 * con un Worker: eso la vuelve fiable.
 */

const defaults = {
  /** URL base de un proxy (Cloudflare Worker). Opcional; si se define, tiene prioridad. */
  proxyBase: '',

  /** API key de football-data.org. Visible en el navegador (key gratuita, bajo riesgo). */
  apiKey: '55274e0f8b9b40b096f3513cac43496b',

  /** Proxy CORS público necesario para usar apiKey sin Worker (puede fallar a veces). */
  legacyCorsProxy: 'https://corsproxy.io/?url=',

  /** Datos de la competición en football-data.org */
  apiBase: 'https://api.football-data.org/v4',
  competition: 'WC',
  season: 2026,

  /** Zona horaria para mostrar fechas/horas */
  timeZone: 'America/Mexico_City',
  locale: 'es-MX',

  /** Comportamiento de red */
  requestTimeoutMs: 12000,
  maxRetries: 2,
  cacheTtlMs: 5 * 60 * 1000,        // datos servibles desde caché hasta 5 min
  refreshMs: 60 * 1000,             // re-fetch automático cuando hay partidos en vivo

  /** Datos económicos del bote (solo presentación) */
  potMXN: 1200,
};

// Override opcional desde js/config.local.js (no versionado).
let override = {};
try {
  const mod = await import('./config.local.js');
  override = mod.default ?? mod.config ?? mod.CONFIG ?? {};
} catch (_) {
  // No existe config.local.js — normal en producción (se usa el proxy).
}

export const CONFIG = { ...defaults, ...override };

/** ¿Hay alguna fuente de datos configurada? */
export function hasDataSource() {
  return Boolean(CONFIG.proxyBase || CONFIG.apiKey);
}
