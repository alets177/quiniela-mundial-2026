/**
 * data.js — Datos de la quiniela y utilidades de nombres/dueños.
 *
 * Estos son los datos REALES del pool: participantes, sus selecciones,
 * los grupos oficiales y el ranking FIFA. No hay DOM ni red aquí.
 */

/* ──────────────────────────────────────────────
   PARTICIPANTES — color + sus 8 selecciones (en español)
─────────────────────────────────────────────── */
export const PARTICIPANTS = {
  Alejandro: { color: '#2563EB', teams: ['Inglaterra', 'Marruecos', 'México', 'Canadá', 'Chequia', 'Ecuador', 'Irak', 'Haití'] },
  Richard:   { color: '#D97706', teams: ['España', 'Bélgica', 'Bosnia y Herzegovina', 'Noruega', 'Escocia', 'Japón', 'Arabia Saudí', 'Turquía'] },
  Javier:    { color: '#DC2626', teams: ['Argentina', 'Alemania', 'EE. UU.', 'RI de Irán', 'Argelia', 'Curazao', 'Uzbekistán', 'Túnez'] },
  Anahi:     { color: '#16A34A', teams: ['Francia', 'Colombia', 'Catar', 'Egipto', 'Senegal', 'República de Corea', 'Ghana', 'Suecia'] },
  Gerardo:   { color: '#374151', teams: ['Sudáfrica', 'Austria', 'Islas de Cabo Verde', 'Panamá', 'Brasil', 'Países Bajos', 'Paraguay', 'Suiza'] },
  Mariel:    { color: '#DB2777', teams: ['Portugal', 'Jordania', 'Croacia', 'Costa de Marfil', 'RD Congo', 'Uruguay', 'Australia', 'Nueva Zelanda'] },
};

/* Alias corto usado internamente */
export const P = PARTICIPANTS;

/* ──────────────────────────────────────────────
   RANKING FIFA (para ordenar y mostrar #posición)
─────────────────────────────────────────────── */
export const RANK = {
  'Argentina': 1, 'España': 2, 'Francia': 3, 'Inglaterra': 4, 'Portugal': 5, 'Brasil': 6,
  'Marruecos': 7, 'Países Bajos': 8, 'Bélgica': 9, 'Alemania': 10, 'Croacia': 11,
  'Colombia': 13, 'México': 14, 'Senegal': 15, 'Uruguay': 16, 'EE. UU.': 17, 'Japón': 18,
  'Suiza': 19, 'RI de Irán': 20, 'Turquía': 22, 'Ecuador': 23, 'Austria': 24,
  'República de Corea': 25, 'Australia': 27, 'Argelia': 28, 'Egipto': 29, 'Canadá': 30,
  'Noruega': 31, 'Costa de Marfil': 33, 'Panamá': 34, 'Suecia': 38, 'Chequia': 40,
  'Paraguay': 41, 'Escocia': 42, 'Túnez': 45, 'RD Congo': 46, 'Uzbekistán': 50,
  'Catar': 56, 'Irak': 57, 'Sudáfrica': 60, 'Arabia Saudí': 61, 'Jordania': 63,
  'Bosnia y Herzegovina': 64, 'Islas de Cabo Verde': 67, 'Ghana': 73, 'Curazao': 82,
  'Haití': 83, 'Nueva Zelanda': 85,
};
export const RK = RANK;

/* ──────────────────────────────────────────────
   GRUPOS OFICIALES A–L (4 selecciones cada uno)
─────────────────────────────────────────────── */
export const GROUPS = {
  A: ['México', 'Sudáfrica', 'República de Corea', 'Chequia'],
  B: ['Canadá', 'Bosnia y Herzegovina', 'Catar', 'Suiza'],
  C: ['Brasil', 'Marruecos', 'Haití', 'Escocia'],
  D: ['EE. UU.', 'Paraguay', 'Australia', 'Turquía'],
  E: ['Alemania', 'Curazao', 'Costa de Marfil', 'Ecuador'],
  F: ['Países Bajos', 'Japón', 'Suecia', 'Túnez'],
  G: ['Bélgica', 'Egipto', 'RI de Irán', 'Nueva Zelanda'],
  H: ['España', 'Islas de Cabo Verde', 'Arabia Saudí', 'Uruguay'],
  I: ['Francia', 'Senegal', 'Irak', 'Noruega'],
  J: ['Argentina', 'Argelia', 'Austria', 'Jordania'],
  K: ['Portugal', 'RD Congo', 'Uzbekistán', 'Colombia'],
  L: ['Inglaterra', 'Croacia', 'Ghana', 'Panamá'],
};
export const GF = GROUPS;

