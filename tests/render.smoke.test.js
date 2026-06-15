/**
 * Prueba de humo del renderizado: simula un DOM mínimo y confirma que cada
 * pestaña genera HTML sin lanzar errores. No reemplaza una prueba en navegador,
 * pero atrapa fallos de plantillas / referencias indefinidas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

/* ── Stub de DOM antes de importar los renderers ── */
const elements = new Map();
function fakeEl() {
  return {
    innerHTML: '', textContent: '', className: '', value: '', style: {},
    setAttribute() {}, getAttribute() { return ''; }, addEventListener() {},
    classList: { toggle() {}, add() {}, remove() {} },
  };
}
function get(sel) { if (!elements.has(sel)) elements.set(sel, fakeEl()); return elements.get(sel); }

globalThis.document = {
  querySelector: (sel) => get(sel),
  querySelectorAll: () => [],
  getElementById: (id) => get('#' + id),
};
globalThis.window = { matchMedia: () => ({ matches: false }) };

const {
  renderLegend, renderEquipos, renderGrupos, renderTabla, renderCalendario, renderApuestas,
  renderMiPanel, renderEliminatorias, renderRecords, renderNextBar,
} = await import('../js/render.js');

const m = (id, group, md, home, away, hs, as) => ({
  id, stage: 'GROUP_STAGE', group, matchday: md,
  utcDate: `2026-06-${10 + md}T18:00:00Z`,
  status: hs == null ? 'TIMED' : 'FINISHED',
  homeTeam: { name: home }, awayTeam: { name: away },
  score: { fullTime: { home: hs, away: as } },
});

const koMatch = {
  id: 90, stage: 'LAST_32', matchday: null, utcDate: '2026-06-28T19:00:00Z', status: 'TIMED',
  homeTeam: { name: null }, awayTeam: { name: null }, score: { fullTime: { home: null, away: null } },
};

const state = {
  matches: [
    m(1, 'GROUP_A', 1, 'Mexico', 'South Africa', 2, 0),
    m(2, 'GROUP_C', 1, 'Brazil', 'Scotland', 3, 1),
    m(3, 'GROUP_A', 2, 'Mexico', 'Korea Republic', null, null),
    koMatch,
  ],
  standings: [], crests: {}, me: 'Alejandro', error: null, fromCache: false, loading: false, configMissing: false,
};

test('renderLegend pinta los 6 participantes', () => {
  renderLegend();
  assert.match(get('#legend-row').innerHTML, /Alejandro/);
});

test('renderEquipos pinta tarjetas con equipos', () => {
  renderEquipos(state);
  const html = get('#equipos').innerHTML;
  assert.ok(html.length > 100);
  assert.match(html, /México/);
});

test('renderGrupos pinta las 12 tablas', () => {
  renderGrupos(state);
  const html = get('#grupos').innerHTML;
  assert.equal((html.match(/standings-group-title/g) || []).length, 12);
  assert.match(html, /Grupo A/);
});

test('renderTabla pinta jornadas y acumulado', () => {
  renderTabla(state);
  const html = get('#tabla').innerHTML;
  assert.match(html, /Jornada 1/);
  assert.match(html, /Acumulado total/);
});

test('renderCalendario agrupa partidos por día', () => {
  renderCalendario(state);
  assert.match(get('#calendario').innerHTML, /match-card/);
});

test('renderApuestas pinta opciones y actualiza el contador de duelos', () => {
  renderApuestas(state);
  assert.match(get('#apuestas').innerHTML, /Opción 01/);
  assert.notEqual(get('#duel-count').textContent, '');
});

test('estado sin datos + configMissing muestra el aviso de configuración', () => {
  renderCalendario({ matches: [], loading: false, configMissing: true });
  assert.match(get('#calendario').innerHTML, /configurar el origen de datos/);
});

test('renderMiPanel pinta el panel del participante elegido', () => {
  renderMiPanel(state);
  const html = get('#yo').innerHTML;
  assert.match(html, /Alejandro/);
  assert.match(html, /selecciones/);
});

test('renderMiPanel sin participante invita a elegir', () => {
  renderMiPanel({ ...state, me: null });
  assert.match(get('#yo').innerHTML, /Quién eres/);
});

test('renderEliminatorias pinta el cuadro con "Por definir"', () => {
  renderEliminatorias(state);
  const html = get('#eliminatorias').innerHTML;
  assert.match(html, /16avos de final/);
  assert.match(html, /Por definir/);
});

test('renderRecords pinta récords y cara a cara', () => {
  renderRecords(state);
  const html = get('#records').innerHTML;
  assert.match(html, /Récords del torneo/);
  assert.match(html, /Cara a cara/);
});

test('renderNextBar no truena (con o sin próximo partido)', () => {
  renderNextBar(state);
  assert.equal(typeof get('#next-bar').innerHTML, 'string');
});
