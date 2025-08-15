// src/lib/geo-astro.js
export async function geocode(q) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=es&format=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Geocode ${r.status}`);
  const j = await r.json();
  return (j.results || []).map(it => ({
    name: `${it.name}${it.admin1 ? ', ' + it.admin1 : ''}${it.country ? ', ' + it.country : ''}`,
    lat: it.latitude,
    lon: it.longitude
  }));
}

export async function reverseGeocode(lat, lon) {
  const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=es`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Reverse ${r.status}`);
  const j = await r.json();
  const it = (j.results || [])[0];
  if (!it) throw new Error('Sin resultados');
  return {
    name: `${it.name}${it.admin1 ? ', ' + it.admin1 : ''}${it.country ? ', ' + it.country : ''}`,
    lat, lon
  };
}

// yyyy-mm-dd
export function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Etiqueta simple de fase lunar (0..1)
export function moonPhaseLabel(v) {
  if (v == null) return '—';
  if (v === 0) return 'Luna nueva';
  if (v > 0 && v < 0.25) return 'Creciente';
  if (v === 0.25) return 'Cuarto creciente';
  if (v > 0.25 && v < 0.5) return 'Gibosa creciente';
  if (v === 0.5) return 'Luna llena';
  if (v > 0.5 && v < 0.75) return 'Gibosa menguante';
  if (v === 0.75) return 'Cuarto menguante';
  return 'Menguante';
}

/**
 * Llama al endpoint oficial:
 * https://api.open-meteo.com/v1/astronomy
 * Requisitos:
 *  - latitude, longitude
 *  - start_date, end_date (yyyy-mm-dd)
 *  - timezone
 *  - daily con cualquiera de estos: sunrise,sunset,moonrise,moonset,moon_phase
 */
export async function fetchAstronomy(lat, lon, startDate, endDate, tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'auto') {
  const daily = ['moon_phase', 'moonrise', 'moonset'].join(',');
  const url = `https://api.open-meteo.com/v1/astronomy?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&timezone=${encodeURIComponent(tz)}&daily=${daily}`;

  const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
  // Open-Meteo devuelve 4xx (ej. 404) cuando falta un parámetro o está mal
  if (!r.ok) {
    let reason = '';
    try { reason = (await r.json())?.reason || ''; } catch {}
    throw new Error(`Astronomy ${r.status} ${reason ? '(' + reason + ')' : ''}`);
  }
  return r.json();
}
