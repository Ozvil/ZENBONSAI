import React, { useEffect, useState } from "react";
import "./zen.css";
import {
  geocode,
  reverseGeocode,
  fetchAstronomy,
  moonPhaseLabel,
  fmtDate
} from "./lib/geo-astro";

const loadLS = (k, fb) => {
  try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : fb; }
  catch { return fb; }
};
const saveLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export default function App(){
  const [locText, setLocText] = useState(loadLS("locText", ""));
  const [coords, setCoords] = useState(loadLS("coords", { lat: -12.0464, lon: -77.0428 }));
  const [locLabel, setLocLabel] = useState(loadLS("locLabel", "Lima, Perú"));
  const [useLunar, setUseLunar] = useState(loadLS("useLunar", false));
  const [astro, setAstro] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uiError, setUiError] = useState(null);

  useEffect(()=> saveLS("locText", locText), [locText]);
  useEffect(()=> saveLS("coords", coords), [coords]);
  useEffect(()=> saveLS("locLabel", locLabel), [locLabel]);
  useEffect(()=> saveLS("useLunar", useLunar), [useLunar]);

  useEffect(()=>{
    let abort = false;
    async function run(){
      setUiError(null);
      if (!useLunar){ setAstro(null); return; }

      const lat = toNum(coords?.lat), lon = toNum(coords?.lon);
      if (lat == null || lon == null){
        setUiError("Coordenadas inválidas. Configura una ubicación válida.");
        setAstro(null);
        return;
      }

      setLoading(true);
      try{
        const res = await fetchAstronomy({ lat, lon, date: new Date() });
        if (abort) return;
        if (!res?.ok){
          setUiError(res?.error || "No se pudo cargar el calendario lunar.");
          setAstro(null);
        } else {
          setAstro(res);
        }
      }catch(e){
        if (!abort){
          console.error(e);
          setUiError(e?.message || "Error desconocido");
          setAstro(null);
        }
      }finally{
        if (!abort) setLoading(false);
      }
    }
    run();
    return ()=> { abort = true; };
  }, [coords, useLunar]);

  const handleFindLocation = async () => {
    setUiError(null);
    try{
      if (!locText.trim()) throw new Error("Ingresa una ciudad o dirección");
      const r = await geocode(locText.trim());
      if (!r) throw new Error("No se pudo obtener coordenadas");
      if (!Number.isFinite(r.lat) || !Number.isFinite(r.lon)) throw new Error("Coordenadas inválidas del geocodificador");
      setCoords({ lat: r.lat, lon: r.lon });
      setLocLabel(r.label || `${r.lat}, ${r.lon}`);
    }catch(e){
      setUiError(e?.message || "Error buscando ubicación");
    }
  };

  const handleToggleLunar = () => {
    const lat = toNum(coords?.lat), lon = toNum(coords?.lon);
    if (!useLunar && (lat == null || lon == null)){
      setUiError("Primero configura una ubicación válida");
      return;
    }
    setUseLunar(v => !v);
  };

  return (
    <div className="container">
      <h1>ZEN Bonsai</h1>

      <section className="row">
        <input
          className="input"
          placeholder="Ciudad / dirección (p. ej., Lima, Perú)"
          value={locText}
          onChange={e=>setLocText(e.target.value)}
        />
        <button className="btn" onClick={handleFindLocation}>OK</button>
      </section>

      <p className="muted">
        Ubicación actual: <strong>{locLabel}</strong>{" "}
        <small>
          ({Number(coords?.lat)?.toFixed?.(4)}, {Number(coords?.lon)?.toFixed?.(4)})
        </small>
      </p>

      <label className="toggle">
        <input type="checkbox" checked={useLunar} onChange={handleToggleLunar} />
        <span>Prender calendario lunar</span>
      </label>

      {uiError && (
        <div className="alert">
          <strong>Error:</strong> {uiError}
        </div>
      )}

      {useLunar && (
        <div className="card">
          <h2>Calendario lunar</h2>
          {loading && <p>Cargando calendario…</p>}
          {!loading && astro && (
            <>
              <p><strong>Fecha:</strong> {astro.date}</p>
              <p>
                <strong>Fase:</strong> {astro.phaseText}{" "}
                {Number.isFinite(astro.phaseFrac) ? `(${(astro.phaseFrac*100).toFixed(1)}%)` : ""}
              </p>
              <p><strong>Amanecer/Puesta:</strong> {astro.sunrise || "—"} / {astro.sunset || "—"}</p>
            </>
          )}
          {!loading && !astro && !uiError && (
            <p>No hay datos de astronomía disponibles.</p>
          )}
        </div>
      )}
    </div>
  );
}
