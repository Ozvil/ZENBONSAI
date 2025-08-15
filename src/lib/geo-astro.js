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
  if (!r)
