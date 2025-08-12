// src/lib/geo-astro.js
// Utilidades de geocodificación y calendario solar/lunar con Open-Meteo.
// Corrige errores 400 añadiendo format=json y fuerza timezone=auto como fallback.
// Cachea respuestas 24h en localStorage.

const ONE_DAY = 24 * 3600e3;

function saveCache(key, value, ttlMs = ONE_DAY) {
  try { localStorage.setItem(key, JSON.stringify({ exp: Date.now() + ttlMs, value })); } catch {}
}
function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { exp, value } = JSON.parse(raw);
    if (Date.now() > exp) return null;
    return value;
  } catch { return null; }
}

// Geocodificación por texto
export async function geocodeCity(q, lang = 'es') {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=${lang}&format=json`;
  const cached = readCache(`geo_${lang}_${q.toLowerCase()}`);
  if (cached) return cached;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
  const j = await r.json();
  if (!j.results?.length) throw new Error('No encontrado');

  const { latitude, longitude, timezone, country, name, admin1 } = j.results[0];
  const res = { lat: latitude, lon: longitude, tz: timezone, country, city: name, region: admin1 || '' };
  saveCache(`geo_${lang}_${q.toLowerCase()}`, res);
  return res;
}

// Geocodificación inversa por coordenadas (¡incluye format=json!)
export async function reverseGeocode(lat, lon, lang = 'es') {
  const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=${lang}&format=json`;
  const key = `rev_${lang}_${Number(lat).toFixed(4)}_${Number(lon).toFixed(4)}`;
  const cached = readCache(key);
  if (cached) return cached;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
  const j = await r.json();
  const res0 = j.results?.[0] || {};

  const res = {
    tz: res0.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    country: res0.country || '',
    city: res0.name || res0.admin1 || '',
    region: res0.admin1 || ''
  };
  saveCache(key, res);
  return res;
}

// Astronomía (amanecer/atardecer y fases/horas lunares)
export async function loadAstronomy(lat, lon, tz) {
  if (lat == null || lon == null) throw new Error('Lat/Lon faltan');
  const la = Number(lat).toFixed(4);
  const lo = Number(lon).toFixed(4);

  const base = `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&daily=sunrise,sunset,moon_phase,moonrise,moonset`;
  const urls = [
    tz ? `${base}&timezone=${encodeURIComponent(tz)}` : `${base}&timezone=auto`,
    `${base}&timezone=auto` // fallback siempre en auto
  ];

  const cacheKey = `astro_${la}_${lo}_${tz || 'auto'}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  let lastErr;
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
      const j = await r.json();
      if (!j?.daily?.time) throw new Error('Respuesta inválida');
      const out = j.daily; // { time, sunrise, sunset, moon_phase, moonrise, moonset }
      saveCache(cacheKey, out);
      return out;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Fallo astronomía');
}

// Utilidad opcional para mostrar fase lunar en texto
export function moonPhaseLabel(code) {
  // Open-Meteo devuelve 0..1 (fracción del ciclo)
  if (code == null) return '';
  const p = Number(code);
  if (p < 0.03 || p > 0.97) return 'Luna nueva';
  if (p < 0.22) return 'Creciente';
  if (p < 0.28) return 'Cuarto creciente';
  if (p < 0.47) return 'Gibosa creciente';
  if (p < 0.53) return 'Luna llena';
  if (p < 0.72) return 'Gibosa menguante';
  if (p < 0.78) return 'Cuarto menguante';
  return 'Menguante';
}
