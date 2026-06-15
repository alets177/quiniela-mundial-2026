/**
 * scoring.js — Lógica pura del torneo y de las apuestas.
 *
 * Sin DOM ni red: recibe el arreglo `matches` de la API y devuelve
 * estructuras de datos. Esto permite probarlo con `node --test`.
 */
import { GROUPS, P, normName, getOwner } from './data.js';

/** Mapa equipo (español) → letra de grupo. */
export const TEAM_GROUP = (() => {
  const map = {};
  for (const [letter, teams] of Object.entries(GROUPS)) {
    for (const t of teams) map[t] = letter;
  }
  return map;
})();

/* ── Estado de un partido ── */
export const isLive = (m) => m?.status === 'IN_PLAY' || m?.status === 'PAUSED';
export const isFinished = (m) => m?.status === 'FINISHED';
export const isScheduled = (m) => m?.status === 'SCHEDULED' || m?.status === 'TIMED';

/** Marcador {h,a} o null si el partido no ha empezado / no hay datos. */
export function getMatchScore(m) {
  if (!m || isScheduled(m)) return null;
  const s = m.score?.fullTime;
  if (s == null || s.home == null) return null;
  return { h: s.home, a: s.away };
}

/** Letra de grupo de un partido (vía campo group o vía los equipos). */
export function groupLetter(m) {
  if (m?.group) return String(m.group).replace('GROUP_', '');
  return TEAM_GROUP[normName(m?.homeTeam?.name)] || TEAM_GROUP[normName(m?.awayTeam?.name)] || '?';
}

/**
 * Partidos de fase de grupos. Usa el campo `stage` cuando está; si no,
 * cae a "ambos equipos pertenecen a nuestros grupos" para no quedarse vacío.
 */
export function groupStageMatches(matches) {
  const all = matches || [];
  const tagged = all.filter((m) => m.stage === 'GROUP_STAGE');
  if (tagged.length) return tagged;
  return all.filter(
    (m) => TEAM_GROUP[normName(m.homeTeam?.name)] && TEAM_GROUP[normName(m.awayTeam?.name)]
  );
}

export const countLive = (matches) => (matches || []).filter(isLive).length;

/* ──────────────────────────────────────────────
   TABLA DE POSICIONES (reconstruida desde resultados)
   Desempates: Pts → Diferencia de goles → Goles a favor → nombre.
   (Aproximación; FIFA además usa head-to-head y otros criterios.)
─────────────────────────────────────────────── */
function cmpStanding(a, b) {
  if (b.pts !== a.pts) return b.pts - a.pts;
  if (b.dg !== a.dg) return b.dg - a.dg;
  if (b.gf !== a.gf) return b.gf - a.gf;
  return a.name.localeCompare(b.name);
}

export function buildStandings(matches) {
  const stats = {};
  for (const [letter, teams] of Object.entries(GROUPS)) {
    stats[letter] = {};
    for (const t of teams) {
      stats[letter][t] = { name: t, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 };
    }
  }

  for (const m of groupStageMatches(matches)) {
    const h = normName(m.homeTeam?.name || '');
    const a = normName(m.awayTeam?.name || '');
    const letter = TEAM_GROUP[h] || TEAM_GROUP[a];
    if (!letter || !stats[letter]?.[h] || !stats[letter]?.[a]) continue;

    const sc = getMatchScore(m);
    if (!sc) continue;

    const H = stats[letter][h];
    const A = stats[letter][a];
    H.pj++; A.pj++;
    H.gf += sc.h; H.gc += sc.a;
    A.gf += sc.a; A.gc += sc.h;

    if (sc.h > sc.a) { H.g++; H.pts += 3; A.p++; }
    else if (sc.h < sc.a) { A.g++; A.pts += 3; H.p++; }
    else { H.e++; H.pts++; A.e++; A.pts++; }
  }

  const out = {};
  for (const [letter, teamsObj] of Object.entries(stats)) {
    out[letter] = Object.values(teamsObj)
      .map((r) => ({ ...r, dg: r.gf - r.gc }))
      .sort(cmpStanding);
  }
  return out;
}

