import React, { useEffect, useMemo, useState, useCallback } from "react";
import LocationPicker from "./components/LocationPicker.jsx";
import { fetchAstronomy, moonPhaseLabel } from "./lib/geo-astro.js";

/* ================== Utils & Defaults ================== */
const loadLS = (k, fb) => { try{ const r = localStorage.getItem(k); return r? JSON.parse(r):fb; }catch{ return fb; } };
const saveLS = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} };

const SPECIES_PRESETS = [
  { key:"juniperus", name:"Juniperus (enebro)", waterDays:5 },
  { key:"ficus", name:"Ficus", waterDays:3 },
  { key:"olmo", name:"Olmo chino", waterDays:4 },
  { key:"pino", name:"Pino", waterDays:6 },
  { key:"portulacaria", name:"Portulacaria", waterDays:7 },
];

const newId = () => Math.random().toString(36).slice(2,10);
const todayISO = () => new Date().toISOString().slice(0,10);
const toDate = (v) => { const d = v? new Date(v): null; return d && !isNaN(d.getTime()) ? d : null; };
const addDays = (iso, n) => { const d = toDate(iso) || new Date(); d.setDate(d.getDate() + (isFinite(n)? Number(n):0)); return d.toISOString().slice(0,10); };

/* ================== Form estable: evita perder el foco ================== */
const BonsaiForm = React.memo(function BonsaiForm({ form, onPatch, onSubmit, onCancel }) {
  // onPatch es estable (useCallback), así el componente no se “remonta” en cada tecla
  return (
    <div className="card">
      <h2>{form.id ? "Editar bonsái" : "Agregar bonsái"}</h2>
      <form
        onSubmit={onSubmit}
        style={{display:"grid", gap:10, gridTemplateColumns:"repeat(2, minmax(0,1fr))"}}
      >
        <input
          className="input"
          placeholder="Nombre"
          value={form.name}
          onChange={(e)=>onPatch({name:e.target.value})}
        />
        <select
          className="input"
          value={form.speciesKey}
          onChange={(e)=>onPatch({speciesKey:e.target.value})}
        >
          {SPECIES_PRESETS.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
        </select>
        <input
          className="input"
          type="date"
          value={form.acquired}
          onChange={(e)=>onPatch({acquired:e.target.value})}
        />
        <input
          className="input"
          placeholder="Maceta / sustrato"
          value={form.pot}
          onChange={(e)=>onPatch({pot:e.target.value})}
        />
        <input
          className="input"
          placeholder="Días entre riegos (opcional)"
          value={form.customWaterDays}
          onChange={(e)=>onPatch({customWaterDays:(e.target.value||"").replace(/[^0-9]/g,"")})}
        />
        <input
          className="input"
          placeholder="Notas"
          value={form.notes}
          onChange={(e)=>onPatch({notes:e.target.value})}
        />
        <div style={{gridColumn:"1 / -1", display:"flex", gap:8}}>
          <button className="btn primary" type="submit">{form.id? "Guardar":"Agregar"}</button>
          {form.id ? <button className="btn" type="button" onClick={onCancel}>Cancelar</button> : null}
        </div>
      </form>
    </div>
  );
});

/* ================== AstroBadge en el detalle ================== */
function AstroBadge({ coords }){
  const [state, setState] = useState({loading:true, err:null, data:null});

  useEffect(()=>{
    let cancel = false;
    async function run(){
      const lat = Number(coords && coords.lat);
      const lon = Number(coords && coords.lon);
      if (!isFinite(lat) || !isFinite(lon)) {
        setState({loading:false, err:"Configura una ubicación válida.", data:null});
        return;
      }
      setState({loading:true, err:null, data:null});
      const res = await fetchAstronomy({ lat, lon, date: new Date() });
      if (cancel) return;
      if (!res || !res.ok){ setState({loading:false, err: (res && res.error) || "No disponible", data:null}); }
      else { setState({loading:false, err:null, data:res}); }
    }
    run();
    return ()=>{ cancel = true; };
  }, [coords && coords.lat, coords && coords.lon]);

  // Reglas simples (ajústalas a tu criterio):
  // - Nueva / menguante fuerte: evitar trasplantes; poda ligera ok.
  // - Cuarto creciente / gibosa creciente: buen momento para poda de formación y alambrado.
  // - Llena ±1d: evita cortes fuertes.
  // - Cuarto menguante: trasplante más seguro (menos sangrado) en muchas especies.
  const tipsFor = (d) => {
    const p = Number(d.phaseFrac || 0);
    const label = d.phaseText || moonPhaseLabel(p);
    let prune = "Moderada";
    let wire  = "Buen momento";
    let repot = "Con cuidado";

    if (p < 0.05 || p > 0.95) { // nueva
      prune = "Ligera"; wire = "Ok"; repot = "Evitar";
    } else if (p >= 0.45 && p <= 0.55) { // llena
      prune = "Evitar cortes fuertes"; wire = "Ok"; repot = "Evitar";
    } else if (p >= 0.70 && p <= 0.80) { // cuarto menguante aprox.
      prune = "Ligera"; wire = "Ok"; repot = "Recomendado";
    } else if (p >= 0.20 && p <= 0.40) { // creciente
      prune = "Recomendado"; wire = "Recomendado"; repot = "Con cuidado";
    }

    return { label, prune, wire, repot };
  };

  if (state.loading) return <div className="card"><h2>Moon & care tips</h2><div className="muted">Cargando…</div></div>;
  if (state.err)     return <div className="card"><h2>Moon & care tips</h2><div className="muted">{state.err}</div></div>;

  const t = tipsFor(state.data);

  return (
    <div className="card">
      <h2>Moon & care tips</h2>
      <div style={{display:"grid", gap:8}}>
        <div><strong>Fecha:</strong> {state.data.date}</div>
        <div><strong>Fase:</strong> {t.label}{" "}
          {isFinite(Number(state.data.phaseFrac)) ? ("(" + (state.data.phaseFrac*100).toFixed(1) + "%)") : ""}</div>
        <div style={{display:"grid", gap:8, gridTemplateColumns:"repeat(3, minmax(0,1fr))"}}>
          <div className="card" style={{background:"#1b1b1b"}}><strong>Poda</strong><div className="muted">{t.prune}</div></div>
          <div className="card" style={{background:"#1b1b1b"}}><strong>Alambrado</strong><div className="muted">{t.wire}</div></div>
          <div className="card" style={{background:"#1b1b1b"}}><strong>Trasplante</strong><div className="muted">{t.repot}</div></div>
        </div>
        <small className="muted">Consejos generales; ajusta por especie/clima.</small>
      </div>
    </div>
  );
}

/* ================== App ================== */
export default function App(){
  /* ---- Estado raíz ---- */
  const [bonsais, setBonsais] = useState(loadLS("bonsais", []));
  const [logs, setLogs]       = useState(loadLS("careLogs", []));
  const [coords, setCoords]   = useState(loadLS("coords", { lat:-12.0464, lon:-77.0428, label:"Lima, Perú" }));

  useEffect(()=> saveLS("bonsais", bonsais), [bonsais]);
  useEffect(()=> saveLS("careLogs", logs), [logs]);
  useEffect(()=> saveLS("coords", coords), [coords]);

  /* ---- Derivados ---- */
  const lastWaterByBonsai = useMemo(()=>{
    const m = new Map();
    for (const l of logs){ if (l.type !== "riego") continue;
      const prev = m.get(l.bonsaiId);
      if (!prev || l.date > prev.date) m.set(l.bonsaiId, l);
    }
    return m;
  }, [logs]);

  const withNextWater = useMemo(()=>{
    return bonsais.map(b=>{
      const preset = SPECIES_PRESETS.find(s=>s.key===b.speciesKey);
      const baseDays = isFinite(b.customWaterDays) ? Number(b.customWaterDays) : (preset && preset.waterDays) || 4;
      const last = (lastWaterByBonsai.get(b.id)||{}).date || b.acquired || todayISO();
      const next = addDays(last, baseDays);
      return Object.assign({}, b, { baseDays, lastWaterDate:last, nextWaterDate:next });
    });
  }, [bonsais, lastWaterByBonsai]);

  const dueToday = useMemo(()=>{
    const t = todayISO();
    return withNextWater.filter(b => b.nextWaterDate <= t);
  }, [withNextWater]);

  /* ---- Formulario (con handlers estables) ---- */
  const [form, setForm] = useState({
    id:null, name:"", speciesKey:"juniperus",
    acquired: todayISO(), pot:"", notes:"", customWaterDays:""
  });
  const patchForm = useCallback((p)=> setForm(f=>Object.assign({}, f, p)), []);
  const resetForm = useCallback(()=> setForm({
    id:null, name:"", speciesKey:"juniperus",
    acquired: todayISO(), pot:"", notes:"", customWaterDays:""
  }), []);

  const onSubmitBonsai = useCallback((e)=>{
    e && e.preventDefault && e.preventDefault();
    const id = form.id || newId();
    const rec = {
      id,
      name: (form.name||"").trim() || "Bonsái",
      speciesKey: form.speciesKey,
      acquired: form.acquired || todayISO(),
      pot: form.pot || "",
      notes: form.notes || "",
      customWaterDays: form.customWaterDays === "" ? undefined : Math.max(1, Number(form.customWaterDays)||0)
    };
    setBonsais(prev=>{
      const idx = prev.findIndex(x=>x.id===id);
      if (idx>=0){ const next = prev.slice(); next[idx]=rec; return next; }
      return [rec, ...prev];
    });
    resetForm();
  }, [form, resetForm]);

  const editBonsai = (b) => setForm({
    id:b.id, name:b.name, speciesKey:b.speciesKey, acquired:b.acquired||todayISO(),
    pot:b.pot||"", notes:b.notes||"", customWaterDays: b.customWaterDays!=null ? b.customWaterDays : ""
  });
  const deleteBonsai = (id) => {
    if (!confirm("¿Eliminar este bonsái y sus registros?")) return;
    setBonsais(prev=>prev.filter(x=>x.id!==id));
    setLogs(prev=>prev.filter(x=>x.bonsaiId!==id));
  };

  const quickLog = (bonsaiId, type) => {
    const types = ["riego","fertilización","poda","observación"];
    if (types.indexOf(type)===-1) return;
    const note = type==="observación" ? (prompt("Observación:") || "") : "";
    const rec = { id:newId(), bonsaiId, type, date:todayISO(), note };
    setLogs(prev => [rec, ...prev]);
  };
  const logsFor = (bonsaiId) => logs.filter(l=>l.bonsaiId===bonsaiId).slice(0,6);

  /* ---- Navegación simple (lista/detalle) ---- */
  const [view, setView] = useState({ name:"list" }); // {name:"list"} | {name:"detail", id:string}
  const openDetail = (id) => setView({ name:"detail", id });
  const backToList = () => setView({ name:"list" });

  /* ================== Páginas ================== */

  function PageList(){
    return (
      <>
        <h1>My Trees</h1>

        {/* Lista */}
        <div className="tree-list">
          {withNextWater.length===0 ? (
            <div className="card center muted">Aún no agregas bonsáis.</div>
          ) : withNextWater.map(b=>{
            const speciesName = (SPECIES_PRESETS.find(s=>s.key===b.speciesKey)||{}).name || b.speciesKey;
            return (
              <button key={b.id} className="tree-card" onClick={()=>openDetail(b.id)} style={{textAlign:"left"}}>
                <div className="tree-info">
                  <h3>{b.name}</h3>
                  <div className="subtitle">{speciesName}</div>
                  <div className="last">Last watered: {b.lastWaterDate || "—"}</div>
                </div>
                <div className="tree-thumb"><div style={{fontSize:22}}>🪴</div></div>
              </button>
            );
          })}
        </div>

        <div className="spacer-12"></div>

        {/* Form: estable, no pierde foco */}
        <BonsaiForm
          form={form}
          onPatch={patchForm}
          onSubmit={onSubmitBonsai}
          onCancel={resetForm}
        />
      </>
    );
  }

  function PageDetail({ id }){
    const b = withNextWater.find(x=>x.id===id);
    if (!b) return (
      <div className="card">
        <button className="btn" onClick={backToList}>← Volver</button>
        <div className="muted">No encontrado.</div>
      </div>
    );

    const speciesName = (SPECIES_PRESETS.find(s=>s.key===b.speciesKey)||{}).name || b.speciesKey;

    return (
      <>
        <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:10}}>
          <button className="btn" onClick={backToList}>← My Trees</button>
          <h1 style={{margin:0}}>{b.name}</h1>
        </div>

        {/* Hero */}
        <div className="card" style={{display:"grid", gridTemplateColumns:"1fr auto", gap:12, alignItems:"center"}}>
          <div>
            <div style={{fontSize:18, fontWeight:600}}>{speciesName}</div>
            <div className="muted" style={{marginTop:6}}>
              Last Watered: {b.lastWaterDate || "—"} · Next: {b.nextWaterDate}
            </div>
          </div>
          <div className="tree-thumb" title={speciesName}><div style={{fontSize:22}}>🪴</div></div>
        </div>

        <div className="spacer-12"></div>

        {/* Acciones rápidas */}
        <div className="card">
          <h2>Acciones</h2>
          <div className="tile-grid" style={{marginTop:10}}>
            <div className="tile">
              <div>💧</div>
              <div className="title"><button className="btn primary" onClick={()=>quickLog(b.id, "riego")}>Registrar riego</button></div>
            </div>
            <div className="tile">
              <div>🧪</div>
              <div className="title"><button className="btn" onClick={()=>quickLog(b.id, "fertilización")}>Fertilización</button></div>
            </div>
            <div className="tile">
              <div>✂️</div>
              <div className="title"><button className="btn" onClick={()=>quickLog(b.id, "poda")}>Poda</button></div>
            </div>
            <div className="tile">
              <div>📝</div>
              <div className="title"><button className="btn" onClick={()=>quickLog(b.id, "observación")}>Observación</button></div>
            </div>
          </div>
        </div>

        <div className="spacer-12"></div>

        {/* 🔭 Astronomía integrada al detalle */}
        <AstroBadge coords={coords} />

        <div className="spacer-12"></div>

        {/* Historial corto */}
        <div className="card">
          <h2>Historial</h2>
          {logsFor(b.id).length===0 ? (
            <div className="muted">Sin registros todavía.</div>
          ) : (
            <table>
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Nota</th></tr></thead>
              <tbody>
                {logsFor(b.id).map(l=>(
                  <tr key={l.id}><td>{l.date}</td><td>{l.type}</td><td>{l.note || "—"}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="spacer-12"></div>

        {/* Editar / Eliminar */}
        <div className="card" style={{display:"flex", gap:8, flexWrap:"wrap"}}>
          <button className="btn" onClick={()=>{ editBonsai(b); window.scrollTo(0,0); backToList(); }}>Editar</button>
          <button className="btn" onClick={()=>deleteBonsai(b.id)}>Eliminar</button>
        </div>
      </>
    );
  }

  return (
    <div className="container">
      {view.name === "list"   && <PageList/>}
      {view.name === "detail" && <PageDetail id={view.id}/>}

      {/* Ubicación (para el módulo lunar del detalle) */}
      <div className="spacer-12"></div>
      <div className="card">
        <h2>Ubicación</h2>
        <LocationPicker value={coords} onChange={setCoords}/>
        <p className="muted" style={{marginTop:6}}>Se usa para calcular las fases y sugerencias de cuidado.</p>
      </div>
    </div>
  );
}
