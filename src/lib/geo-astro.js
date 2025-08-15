// src/lib/geo-astro.ts
// Reemplazo total — usa Open-Meteo solo para geocodificación y WeatherAPI (vía /api/astronomy) para astronomía.

export type GeoPlace = {
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
};

export type AstroDay = {
  date: string;           // YYYY-MM-DD
  sunrise?: string;       // "06:12 AM"
  sunset?: string;        // "06:02 PM"
  moonrise?: string;      // "03:41 PM"
  moonset?: string;       // "03:55 AM"
  moon_phase?: string;    // e.g., "Waxing Crescent", "Full Moon"
};

const OM_GEO_SEARCH = (q: string) =>
  `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=es&format=json`;

const OM_REVERSE = (lat: number, lon: number) =>
  `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=es&format=json`;

/** Busca lugares por nombre (Open-Meteo Geocoding) */
export async function geocode(query: string): Promise<GeoPlace[]> {
  const res = await fetch(OM_GEO_SEARCH(query));
  if (!res.ok) return [];
  const j = await res.json();
  const out: GeoPlace[] =
    (j?.results || []).map((r: any) => ({
      name: r.name,
      country: r.country,
      admin1: r.admin1,
      latitude: r.latitude,
      longitude: r.longitude,
    })) ?? [];
  return out;
}

/** Reverse geocoding por lat/lon (Open-Meteo Geocoding) */
export async function reverseGeocode(lat: number, lon: number): Promise<GeoPlace | null> {
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
 * Astronomy — usa tu endpoint backend /api/astronomy (WeatherAPI)
 * startISO / endISO: "YYYY-MM-DD"
 */
export async function fetchAstronomy(
  lat: number,
  lon: number,
  startISO: string,
  endISO: string
): Promise<{ source: "WeatherAPI"; days: AstroDay[] }> {
  const url = `/api/astronomy?lat=${lat}&lon=${lon}&start=${startISO}&end=${endISO}`;
  const r = await fetch(url);
  if (!r.ok) {
    console.warn("Astronomy API error:", r.status, await r.text());
    return { source: "WeatherAPI", days: [] };
  }
  const j = await r.json();
  // El backend ya devuelve normalizado
  return { source: "WeatherAPI", days: (j?.days ?? []) as AstroDay[] };
}

/** Etiqueta “bonita” para fase lunar (acepta inglés de WeatherAPI) */
export function moonPhaseLabel(phase?: string): string {
  if (!phase) return "—";
  const p = phase.toLowerCase();
  // Map a español
  if (p.includes("new moon")) return "Luna Nueva";
  if (p.includes("waxing crescent")) return "Creciente Iluminante";
  if (p.includes("first quarter")) return "Cuarto Creciente";
  if (p.includes("waxing gibbous")) return "Gibosa Creciente";
  if (p.includes("full moon")) return "Luna Llena";
  if (p.includes("waning gibbous")) return "Gibosa Menguante";
  if (p.includes("last quarter") || p.includes("third quarter")) return "Cuarto Menguante";
  if (p.includes("waning crescent")) return "Creciente Menguante";
  // Fallback: capitaliza
  return phase.replace(/\b\w/g, (m) => m.toUpperCase());
}

/** Fecha corta local (Lima por defecto) */
export function fmtDate(iso: string, locale = "es-PE", tz = "America/Lima") {
  const d = new Date(iso + "T12:00:00"); // forzar zona segura
  return d.toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "short", timeZone: tz });
}
