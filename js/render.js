/**
 * render.js — Renderizadores de cada pestaña.
 *
 * Cada función recibe un `state`:
 *   { matches, standings, error, fromCache, configMissing, loading }
 * y pinta su contenido. La estructura (equipos, grupos, apuestas) se muestra
 * SIEMPRE; los datos en vivo solo la enriquecen.
 */
import { P, RANK, GROUPS, getOwner, hexAlpha, normName } from './data.js';
import {
  buildStandings, computeJornadas, jornadaRanking, jornadaLoser,
  totalsByParticipant, findDuels, getMatchScore, groupStageMatches,
  groupLetter, isLive, isFinished, knockoutByStage, participantStats,
  computeRecords, headToHead, nextMatch, duelOutcome, teamHistory,
} from './scoring.js';
import { $, escapeHtml, fmtTime, fmtDayLong } from './ui.js';

const MAX_J_PTS = 24;   // 8 equipos × 3 pts por jornada
const MAX_TOTAL = 72;   // × 3 jornadas

/* ── Helpers de presentación ── */
function ownerChip(name) {
  const c = P[name].color;
  return `<span class="owner-chip" style="background:${hexAlpha(c, 0.14)};color:${c}">${escapeHtml(name)}</span>`;
}

/** <img> del escudo del equipo (vacío si aún no llega de la API). */
function crestImg(name, crests, cls = '') {
  const c = crests?.[name]?.crest;
  if (!c) return '';
  return `<img class="crest ${cls}" src="${escapeHtml(c)}" alt="" loading="lazy" onerror="this.style.display='none'">`;
}

/** Nombre del equipo con su escudo al lado. */
function teamName(name, crests, cls = '') {
  return `<span class="team-name">${crestImg(name, crests, cls)}<span>${escapeHtml(name)}</span></span>`;
}

function matchBadge(m) {
  if (isLive(m)) return `<span class="live-badge">${m.minute ? `${m.minute}'` : 'En vivo'}</span>`;
  if (isFinished(m)) return '<span class="fin-badge">FIN</span>';
  return `<span class="sched-badge">${fmtTime(m.utcDate)}</span>`;
}

function scoreHTML(m) {
  const sc = getMatchScore(m);
  if (!sc) return '<span class="score-nil">vs</span>';
  return `<div class="score-box"><span>${sc.h}</span><span class="score-sep">-</span><span>${sc.a}</span></div>`;
}

function configBox() {
  return `<div class="empty-box">
    <h3>⚙️ Falta configurar el origen de datos</h3>
    <p>Para ver partidos en vivo, define el proxy (<code>proxyBase</code>) en
    <code>js/config.js</code> o tu API key en <code>js/config.local.js</code>.</p>
    <p>Guía paso a paso en <code>worker/README.md</code>.</p>
  </div>`;
}

/* ══════════ LEYENDA ══════════ */
export function renderLegend() {
  const el = $('#legend-row');
  if (!el) return;
  el.innerHTML = Object.entries(P).map(([name, d]) => {
    const pip = `<span style="width:8px;height:8px;border-radius:50%;background:${d.color};flex-shrink:0;display:inline-block"></span>`;
    return `<span class="leg-item">${pip}<span>${escapeHtml(name)}</span></span>`;
  }).join('');
}

