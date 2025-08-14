// src/lib/geo-astro.js
// Helpers de geocodificación y astronomía con Open-Meteo

export async function geocode(q) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=es`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('geocode ' + r.status);
  const j = await r.json();
  return (j.results || []).map((it) => ({
    name: [it.name, it.admin1, it.country].filter(Boolean).join(', '),
    lat: it.latitude,
    lon: it.longitude
  }));
}

export async function reverseGeocode(lat, lon) {
  const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=es`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('reverse ' + r.status);
  const j = await r.json();
  const it = (j.results || [])[0];
  return it
    ? { name: [it.name, it.admin1, it.country].filter(Boolean).join(', '), lat, lon }
    : { name: `${lat.toFixed(3)}, ${lon.toFixed(3)}`, lat, lon };
}

export function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function moonPhaseLabel(p) {
  if (p == null) return '—';
  const deg = Number(p) * 360; // 0..1 -> 0..360
  if (deg < 22.5) return 'Luna nueva';
  if (deg < 67.5) return 'Creciente c.';
  if (deg < 112.5) return 'Cuarto creciente';
  if (deg < 157.5) return 'Creciente g.';
  if (deg < 202.5) return 'Luna llena';
  if (deg < 247.5) return 'Menguante g.';
  if (deg < 292.5) return 'Cuarto menguante';
  if (deg < 337.5) return 'Menguante c.';
  return 'Luna nueva';
}

export async function fetchAstronomy(lat, lon, startDate, endDate, tz = 'auto') {
  const url =
    `https://api.open-meteo.com/v1/astronomy` +
    `?latitude=${lat}&longitude=${lon}` +
    `&start_date=${startDate}&end_date=${endDate}` +
    `&daily=moon_phase,moonrise,moonset` +
    `&timezone=${encodeURIComponent(tz)}`;

  // Debug: deja esto encendido hasta que confirmemos en Network que es el correcto
  console.log('[astro] GET', url);

  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
  return r.json();
}