/* ──────────────────────────────────────────────
   JORNADAS (matchday 1, 2, 3)
   Prefiere el campo `matchday` de la API; si falta, lo deduce por fecha.
─────────────────────────────────────────────── */
export function assignMatchdays(matches) {
  const sorted = [...groupStageMatches(matches)].sort(
    (a, b) => new Date(a.utcDate) - new Date(b.utcDate)
  );
  const teamCount = {};
  const map = {};
  for (const m of sorted) {
    const h = normName(m.homeTeam?.name || '');
    const a = normName(m.awayTeam?.name || '');
    teamCount[h] = (teamCount[h] || 0) + 1;
    teamCount[a] = (teamCount[a] || 0) + 1;
    const byDate = teamCount[h];
    const md = Number.isInteger(m.matchday) && m.matchday >= 1 && m.matchday <= 3 ? m.matchday : byDate;
    map[m.id] = md;
  }
  return map;
}

/**
 * Puntos por participante por jornada (Apuesta 02): victoria 3, empate 1, derrota 0.
 * Devuelve { pts: {part:{1,2,3}}, played: {part:{1,2,3}} }.
 */
export function computeJornadas(matches) {
  const mdMap = assignMatchdays(matches);
  const pts = {};
  const played = {};
  for (const name of Object.keys(P)) {
    pts[name] = { 1: 0, 2: 0, 3: 0 };
    played[name] = { 1: 0, 2: 0, 3: 0 };
  }

  for (const m of groupStageMatches(matches)) {
    const sc = getMatchScore(m);
    if (!sc) continue;
    const j = mdMap[m.id];
    if (!j || j < 1 || j > 3) continue;

    const ph = getOwner(m.homeTeam?.name);
    const pa = getOwner(m.awayTeam?.name);
    let hp, ap;
    if (sc.h > sc.a) { hp = 3; ap = 0; }
    else if (sc.h < sc.a) { hp = 0; ap = 3; }
    else { hp = 1; ap = 1; }

    if (ph) { pts[ph][j] += hp; played[ph][j]++; }
    if (pa) { pts[pa][j] += ap; played[pa][j]++; }
  }
  return { pts, played };
}

/** Cada participante posee 8 selecciones, una juega por jornada → 8 partidos/jornada. */
export const MATCHES_PER_JORNADA = 8;

/** Info del "perdedor" de una jornada (menos puntos). null si nadie ha jugado. */
export function jornadaLoser(pts, played, j) {
  const rows = Object.keys(P).map((name) => ({ name, pts: pts[name][j], played: played[name][j] }));
  if (!rows.some((r) => r.played > 0)) return null;
  const minPts = Math.min(...rows.map((r) => r.pts));
  return {
    losers: rows.filter((r) => r.pts === minPts).map((r) => r.name),
    pts: minPts,
    finished: rows.every((r) => r.played === MATCHES_PER_JORNADA),
  };
}

/** Ranking de una jornada (orden desc por puntos). */
export function jornadaRanking(pts, played, j) {
  return Object.keys(P)
    .map((name) => ({ name, pts: pts[name][j], played: played[name][j] }))
    .sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
}

