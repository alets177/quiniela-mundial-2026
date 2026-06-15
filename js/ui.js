/**
 * ui.js — Utilidades de presentación: DOM, formato, barra de estado,
 * pestañas accesibles (ARIA + teclado) y conmutador de tema.
 */
import { CONFIG } from './config.js';
import { P } from './data.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Escapa texto para insertarlo seguro en innerHTML (nombres vienen de la API). */
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* ── Formato de fechas (zona horaria de la quiniela) ── */
export const fmtTime = (d) =>
  new Date(d).toLocaleTimeString(CONFIG.locale, { hour: '2-digit', minute: '2-digit', timeZone: CONFIG.timeZone });
export const fmtDayLong = (d) =>
  new Date(d).toLocaleDateString(CONFIG.locale, { weekday: 'long', day: 'numeric', month: 'short', timeZone: CONFIG.timeZone });
/** Reloj local del visitante (para "actualizado a las…"). */
export const fmtClock = (d) =>
  new Date(d).toLocaleTimeString(CONFIG.locale, { hour: '2-digit', minute: '2-digit' });

/* ── Barra de estado de la API ── */
export function setStatus(state, text) {
  const dot = $('#api-dot');
  const label = $('#api-status-txt');
  if (dot) dot.className = 'api-dot ' + state;
  if (label) label.textContent = text;
}

/* ── Pestañas: ARIA + navegación con flechas ── */
export function initTabs(onChange) {
  const tabs = $$('.tab-btn');
  const panels = $$('.panel');

  function activate(tab) {
    for (const t of tabs) {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
    }
    const target = tab.getAttribute('aria-controls');
    for (const p of panels) p.classList.toggle('active', p.id === target);
    onChange?.(target);
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', (e) => {
      let next;
      if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      else return;
      e.preventDefault();
      tabs[next].focus();
      activate(tabs[next]);
    });
  });
}

/* ── Tema claro/oscuro ── */
const THEME_KEY = 'quiniela:theme';
const SUN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
const MOON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

function effectiveDark() {
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit) return explicit === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function syncToggleIcon() {
  const btn = $('#theme-toggle');
  if (!btn) return;
  const dark = effectiveDark();
  btn.innerHTML = dark ? SUN : MOON;
  btn.setAttribute('aria-label', dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
}

export function initTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) document.documentElement.setAttribute('data-theme', saved);
  } catch (_) { /* sin almacenamiento */ }

  syncToggleIcon();
  $('#theme-toggle')?.addEventListener('click', () => {
    const next = effectiveDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
    syncToggleIcon();
  });
}

/* ── Selector de participante (modo "Yo"), persistido ── */
const ME_KEY = 'quiniela:me';
export function initParticipant(onChange) {
  const sel = $('#me-select');
  if (!sel) return null;
  const names = Object.keys(P);

  let saved = '';
  try { saved = localStorage.getItem(ME_KEY) || ''; } catch (_) {}
  if (saved && !names.includes(saved)) saved = '';

  sel.innerHTML = '<option value="">— elige —</option>' +
    names.map((n) => `<option value="${n}"${n === saved ? ' selected' : ''}>${n}</option>`).join('');

  sel.addEventListener('change', () => {
    const v = sel.value;
    try { v ? localStorage.setItem(ME_KEY, v) : localStorage.removeItem(ME_KEY); } catch (_) {}
    onChange?.(v || null);
  });

  return saved || null;
}

/* ── Cuenta regresiva: actualiza todos los .countdown[data-target] ── */
export function tickCountdowns() {
  const now = Date.now();
  const pad = (n) => String(n).padStart(2, '0');
  for (const el of $$('.countdown[data-target]')) {
    let diff = Math.floor((new Date(el.getAttribute('data-target')).getTime() - now) / 1000);
    if (diff <= 0) { el.textContent = '¡En juego!'; el.classList.add('soon'); continue; }
    const d = Math.floor(diff / 86400); diff %= 86400;
    const h = Math.floor(diff / 3600); diff %= 3600;
    const m = Math.floor(diff / 60); const s = diff % 60;
    el.textContent = d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
    el.classList.toggle('soon', d === 0 && h === 0);
  }
}
