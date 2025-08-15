// src/lib/geo-astro.js

// --------- Utilidades de fecha ----------
export function fmtDate(d) {
  // YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// --------- Geocoding (Open-Meteo, sin API key) ----------
export async function geocode(q) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=es&format=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('geocode');
  const j = await r.json();
  const out = (j.results || []).map(it => ({
    name: `${it.name}${it.admin1 ? ', ' + it.admin1 : ''}${it.country ? ', ' + it.country : ''}`,
    lat: it.latitude,
    lon: it.longitude,
  }));
  return out;
}

export async function reverseGeocode(lat, lon) {
  const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=es&format=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('reverse');
  const j = await r.json();
  const it = (j.results || [])[0];
  if (!it) throw new Error('no-reverse');
  return {
    name: `${it.name}${it.admin1 ? ', ' + it.admin1 : ''}${it.country ? ', ' + it.country : ''}`,
    lat: it.latitude,
    lon: it.longitude,
  };
}

// --------- Astronomía (Open-Meteo /astronomy) ----------
// IMPORTANTE: este endpoint exige daily=... y (opcional) rango de fechas.
export async function fetchAstronomy(lat, lon, startYYYYMMDD, endYYYYMMDD) {
  const url =
    `https://api.open-meteo.com/v1/astronomy` +
    `?latitude=${lat}&longitude=${lon}` +
    `&daily=sunrise,sunset,moon_phase,moonrise,moonset` +
    `&timezone=auto` +
    (startYYYYMMDD ? `&start_date=${startYYYYMMDD}` : '') +
    (endYYYYMMDD ? `&end_date=${endYYYYMMDD}` : '');
  const r = await fetch(url);
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`Astronomy ${r.status} ${txt || ''}`.trim());
  }
  return r.json();
}

// (Opcional) Meteorología diaria (si la usas en el futuro)
export async function fetchForecast(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum` +
    `&timezone=auto`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('forecast');
  return r.json();
}

// --------- Fase de la luna (etiqueta legible) ----------
export function moonPhaseLabel(phase) {
  // Open-Meteo moon_phase: 0=new, 0.25=first quarter, 0.5=full, 0.75=last quarter
  // pero también da valores intermedios de 0..1
  if (phase == null) return '—';
  const p = Number(phase);
  if (p >= 0.95 || p < 0.05) return 'Luna nueva';
  if (p >= 0.45 && p <= 0.55) return 'Luna llena';
  if (p >= 0.20 && p <= 0.30) return 'Cuarto creciente';
  if (p >= 0.70 && p <= 0.80) return 'Cuarto menguante';
  return p < 0.5 ? 'Creciente' : 'Menguante';
}
