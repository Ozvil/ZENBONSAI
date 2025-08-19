import React, { useEffect, useMemo, useState } from "react";
import LocationPicker from "./components/LocationPicker.jsx";
import LunarCalendar from "./components/LunarCalendar.jsx";

/* ============== Utils ============== */
const loadLS = function (k, fb) {
  try { var raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : fb; }
  catch (e) { return fb; }
};
const saveLS = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

const SPECIES_PRESETS = [
  { key: "juniperus", name: "Juniperus (enebro)", waterDays: 5 },
  { key: "ficus", name: "Ficus", waterDays: 3 },
  { key: "olmo", name: "Olmo chino", waterDays: 4 },
  { key: "pino", name: "Pino", waterDays: 6 },
  { key: "portulacaria", name: "Portulacaria", waterDays: 7 }
];

const newId = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);
const toDate = (v) => { const d = v ? new Date(v) : null; return d && !isNaN(d.getTime()) ? d : null; };
const addDays = (iso, n) => { const d = toDate(iso) || new Date(); d.setDate(d.getDate() + (isFinite(n) ? Number(n) : 0)); return d.toISOString().slice(0,10); };

/* ============== App ============== */
export default function App(){
  const [bonsais, setBonsais] = useState(loadLS("bonsais", []));
  const [logs, setLogs]       = useState(loadLS("careLogs", []));
  const [coords, setCoords]   = useState(loadLS("coords", { lat:-12.0464, lon:-77.0428, label:"Lima, Perú" }));
  const [showLunar, setShowLunar] = useState(loadLS("useLunar", false));

  useEffect(()=> saveLS("bonsais", bonsais), [bonsais]);
  useEffect(()=> saveLS("careLogs", logs), [logs]);
  useEffect(()=> saveLS("coords", coords), [coords]);
  useEffect(()=> saveLS("useLunar", showLunar), [showLunar]);

  const lastWaterByBonsai = useMemo(()=>{
    const map = new Map();
    for (const l of logs){ if (l.type !== "riego") continue;
      const prev = map.get(l.bonsaiId);
      if (!prev || l.date > prev.date) map.set(l.bonsaiId, l);
    }
    return map;
  }, [logs]);

  const withNextWater = useMemo(()=>{
    return bonsais.map((b)=>{
      const preset = SPECIES_PRESETS.find(s=>s.key===b.speciesKey);
      const baseDays = isFinite(b.customWaterDays) ? Number(b.customWaterDays) : (preset?.waterDays || 4);
      const last = lastWaterByBonsai.get(b.id)?.date || b.acquired || todayISO();
      const next = addDays(last, baseDays);
      return Object.assign({}, b, { baseDays, lastWaterDate:last, nextWaterDate:next });
    });
  }, [bonsais, lastWaterByBonsai]);

  const dueToday = useMemo(()=>{
    const t = todayISO();
    return withNextWater.filter(b => b.nextWaterDate <= t);
  }, [withNextWater]);

  /* ------ CRUD ------ */
  const [form, setForm] = useState({
    id:null, name:"", speciesKey:"juniperus",
    acquired: todayISO(), pot:"", notes:"", customWaterDays:""
  });
  const resetForm = () => setForm({
    id:null, name:"", speciesKey:"juniperus",
    acquired: todayISO(), pot:"", notes:"", customWaterDays:""
  });

  const onSubmitBonsai = (e) => {
    e && e.preventDefault && e.preventDefault();
    const id = form.id || newId();
    const rec = {
      id, name: (form.name||"").trim() || "Bonsái",
      speciesKey: form.speciesKey,
      acquired: form.acquired || todayISO(),
      pot: form.pot || "", notes: form.notes || "",
      customWaterDays: form.customWaterDays==="" ? undefined : Math.max(1, Number(form.customWaterDays)||0)
    };
    setBonsais(prev => {
      const idx = prev.findIndex(x=>x.id===id);
      if (idx>=0){ const next = prev.slice(); next[idx]=rec; return next; }
      return [rec, ...prev];
    });
    resetForm();
  };

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

  /* ------ Tabs (bottom) ------ */
  const [tab, setTab] = useState("trees");

  const BottomNav = () => (
    <nav className="nav-bottom">
      <div className="nav-inner">
        <div className="nav-item" data-active={tab==="trees"} onClick={()=>setTab("trees")}>
          <div className="icon">🌿</div><div>My Trees</div>
        </div>
        <div className="nav-item" data-active={tab==="care"} onClick={()=>setTab("care")}>
          <div className="icon">🗓️</div><div>Care</div>
        </div>
        <div className="nav-item" data-active={tab==="progress"} onClick={()=>setTab("progress")}>
          <div className="icon">📈</div><div>Progress</div>
        </div>
        <div className="nav-item" data-active={tab==="astro"} onClick={()=>setTab("astro")}>
          <div className="icon">🌙</div><div>Astronomy</div>
        </div>
      </div>
    </nav>
  );

  /* ------ Vistas ------ */
  function PageTrees(){
    return (
      <>
        <h1>My Trees</h1>

        {/* Lista como tarjetas */}
        <div className="tree-list">
          {withNextWater.length===0 ? (
            <div className="card center muted">Aún no agregas bonsáis.</div>
          ) : withNextWater.map(b => {
            const speciesName = (SPECIES_PRESETS.find(s=>s.key===b.speciesKey)||{}).name || b.speciesKey;
            return (
              <div key={b.id} className="tree-card">
                <div className="tree-info">
                  <h3>{b.name}</h3>
                  <div className="subtitle">{speciesName}</div>
                  <div className="last">Last watered: {b.lastWaterDate || "—"}</div>
                </div>
                <div className="tree-thumb" title={speciesName}>
                  {/* Si tienes fotos, colócalas aquí */}
                  <div style={{fontSize:22}}>🪴</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="spacer-12"></div>

        {/* Formulario rápido para agregar/editar */}
        <div className="card">
          <h2>{form.id ? "Edit tree" : "Add tree"}</h2>
          <form
            onSubmit={onSubmitBonsai}
            style={{display:"grid", gap:10, gridTemplateColumns:"repeat(2, minmax(0,1fr))"}}
          >
            <input className="input" placeholder="Name" value={form.name}
                   onChange={(e)=>setForm(f=>Object.assign({}, f, {name:e.target.value}))}/>
            <select className="input" value={form.speciesKey}
                    onChange={(e)=>setForm(f=>Object.assign({}, f, {speciesKey:e.target.value}))}>
              {SPECIES_PRESETS.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
            <input className="input" type="date" value={form.acquired}
                   onChange={(e)=>setForm(f=>Object.assign({}, f, {acquired:e.target.value}))}/>
            <input className="input" placeholder="Pot / substrate" value={form.pot}
                   onChange={(e)=>setForm(f=>Object.assign({}, f, {pot:e.target.value}))}/>
            <input className="input" placeholder="Watering every N days (optional)" value={form.customWaterDays}
                   onChange={(e)=>setForm(f=>Object.assign({}, f, {customWaterDays:(e.target.value||"").replace(/[^0-9]/g,"")}))}/>
            <input className="input" placeholder="Notes" value={form.notes}
                   onChange={(e)=>setForm(f=>Object.assign({}, f, {notes:e.target.value}))}/>
            <div style={{gridColumn:"1 / -1", display:"flex", gap:8}}>
              <button className="btn primary" type="submit">{form.id? "Save" : "Add"}</button>
              {form.id ? <button className="btn" type="button" onClick={resetForm}>Cancel</button> : null}
            </div>
          </form>
        </div>

        {/* Acciones rápidas por árbol */}
        {withNextWater.length>0 && (
          <>
            <div className="spacer-12"></div>
            <div className="card">
              <h2>Quick Actions</h2>
              {withNextWater.map(b=>(
                <div key={b.id} className="card" style={{background:"#1b1b1b", marginTop:10}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                    <div style={{fontWeight:600}}>{b.name}</div>
                    <div className="muted">Next: {b.nextWaterDate}</div>
                  </div>
                  <div className="tile-grid" style={{marginTop:10}}>
                    <div className="tile">
                      <div>💧</div><div className="title">
                        <button className="btn primary" onClick={()=>quickLog(b.id, "riego")}>Add Water</button>
                      </div>
                    </div>
                    <div className="tile">
                      <div>🧪</div><div className="title">
                        <button className="btn" onClick={()=>quickLog(b.id, "fertilización")}>Fertilize</button>
                      </div>
                    </div>
                    <div className="tile">
                      <div>✂️</div><div className="title">
                        <button className="btn" onClick={()=>quickLog(b.id, "poda")}>Prune</button>
                      </div>
                    </div>
                    <div className="tile">
                      <div>📝</div><div className="title">
                        <button className="btn" onClick={()=>quickLog(b.id, "observación")}>Note</button>
                      </div>
                    </div>
                  </div>
                  {logsFor(b.id).length>0 && (
                    <div className="muted" style={{marginTop:10, fontSize:13}}>
                      Recent: {logsFor(b.id).map(l => l.type).join(" · ")}
                    </div>
                  )}
                  <div style={{marginTop:8}}>
                    <button className="btn" onClick={()=>editBonsai(b)}>Edit</button>{" "}
                    <button className="btn" onClick={()=>deleteBonsai(b.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </>
    );
  }

  function PageCare(){
    return (
      <>
        <h1>Care</h1>
        <div className="card">
          <h2>Today</h2>
          {dueToday.length===0
            ? <div className="center muted" style={{padding:"12px 0"}}>No pending waterings for today. 🌿</div>
            : (
              <table>
                <thead><tr>
                  <th>Tree</th><th>Species</th><th>Last</th><th>Every</th><th>Next</th><th></th>
                </tr></thead>
                <tbody>
                  {dueToday.map(b=>(
                    <tr key={b.id}>
                      <td>{b.name}</td>
                      <td>{(SPECIES_PRESETS.find(s=>s.key===b.speciesKey)||{}).name || b.speciesKey}</td>
                      <td>{b.lastWaterDate || "—"}</td>
                      <td>{b.baseDays} d</td>
                      <td>{b.nextWaterDate}</td>
                      <td><button className="btn primary" onClick={()=>quickLog(b.id, "riego")}>Water</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>

        <div className="spacer-12"></div>

        <div className="card">
          <h2>History</h2>
          {logs.length===0
            ? <div className="center muted" style={{padding:"12px 0"}}>No records yet.</div>
            : (
              <table>
                <thead><tr><th>Date</th><th>Tree</th><th>Type</th><th>Note</th></tr></thead>
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
        <div className="card center muted">En una siguiente iteración podemos graficar riegos/fotos por árbol 📈.</div>
      </>
    );
  }

  function PageAstronomy(){
    return (
      <>
        <h1>Astronomy</h1>
        <div className="card">
          <LocationPicker value={coords} onChange={setCoords}/>
          <LunarCalendar coords={coords} checked={showLunar} onCheckedChange={setShowLunar}/>
          <p className="muted" style={{marginTop:8}}>Tip: deja activo el calendario lunar; se recuerda en tu dispositivo.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="container">
        {/* Render dinámico de páginas */}
        {tab==="trees" && <PageTrees/>}
        {tab==="care" && <PageCare/>}
        {tab==="progress" && <PageProgress/>}
        {tab==="astro" && <PageAstronomy/>}
      </div>
      <BottomNav/>
    </>
  );
}
