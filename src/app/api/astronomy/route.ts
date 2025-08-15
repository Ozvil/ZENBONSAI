// app/api/astronomy/route.ts
import { NextResponse } from "next/server";

type AstroDay = {
  date: string;
  sunrise?: string;
  sunset?: string;
  moonrise?: string;
  moonset?: string;
  moon_phase?: string;
};

export const runtime = "nodejs"; // más simple para usar process.env

function ymdRange(start: string, end: string): string[] {
  const out: string[] = [];
  const d0 = new Date(start + "T00:00:00");
  const d1 = new Date(end + "T00:00:00");
  for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!lat || !lon || !start || !end) {
      return NextResponse.json({ error: "Missing lat/lon/start/end" }, { status: 400 });
    }

    const KEY = process.env.WEATHERAPI_KEY;
    if (!KEY) {
      return NextResponse.json({ error: "WEATHERAPI_KEY not configured" }, { status: 500 });
    }

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
    return NextResponse.json({ source: "WeatherAPI", days });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 500 });
  }
}

