// src/components/LunarCalendar.jsx
import React, { useEffect, useState } from "react";
import "./lunar.css";
import { fetchAstronomy } from "../lib/geo-astro";

export default function LunarCalendar({
  coords,               // { lat, lon }
  checked,              // boolean (mostrar/ocultar)
  onCheckedChange,      // (next:boolean)=>void
  title="Calendario lunar"
}){
  const [loading, setLoading] = useState(false);
  const [astro, setAstro] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(()=>{
    let cancel = false;
    async function run(){
      setErr(null); setAstro(null);
      if (!checked) return;
      const lat = Number(coords?.lat), lon = Number(coords?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)){
        setErr("Coordenadas inválidas. Configura una ubicación válida.");
        return;
      }
      setLoading(true);
      try{
        const res = await fetchAstronomy({ lat, lon, date: new Date() });
        if (cancel) return;
        if (!res?.ok){
          setErr(res?.error || "No se pudo cargar el calendario lunar.");
        }else{
          setAstro(res);
        }
      }catch(e){
        if (!cancel) setErr(e?.message || "Error desconocido");
      }finally{
        if (!cancel) setLoading(false);
      }
    }
    run();
    return ()=>{ cancel = true; };
  }, [coords?.lat, coords?.lon, checked]);

  return (
    <div className="lb-block">
      <label className="lb-toggle">
        <input
          type="checkbox"
          checked={!!checked}
          onChange={(e)=>onCheckedChange?.(e.target.checked)}
        />
        <span>Prender calendario lunar</span>
      </label>

      {checked && (
        <div className="lb-card">
          <h2 className="lb-title">{title}</h2>
          {loading && <p>Cargando calendario…</p>}
          {err && <div className="lb-alert"><strong>Error:</strong> {err}</div>}
          {!loading && !err && astro && (
            <div className="lb-grid">
              <div><strong>Fecha:</strong> {astro.date}</div>
              <div>
                <strong>Fase:</strong> {astro.phaseText}
                {Number.isFinite(astro.phaseFrac) ? ` (${(astro.phaseFrac*100).toFixed(1)}%)` : ""}
              </div>
              <div><strong>Amanecer/Puesta:</strong> {astro.sunrise || "—"} / {astro.sunset || "—"}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