/* ──────────────────────────────────────────────
   NORMALIZACIÓN DE NOMBRES
   La API (football-data.org) usa nombres en inglés con grafías
   variadas. Todo nombre de la API debe pasar por normName() antes
   de compararse con los datos de la quiniela (que están en español).
─────────────────────────────────────────────── */
export const NAME_MAP = {
  // EE. UU.
  'United States': 'EE. UU.', 'United States of America': 'EE. UU.', 'USA': 'EE. UU.', 'US': 'EE. UU.',
  // República de Corea
  'Korea Republic': 'República de Corea', 'Republic of Korea': 'República de Corea',
  'South Korea': 'República de Corea', 'Korea, Republic of': 'República de Corea',
  // RI de Irán
  'Iran': 'RI de Irán', 'IR Iran': 'RI de Irán', 'Islamic Republic of Iran': 'RI de Irán',
  // Resto
  'Morocco': 'Marruecos',
  'Netherlands': 'Países Bajos', 'Holland': 'Países Bajos',
  'Belgium': 'Bélgica',
  'Germany': 'Alemania',
  'Spain': 'España',
  'France': 'Francia',
  'Brazil': 'Brasil',
  'Argentina': 'Argentina',
  'Portugal': 'Portugal',
  'England': 'Inglaterra',
  'Croatia': 'Croacia',
  'Colombia': 'Colombia',
  'Senegal': 'Senegal',
  'Uruguay': 'Uruguay',
  'Switzerland': 'Suiza',
  'Ecuador': 'Ecuador',
  'Japan': 'Japón',
  'Australia': 'Australia',
  'Algeria': 'Argelia',
  'Egypt': 'Egipto',
  'Canada': 'Canadá',
  'Norway': 'Noruega',
  'Ivory Coast': 'Costa de Marfil', "Côte d'Ivoire": 'Costa de Marfil',
  "Cote d'Ivoire": 'Costa de Marfil', 'Côte d’Ivoire': 'Costa de Marfil',
  'Panama': 'Panamá',
  'Sweden': 'Suecia',
  'Czech Republic': 'Chequia', 'Czechia': 'Chequia', 'Czech Rep.': 'Chequia',
  'Paraguay': 'Paraguay',
  'Scotland': 'Escocia',
  'Tunisia': 'Túnez',
  'DR Congo': 'RD Congo', 'Congo DR': 'RD Congo',
  'Democratic Republic of Congo': 'RD Congo', 'Congo, Democratic Republic of': 'RD Congo',
  'Uzbekistan': 'Uzbekistán',
  'Qatar': 'Catar',
  'Iraq': 'Irak',
  'South Africa': 'Sudáfrica',
  'Saudi Arabia': 'Arabia Saudí',
  'Jordan': 'Jordania',
  'Bosnia and Herzegovina': 'Bosnia y Herzegovina', 'Bosnia & Herzegovina': 'Bosnia y Herzegovina',
  'Bosnia-Herzegovina': 'Bosnia y Herzegovina',
  'Cape Verde': 'Islas de Cabo Verde', 'Cabo Verde': 'Islas de Cabo Verde',
  'Cape Verde Islands': 'Islas de Cabo Verde',
  'Ghana': 'Ghana',
  'Curaçao': 'Curazao', 'Curacao': 'Curazao',
  'Haiti': 'Haití',
  'New Zealand': 'Nueva Zelanda',
  'Mexico': 'México', 'México': 'México',
  'Austria': 'Austria',
  'Turkey': 'Turquía', 'Türkiye': 'Turquía',
};

/** Normaliza un nombre de selección al nombre usado en la quiniela. */
export function normName(n) {
  if (!n) return '';
  return NAME_MAP[n] || NAME_MAP[n.trim()] || n;
}

/** Devuelve el participante dueño de una selección (o null). */
export function getOwner(name) {
  const r = normName(name);
  for (const [participant, data] of Object.entries(P)) {
    if (data.teams.includes(r)) return participant;
  }
  return null;
}

/** Convierte #RRGGBB + alpha en rgba(). */
export function hexAlpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** Conjunto de nombres (español) que pertenecen a algún participante. */
export const OWNED_TEAMS = new Set(Object.values(P).flatMap((d) => d.teams));

/**
 * Reporta nombres de la API que no tienen mapeo en NAME_MAP.
 * Útil para detectar por qué una selección aparece "sin dueño".
 */
export function findUnmappedNames(matches) {
  if (!matches) return [];
  const mappedValues = new Set(Object.values(NAME_MAP));
  const unmapped = new Set();
  for (const m of matches) {
    for (const raw of [m.homeTeam?.name, m.awayTeam?.name]) {
      if (raw && !NAME_MAP[raw] && !mappedValues.has(raw)) unmapped.add(raw);
    }
  }
  return [...unmapped].sort();
}
