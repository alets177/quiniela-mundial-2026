# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Single-page "quiniela" (betting pool) tracker for the FIFA World Cup 2026, in Spanish.
Six participants each own 8 national teams; the app pulls live data and shows teams,
groups/standings, per-matchday scoring, schedule, knockout bracket, bets and records
across eight tabs — plus a personal "Yo" panel and a "Yo soy…" participant selector
(persisted) that highlights your teams. Team crests/flags come from the API.

Static site: HTML + CSS + vanilla JS using **ES modules, no build step**. Deploys
as-is to GitHub Pages.

## Run, test, deploy

- **Run locally:** ES modules must be served over HTTP, not `file://`.
  `python -m http.server 5500` then open `http://localhost:5500`, or VS Code Live Server.
- **Test:** `npm test` (Node's built-in runner, no dependencies). Tests live in `tests/`.
  `scoring.test.js` covers the pure logic; `render.smoke.test.js` stubs a minimal DOM
  and asserts each tab renders without throwing. Run one file: `node --test tests/scoring.test.js`.
- **Deploy:** push to the published branch; GitHub Pages serves the files directly.
  Nothing to build.

## Architecture

Strict separation so the logic is testable and the data layer swappable:

- `js/data.js` — the real pool data: `PARTICIPANTS` (P), `GROUPS` (GF), `RANK` (RK),
  `NAME_MAP` + `normName()`, `getOwner()`. **No DOM, no network.** Treat the participant
  team lists as source-of-truth real data — don't change them casually.
- `js/scoring.js` — **pure functions** over the API `matches` array: `buildStandings`,
  `computeJornadas`, `jornadaLoser`, `totalsByParticipant`, `findDuels`, `duelOutcome`,
  `knockoutByStage`, `nextMatch`, `participantStats`, `computeRecords`, `headToHead`,
  `extractCrests` (name→flag map), plus match helpers. All betting/standings rules live
  here; it's the tested core (`tests/scoring.test.js`, `tests/features.test.js`).
- `js/api.js` — resilient data layer over football-data.org: per-request timeout,
  retries with backoff, `localStorage` cache with TTL, and stale-cache fallback when
  the API fails. Returns `{matches, standings, fromCache, error, ...}`.
- `js/config.js` — non-secret config (`proxyBase`, competition `WC`, season `2026`,
  timeouts). Layers an optional `js/config.local.js` (gitignored) via dynamic import.
- `js/ui.js` — DOM/format helpers, status bar, accessible tabs (ARIA + arrow keys),
  light/dark theme toggle, participant selector (`initParticipant`), and the
  per-second countdown ticker (`tickCountdowns`, updates any `.countdown[data-target]`).
  Theme and selected participant persist in localStorage.
- `js/render.js` — one `render*()` per tab (incl. `renderMiPanel`, `renderEliminatorias`,
  `renderRecords`, `renderNextBar`); each takes a `state` object (`{matches, crests, me,
  …}`) and writes `innerHTML`. Static structure always renders; live data and crests only
  enrich it. Handles loading / cache / error / config-missing states. `state.me` drives
  the "Yo" panel and the `.is-me` highlight.
- `js/app.js` — orchestrator: holds `state`, paints from cache immediately, calls
  `loadAll()`, wires tabs/refresh/theme, and auto-refreshes every 60s **only while a
  match is live**.

### The critical glue: name normalization

The API returns team names in English (varied spellings/accents); all pool data is in
**Spanish**. Every API team name MUST pass through `normName()` before being compared
to `P`/`GROUPS`/`RANK`. `app.js` logs `findUnmappedNames()` to the console — check there
first when a team shows no owner or lands in the wrong group, then add the variant to
`NAME_MAP` in `data.js`.

### Scoring rules (in scoring.js)

- Standings are **recomputed from match results** (not trusting the API standings array).
  Tiebreakers: Pts → goal difference → goals for → name (an approximation of FIFA's).
- Jornada (matchday) points (bet "Opción 02"): win 3 / draw 1 / loss 0, grouped by
  `matchday` (falls back to date-ordering). Lowest total per jornada pays $50; a jornada
  is "finished" when each participant has played all 8 of their matches.
- Duels (bet "Opción 01") are group-stage matches between teams owned by two *different*
  participants — included even when still scheduled (the Apuestas/Calendario tabs show
  upcoming duels).

## API key / security

The site is static, so a browser-side key is always public. Two paths (see
`worker/README.md`):
- **Production:** a Cloudflare Worker (`worker/quiniela-proxy.js`) holds the key as a
  secret; set its URL in `config.js` `proxyBase`. This also avoids the flaky public CORS proxy.
- **Local only:** put the key in `js/config.local.js` (gitignored).

The original hardcoded key was public — it should be rotated on football-data.org.