/* ══════════ EQUIPOS ══════════ */
export function renderEquipos(state) {
  const el = $('#equipos');
  if (!el) return;
  const matches = state.matches || [];
  const crests = state.crests || {};

  let html = '<h2 class="sec-eye">Equipos por participante</h2><div class="players-grid">';
  for (const [name, d] of Object.entries(P)) {
    const sorted = [...d.teams].sort((a, b) => (RANK[a] || 99) - (RANK[b] || 99));
    const isMe = state.me === name;
    html += `<article class="p-card${isMe ? ' is-me' : ''}">
      <header class="p-card-header">
        <div class="p-avatar" style="background:${d.color}">${escapeHtml(name[0])}</div>
        <div><div class="p-name">${escapeHtml(name)}</div><div class="p-sub">8 selecciones</div></div>
        ${isMe ? '<span class="is-me-badge">Tú</span>' : ''}
      </header>
      <div class="p-teams-list">
        ${sorted.map((t) => {
          let badge = '';
          const live = matches.find((m) => isLive(m) &&
            (normName(m.homeTeam?.name) === t || normName(m.awayTeam?.name) === t));
          if (live) {
            const sc = getMatchScore(live);
            badge = sc ? `<span class="live-badge">${sc.h}-${sc.a}</span>` : '<span class="live-badge">●</span>';
          }
          return `<div class="p-team-row" style="border-left:3px solid ${d.color}">
            <span style="display:flex;align-items:center;gap:6px">${teamName(t, crests)}${badge}</span>
            <span class="p-rank-badge">#${RANK[t] || '—'}</span>
          </div>`;
        }).join('')}
      </div>
    </article>`;
  }
  el.innerHTML = html + '</div>';
}

/* ══════════ GRUPOS / POSICIONES ══════════ */
function groupTableHTML(letter, rows, crests = {}) {
  let html = `<section class="standings-group">
    <h3 class="standings-group-title">Grupo ${letter}</h3>
    <table class="standings-table">
      <colgroup><col style="width:auto">
        <col style="width:24px"><col style="width:22px"><col style="width:22px"><col style="width:22px">
        <col style="width:26px"><col style="width:26px"><col style="width:30px"><col style="width:30px"></colgroup>
      <thead><tr>
        <th class="col-team">Equipo</th>
        <th title="Partidos jugados">PJ</th><th title="Ganados">G</th><th title="Empatados">E</th>
        <th title="Perdidos">P</th><th title="Goles a favor">GF</th><th title="Goles en contra">GC</th>
        <th title="Diferencia de goles">DG</th><th class="col-pts" title="Puntos">Pts</th>
      </tr></thead><tbody>`;

  rows.forEach((row, i) => {
    const owner = getOwner(row.name);
    const c = owner ? P[owner].color : '#8DA0B8';
    const advancing = i < 2 && row.pj > 0;
    const chip = owner ? `<span class="st-chip" style="background:${hexAlpha(c, 0.14)};color:${c}">${escapeHtml(owner)}</span>` : '';
    const dg = row.dg;
    const dgStr = dg > 0 ? `+${dg}` : `${dg}`;
    const dgColor = dg > 0 ? 'var(--live)' : dg < 0 ? 'var(--danger)' : 'var(--text3)';
    html += `<tr${advancing ? ' class="advancing"' : ''}>
      <td class="col-team" style="border-left:3px solid ${advancing ? 'var(--live)' : (owner ? c : 'transparent')};padding-left:8px">
        <span style="display:flex;align-items:center;gap:6px">
          <span class="st-pos">${i + 1}</span>
          ${crestImg(row.name, crests)}
          <span style="min-width:0"><span class="st-name">${escapeHtml(row.name)}</span>${chip}</span>
        </span>
      </td>
      <td>${row.pj}</td><td>${row.g}</td><td>${row.e}</td><td>${row.p}</td>
      <td>${row.gf}</td><td>${row.gc}</td>
      <td style="color:${dgColor};font-weight:700">${dgStr}</td>
      <td class="st-pts">${row.pts}</td>
    </tr>`;
  });
  return html + '</tbody></table></section>';
}

export function renderGrupos(state) {
  const el = $('#grupos');
  if (!el) return;
  const standings = buildStandings(state.matches || []);
  const anyPlayed = Object.values(standings).some((rows) => rows.some((r) => r.pj > 0));
  const title = anyPlayed ? 'Posiciones en vivo · fase de grupos' : '12 grupos · fase de grupos';

  let html = `<h2 class="sec-eye">${title}</h2>`;
  if (!anyPlayed && state.error && !state.fromCache) {
    html += `<div class="error-box">⚠️ ${escapeHtml(state.error)}</div>`;
  }
  html += '<div class="standings-grid">';
  const crests = state.crests || {};
  for (const letter of Object.keys(GROUPS)) html += groupTableHTML(letter, standings[letter], crests);
  el.innerHTML = html + '</div>';
}

