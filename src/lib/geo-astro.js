// src/lib/geo-astro.js
// Versión JS (sin TypeScript). Geocodificación con Open-Meteo + astronomía vía /api/astronomy (Vercel Function).

const OM_GEO_SEARCH = (q) =>
  `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=es&format=json`;

const OM_REVERSE = (lat, lon) =>
  `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=es&format=json`;

/** Busca lugares por nombre (Open-Meteo Geocoding) */
export async function geocode(query) {
  const res = await fetch(OM_GEO_SEARCH(query));
  if (!res.ok) return [];
  const j = await res.json();
  const out = (j?.results || []).map((r) => ({
    name: r.name,
    country: r.country,
    admin1: r.admin1,
    latitude: r.latitude,
    longitude: r.longitude,
  }));
  return out || [];
}

/** Reverse geocoding (Open-Meteo Geocoding) */
export async function reverseGeocode(lat, lon) {
  const res = await fetch(OM_REVERSE(lat, lon));
  if (!res.ok) return null;
  const j = await res.json();
  const r = j?.results?.[0];
  if (!r) return null;
  return {
    name: r.name,
    country: r.country,
    admin1: r.admin1,
    latitude: r.latitude,
    longitude: r.longitude,
  };
}

/**
 * Astronomy — llama al backend /api/astronomy (WeatherAPI detrás)
 * startISO / endISO: "YYYY-MM-DD"
 * Devuelve: { source: "WeatherAPI", days: Array<{ date, sunrise, sunset, moonrise, moonset, moon_phase }>}
 */
export async function fetchAstronomy(lat, lon, startISO, endISO) {
  const url = `/api/astronomy?lat=${lat}&lon=${lon}&start=${startISO}&end=${endISO}`;
  const r = await fetch(url);
  if (!r.ok) {
    console.warn("Astronomy API error:", r.status);
    return { source: "WeatherAPI", days: [] };
  }
  const j = await r.json();
  return { source: "WeatherAPI", days: j?.days ?? [] };
}

/** Etiqueta “bonita” para fase lunar (WeatherAPI viene en inglés) */
export function moonPhaseLabel(phase) {
  if (!phase) return "—";
  const p = String(phase).toLowerCase();
  if (p.includes("new moon")) return "Luna Nueva";
  if (p.includes("waxing crescent")) return "Creciente Iluminante";
  if (p.includes("first quarter")) return "Cuarto Creciente";
  if (p.includes("waxing gibbous")) return "Gibosa Creciente";
  if (p.includes("full moon")) return "Luna Llena";
  if (p.includes("waning gibbous")) return "Gibosa Menguante";
  if (p.includes("last quarter") || p.includes("third quarter")) return "Cuarto Menguante";
  if (p.includes("waning crescent")) return "Creciente Menguante";
  // Fallback: capitalizar palabras
  return phase.replace(/\b\w/g, (m) => m.toUpperCase());
}

/** Fecha corta local (Lima por defecto) */
export function fmtDate(iso, locale = "es-PE", tz = "America/Lima") {
  const d = new Date(iso + "T12:00:00"); // evita desfaces de TZ
  return d.toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "short", timeZone: tz });
}
