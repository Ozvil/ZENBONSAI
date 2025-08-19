import React, { useEffect, useMemo, useState } from "react";
import "./zen.css";
import LocationPicker from "./components/LocationPicker";
import LunarCalendar from "./components/LunarCalendar";

/* ================== Utils: LocalStorage ================== */
const loadLS = (k, fb) => {
  try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : fb; }
  catch { return fb; }
};
const saveLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* ================== Tipos y defaults ================== */
const SPECIES_PRESETS = [
  { key: "juniperus", name: "Juniperus (enebro)", waterDays: 5, notes: "Exposición alta luz; no encharcar." },
  { key: "ficus",     name: "Ficus",               waterDays: 3, notes: "Tolera interior; pulverizar hojas." },
  { key: "olmo",      name: "Olmo chino",          waterDays: 4, notes: "Buena luz indirecta; revisar sustrato." },
  { key: "pino",      name: "Pino",                waterDays: 6, notes: "Prefiere sustrato drenante; riegos espaciados." },
  { key: "portulacaria", name: "Portulacaria",     waterDays: 7, notes: "Suculenta; dejar secar bien entre riegos." },
];

const newId = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0,10);

const toDate = (v) => {
  const d = v ? new Date(v) : null;
  return d && !isNaN(d.getTime()) ? d : null;
};
const addDays = (isoDate, n) => {
  const d = toDate(isoDate) ?? new Date();
  d.setDate(d.getDate() + (Number.isFinite(n) ? n : 0));
  return d.toISOString().slice(0,10);
};

/* ================== Componentes pequeños ================== */
function Tabs({ value, onChange, items }){
  return (
    <div>
      <div style={{display:"flex", gap:8, marginBottom:12, flexWrap:"wrap"}}>
        {items.map(it => (
          <button
            key={it.key}
            className="btn"
            style={{
              padding:"8px 12px",
              background: value===it.key ? "#f3f4f6" : "white",
              borderColor: value===it.key ? "#bbb" : "#ddd"
            }}
            onClick={()=>onChange(it.key)}
          >
            {it.label}
          </button>
        ))}
      </div>
      <div>
        {items.find(it => it.key === value)?.render()}
      </div>
    </div>
  );
}

function Empty({ children }) {
  return (
    <div className="card" style={{textAlign:"center", color:"#666"}}>
      {children}
    </div>
  );
}

