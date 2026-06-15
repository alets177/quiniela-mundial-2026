/**
 * Pruebas de la lógica de las funciones nuevas (escudos, eliminatorias,
 * próximo partido, stats de participante, récords, cara a cara).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractCrests, knockoutByStage, nextMatch, duelOutcome,
  participantStats, computeRecords, headToHead, findDuels,
  teamHistory, teamRecord,
} from '../js/scoring.js';

function gm(id, group, md, home, away, hs, as, status = 'FINISHED') {
  const fin = hs != null;
  return {
    id, stage: 'GROUP_STAGE', group, matchday: md,
    utcDate: `2026-06-${10 + md}T18:00:00Z`,
    status: fin ? status : 'TIMED',
    homeTeam: { name: home, crest: `https://crests/${home}.svg`, tla: home.slice(0, 3).toUpperCase() },
    awayTeam: { name: away, crest: `https://crests/${away}.svg`, tla: away.slice(0, 3).toUpperCase() },
    score: { fullTime: { home: fin ? hs : null, away: fin ? as : null } },
  };
}

const MATCHES = [
  gm(1, 'GROUP_A', 1, 'Mexico', 'South Africa', 3, 0),       // Alejandro 3-0 Gerardo
  gm(2, 'GROUP_C', 1, 'Brazil', 'Scotland', 1, 2),           // Gerardo pierde vs Richard
  gm(3, 'GROUP_A', 2, 'Mexico', 'Korea Republic', null, null), // programado (Alejandro vs Anahi)
  {
    id: 90, stage: 'LAST_32', matchday: null, utcDate: '2026-06-28T19:00:00Z', status: 'TIMED',
    homeTeam: { name: null }, awayTeam: { name: null }, score: { fullTime: { home: null, away: null } },
  },
];

test('extractCrests mapea nombre(español) → escudo', () => {
  const c = extractCrests(MATCHES);
  assert.equal(c['México'].crest, 'https://crests/Mexico.svg');
  assert.equal(c['Brasil'].tla, 'BRA');
});

test('knockoutByStage agrupa y ordena las fases presentes', () => {
  const ko = knockoutByStage(MATCHES);
  assert.equal(ko.length, 1);
  assert.equal(ko[0].stage, 'LAST_32');
  assert.equal(ko[0].matches.length, 1);
});

test('nextMatch devuelve el próximo programado (y filtra por equipos)', () => {
  const now = new Date('2026-06-11T00:00:00Z');
  const n = nextMatch(MATCHES, now);
  assert.equal(n.id, 3); // único SCHEDULED/TIMED de grupos a futuro
  // filtrado a equipos de Anahi (tiene a Corea)
  const nAnahi = nextMatch(MATCHES, now, ['República de Corea']);
  assert.equal(nAnahi.id, 3);
  // filtrado a equipos que no juegan pronto → null
  assert.equal(nextMatch(MATCHES, now, ['Haití']), null);
});

test('duelOutcome resuelve ganador / empate / pendiente', () => {
  const duels = findDuels(MATCHES);
  const mexSa = duels.find((d) => d.home === 'México');
  assert.equal(duelOutcome(mexSa), 'Alejandro'); // 3-0
  const prog = duels.find((d) => d.away === 'República de Corea');
  assert.equal(duelOutcome(prog), null); // sin marcador
});

test('participantStats resume puntos, rank y duelos', () => {
  const st = participantStats(MATCHES, 'Alejandro', new Date('2026-06-11T00:00:00Z'));
  assert.equal(st.total, 3);           // ganó México 3-0
  assert.equal(st.duels.won, 1);       // venció a Gerardo
  assert.equal(st.duels.pending, 1);   // duelo programado vs Anahi
  assert.ok(st.next);                  // tiene próximo partido
});

test('computeRecords saca mayor goleada y goleo por participante', () => {
  const r = computeRecords(MATCHES);
  assert.equal(r.biggest.margin, 3);   // México 3-0
  assert.equal(r.goalRanking[0].goals >= 0, true);
  const ale = r.goalRanking.find((x) => x.name === 'Alejandro');
  assert.equal(ale.goals, 3);
});

test('headToHead cuenta duelos entre dos participantes', () => {
  const h = headToHead(MATCHES, 'Alejandro', 'Gerardo');
  assert.equal(h.aWins, 1);
  assert.equal(h.bWins, 0);
});

test('teamHistory da el historial desde la perspectiva del equipo', () => {
  const hist = teamHistory(MATCHES, 'México');
  // México: ganó 3-0 a Sudáfrica (jugado) y tiene un programado vs Corea
  const jugado = hist.find((x) => x.played);
  assert.equal(jugado.opp, 'Sudáfrica');
  assert.deepEqual([jugado.gf, jugado.ga, jugado.res], [3, 0, 'G']);
  assert.ok(hist.some((x) => !x.played && x.opp === 'República de Corea'));
});

test('teamRecord toma el récord del equipo de la tabla', () => {
  const rec = teamRecord(MATCHES, 'México');
  assert.equal(rec.pj, 1);
  assert.equal(rec.g, 1);
  assert.equal(rec.pts, 3);
});
