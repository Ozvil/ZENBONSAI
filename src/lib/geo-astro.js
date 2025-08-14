// src/lib/geo-astro.js

const API_GEO = 'https://geocoding-api.open-meteo.com/v1';

// Busca una ciudad por texto
export async function geocode(q) {
  const url = `${API_GEO}/search?name=${encodeURIComponent(q)}&count=8&language=es&format=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('geocode ' + r.status);
  const j = await r.json();
  return (j.results || []).map(x => ({
    name: [x.name, x.admin1, x.country].filter(Boolean).join(', '),
    lat: x.latitude,
    lon: x.longitude,
  }));
}

// Revierte lat/lon a nombre de lugar
export async function reverseGeocode(lat, lon) {
  const url = `${API_GEO}/reverse?latitude=${lat}&longitude=${lon}&language=es`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('reverse ' + r.status);
  const j = await r.json();
  const x = (j.results || [])[0];
  return {
    name: x ? [x.name, x.admin1, x.country].filter(Boolean).join(', ') : `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
    lat, lon
  };
}

// ======= Astronomía (fases de luna) =======
const API_ASTRO = 'https://api.open-meteo.com/v1/astronomy';

export async function fetchAstronomy(lat, lon, start, end, tz = 'auto') {
  const url = `${API_ASTRO}?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}&daily=moon_phase,moonrise,moonset&timezone=${encodeURIComponent(tz)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Astronomy ' + r.status);
  return r.json();
}

// Etiquetas amigables para la fase de luna
export function moonPhaseLabel(p) {
  if (p == null) return '—';
  const deg = Number(p);
  if (Number.isNaN(deg)) return '—';
  if (deg === 0) return 'Luna nueva';
  if (deg > 0 && deg < 90) return 'Creciente';
  if (deg === 90) return 'Cuarto creciente';
  if (deg > 90 && deg < 180) return 'Gibosa creciente';
  if (deg === 180) return 'Luna llena';
  if (deg > 180 && deg < 270) return 'Gibosa menguante';
  if (deg === 270) return 'Cuarto menguante';
  return 'Menguante';
}

// YYYY-MM-DD
export function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
