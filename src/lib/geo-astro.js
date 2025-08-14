// src/lib/geo-astro.js

// ---------- util ----------
export const fmtDate = (d) => {
  const dt = (d instanceof Date) ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// ---------- geocoding ----------
export async function geocode(query, { lang = 'es', count = 5 } = {}) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({
    name: query,
    count,
    language: lang,
    format: 'json'
  });
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Geocode ${res.status}`);
  const json = await res.json();
  const list = (json.results || []).map(r => ({
    name: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
    lat: r.latitude,
    lon: r.longitude
  }));
  return list;
}

export async function reverseGeocode(lat, lon, { lang = 'es' } = {}) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/reverse');
  url.search = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    language: lang,
    format: 'json'
  });
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Reverse ${res.status}`);
  const json = await res.json();
  const r = (json.results || [])[0];
  return {
    name: r ? [r.name, r.admin1, r.country].filter(Boolean).join(', ') : `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
    lat,
    lon
  };
}

// ---------- astronomy ----------
const API_ASTRO = 'https://api.open-meteo.com/v1/astronomy';

// Open-Meteo devuelve moon_phase entre 0..1 (0 nueva, 0.25 cuarto creciente, 0.5 llena, 0.75 cuarto menguante)
export function moonPhaseLabel(p) {
  if (p == null) return '—';
  const v = Number(p);
  if (isNaN(v)) return '—';
  const wrap = (x) => (x + 1) % 1;
  const dist = (a, b) => Math.min(Math.abs(a - b), Math.abs(wrap(a) - b), Math.abs(a - wrap(b)));
  const nearest = [
    { k: 0.00, t: 'Luna nueva' },
    { k: 0.25, t: 'Cuarto creciente' },
    { k: 0.50, t: 'Luna llena' },
    { k: 0.75, t: 'Cuarto menguante' }
  ].reduce((best, cur) => (dist(v, cur.k) < dist(v, best.k) ? cur : best));
  return nearest.t;
}

export async function fetchAstronomy(lat, lon, startDate, endDate, timezone) {
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'auto';

  const buildURL = (tzValue) => {
    const u = new URL(API_ASTRO);
    u.search = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      start_date: startDate,
      end_date: endDate,
      daily: 'moon_phase,moonrise,moonset',
      timezone: tzValue
    });
    return u.toString();
  };

  // intento con timezone real, si falla 400/404 probamos con 'auto'
  let res = await fetch(buildURL(tz));
  if (!res.ok && (res.status === 400 || res.status === 404)) {
    res = await fetch(buildURL('auto'));
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

  return res.json();
}
