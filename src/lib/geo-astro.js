// Funciones robustas para geocodificación y astronomía (sin romper la app)

export const fmtDate = (d) => {
  try {
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) throw new Error("Fecha inválida");
    return dt.toISOString().slice(0,10);
  } catch {
    return new Date().toISOString().slice(0,10);
  }
};

const toNumber = (v, fb=null) => {
  // Convierte a número y retorna fb si no es finito
  if (v === null || v === undefined) return fb;
  if (typeof v === "string" && v.trim() === "") return fb;
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

export async function geocode(q){
  // Sustituye esta función por tu geocodificador real si lo tienes (API).
  try{
    if (!q || typeof q !== "string" || !q.trim()) throw new Error("Consulta vacía");
    // Ejemplo tonto: si contiene "Lima", devuelve Lima; si no, default.
    const s = q.toLowerCase();
    if (s.includes("lima")){
      return { lat: -12.0464, lon: -77.0428, label: "Lima, Perú" };
    }
    // Valor por defecto seguro para no romper el flujo
    return { lat: -12.0464, lon: -77.0428, label: q.trim() };
  }catch(e){
    console.error("[geocode]", e);
    return null;
  }
}

export async function reverseGeocode(lat, lon){
  try{
    const la = toNumber(lat), lo = toNumber(lon);
    if (la == null || lo == null) throw new Error("Coordenadas inválidas");
    return { label: `(${la.toFixed(4)}, ${lo.toFixed(4)})` };
  }catch(e){
    console.error("[reverseGeocode]", e);
    return null;
  }
}

export const moonPhaseLabel = (phaseFrac) => {
  const p = Number.isFinite(Number(phaseFrac)) ? Number(phaseFrac) : 0;
  if (p < 0.03 || p > 0.97) return "Luna nueva";
  if (p < 0.22) return "Creciente";
  if (p < 0.28) return "Cuarto creciente";
  if (p < 0.47) return "Gibosa creciente";
  if (p < 0.53) return "Luna llena";
  if (p < 0.72) return "Gibosa menguante";
  if (p < 0.78) return "Cuarto menguante";
  return "Menguante";
};

// Mock de astronomía: devuelve un objeto con shape estable y no lanza excepciones.
export async function fetchAstronomy({ lat, lon, date }){
  try{
    const la = toNumber(lat), lo = toNumber(lon);
    if (la == null || lo == null) throw new Error("Coordenadas inválidas");
    const d = date ? new Date(date) : new Date();
    if (isNaN(d.getTime())) throw new Error("Fecha inválida");

    // 👉 Aquí puedes implementar el cálculo real o consultar una API externa.
    // Para evitar pantallas en blanco, devolvemos datos coherentes.
    const phaseFrac = 0.51; // simulado
    return {
      ok: true,
      date: fmtDate(d),
      lat: la,
      lon: lo,
      phaseFrac,
      phaseText: moonPhaseLabel(phaseFrac),
      sunrise: "06:00",
      sunset: "18:00",
    };
  }catch(e){
    console.error("[fetchAstronomy]", e);
    return {
      ok: false,
      error: e?.message || "Astronomía no disponible",
      date: fmtDate(new Date()),
      lat: null,
      lon: null,
      phaseFrac: null,
      phaseText: "—",
      sunrise: null,
      sunset: null,
    };
  }
}