/* ================== App principal ================== */
export default function App(){
  /* ---- Estado raíz ---- */
  const [bonsais, setBonsais]   = useState(loadLS("bonsais", []));     // [{id, name, speciesKey, acquired, pot, notes, customWaterDays?}]
  const [logs, setLogs]         = useState(loadLS("careLogs", []));    // [{id, bonsaiId, type, date, note}]
  const [coords, setCoords]     = useState(loadLS("coords", { lat: -12.0464, lon: -77.0428, label: "Lima, Perú" }));
  const [showLunar, setShowLunar] = useState(loadLS("useLunar", false));

  useEffect(()=> saveLS("bonsais", bonsais), [bonsais]);
  useEffect(()=> saveLS("careLogs", logs), [logs]);
  useEffect(()=> saveLS("coords", coords), [coords]);
  useEffect(()=> saveLS("useLunar", showLunar), [showLunar]);

  /* ---- Derivados ---- */
  const lastWaterByBonsai = useMemo(()=>{
    const map = new Map();
    for (const l of logs) {
      if (l.type !== "riego") continue;
      const prev = map.get(l.bonsaiId);
      if (!prev || (l.date > prev.date)) map.set(l.bonsaiId, l);
    }
    return map; // bonsaiId -> last water log
  }, [logs]);

  const withNextWater = useMemo(()=>{
    return bonsais.map(b => {
      const preset = SPECIES_PRESETS.find(s=>s.key===b.speciesKey);
      const baseDays = Number.isFinite(b.customWaterDays) ? b.customWaterDays
                        : (preset?.waterDays ?? 4);
      const last = lastWaterByBonsai.get(b.id)?.date || b.acquired || todayISO();
      const next = addDays(last, baseDays);
      return { ...b, baseDays, lastWaterDate: last, nextWaterDate: next };
    });
  }, [bonsais, lastWaterByBonsai]);

  const dueToday = useMemo(()=>{
    const t = todayISO();
    return withNextWater.filter(b => b.nextWaterDate <= t);
  }, [withNextWater]);

  /* ---- CRUD Bonsáis ---- */
  const [form, setForm] = useState({
    id: null,
    name: "",
    speciesKey: "juniperus",
    acquired: todayISO(),
    pot: "",
    notes: "",
    customWaterDays: ""
  });
  const resetForm = () => setForm({
    id: null, name: "", speciesKey: "juniperus",
    acquired: todayISO(), pot: "", notes: "", customWaterDays: ""
  });

  const onSubmitBonsai = (e) => {
    e?.preventDefault?.();
    const id = form.id || newId();
    const rec = {
      id,
      name: form.name.trim() || "Bonsái sin nombre",
      speciesKey: form.speciesKey,
      acquired: form.acquired || todayISO(),
      pot: form.pot || "",
      notes: form.notes || "",
      customWaterDays: form.customWaterDays === "" ? undefined : Math.max(1, Number(form.customWaterDays)||0)
    };
    setBonsais(prev=>{
      const idx = prev.findIndex(x=>x.id===id);
      if (idx>=0){
        const next = prev.slice(); next[idx] = rec; return next;
      }
      return [rec, ...prev];
    });
    resetForm();
  };

  const editBonsai = (b) => setForm({
    id: b.id,
    name: b.name,
    speciesKey: b.speciesKey,
    acquired: b.acquired || todayISO(),
    pot: b.pot || "",
    notes: b.notes || "",
    customWaterDays: b.customWaterDays ?? ""
  });

  const deleteBonsai = (id) => {
    if (!confirm("¿Eliminar este bonsái y sus registros?")) return;
    setBonsais(prev => prev.filter(x=>x.id!==id));
    setLogs(prev => prev.filter(x=>x.bonsaiId!==id));
  };

  /* ---- Registros de cuidado ---- */
  const quickLog = (bonsaiId, type) => {
    const types = ["riego", "fertilización", "poda", "observación"];
    if (!types.includes(type)) return;
    const note = type==="observación" ? prompt("Observación:") || "" : "";
    const rec = { id: newId(), bonsaiId, type, date: todayISO(), note };
    setLogs(prev => [rec, ...prev]);
  };

  const logsFor = (bonsaiId) => logs.filter(l => l.bonsaiId===bonsaiId).slice(0, 8);

  /* ---- Pestañas / Vistas ---- */
  const [tab, setTab] = useState("hoy");

  const TabHoy = () => (
    <div className="card">
      <h2 style={{marginTop:0}}>Hoy</h2>
      {dueToday.length === 0 ? (
        <Empty>Sin riegos pendientes por hoy. ¡Todo bajo control! 🌿</Empty>
      ) : (
        <table style={{width:"100%", borderCollapse:"collapse"}}>
          <thead>
            <tr>
              <th style={{textAlign:"left", padding:"8px 0"}}>Bonsái</th>
              <th style={{textAlign:"left", padding:"8px 0"}}>Especie</th>
              <th style={{textAlign:"left", padding:"8px 0"}}>Últ. riego</th>
              <th style={{textAlign:"left", padding:"8px 0"}}>Cada</th>
              <th style={{textAlign:"left", padding:"8px 0"}}>Próx. riego</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {dueToday.map(b=>(
              <tr key={b.id} style={{borderTop:"1px solid #eee"}}>
                <td style={{padding:"8px 0"}}>{b.name}</td>
                <td style={{padding:"8px 0"}}>{SPECIES_PRESETS.find(s=>s.key===b.speciesKey)?.name || b.speciesKey}</td>
                <td style={{padding:"8px 0"}}>{b.lastWaterDate || "—"}</td>
                <td style={{padding:"8px 0"}}>{b.baseDays} días</td>
                <td style={{padding:"8px 0"}}>{b.nextWaterDate}</td>
                <td style={{padding:"8px 0"}}>
                  <button className="btn" onClick={()=>quickLog(b.id, "riego")}>Registrar riego</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const TabColeccion = () => (
    <div className="card">
      <h2 style={{marginTop:0}}>Mi colección</h2>

      <form onSubmit={onSubmitBonsai} style={{display:"grid", gap:8, gridTemplateColumns:"repeat(2, minmax(0,1fr))"}}>
        <input className="input" placeholder="Nombre" value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))}/>
        <select className="input" value={form.speciesKey} onChange={e=>setForm(f=>({...f, speciesKey:e.target.value}))}>
          {SPECIES_PRESETS.map(s=> <option key={s.key} value={s.key}>{s.name}</option>)}
        </select>
        <input className="input" type="date" value={form.acquired} onChange={e=>setForm(f=>({...f, acquired:e.target.value}))}/>
        <input className="input" placeholder="Maceta / sustrato" value={form.pot} onChange={e=>setForm(f=>({...f, pot:e.target.value}))}/>
        <input className="input" placeholder="Días entre riegos (opcional)" value={form.customWaterDays}
               onChange={e=>setForm(f=>({...f, customWaterDays:e.target.value.replace(/[^\d]/g,"")}))}/>
        <input className="input" placeholder="Notas" value={form.notes} onChange={e=>setForm(f=>({...f, notes:e.target.value}))}/>
        <div style={{gridColumn:"1 / -1", display:"flex", gap:8}}>
          <button className="btn" type="submit">{form.id ? "Guardar cambios" : "Agregar bonsái"}</button>
          {form.id && <button className="btn" type="button" onClick={resetForm}>Cancelar</button>}
        </div>
      </form>

      <div style={{height:12}}/>

      {bonsais.length===0 ? (
        <Empty>Aún no agregas bonsáis. Empieza con el formulario de arriba.</Empty>
      ) : (
        <div className="card" style={{background:"#fafafa"}}>
          <table style={{width:"100%", borderCollapse:"collapse"}}>
            <thead>
              <tr>
                <th style={{textAlign:"left", padding:"8px 0"}}>Bonsái</th>
                <th style={{textAlign:"left", padding:"8px 0"}}>Especie</th>
                <th style={{textAlign:"left", padding:"8px 0"}}>Cada</th>
                <th style={{textAlign:"l
