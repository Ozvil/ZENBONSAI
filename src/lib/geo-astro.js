// src/lib/geo-astro.js
// Versión ES2018 compatible (sin optional chaining / nullish / etc.)

// Formatea una fecha a YYYY-MM-DD con tolerancia a errores
export const fmtDate = function(d) {
  try {
    var dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) throw new Error("Fecha inválida");
    return dt.toISOString().slice(0, 10);
  } catch (e) {
    var now = new Date();
    return now.toISOString().slice(0, 10);
  }
};

// Convierte a número; si no es finito, devuelve fallback (fb)
function toNumber(v, fb) {
  if (fb === undefined) fb = null;
  if (v === null || v === undefined) return fb;
  if (typeof v === "string" && v.trim() === "") return fb;
  var n = Number(v);
  return isFinite(n) ? n : fb;
}

// Geocodificador mock seguro (sustituye por tu API real si quieres)
export async function geocode(q) {
  try {
    if (!q || typeof q !== "string" || !q.trim()) throw new Error("Consulta vacía");
    var s = q.toLowerCase();
    if (s.indexOf("lima") !== -1) {
      return { lat: -12.0464, lon: -77.0428, label: "Lima, Perú" };
    }
    return { lat: -12.0464, lon: -77.0428, label: q.trim() };
  } catch (e) {
    console.error("[geocode]", e);
    return null;
  }
}

export async function reverseGeocode(lat, lon) {
  try {
    var la = toNumber(lat, null);
    var lo = toNumber(lon, null);
    if (la === null || lo === null) throw new Error("Coordenadas inválidas");
    return { label: "(" + la.toFixed(4) + ", " + lo.toFixed(4) + ")" };
  } catch (e) {
    console.error("[reverseGeocode]", e);
    return null;
  }
}

// Texto de fase lunar a partir de fracción [0..1]
export const moonPhaseLabel = function(phaseFrac) {
  var p = Number(phaseFrac);
  if (!isFinite(p)) p = 0;
  if (p < 0.03 || p > 0.97) return "Luna nueva";
  if (p < 0.22) return "Creciente";
  if (p < 0.28) return "Cuarto creciente";
  if (p < 0.47) return "Gibosa creciente";
  if (p < 0.53) return "Luna llena";
  if (p < 0.72) return "Gibosa menguante";
  if (p < 0.78) return "Cuarto menguante";
  return "Menguante";
};

// Astronomía mock segura (no lanza excepciones)
export async function fetchAstronomy(args) {
  try {
    var lat = toNumber(args && args.lat, null);
    var lon = toNumber(args && args.lon, null);
    if (lat === null || lon === null) throw new Error("Coordenadas inválidas");
    var d = args && args.date ? new Date(args.date) : new Date();
    if (isNaN(d.getTime())) throw new Error("Fecha inválida");

    // Sustituye por cálculo/API real si deseas
    var phaseFrac = 0.51;
    return {
      ok: true,
      date: fmtDate(d),
      lat: lat,
      lon: lon,
      phaseFrac: phaseFrac,
      phaseText: moonPhaseLabel(phaseFrac),
      sunrise: "06:00",
      sunset: "18:00"
    };
  } catch (e) {
    console.error("[fetchAstronomy]", e);
    return {
      ok: false,
      error: e && e.message ? e.message : "Astronomía no disponible",
      date: fmtDate(new Date()),
      lat: null,
      lon: null,
      phaseFrac: null,
      phaseText: "-",
      sunrise: null,
      sunset: null
    };
  }
}
