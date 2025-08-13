// src/lib/geo-astro.js
export async function geocode(q) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=es&format=json`;
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('Geocoding ' + r.status);
  const j = await r.json();
  return (j.results || []).map(x => ({
    lat: x.latitude,
    lon: x.longitude,
    name: [x.name, x.admin1, x.country].filter(Boolean).join(', '),
    tz: x.timezone
  }));
}

export async function reverseGeocode(lat, lon) {
  const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=es&format=json`;
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('Reverse ' + r.status);
  const j = await r.json();
  const x = (j.results || [])[0];
  return x
    ? { lat, lon, name: [x.name || x.country, x.admin1].filter(Boolean).join(', '), tz: x.timezone }
    : { lat, lon, name: `${lat.toFixed(2)}, ${lon.toFixed(2)}`, tz: 'auto' };
}

export async function fetchAstronomy(lat, lon, start, end) {
  const url =
    `https://api.open-meteo.com/v1/astronomy?latitude=${lat}&longitude=${lon}` +
    `&daily=moon_phase,moonrise,moonset&timezone=auto&start_date=${start}&end_date=${end}`;
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('Astronomy ' + r.status);
  return await r.json();
}

export function moonPhaseLabel(p) {
  const v = Number(p);
  if (v === 0) return 'Luna nueva';
  if (v > 0 && v < 0.25) return 'Creciente cóncava';
  if (v === 0.25) return 'Cuarto creciente';
  if (v > 0.25 && v < 0.5) return 'Creciente gibosa';
  if (v === 0.5) return 'Luna llena';
  if (v > 0.5 && v < 0.75) return 'Menguante gibosa';
  if (v === 0.75) return 'Cuarto menguante';
  return 'Menguante cóncava';
}

export function fmtDate(d) { return d.toISOString().slice(0, 10); }
