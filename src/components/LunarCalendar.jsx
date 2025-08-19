import React, { useEffect, useState } from "react";
import "./lunar.css";
import { fetchAstronomy } from "../lib/geo-astro";

function LunarCalendar({
  coords,               // { lat, lon }
  checked,              // boolean
  onCheckedChange,      // (next:boolean)=>void
  title = "Calendario lunar"
}) {
  const [loading, setLoading] = useState(false);
  const [astro, setAstro] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(function(){
    var cancel = false;
    async function run(){
      setErr(null);
      setAstro(null);
      if (!checked) return;

      var lat = Number(coords && coords.lat);
      var lon = Number(coords && coords.lon);
      if (!isFinite(lat) || !isFinite(lon)) {
        setErr("Coordenadas inválidas. Configura una ubicación válida.");
        return;
      }

      setLoading(true);
      try{
        const res = await fetchAstronomy({ lat: lat, lon: lon, date: new Date() });
        if (cancel) return;
        if (!res || !res.ok) {
          setErr((res && res.error) || "No se pudo cargar el calendario lunar.");
        } else {
          setAstro(res);
        }
      } catch (e) {
        if (!cancel) setErr((e && e.message) || "Error desconocido");
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    run();
    return function(){ cancel = true; };
  }, [checked, coords && coords.lat, coords && coords.lon]);

  return (
    <div className="lb-block">
      <label className="lb-toggle">
        <input
          type="checkbox"
          checked={!!checked}
          onChange={(e)=> onCheckedChange && onCheckedChange(e.target.checked)}
        />
        <span>Prender calendario lunar</span>
      </label>

      {checked ? (
        <div className="lb-card">
          <h2 className="lb-title">{title}</h2>
          {loading ? <p>Cargando calendario…</p> : null}
          {err ? <div className="lb-alert"><strong>Error:</strong> {err}</div> : null}
          {!loading && !err && astro ? (
            <div className="lb-grid">
              <div><strong>Fecha:</strong> {astro.date}</div>
              <div>
                <strong>Fase:</strong> {astro.phaseText}
                {isFinite(Number(astro.phaseFrac)) ? (" (" + (astro.phaseFrac * 100).toFixed(1) + "%)") : ""}
              </div>
              <div><strong>Amanecer/Puesta:</strong> {(astro.sunrise || "—")} / {(astro.sunset || "—")}</div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export { LunarCalendar };
export default LunarCalendar;
