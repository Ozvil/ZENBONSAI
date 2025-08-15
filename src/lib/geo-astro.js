// src/lib/geo-astro.ts
export type GeoPlace = {
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
};

export type AstroDay = {
  date: string;
  sunrise?: string;
  sunset?: string;
  moonrise?: string;
  moonset?: string;
  moon_phase?: string;
};

const OM_GEO_SEARCH = (q: string) =>
  `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=es&format=json`;

const OM_REVERSE = (lat: number, lon: number) =>
  `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=es&format=json`;

export async function geocode(query: string): Promise<GeoPlace[]> {
  const res = await fetch(OM_GEO_SEARCH(query));
  if (!res.ok) return [];
  const j = await res.json();
  return (j?.results || []).map((r: any) => ({
    name: r.name,
    country: r.country,
    admin1: r.admin1,
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

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

export async function fetchAstronomy(
  lat: number,
  lon: number,
  startISO: string,
  endISO: string
): Promise<{ source: "WeatherAPI"; days: AstroDay[] }> {
  const url = `/api/astronomy?lat=${lat}&lon=${lon}&start=${startISO}&end=${endISO}`;
  const r = await fetch(url);
  if (!r.ok) {
    console.warn("Astronomy API error:", r.status);
    return { source: "WeatherAPI", days: [] };
  }
  const j = await r.json();
  return { source: "WeatherAPI", days: (j?.days ?? []) as AstroDay[] };
}

export function moonPhaseLabel(phase?: string): string {
  if (!phase) return "—";
  const p = phase.toLowerCase();
  if (p.includes("new moon")) return "Luna Nueva";
  if (p.includes("waxing crescent")) return "Creciente Iluminante";
  if (p.includes("first quarter")) return "Cuarto Creciente";
  if (p.includes("waxing gibbous")) return "Gibosa Creciente";
  if (p.includes("full moon")) return "Luna Llena";
  if (p.includes("waning gibbous")) return "Gibosa Menguante";
  if (p.includes("last quarter") || p.includes("third quarter")) return "Cuarto Menguante";
  if (p.includes("waning crescent")) return "Creciente Menguante";
  return phase.replace(/\b\w/g, (m) => m.toUpperCase());
}

export function fmtDate(iso: string, locale = "es-PE", tz = "America/Lima") {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "short", timeZone: tz });
}
