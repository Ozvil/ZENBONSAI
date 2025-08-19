import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import LocationPicker from "./components/LocationPicker.jsx";
import { fetchAstronomy, moonPhaseLabel } from "./lib/geo-astro.js";

/* ============== Utils ============== */
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

/* ============== Form con estado interno (no pierde foco) ============== */
const BonsaiForm = React.memo(function BonsaiForm({ seed, onSubmit, onCancel }) {
  const [form, setForm] = useState(()=> seed || {
    id:null, name:"", speciesKey:"juniperus", acquired: todayISO(),
    pot:"", notes:"", customWaterDays:""
  });

  // si cambia la semilla (p.ej. “Editar”), sincronizamos
  useEffect(()=>{ setForm(seed || {
    id:null, name:"", speciesKey:"juniperus", acquired: todayISO(),
    pot:"", notes:"", customWaterDays:""
  }); }, [seed && seed.id]); // dep. por id para no resetear mientras escribes

  const nameRef = useRef(null);
  useEffect(()=>{ if (nameRef.current && document.activeElement !== nameRef.current) nameRef.current.focus(); }, [form.id]);

  const patch = (p) => setForm(f => Object.assign({}, f, p));

  const submit = (e) => {
    e && e.preventDefault && e.preventDefault();
    const data = {
      id: form.id || newId(),
      name: (form.name || "").trim() || "Bonsái",
      speciesKey: form.speciesKey,
      acquired: form.acquired || todayISO(),
      pot: form.pot || "",
      notes: form.notes || "",
      customWaterDays: form.customWaterDays === "" ? undefined : Math.max(1, Number(form.customWaterDays)||0)
    };
    onSubmit && onSubmit(data);
  };

  return (
    <div className="card">
      <h2>{form.id ? "Editar bonsái" : "Agregar bonsái"}</h2>
      <form onSubmit={submit}
            style={{display:"grid", gap:10, gridTemplateColumns:"repeat(2, minmax(0,1fr))"}}>
        <input
          ref={nameRef}
          className="input"
          placeholder="Nombre"
          value={form.name}
          onChange={(e)=>patch({name:e.target.value})}
        />
        <select
          className="input"
          value={form.speciesKey}
          onChange={(e)=>patch({speciesKey:e.target.value})}
        >
          {SPECIES_PRESETS.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
        </select>
        <input
          className="input" type="date" value={form.acquired}
          onChange={(e)=>patch({acquired:e.target.value})}
        />
        <input
          className="input" placeholder="Maceta / sustrato" value={form.pot}
          onChange={(e)=>patch({pot:e.target.value})}
        />
        <input
          className="input" placeholder="Días entre riegos (opcional)" value={form.customWaterDays}
          onChange={(e)=>patch({customWaterDays:(e.target.value||"").replace(/[^0-9]/g,"")})}
        />
        <input
          className="input" placeholder="Notas" value={form.notes}
          onChange={(e)=>patch({notes:e.target.value})}
        />
        <div style={{gridColumn:"1 / -1", display:"flex", gap:8}}>
          <button className="btn primary" type="submit">{form.id? "Guardar":"Agregar"}</button>
          {form.id ? <button className="btn" type="button" onClick={onCancel}>Cancelar</button> : null}
        </div>
      </form>
    </div>
  );
});

/* ============== Astronomía en detalle ============== */
function AstroBadge({ coords }){
  const [state, setState] = useState({loading:true, err:null, data:null});
  useEffect(()=>{
    let cancel = false;
    async function run(){
      const lat = Number(coords && coords.lat), lon = Number(coords && coords.lon);
      if (!isFinite(lat) || !isFinite(lon)) { setState({loading:false, err:"Configura una ubicación válida.", data:null}); return; }
      setState({loading:true, err:null, data:null});
      const res = await fetchAstronomy({ lat, lon, date: new Date() });
      if (cancel) return;
      if (!res || !res.ok) setState({loading:false, err:(res && res.error) || "No disponible", data:null});
      else setState({loading:false, err:null, data:res});
    }
    run(); return ()=>{ cancel = true; };
  }, [coords && coords.lat, coords && coords.lon]);

  const tipsFor = (d) => {
    const p = Number(d.phaseFrac || 0);
    const label = d.phaseText || moonPhaseLabel(p);
    let prune="Moderada", wire="Buen momento", repot="Con cuidado";
    if (p < 0.05 || p > 0.95) { prune="Ligera"; wire="Ok"; repot="Evitar"; }
    else if (p >= 0.45 && p <= 0.55) { prune="Evitar cortes fuertes"; wire="Ok"; repot="Evitar"; }
    else if (p >= 0.70 && p <= 0.80) { prune="Ligera"; wire="Ok"; repot="Recomendado"; }
    else if (p >= 0.20 && p <= 0.40) { prune="Recomendado"; wire="Recomendado"; repot="Con cuidado"; }
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
        <div><strong>Fase:</strong> {t.label}{isFinite(Number(state.data.phaseFrac)) ? (" ("+(state.data.phaseFrac*100).toFixed(1)+"%)") : ""}</div>
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

/* ============== App ============== */
export default function App(){
  const [bonsais, setBonsais] = useState(loadLS("bonsais", []));
  const [logs, setLogs]       = useState(loadLS("careLogs", []));
  const [coords, setCoords]   = useState(loadLS("coords", { lat:-12.0464, lon:-77.0428, label:"Lima, Perú" }));

  useEffect(()=> saveLS("bonsais", bonsais), [bonsais]);
  useEffect(()=> saveLS("careLogs", logs), [logs]);
  useEffect(()=> saveLS("coords", coords), [coords]);

  // derivados
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

  // acciones
  const quickLog = (bonsaiId, type) => {
    const types = ["riego","fertilización","poda","observación"];
    if (types.indexOf(type)===-1) return;
    const note = type==="observación" ? (prompt("Observación:") || "") : "";
    const rec = { id:newId(), bonsaiId, type, date:todayISO(), note };
    setLogs(prev => [rec, ...prev]);
  };
  const logsFor = (bonsaiId) => logs.filter(l=>l.bonsaiId===bonsaiId).slice(0,6);

  // navegación
  const [tab, setTab] = useState("trees"); // trees | care | progress | settings
  const [treeView, setTreeView] = useState({ name:"list", id:null }); // list | detail

  // crear/editar desde el formulario (sin perder foco)
  const [formSeed, setFormSeed] = useState(null); // null = crear nuevo
  const handleSubmitForm = (data) => {
    setBonsais(prev=>{
      const idx = prev.findIndex(x=>x.id===data.id);
      if (idx>=0){ const next = prev.slice(); next[idx]=data; return next; }
      return [data, ...prev];
    });
    setFormSeed(null); // volver a modo “agregar”
  };

  const editBonsai = (b) => { setFormSeed(b); window.scrollTo(0,0); };
  const deleteBonsai = (id) => {
    if (!confirm("¿Eliminar este bonsái y sus registros?")) return;
    setBonsais(prev=>prev.filter(x=>x.id!==id));
    setLogs(prev=>prev.filter(x=>x.bonsaiId!==id));
    if (treeView.name === "detail" && treeView.id === id) setTreeView({name:"list", id:null});
  };

  /* ========== páginas ========== */
  function PageTrees(){
    if (treeView.name === "detail") {
      const b = withNextWater.find(x=>x.id===treeView.id);
      if (!b) return (
        <>
          <button className="btn" onClick={()=>setTreeView({name:"list", id:null})}>← Back</button>
          <div className="card" style={{marginTop:8}}><div className="muted">No encontrado.</div></div>
        </>
      );
      const speciesName = (SPECIES_PRESETS.find(s=>s.key===b.speciesKey)||{}).name || b.speciesKey;
      return (
        <>
          <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:10}}>
            <button className="btn" onClick={()=>setTreeView({name:"list", id:null})}>← My Trees</button>
            <h1 style={{margin:0}}>{b.name}</h1>
          </div>

          <div className="card" style={{display:"grid", gridTemplateColumns:"1fr auto", gap:12, alignItems:"center"}}>
            <div>
              <div style={{fontSize:18, fontWeight:600}}>{speciesName}</div>
              <div className="muted" style={{marginTop:6}}>
                Last Watered: {b.lastWaterDate || "—"} · Next: {b.nextWaterDate}
              </div>
            </div>
            <div className="tree-thumb"><div style={{fontSize:22}}>🪴</div></div>
          </div>

          <div className="spacer-12"></div>

          <div className="card">
            <h2>Acciones</h2>
            <div className="tile-grid" style={{marginTop:10}}>
              <div className="tile"><div>💧</div><div className="title"><button className="btn primary" onClick={()=>quickLog(b.id, "riego")}>Registrar riego</button></div></div>
              <div className="tile"><div>🧪</div><div className="title"><button className="btn" onClick={()=>quickLog(b.id, "fertilización")}>Fertilización</button></div></div>
              <div className="tile"><div>✂️</div><div className="title"><button className="btn" onClick={()=>quickLog(b.id, "poda")}>Poda</button></div></div>
              <div className="tile"><div>📝</div><div className="title"><button className="btn" onClick={()=>quickLog(b.id, "observación")}>Observación</button></div></div>
            </div>
          </div>

          <div className="spacer-12"></div>

          {/* Astronomía integrada en detalle */}
          <AstroBadge coords={coords} />

          <div className="spacer-12"></div>

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

          <div className="card" style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            <button className="btn" onClick={()=>editBonsai(b)}>Editar</button>
            <button className="btn" onClick={()=>deleteBonsai(b.id)}>Eliminar</button>
          </div>
        </>
      );
    }

    return (
      <>
        <h1>My Trees</h1>

        <div className="tree-list">
          {withNextWater.length===0 ? (
            <div className="card center muted">Aún no agregas bonsáis.</div>
          ) : withNextWater.map(b=>{
            const speciesName = (SPECIES_PRESETS.find(s=>s.key===b.speciesKey)||{}).name || b.speciesKey;
            return (
              <button key={b.id} className="tree-card" onClick={()=>setTreeView({name:"detail", id:b.id})} style={{textAlign:"left"}}>
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

        {/* Form aislado (no pierde foco) */}
        <BonsaiForm
          seed={formSeed}
          onSubmit={handleSubmitForm}
          onCancel={()=>setFormSeed(null)}
        />
      </>
    );
  }

  function PageCare(){
    return (
      <>
        <h1>Care</h1>
        <div className="card">
          <h2>Hoy</h2>
          {dueToday.length===0
            ? <div className="center muted" style={{padding:"10px 0"}}>Sin riegos pendientes por hoy. 🌿</div>
            : (
              <table>
                <thead><tr><th>Bonsái</th><th>Especie</th><th>Últ.</th><th>Cada</th><th>Próx.</th><th></th></tr></thead>
                <tbody>
                  {dueToday.map(b=>(
                    <tr key={b.id}>
                      <td>{b.name}</td>
                      <td>{(SPECIES_PRESETS.find(s=>s.key===b.speciesKey)||{}).name || b.speciesKey}</td>
                      <td>{b.lastWaterDate || "—"}</td>
                      <td>{b.baseDays} d</td>
                      <td>{b.nextWaterDate}</td>
                      <td><button className="btn primary" onClick={()=>quickLog(b.id, "riego")}>Riego</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>

        <div className="spacer-12"></div>

        <div className="card">
          <h2>Historial</h2>
          {logs.length===0
            ? <div className="center muted" style={{padding:"10px 0"}}>Sin registros aún.</div>
            : (
              <table>
                <thead><tr><th>Fecha</th><th>Bonsái</th><th>Tipo</th><th>Nota</th></tr></thead>
                <tbody>
                {logs.slice(0,200).map(l=>{
                  const b = bonsais.find(x=>x.id===l.bonsaiId);
                  return (
                    <tr key={l.id}>
                      <td>{l.date}</td>
                      <td>{(b && b.name) || "—"}</td>
                      <td>{l.type}</td>
                      <td>{l.note || "—"}</td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            )
          }
        </div>
      </>
    );
  }

  function PageProgress(){
    return (
      <>
        <h1>Progress</h1>
        <div className="card center muted">Próximamente: gráficos de riegos/fotos por árbol 📈.</div>
      </>
    );
  }

  function PageSettings(){
    return (
      <>
        <h1>Settings</h1>
        <div className="card">
          <h2>Ubicación</h2>
          <LocationPicker value={coords} onChange={setCoords}/>
          <p className="muted" style={{marginTop:6}}>Se usa para calcular la fase lunar y los tips en el detalle.</p>
        </div>
      </>
    );
  }

  const BottomNav = () => (
    <nav className="nav-bottom">
      <div className="nav-inner">
        <div className="nav-item" data-active={tab==="trees"} onClick={()=>setTab("trees")}><div className="icon">🌿</div><div>My Trees</div></div>
        <div className="nav-item" data-active={tab==="care"} onClick={()=>setTab("care")}><div className="icon">🗓️</div><div>Care</div></div>
        <div className="nav-item" data-active={tab==="progress"} onClick={()=>setTab("progress")}><div className="icon">📈</div><div>Progress</div></div>
        <div className="nav-item" data-active={tab==="settings"} onClick={()=>setTab("settings")}><div className="icon">⚙️</div><div>Settings</div></div>
      </div>
    </nav>
  );

  return (
    <>
      <div className="container">
        {tab==="trees"    && <PageTrees/>}
        {tab==="care"     && <PageCare/>}
        {tab==="progress" && <PageProgress/>}
        {tab==="settings" && <PageSettings/>}
      </div>
      <BottomNav/>
    </>
  );
}
