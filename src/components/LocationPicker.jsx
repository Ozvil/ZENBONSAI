import React, { useState } from "react";
import "./lunar.css";
import { geocode } from "../lib/geo-astro";

function LocationPicker({
  value,          // { lat, lon, label }
  onChange,       // (next) => void
  placeholder = "Ciudad / dirección (p. ej., Lima, Perú)"
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function handleOK() {
    setErr(null);
    try {
      const t = (text || "").trim();
      if (!t) throw new Error("Ingresa una ciudad o dirección");
      setBusy(true);
      const r = await geocode(t);
      if (!r) throw new Error("No se pudo obtener coordenadas");
      if (!isFinite(Number(r.lat)) || !isFinite(Number(r.lon))) {
        throw new Error("Coordenadas inválidas");
      }
      if (onChange) {
        onChange({ lat: r.lat, lon: r.lon, label: r.label || (r.lat + ", " + r.lon) });
      }
      setText("");
    } catch (e) {
      setErr(e && e.message ? e.message : "Error buscando ubicación");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lb-block">
      <div className="lb-row">
        <input
          className="lb-input"
          placeholder={placeholder}
          value={text}
          onChange={(e)=>setText(e.target.value)}
          disabled={busy}
        />
        <button className="lb-btn" onClick={handleOK} disabled={busy}>
          {busy ? "…" : "OK"}
        </button>
      </div>

      {value && value.label ? (
        <p className="lb-muted">
          Ubicación: <strong>{value.label}</strong>{" "}
          <small>({Number(value.lat).toFixed(4)}, {Number(value.lon).toFixed(4)})</small>
        </p>
      ) : null}

      {err ? <div className="lb-alert"><strong>Error:</strong> {err}</div> : null}
    </div>
  );
}

export { LocationPicker };
export default LocationPicker;