/* ══════════ TABLA (Apuesta 02: puntos por jornada) ══════════ */
export function renderTabla(state) {
  const el = $('#tabla');
  if (!el) return;
  const { pts, played } = computeJornadas(state.matches || []);

  let html = `<h2 class="sec-eye">Apuesta 02 · puntos por jornada</h2>
    <div class="cal-notice" style="margin-bottom:1.25rem">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      Victoria = 3 pts · Empate = 1 pt · Derrota = 0 pts · El de menos puntos por jornada paga $50
    </div>`;

  for (const j of [1, 2, 3]) {
    const ranking = jornadaRanking(pts, played, j);
    const loser = jornadaLoser(pts, played, j);
    const jPlayed = Boolean(loser);
    const maxPts = ranking[0]?.pts || 0;
    const minPts = ranking[ranking.length - 1]?.pts ?? 0;

    let tag;
    if (!jPlayed) tag = `<span class="mini-tag" style="background:var(--bg3);color:var(--text3)">Sin partidos aún</span>`;
    else if (loser.finished) tag = `<span class="mini-tag pays">💸 Paga $50: ${loser.losers.map(escapeHtml).join(' y ')}</span>`;
    else tag = `<span class="mini-tag" style="background:var(--gold-dim);color:var(--gold)">⏳ En curso</span>`;

    html += `<div style="margin-bottom:1.5rem">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:800;letter-spacing:0.06em;color:var(--text);text-transform:uppercase">Jornada ${j}</div>
        ${tag}
      </div>
      <div class="rank-card">
        ${ranking.map((r, i) => {
          const c = P[r.name].color;
          const isLeader = jPlayed && r.pts === maxPts && maxPts > 0;
          const isLoser = jPlayed && r.pts === minPts;
          const barPct = Math.round((r.pts / MAX_J_PTS) * 100);
          return `<div class="rank-row">
            ${jPlayed ? `<span class="rank-bar" style="width:${barPct}%;background:${hexAlpha(c, 0.08)}"></span>` : ''}
            <span class="rank-pos">${i + 1}</span>
            <div style="flex:1;position:relative;z-index:1">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span style="width:28px;height:28px;border-radius:8px;background:${c};display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;color:rgba(255,255,255,0.95);flex-shrink:0">${escapeHtml(r.name[0])}</span>
                <span style="font-size:13px;font-weight:600;color:var(--text)">${escapeHtml(r.name)}</span>
                ${isLeader && !isLoser ? '<span class="mini-tag leader">↑ Líder</span>' : ''}
                ${isLoser ? '<span class="mini-tag pays">💸 Paga</span>' : ''}
              </div>
              <div style="font-size:10px;color:var(--text3);margin-top:2px">${r.played} partido${r.played !== 1 ? 's' : ''} jugado${r.played !== 1 ? 's' : ''}</div>
            </div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:800;color:${jPlayed ? c : 'var(--text3)'};position:relative;z-index:1;min-width:32px;text-align:right">${jPlayed ? r.pts : '—'}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  // Acumulado total
  const totals = totalsByParticipant(pts, played);
  const anyTotal = totals.some((t) => t.played > 0);
  html += `<div style="margin-bottom:1.5rem">
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:800;letter-spacing:0.06em;color:var(--text);text-transform:uppercase;margin-bottom:10px">Acumulado total</div>
    <div class="rank-card">
      ${totals.map((r, i) => {
        const c = P[r.name].color;
        const barPct = Math.round((r.total / MAX_TOTAL) * 100);
        return `<div class="rank-row">
          ${anyTotal ? `<span class="rank-bar" style="width:${barPct}%;background:${hexAlpha(c, 0.08)}"></span>` : ''}
          <span class="rank-pos">${i + 1}</span>
          <div style="flex:1;position:relative;z-index:1">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="width:28px;height:28px;border-radius:8px;background:${c};display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;color:rgba(255,255,255,0.95);flex-shrink:0">${escapeHtml(r.name[0])}</span>
              <span style="font-size:13px;font-weight:600;color:var(--text)">${escapeHtml(r.name)}</span>
            </div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">${r.played} partidos jugados</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;position:relative;z-index:1">
            ${[['J1', r.j1], ['J2', r.j2], ['J3', r.j3]].map(([lbl, v]) => `<div style="text-align:center"><div style="font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--text3)">${lbl}</div><div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;color:var(--text2)">${v}</div></div>`).join('')}
            <div style="text-align:center;margin-left:4px;padding-left:10px;border-left:1px solid var(--line2)">
              <div style="font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--text3)">Total</div>
              <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:800;color:${anyTotal ? c : 'var(--text3)'}">${anyTotal ? r.total : '—'}</div>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;

  el.innerHTML = html;
}

/* ══════════ CALENDARIO ══════════ */
function skeletonCalendario() {
  return Array.from({ length: 6 }, () => '<div class="skel-card skeleton"></div>').join('');
}

export function renderCalendario(state) {
  const el = $('#calendario');
  if (!el) return;
  const matches = groupStageMatches(state.matches || []);

  if (matches.length === 0) {
    if (state.loading) {
      el.innerHTML = `<h2 class="sec-eye">Fase de grupos</h2>
        <div class="cal-notice">Cargando datos en vivo…</div>${skeletonCalendario()}`;
    } else if (state.configMissing) {
      el.innerHTML = `<h2 class="sec-eye">Fase de grupos</h2>${configBox()}`;
    } else {
      el.innerHTML = `<h2 class="sec-eye">Fase de grupos</h2>
        <div class="empty-box">${state.error ? `⚠️ ${escapeHtml(state.error)}<br>` : ''}Aún no hay partidos disponibles desde la API.</div>`;
    }
    return;
  }

  const crests = state.crests || {};
  const byDay = {};
  for (const m of matches) {
    const day = fmtDayLong(m.utcDate);
    (byDay[day] ||= []).push(m);
  }

  let html = `<h2 class="sec-eye">Fase de grupos · datos en vivo</h2>
    <div class="cal-notice">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      Borde dorado = duelo directo · verde = en vivo
    </div>`;

  for (const [day, dayMatches] of Object.entries(byDay)) {
    html += `<div class="day-block"><div class="day-label">${escapeHtml(day)}</div>`;
    for (const m of dayMatches) {
      const hName = normName(m.homeTeam?.name || '');
      const aName = normName(m.awayTeam?.name || '');
      const ph = getOwner(hName), pa = getOwner(aName);
      const isDuel = ph && pa && ph !== pa;
      const live = isLive(m);
      const leftColor = ph ? P[ph].color : (live ? 'var(--live)' : 'transparent');
      const cls = live ? 'match-card live-card' : (isDuel ? 'match-card duel' : 'match-card');
      html += `<div class="${cls}" style="border-left:3px solid ${leftColor}">
        <div class="m-team-col"><div class="m-team-name">${teamName(hName || m.homeTeam?.name || '?', crests)}</div>${ph ? ownerChip(ph) : ''}</div>
        <div class="m-center-col">
          ${scoreHTML(m)}${matchBadge(m)}
          <div class="m-meta-row"><span class="m-group-tag">G${groupLetter(m)}</span>${isDuel ? '<span class="m-duel-tag">⚡ Duelo</span>' : ''}</div>
        </div>
        <div class="m-team-col right"><div class="m-team-name">${teamName(aName || m.awayTeam?.name || '?', crests)}</div>${pa ? ownerChip(pa) : ''}</div>
      </div>`;
    }
    html += '</div>';
  }
  el.innerHTML = html;
}

/* ══════════ APUESTAS ══════════ */
export function renderApuestas(state) {
  const el = $('#apuestas');
  if (!el) return;
  const duels = findDuels(state.matches || []);
  const dc = duels.length;
  const crests = state.crests || {};

  const countEl = $('#duel-count');
  if (countEl) countEl.textContent = dc || '—';

  const cards = `<div class="bet-grid">
    <article class="bet-card">
      <div class="bet-num">Opción 01</div><h3 class="bet-title">Apuesta por partido directo</h3>
      <p class="bet-body">Cuando dos equipos de distintos participantes se enfrentan, ambos ponen $20. El ganador se lleva $40. En empate se devuelve o acumula al bote.</p>
      <div class="bet-chips"><span class="chip">$20 por partido</span><span class="chip">${dc || '?'} duelos en grupos</span></div>
    </article>
    <article class="bet-card">
      <div class="bet-num">Opción 02</div><h3 class="bet-title">Puntos por jornada</h3>
      <p class="bet-body">Victoria = 3 pts, empate = 1, derrota = 0. Al final de cada jornada, el participante con menos puntos paga $50 a un bote extra.</p>
      <div class="bet-chips"><span class="chip">$50 por jornada</span><span class="chip">3 jornadas</span></div>
    </article>
    <article class="bet-card rec">
      <div class="bet-num">Opción 03 — Recomendada</div><h3 class="bet-title">Combinada</h3>
      <p class="bet-body">$200 por el campeón más $10–$20 en cada duelo directo. Emoción en cada partido y también al final.</p>
      <div class="bet-chips"><span class="chip">Máxima emoción</span><span class="chip">Todos los partidos cuentan</span></div>
    </article>
  </div>`;

  const duelsHTML = dc === 0
    ? `<div class="empty-box">Los duelos directos aparecerán aquí cuando se cargue el calendario desde la API.</div>`
    : duels.map((d) => {
        const sc = d.score;
        const scHTML = sc ? `<span style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;color:var(--text)">${sc.h} - ${sc.a}</span>` : '';
        const badge = (d.status === 'IN_PLAY' || d.status === 'PAUSED') ? '<span class="live-badge">En vivo</span>'
          : d.status === 'FINISHED' ? '<span class="fin-badge">FIN</span>' : '';
        return `<div class="duel-row" style="border-left:3px solid ${P[d.ownerHome].color}">
          <div class="duel-date">${escapeHtml(fmtDayLong(d.utcDate))}</div>
          <div class="duel-vs">
            <div class="duel-team">${teamName(d.home, crests)}${ownerChip(d.ownerHome)}</div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:3px">${scHTML}${badge}<span class="duel-slash">vs</span></div>
            <div class="duel-team">${teamName(d.away, crests)}${ownerChip(d.ownerAway)}</div>
          </div>
          <div class="duel-group">G${d.group}</div>
        </div>`;
      }).join('');

  el.innerHTML = `<h2 class="sec-eye">Opciones de apuesta</h2>${cards}
    <h2 class="sec-eye" style="margin-top:1rem">Los ${dc || '?'} duelos directos · fase de grupos</h2>
    <div>${duelsHTML}</div>`;
}

/* ══════════ BARRA "PRÓXIMO PARTIDO" ══════════ */
export function renderNextBar(state) {
  const el = $('#next-bar');
  if (!el) return;
  const m = nextMatch(state.matches || [], new Date());
  if (!m) { el.style.display = 'none'; return; }
  el.style.display = '';
  const crests = state.crests || {};
  const h = normName(m.homeTeam?.name || '') || m.homeTeam?.name || '?';
  const a = normName(m.awayTeam?.name || '') || m.awayTeam?.name || '?';
  el.innerHTML = `<span class="next-label">⏱ Próximo</span>
    <span class="next-teams">${teamName(h, crests)} <span style="color:var(--text3)">vs</span> ${teamName(a, crests)}</span>
    <span class="countdown" data-target="${escapeHtml(m.utcDate)}"></span>`;
}

/* ══════════ MI PANEL (modo "Yo") ══════════ */
export function renderMiPanel(state) {
  const el = $('#yo');
  if (!el) return;
  const me = state.me;
  const crests = state.crests || {};

  if (!me) {
    el.innerHTML = `<div class="empty-box">
      <h3>¿Quién eres?</h3>
      <p>Elige tu nombre en el selector <strong>"Yo soy…"</strong> de arriba para ver tu panel:
      tus selecciones, tu próximo partido y el marcador de tus duelos.</p>
    </div>`;
    return;
  }

  const d = P[me];
  const matches = state.matches || [];
  const stats = participantStats(matches, me, new Date());
  const standings = buildStandings(matches);
  const rowMap = {};
  for (const [letter, rows] of Object.entries(standings)) {
    rows.forEach((r, i) => { rowMap[r.name] = { ...r, pos: i + 1, letter }; });
  }
  const teams = [...d.teams].sort((a, b) => (RANK[a] || 99) - (RANK[b] || 99));

  const resTag = (res) => {
    const map = { G: 'w', E: 'd', P: 'l' };
    return `<span class="res-dot ${map[res] || ''}">${res}</span>`;
  };
  const teamHistoryHTML = (t) => {
    const hist = teamHistory(matches, t);
    if (!hist.length) return '<div class="mt-hist empty">Sin partidos programados</div>';
    return `<div class="mt-hist">${hist.map((x) => {
      const intra = getOwner(x.opp) === me; // rival también es tuyo → partido interno
      const opp = `vs ${escapeHtml(x.opp)}${intra ? '<span class="intra-tag" title="Tus dos equipos se enfrentan">interno</span>' : ''}`;
      if (!x.played) {
        return `<div class="mt-game pend"><span>${opp}</span><span class="mt-when">${escapeHtml(fmtDayLong(x.utcDate))}</span></div>`;
      }
      return `<div class="mt-game"><span>${opp}</span><span><strong>${x.gf}-${x.ga}</strong> ${resTag(x.res)}</span></div>`;
    }).join('')}</div>`;
  };

  // Próximo partido del participante
  let nextHTML = '';
  if (stats.next) {
    const nm = stats.next;
    const nh = normName(nm.homeTeam?.name || '');
    const na = normName(nm.awayTeam?.name || '');
    nextHTML = `<div class="sec-eye">Tu próximo partido</div>
      <div class="next-bar" style="margin-bottom:1.5rem">
        <span class="next-teams">${teamName(nh, crests)} <span style="color:var(--text3)">vs</span> ${teamName(na, crests)}</span>
        <span class="countdown" data-target="${escapeHtml(nm.utcDate)}"></span>
      </div>`;
  }

  const duelPill = (o, name) => {
    if (o === null) return '<span class="duel-pill p">Pendiente</span>';
    if (o === 'draw') return '<span class="duel-pill d">Empate</span>';
    return o === name ? '<span class="duel-pill w">Ganado</span>' : '<span class="duel-pill l">Perdido</span>';
  };

  el.innerHTML = `
    <div class="mine-hero" style="background:linear-gradient(135deg, ${d.color}, ${hexAlpha(d.color, 0.7)})">
      <div class="m-avatar">${escapeHtml(me[0])}</div>
      <div>
        <div class="m-name">${escapeHtml(me)}</div>
        <div class="m-meta">Lugar ${stats.rank} de ${Object.keys(P).length} · ${stats.played} partidos jugados</div>
      </div>
      <div class="mine-stats">
        <div><div class="v">${stats.total}</div><div class="l">Puntos</div></div>
        <div title="Duelos directos ganados · empatados · perdidos"><div class="v">${stats.duels.won}G · ${stats.duels.draw}E · ${stats.duels.lost}P</div><div class="l">Duelos G · E · P</div></div>
        <div><div class="v">${stats.duels.pending}</div><div class="l">Duelos pendientes</div></div>
      </div>
    </div>
    ${nextHTML}
    <div class="sec-eye">Tus 8 selecciones · récord e historial</div>
    <div class="mine-teams">
      ${teams.map((t) => {
        const r = rowMap[t] || { pj: 0, g: 0, e: 0, p: 0, pts: 0, pos: '?', letter: '?' };
        const posTxt = r.pj > 0 ? `G${r.letter} · ${r.pos}.º` : `G${r.letter}`;
        return `<div class="mine-team-card">
          <div class="mt-head">${teamName(t, crests, 'lg')}<span class="pos">${posTxt}</span></div>
          <div class="mt-rec">${r.pj} PJ · ${r.g}G ${r.e}E ${r.p}P · <strong>${r.pts} pts</strong></div>
          ${teamHistoryHTML(t)}
        </div>`;
      }).join('')}
    </div>
    <div class="sec-eye">Tus duelos directos</div>
    <div>
      ${stats.duels.list.length === 0
        ? '<div class="empty-box">Aún no hay duelos en el calendario.</div>'
        : stats.duels.list.map((du) => {
            const rival = du.ownerHome === me ? du.ownerAway : du.ownerHome;
            const sc = du.score;
            return `<div class="duel-row" style="border-left:3px solid ${P[me].color}">
              <div class="duel-date">${escapeHtml(fmtDayLong(du.utcDate))}</div>
              <div class="duel-vs">
                <div class="duel-team">${teamName(du.home, crests)}${ownerChip(du.ownerHome)}</div>
                <div style="display:flex;align-items:center;gap:6px">${sc ? `<strong>${sc.h}-${sc.a}</strong>` : '<span class="duel-slash">vs</span>'}</div>
                <div class="duel-team">${teamName(du.away, crests)}${ownerChip(du.ownerAway)}</div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px">
                ${duelPill(duelOutcome(du), me)}
                <span style="font-size:10px;color:var(--text3)">vs ${escapeHtml(rival)}</span>
              </div>
            </div>`;
          }).join('')}
    </div>`;
}

/* ══════════ ELIMINATORIAS (bracket) ══════════ */
export function renderEliminatorias(state) {
  const el = $('#eliminatorias');
  if (!el) return;
  const crests = state.crests || {};
  const stages = knockoutByStage(state.matches || []);

  if (!stages.length) {
    el.innerHTML = `<h2 class="sec-eye">Eliminatorias</h2>
      <div class="empty-box">El cuadro aparecerá cuando la API lo publique.</div>`;
    return;
  }

  const koTeam = (raw, score) => {
    const name = raw ? normName(raw) : null;
    if (!name) return '<div class="ko-team tbd"><span>Por definir</span></div>';
    const owner = getOwner(name);
    return `<div class="ko-team">${teamName(name, crests)}${owner ? ownerChip(owner) : ''}<span class="ko-score">${score != null ? score : ''}</span></div>`;
  };

  let html = '<h2 class="sec-eye">Eliminatorias · cuadro</h2><div class="ko-board">';
  for (const s of stages) {
    html += `<div class="ko-stage"><div class="ko-stage-title">${escapeHtml(s.label)}</div><div class="ko-stage-body">`;
    for (const m of s.matches) {
      const dispH = m.homeTeam?.name ? normName(m.homeTeam.name) : null;
      const dispA = m.awayTeam?.name ? normName(m.awayTeam.name) : null;
      const ph = dispH ? getOwner(dispH) : null;
      const pa = dispA ? getOwner(dispA) : null;
      const isDuel = ph && pa && ph !== pa;
      const sc = getMatchScore(m);
      html += `<div class="ko-match${isDuel ? ' duel' : ''}">
        ${koTeam(m.homeTeam?.name, sc ? sc.h : null)}
        ${koTeam(m.awayTeam?.name, sc ? sc.a : null)}
        <div class="ko-date">${escapeHtml(fmtDayLong(m.utcDate))}</div>
      </div>`;
    }
    html += '</div></div>';
  }
  el.innerHTML = html + '</div>';
}

/* ══════════ RÉCORDS + CARA A CARA ══════════ */
function recordCard(label, mainHTML, sub) {
  return `<div class="record-card"><div class="r-label">${escapeHtml(label)}</div>
    <div class="r-main">${mainHTML}</div>${sub ? `<div class="r-sub">${escapeHtml(sub)}</div>` : ''}</div>`;
}

function h2hResultHTML(state, a, b) {
  if (a === b) return '<div class="empty-box">Elige dos participantes distintos.</div>';
  const h = headToHead(state.matches || [], a, b);
  const ca = P[a].color, cb = P[b].color;
  return `<div class="h2h-result">
      <div class="h2h-side"><div class="n" style="color:${ca}">${escapeHtml(a)}</div><div class="w" style="color:${ca}">${h.aWins}</div></div>
      <div class="h2h-vs">—</div>
      <div class="h2h-side"><div class="n" style="color:${cb}">${escapeHtml(b)}</div><div class="w" style="color:${cb}">${h.bWins}</div></div>
    </div>
    <div style="text-align:center;font-size:11px;color:var(--text3);margin-top:8px">
      ${h.duels.length} duelo(s) · ${h.draws} empate(s) · ${h.pending} pendiente(s)
    </div>`;
}

export function renderRecords(state) {
  const el = $('#records');
  if (!el) return;
  const crests = state.crests || {};
  const r = computeRecords(state.matches || []);

  const teamSc = (m, sc) =>
    `${teamName(normName(m.homeTeam?.name || ''), crests)} <strong>${sc.h}-${sc.a}</strong> ${teamName(normName(m.awayTeam?.name || ''), crests)}`;

  let cards = '';
  if (r.biggest) cards += recordCard('Mayor goleada', teamSc(r.biggest.m, r.biggest.sc), `Diferencia de ${r.biggest.margin} gol(es)`);
  if (r.mostGoals) cards += recordCard('Partido con más goles', teamSc(r.mostGoals.m, r.mostGoals.sc), `${r.mostGoals.total} goles en total`);
  const top = r.goalRanking[0];
  if (top) cards += recordCard('Participante más goleador', `<span style="color:${P[top.name].color}">${escapeHtml(top.name)}</span>`, `${top.goals} goles de sus selecciones`);

  if (!cards) cards = '<div class="empty-box">Los récords aparecerán cuando se jueguen partidos.</div>';

  // Conserva la selección previa de cara a cara entre re-renders
  const names = Object.keys(P);
  const prevA = $('#h2h-a')?.value;
  const prevB = $('#h2h-b')?.value;
  const aSel = prevA || state.me || names[0];
  const bSel = prevB || (names.find((n) => n !== aSel));
  const options = (sel) => names.map((n) => `<option value="${n}"${n === sel ? ' selected' : ''}>${n}</option>`).join('');

  el.innerHTML = `<h2 class="sec-eye">Récords del torneo</h2>
    <div class="records-grid">${cards}</div>
    <h2 class="sec-eye">Cara a cara</h2>
    <div class="h2h-controls">
      <select class="me-select" id="h2h-a" aria-label="Participante A">${options(aSel)}</select>
      <span class="h2h-vs">vs</span>
      <select class="me-select" id="h2h-b" aria-label="Participante B">${options(bSel)}</select>
    </div>
    <div id="h2h-out">${h2hResultHTML(state, aSel, bSel)}</div>`;

  const a = $('#h2h-a'), b = $('#h2h-b'), out = $('#h2h-out');
  const update = () => { out.innerHTML = h2hResultHTML(state, a.value, b.value); };
  a?.addEventListener('change', update);
  b?.addEventListener('change', update);
}

/* ══════════ ORQUESTADOR ══════════ */
export function renderAll(state) {
  renderNextBar(state);
  renderMiPanel(state);
  renderEquipos(state);
  renderGrupos(state);
  renderTabla(state);
  renderEliminatorias(state);
  renderCalendario(state);
  renderApuestas(state);
  renderRecords(state);
}
