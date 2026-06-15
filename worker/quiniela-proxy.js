/**
 * quiniela-proxy.js — Cloudflare Worker que actúa de proxy seguro hacia
 * football-data.org. La API key vive como SECRETO en el Worker (env.FOOTBALL_DATA_TOKEN),
 * nunca en el navegador ni en el repo.
 *
 * El navegador llama, por ejemplo:
 *   https://quiniela-proxy.TU-USUARIO.workers.dev/competitions/WC/matches?season=2026
 * y el Worker lo reenvía a:
 *   https://api.football-data.org/v4/competitions/WC/matches?season=2026
 *
 * Variables de entorno (configúralas en el panel de Cloudflare):
 *   FOOTBALL_DATA_TOKEN  (Secret, obligatorio)  → tu API key de football-data.org
 *   ALLOW_ORIGIN         (Variable, opcional)   → tu URL de GitHub Pages para
 *                                                 restringir CORS. Por defecto '*'.
 */
const API_BASE = 'https://api.football-data.org/v4';

export default {
  async fetch(request, env) {
    const allowOrigin = env.ALLOW_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'GET') {
      return json({ error: 'Método no permitido' }, 405, cors);
    }

    const url = new URL(request.url);

    // Solo se permite reenviar rutas de competiciones (evita abuso del proxy).
    if (!url.pathname.startsWith('/competitions/')) {
      return json({ error: 'Ruta no permitida' }, 403, cors);
    }
    if (!env.FOOTBALL_DATA_TOKEN) {
      return json({ error: 'Falta el secreto FOOTBALL_DATA_TOKEN en el Worker' }, 500, cors);
    }

    const target = `${API_BASE}${url.pathname}${url.search}`;
    let upstream;
    try {
      upstream = await fetch(target, { headers: { 'X-Auth-Token': env.FOOTBALL_DATA_TOKEN } });
    } catch (e) {
      return json({ error: `No se pudo contactar la API: ${e.message}` }, 502, cors);
    }

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...cors,
        'Content-Type': 'application/json; charset=utf-8',
        // Pequeña caché en el borde para suavizar el límite de la API (10 req/min).
        'Cache-Control': 'public, max-age=30',
      },
    });
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
