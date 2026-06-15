/**
 * app.js — Orquestador: estado, inicialización, carga y auto-refresco.
 */
import { CONFIG, hasDataSource } from './config.js';
import { fetchTournament, readCachedTournament, ConfigError } from './api.js';
import { countLive, extractCrests } from './scoring.js';
import { findUnmappedNames } from './data.js';
import { $, setStatus, initTabs, initTheme, initParticipant, tickCountdowns, fmtClock } from './ui.js';
import { renderLegend, renderAll } from './render.js';

const state = {
  matches: [],
  standings: [],
  crests: {},
  me: null,
  error: null,
  fromCache: false,
  loading: false,
  configMissing: !hasDataSource(),
  fetchedAt: null,
  cachedAt: null,
};

function reportUnmapped() {
  const unmapped = findUnmappedNames(state.matches);
  if (unmapped.length) console.warn('⚠️ Nombres de la API sin mapeo en NAME_MAP:', unmapped);
}

async function loadAll() {
  if (!hasDataSource()) {
    state.configMissing = true;
    state.loading = false;
    setStatus('error', 'Sin origen de datos — configura el proxy o tu API key');
    renderAll(state);
    return;
  }

  state.loading = true;
  const btn = $('#refresh-btn');
  if (btn) { btn.disabled = true; btn.classList.add('spinning'); }
  setStatus('loading', 'Cargando datos en vivo…');
  renderAll(state); // muestra skeleton en calendario mientras carga

  try {
    const data = await fetchTournament();
    Object.assign(state, {
      matches: data.matches,
      standings: data.standings,
      crests: extractCrests(data.matches),
      fromCache: data.fromCache,
      fetchedAt: data.fetchedAt,
      cachedAt: data.cachedAt,
      error: data.error || null,
      configMissing: false,
    });

    const live = countLive(state.matches);
    if (data.fromCache) {
      setStatus('cache', `Datos en caché${data.cachedAt ? ` · ${fmtClock(data.cachedAt)}` : ''} · la API no respondió`);
    } else if (live > 0) {
      setStatus('live', `${live} partido${live > 1 ? 's' : ''} en vivo · ${fmtClock(data.fetchedAt)}`);
    } else {
      setStatus('live', `Datos actualizados · ${fmtClock(data.fetchedAt)}`);
    }
    reportUnmapped();
  } catch (e) {
    state.error = e.message;
    state.configMissing = e instanceof ConfigError;
    setStatus('error', e instanceof ConfigError
      ? 'Sin origen de datos — revisa la configuración'
      : `Error: ${e.message}`);
    console.error(e);
  } finally {
    state.loading = false;
    if (btn) { btn.disabled = false; btn.classList.remove('spinning'); }
    renderAll(state);
  }
}

/* ── Init ── */
function init() {
  initTheme();
  initTabs();
  renderLegend();

  // Modo "Yo": participante seleccionado (persistido), re-renderiza al cambiar.
  state.me = initParticipant((me) => {
    state.me = me;
    renderAll(state);
    tickCountdowns();
  });

  const pot = $('#stat-pot');
  if (pot) pot.textContent = `$${CONFIG.potMXN.toLocaleString(CONFIG.locale)}`;

  $('#refresh-btn')?.addEventListener('click', loadAll);

  // Pintado inmediato desde caché (si hay), para no mostrar una página vacía.
  const cached = readCachedTournament();
  if (cached) {
    Object.assign(state, {
      matches: cached.matches,
      standings: cached.standings,
      crests: extractCrests(cached.matches),
      fromCache: true,
      cachedAt: cached.cachedAt,
    });
  }
  state.loading = hasDataSource();
  renderAll(state);
  tickCountdowns();

  loadAll();

  // Cuenta regresiva: actualiza cada segundo.
  setInterval(tickCountdowns, 1000);

  // Auto-refresco mientras haya partidos en vivo.
  setInterval(() => {
    if (countLive(state.matches) > 0) loadAll();
  }, CONFIG.refreshMs);
}

init();
