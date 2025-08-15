// api/astronomy.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

type AstroDay = {
  date: string;
  sunrise?: string;
  sunset?: string;
  moonrise?: string;
  moonset?: string;
  moon_phase?: string;
};

function ymdRange(start: string, end: string): string[] {
  const out: string[] = [];
  const d0 = new Date(start + "T00:00:00");
  const d1 = new Date(end + "T00:00:00");
  for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") return res.status(405).send("Method Not Allowed");
    const { lat, lon, start, end } = req.query as Record<string, string>;
    if (!lat || !lon || !start || !end) {
      return res.status(400).json({ error: "Missing lat/lon/start/end" });
    }
    const KEY = process.env.WEATHERAPI_KEY;
    if (!KEY) return res.status(500).json({ error: "WEATHERAPI_KEY not configured" });

    const dates = ymdRange(start, end);
    const results = await Promise.all(
      dates.map(async (dt) => {
        const url = `https://api.weatherapi.com/v1/astronomy.json?key=${KEY}&q=${lat},${lon}&dt=${dt}`;
        const r = await fetch(url);
        if (!r.ok) return null;
        const j = await r.json();
        const a = j?.astronomy?.astro;
        return {
          date: dt,
          sunrise: a?.sunrise,
          sunset: a?.sunset,
          moonrise: a?.moonrise,
          moonset: a?.moonset,
          moon_phase: a?.moon_phase,
        } as AstroDay;
      })
    );

    const days = results.filter(Boolean) as AstroDay[];
    return res.status(200).json({ source: "WeatherAPI", days });
  } catch (err: any) {
    console.error("astronomy function error:", err);
    return res.status(500).json({ error: err?.message || "Unknown error" });
  }
}
