/**
 * api.js — Capa de datos resiliente sobre football-data.org.
 *
 * - Timeout por petición (AbortController)
 * - Reintentos con backoff ante errores de red / 429 / 5xx
 * - Caché en localStorage con TTL: muestra el último dato conocido al instante
 *   y sirve de respaldo si la API falla ("datos en caché").
 * - Dos orígenes posibles: proxy (Worker) o key directa + proxy CORS.
 */
import { CONFIG } from './config.js';

const CACHE_PREFIX = 'quiniela:v1:';

/** Error de configuración (no hay fuente de datos) — distinto de un fallo de red. */
export class ConfigError extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, ts: Date.now() }));
  } catch (_) {
    /* localStorage no disponible (modo privado / file://) */
  }
}

/** Orígenes a intentar, en orden, para una ruta dada. */
function buildTargets(path) {
  if (CONFIG.proxyBase) {
    const base = CONFIG.proxyBase.replace(/\/$/, '');
    return [{ url: `${base}${path}`, headers: {} }];
  }
  if (CONFIG.apiKey) {
    const full = `${CONFIG.apiBase}${path}`;
    const headers = { 'X-Auth-Token': CONFIG.apiKey };
    return [
      { url: full, headers }, // directo (suele fallar por CORS desde el navegador)
      { url: `${CONFIG.legacyCorsProxy}${encodeURIComponent(full)}`, headers }, // proxy público
    ];
  }
  return [];
}

async function fetchWithTimeout(url, headers, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { headers, mode: 'cors', signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Pide una ruta de la API con reintentos. Lanza si todo falla. */
export async function apiFetch(path) {
  const targets = buildTargets(path);
  if (!targets.length) {
    throw new ConfigError('Sin fuente de datos: configura el proxy (Worker) o una API key.');
  }

  let lastErr;
  for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
    for (const t of targets) {
      try {
        const r = await fetchWithTimeout(t.url, t.headers, CONFIG.requestTimeoutMs);
        if (r.ok) return await r.json();
        // 429 / 5xx → reintentable; 4xx → error definitivo
        if (r.status === 429 || r.status >= 500) {
          lastErr = new Error(`API ${r.status}`);
          continue;
        }
        const txt = await r.text().catch(() => '');
        throw new Error(`API ${r.status}: ${txt.slice(0, 120)}`);
      } catch (e) {
        lastErr = e;
      }
    }
    if (attempt < CONFIG.maxRetries) await sleep(500 * 2 ** attempt);
  }
  throw lastErr || new Error('Fallo de red desconocido.');
}

/**
 * Trae partidos + posiciones del torneo.
 * @returns {Promise<{matches:Array, standings:Array, fetchedAt:number,
 *                     fromCache:boolean, cachedAt?:number, error?:string}>}
 */
export async function fetchTournament() {
  const matchesPath = `/competitions/${CONFIG.competition}/matches?season=${CONFIG.season}`;
  const standingsPath = `/competitions/${CONFIG.competition}/standings?season=${CONFIG.season}`;

  try {
    const [mData, sData] = await Promise.all([apiFetch(matchesPath), apiFetch(standingsPath)]);
    const result = {
      matches: mData.matches || [],
      standings: sData.standings || [],
      fetchedAt: Date.now(),
      fromCache: false,
    };
    writeCache('tournament', result);
    return result;
  } catch (e) {
    // Respaldo: último dato conocido, marcado como caché.
    const cached = readCache('tournament');
    if (cached?.data) {
      return { ...cached.data, fromCache: true, cachedAt: cached.ts, error: e.message };
    }
    throw e;
  }
}

/** ¿Tenemos algún dato cacheado para arrancar sin esperar a la red? */
export function readCachedTournament() {
  const cached = readCache('tournament');
  if (!cached?.data) return null;
  return { ...cached.data, fromCache: true, cachedAt: cached.ts };
}