/** Acumulado total por participante. */
export function totalsByParticipant(pts, played) {
  return Object.keys(P)
    .map((name) => ({
      name,
      j1: pts[name][1], j2: pts[name][2], j3: pts[name][3],
      total: pts[name][1] + pts[name][2] + pts[name][3],
      played: played[name][1] + played[name][2] + played[name][3],
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

/* ──────────────────────────────────────────────
   DUELOS DIRECTOS (Apuesta 01): partidos entre dos participantes distintos.
─────────────────────────────────────────────── */
export function findDuels(matches) {
  const duels = [];
  for (const m of groupStageMatches(matches)) {
    const home = normName(m.homeTeam?.name || '');
    const away = normName(m.awayTeam?.name || '');
    const ownerHome = getOwner(home);
    const ownerAway = getOwner(away);
    if (ownerHome && ownerAway && ownerHome !== ownerAway) {
      duels.push({
        home, away, ownerHome, ownerAway,
        group: groupLetter(m),
        status: m.status,
        score: getMatchScore(m),
        utcDate: m.utcDate,
      });
    }
  }
  return duels.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
}

/** Resultado de un duelo: nombre del ganador, 'draw', o null si está pendiente. */
export function duelOutcome(duel) {
  const sc = duel.score;
  if (!sc) return null;
  if (sc.h > sc.a) return duel.ownerHome;
  if (sc.h < sc.a) return duel.ownerAway;
  return 'draw';
}

/* ──────────────────────────────────────────────
   ESCUDOS (crests) — mapa nombre(español) → datos del equipo desde la API
─────────────────────────────────────────────── */
export function extractCrests(matches) {
  const map = {};
  for (const m of matches || []) {
    for (const t of [m.homeTeam, m.awayTeam]) {
      if (!t?.name) continue;
      const n = normName(t.name);
      if (!map[n] && t.crest) map[n] = { crest: t.crest, tla: t.tla, shortName: t.shortName };
    }
  }
  return map;
}

/* ──────────────────────────────────────────────
   ELIMINATORIAS
─────────────────────────────────────────────── */
export const STAGES = [
  ['LAST_32', '16avos de final'],
  ['LAST_16', 'Octavos de final'],
  ['QUARTER_FINALS', 'Cuartos de final'],
  ['SEMI_FINALS', 'Semifinales'],
  ['THIRD_PLACE', 'Tercer lugar'],
  ['FINAL', 'Final'],
];

export function knockoutByStage(matches) {
  const all = matches || [];
  return STAGES
    .map(([stage, label]) => ({
      stage,
      label,
      matches: all.filter((m) => m.stage === stage).sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate)),
    }))
    .filter((s) => s.matches.length > 0);
}

/* ──────────────────────────────────────────────
   PRÓXIMO PARTIDO (opcionalmente filtrado a un conjunto de equipos)
─────────────────────────────────────────────── */
export function nextMatch(matches, now = new Date(), teams = null) {
  const t = now instanceof Date ? now : new Date(now);
  const set = teams ? new Set(teams) : null;
  return (matches || [])
    .filter((m) => (m.status === 'SCHEDULED' || m.status === 'TIMED') && new Date(m.utcDate) > t)
    .filter((m) => !set || set.has(normName(m.homeTeam?.name)) || set.has(normName(m.awayTeam?.name)))
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))[0] || null;
}

/**
 * Historial de partidos de una selección (fase de grupos), desde su perspectiva.
 * Devuelve [{ opp, gf, ga, res:'G'|'E'|'P'|null, status, utcDate, played }].
 */
export function teamHistory(matches, name) {
  const out = [];
  for (const m of groupStageMatches(matches)) {
    const h = normName(m.homeTeam?.name || '');
    const a = normName(m.awayTeam?.name || '');
    if (h !== name && a !== name) continue;
    const isHome = h === name;
    const opp = isHome ? a : h;
    const sc = getMatchScore(m);
    let gf = null, ga = null, res = null;
    if (sc) {
      gf = isHome ? sc.h : sc.a;
      ga = isHome ? sc.a : sc.h;
      res = gf > ga ? 'G' : gf < ga ? 'P' : 'E';
    }
    out.push({ opp, gf, ga, res, status: m.status, utcDate: m.utcDate, played: Boolean(sc) });
  }
  return out.sort((x, y) => new Date(x.utcDate) - new Date(y.utcDate));
}

/** Récord de una selección (PJ, G, E, P, GF, GC, Pts) tomado de la tabla. */
export function teamRecord(matches, name) {
  const standings = buildStandings(matches);
  for (const rows of Object.values(standings)) {
    const row = rows.find((r) => r.name === name);
    if (row) return row;
  }
  return { name, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0, dg: 0 };
}

/**
 * Récord agregado de las 8 selecciones de un participante.
 * pts === puntos por jornada del participante (3·G + E) → reconcilia con la Apuesta 02.
 */
export function teamsRecord(matches, name) {
  const standings = buildStandings(matches);
  const byName = {};
  for (const rows of Object.values(standings)) for (const r of rows) byName[r.name] = r;
  const acc = { pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 };
  for (const t of P[name].teams) {
    const r = byName[t];
    if (!r) continue;
    acc.pj += r.pj; acc.g += r.g; acc.e += r.e; acc.p += r.p;
    acc.gf += r.gf; acc.gc += r.gc; acc.pts += r.pts;
  }
  return acc;
}

