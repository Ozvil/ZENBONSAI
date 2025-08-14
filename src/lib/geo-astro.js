// src/lib/geo-astro.js
// Geocoding + Astronomía con Open-Meteo, robusto ante timezones y SW

export async function geocode(q) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
  url.searchParams.set('name', q);
  url.searchParams.set('count', '5');
  url.searchParams.set('language', 'es');

  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('geocode ' + r.status);
  const j = await r.json();
  return (j.results || []).map(it => ({
    name: [it.name, it.admin1, it.country].filter(Boolean).join(', '),
    lat: it.latitude,
    lon: it.longitude,
  }));
}

export async function reverseGeocode(lat, lon) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/reverse');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('language', 'es');

  const r = await fetch(url, { cache: 'no-store' });
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
  const deg = Number(p) * 360;
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

// Astronomy con retries y SIN caché (evita respuestas 404 cacheadas)
export async function fetchAstronomy(lat, lon, startDate, endDate, tzGuess) {
  const base = new URL('https://api.open-meteo.com/v1/astronomy');
  base.searchParams.set('latitude', String(lat));
  base.searchParams.set('longitude', String(lon));
  base.searchParams.set('start_date', startDate);
  base.searchParams.set('end_date', endDate);
  base.searchParams.set('daily', 'moon_phase,moonrise,moonset');

  const tz1 = tzGuess || Intl.DateTimeFormat().resolvedOptions().timeZone || 'auto';
  // Orden de reintentos
  const timezones = [tz1, 'auto', 'UTC', ''];

  let lastErr;
  for (const tz of timezones) {
    const url = new URL(base);
    if (tz) url.searchParams.set('timezone', tz);
    console.log('[astro] TRY', url.toString());
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (r.ok) return r.json();       // ¡Listo!
      lastErr = new Error(r.status + ' ' + r.statusText);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('fetchAstronomy failed');
}
