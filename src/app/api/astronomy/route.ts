// src/app/api/astronomy/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";        // habilita process.env en App Router
export const dynamic = "force-dynamic"; // evita que quede cacheado
export const revalidate = 0;

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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url); // <-- usa el mismo nombre "req"
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!lat || !lon || !start || !end) {
      return NextResponse.json({ error: "Missing lat/lon/start/end" }, { status: 400 });
    }

    const KEY = process.env.WEATHERAPI_KEY;
    if (!KEY) {
      // Configura la env var en Vercel (Production y Preview) y redeploy
      return NextResponse.json({ error: "WEATHERAPI_KEY not configured" }, { status: 500 });
    }

    const dates = ymdRange(start, end);
    const days: AstroDay[] = [];

    for (const dt of dates) {
      const url = `https://api.weatherapi.com/v1/astronomy.json?key=${KEY}&q=${lat},${lon}&dt=${dt}`;
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) {
        console.error("WeatherAPI error", r.status, await r.text());
        continue;
      }
      const j = await r.json();
      const a = j?.astronomy?.astro;
      days.push({
        date: dt,
        sunrise: a?.sunrise,
        sunset: a?.sunset,
        moonrise: a?.moonrise,
        moonset: a?.moonset,
        moon_phase: a?.moon_phase,
      });
    }

    return NextResponse.json({ source: "WeatherAPI", days }, { status: 200 });
  } catch (err: any) {
    console.error("Astronomy route error:", err);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
