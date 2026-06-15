/**
 * Pruebas de la lógica pura (scoring.js + data.js).
 * Correr con:  npm test   (equivale a: node --test)
 *
 * No requiere instalar nada: usa el runner integrado de Node.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { normName, getOwner } from '../js/data.js';
import {
  buildStandings,
  computeJornadas,
  jornadaLoser,
  totalsByParticipant,
  findDuels,
  getMatchScore,
} from '../js/scoring.js';

/* Fixture mínimo con la forma de football-data.org v4 */
function m(id, group, matchday, home, away, hs, as, status = 'FINISHED') {
  const finished = hs != null && as != null;
  return {
    id,
    stage: 'GROUP_STAGE',
    group,
    matchday,
    utcDate: `2026-06-${10 + matchday}T18:00:00Z`,
    status: finished ? status : 'TIMED',
    homeTeam: { name: home },
    awayTeam: { name: away },
    score: { fullTime: { home: finished ? hs : null, away: finished ? as : null } },
  };
}

const MATCHES = [
  // Grupo A — jornada 1
  m(1, 'GROUP_A', 1, 'Mexico', 'South Africa', 2, 0),          // Alejandro vs Gerardo (duelo)
  m(2, 'GROUP_A', 1, 'Korea Republic', 'Czech Republic', 1, 1), // Anahi vs Alejandro (duelo)
  // Grupo C — jornada 1
  m(3, 'GROUP_C', 1, 'Brazil', 'Scotland', 3, 1),              // Gerardo vs Richard (duelo)
  m(4, 'GROUP_C', 1, 'Morocco', 'Haiti', 2, 2),               // Alejandro vs Alejandro (NO duelo)
  // Jornada 2 aún sin jugar (debe ignorarse en puntos/posiciones)
  m(5, 'GROUP_A', 2, 'Mexico', 'Korea Republic', null, null),
];

test('normName mapea variantes de la API al español', () => {
  assert.equal(normName('Korea Republic'), 'República de Corea');
  assert.equal(normName('Czech Republic'), 'Chequia');
  assert.equal(normName('Brazil'), 'Brasil');
  assert.equal(normName('Sin Mapeo'), 'Sin Mapeo'); // sin cambio si no está
});

test('getOwner identifica al dueño tras normalizar', () => {
  assert.equal(getOwner('Mexico'), 'Alejandro');
  assert.equal(getOwner('Brazil'), 'Gerardo');
  assert.equal(getOwner('Scotland'), 'Richard');
  assert.equal(getOwner('Korea Republic'), 'Anahi');
});

test('getMatchScore ignora partidos no jugados', () => {
  assert.deepEqual(getMatchScore(MATCHES[0]), { h: 2, a: 0 });
  assert.equal(getMatchScore(MATCHES[4]), null);
});

test('buildStandings ordena por Pts → DG → GF', () => {
  const st = buildStandings(MATCHES);
  const a = st.A.map((r) => r.name);
  assert.equal(a[0], 'México');        // 3 pts
  assert.equal(a[3], 'Sudáfrica');     // 0 pts, DG -2
  // Empate Chequia/Corea (1 pt, DG 0, GF 1) → desempate alfabético
  assert.deepEqual(a.slice(1, 3), ['Chequia', 'República de Corea']);
  assert.equal(st.A[0].pts, 3);
  assert.equal(st.A[0].gf, 2);
});

test('computeJornadas suma 3/1/0 por participante', () => {
  const { pts, played } = computeJornadas(MATCHES);
  // Alejandro: México(3) + Chequia(1) + Marruecos(1) + Haití(1) = 6, 4 partidos
  assert.equal(pts.Alejandro[1], 6);
  assert.equal(played.Alejandro[1], 4);
  assert.equal(pts.Gerardo[1], 3);   // Sudáfrica(0) + Brasil(3)
  assert.equal(pts.Anahi[1], 1);
  assert.equal(pts.Richard[1], 0);
  // La jornada 2 no se ha jugado
  assert.equal(pts.Alejandro[2], 0);
});

test('jornadaLoser detecta a los de menos puntos (aún no finalizada)', () => {
  const { pts, played } = computeJornadas(MATCHES);
  const loser = jornadaLoser(pts, played, 1);
  assert.equal(loser.pts, 0);
  assert.deepEqual(loser.losers.sort(), ['Javier', 'Mariel', 'Richard']);
  assert.equal(loser.finished, false); // nadie llegó a 8 partidos
});

test('totalsByParticipant acumula y ordena', () => {
  const { pts, played } = computeJornadas(MATCHES);
  const totals = totalsByParticipant(pts, played);
  assert.equal(totals[0].name, 'Alejandro');
  assert.equal(totals[0].total, 6);
});

test('findDuels cuenta partidos entre participantes distintos (incluye futuros)', () => {
  const duels = findDuels(MATCHES);
  // México-Sudáfrica, Corea-Chequia, Brasil-Escocia, y el programado México-Corea.
  // Marruecos-Haití (mismo dueño) NO cuenta.
  assert.equal(duels.length, 4);
  const pares = duels.map((d) => [d.ownerHome, d.ownerAway]);
  assert.ok(pares.every(([a, b]) => a !== b));
  // El duelo programado no tiene marcador todavía
  const programado = duels.find((d) => d.home === 'México' && d.away === 'República de Corea');
  assert.equal(programado.score, null);
});