/**
 * TODOS los partidos (fase de grupos) que involucran a un participante,
 * en orden cronológico, distinguiendo duelos (vs otro participante) e internos
 * (sus dos equipos entre sí). Sin duplicar los internos.
 */
export function participantMatches(matches, name) {
  const mine = new Set(P[name].teams);
  const out = [];
  for (const m of groupStageMatches(matches)) {
    const h = normName(m.homeTeam?.name || '');
    const a = normName(m.awayTeam?.name || '');
    const hMine = mine.has(h);
    const aMine = mine.has(a);
    if (!hMine && !aMine) continue;

    const sc = getMatchScore(m);
    const base = { utcDate: m.utcDate, group: groupLetter(m), status: m.status, score: sc };

    if (hMine && aMine) {
      out.push({ ...base, type: 'interno', teamA: h, teamB: a });
    } else {
      const myTeam = hMine ? h : a;
      const opp = hMine ? a : h;
      let myGoals = null, oppGoals = null, result = null;
      if (sc) {
        myGoals = hMine ? sc.h : sc.a;
        oppGoals = hMine ? sc.a : sc.h;
        result = myGoals > oppGoals ? 'G' : myGoals < oppGoals ? 'P' : 'E';
      }
      out.push({ ...base, type: 'duelo', myTeam, opp, oppOwner: getOwner(opp), myGoals, oppGoals, result });
    }
  }
  return out.sort((x, y) => new Date(x.utcDate) - new Date(y.utcDate));
}

/* ──────────────────────────────────────────────
   ESTADÍSTICAS DE UN PARTICIPANTE (modo "Yo")
─────────────────────────────────────────────── */
export function participantStats(matches, name, now = new Date()) {
  const { pts, played } = computeJornadas(matches);
  const totals = totalsByParticipant(pts, played);
  const me = totals.find((t) => t.name === name) || { total: 0, j1: 0, j2: 0, j3: 0, played: 0 };
  const rank = totals.findIndex((t) => t.name === name) + 1;

  const duels = findDuels(matches).filter((d) => d.ownerHome === name || d.ownerAway === name);
  let won = 0, lost = 0, draw = 0, pending = 0;
  for (const d of duels) {
    const o = duelOutcome(d);
    if (o === null) pending++;
    else if (o === 'draw') draw++;
    else if (o === name) won++;
    else lost++;
  }

  return {
    name,
    rank,
    total: me.total,
    j: [me.j1, me.j2, me.j3],
    played: me.played,
    record: teamsRecord(matches, name),
    duels: { won, lost, draw, pending, list: duels },
    next: nextMatch(matches, now, P[name].teams),
  };
}

/* ──────────────────────────────────────────────
   RÉCORDS Y CARA A CARA
─────────────────────────────────────────────── */
export function computeRecords(matches) {
  const gms = groupStageMatches(matches);
  let biggest = null, mostGoals = null;
  const goals = {};
  for (const n of Object.keys(P)) goals[n] = 0;

  for (const m of gms) {
    const sc = getMatchScore(m);
    if (!sc) continue;
    const margin = Math.abs(sc.h - sc.a);
    const total = sc.h + sc.a;
    if (!biggest || margin > biggest.margin) biggest = { margin, sc, m };
    if (!mostGoals || total > mostGoals.total) mostGoals = { total, sc, m };
    const ph = getOwner(m.homeTeam?.name), pa = getOwner(m.awayTeam?.name);
    if (ph) goals[ph] += sc.h;
    if (pa) goals[pa] += sc.a;
  }

  const goalRanking = Object.entries(goals)
    .map(([name, g]) => ({ name, goals: g }))
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));

  return { biggest, mostGoals, goalRanking };
}

export function headToHead(matches, a, b) {
  const duels = findDuels(matches).filter(
    (d) => (d.ownerHome === a && d.ownerAway === b) || (d.ownerHome === b && d.ownerAway === a)
  );
  let aWins = 0, bWins = 0, draws = 0, pending = 0;
  for (const d of duels) {
    const o = duelOutcome(d);
    if (o === null) pending++;
    else if (o === 'draw') draws++;
    else if (o === a) aWins++;
    else bWins++;
  }
  return { a, b, duels, aWins, bWins, draws, pending };
}
