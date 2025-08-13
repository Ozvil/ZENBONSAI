// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import './zen.css';

/* ========================= Utilidades base ========================= */
const LSK_BONSAIS = 'zb_bonsais';
const LSK_SETTINGS = 'zb_settings';
const ONE_DAY = 24 * 3600e3;

const loadLS = (k, fb) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; } };
const saveLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const setCache = (key, value, ttl = ONE_DAY) => { try { localStorage.setItem(key, JSON.stringify({ exp: Date.now() + ttl, value })) } catch {} };
const getCache = (key) => { try {
  const raw = localStorage.getItem(key); if (!raw) return null;
  const { exp, value } = JSON.parse(raw); if (Date.now() > exp) return null;
  return value;
} catch { return null } };

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const todayISO = () => new Date().toISOString();
const norm = (s='') => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();

/* ===================== Open-Meteo: Geo + Astronomía ===================== */
// Geocodificación por texto
async function geocodeCity(q, lang = 'es') {
  const key = `geo_${lang}_${norm(q)}`;
  const c = getCache(key); if (c) return c;
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=${lang}&format=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
  const j = await r.json();
  if (!j.results?.length) throw new Error('No encontrado');
  const { latitude, longitude, timezone, country, name, admin1 } = j.results[0];
  const out = { lat: latitude, lon: longitude, tz: timezone, country, city: name, region: admin1 || '' };
  setCache(key, out);
  return out;
}
// Reverse geocoding (añade format=json para evitar 400)
async function reverseGeocode(lat, lon, lang = 'es') {
  const key = `rev_${lang}_${Number(lat).toFixed(4)}_${Number(lon).toFixed(4)}`;
  const c = getCache(key); if (c) return c;
  const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=${lang}&format=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
  const j = await r.json();
  const o = j.results?.[0] || {};
  const out = {
    tz: o.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    country: o.country || '',
    city: o.name || o.admin1 || '',
    region: o.admin1 || ''
  };
  setCache(key, out);
  return out;
}
// Astronomía (con fallback timezone=auto)
async function loadAstronomy(lat, lon, tz) {
  if (lat == null || lon == null) throw new Error('Lat/Lon faltan');
  const la = Number(lat).toFixed(4), lo = Number(lon).toFixed(4);
  const key = `astro_${la}_${lo}_${tz || 'auto'}`;
  const c = getCache(key); if (c) return c;
  const base = `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&daily=sunrise,sunset,moon_phase,moonrise,moonset`;
  const urls = [
    tz ? `${base}&timezone=${encodeURIComponent(tz)}` : `${base}&timezone=auto`,
    `${base}&timezone=auto`,
  ];
  let lastErr;
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
      const j = await r.json();
      if (!j?.daily?.time) throw new Error('Respuesta inválida');
      setCache(key, j.daily);
      return j.daily;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Fallo astronomía');
}
const moonPhaseLabel = (code) => {
  if (code == null) return '';
  const p = Number(code);
  if (p < 0.03 || p > 0.97) return 'Luna nueva';
  if (p < 0.22) return 'Creciente';
  if (p < 0.28) return 'Cuarto creciente';
  if (p < 0.47) return 'Gibosa creciente';
  if (p < 0.53) return 'Luna llena';
  if (p < 0.72) return 'Gibosa menguante';
  if (p < 0.78) return 'Cuarto menguante';
  return 'Menguante';
};

/* ========================= Datos (fetch opcional) ========================= */
async function safeJSON(path) {
  try { const r = await fetch(path); if (!r.ok) throw new Error(); return await r.json(); }
  catch { return null; }
}

/* ========================= Componentes UI reutilizables ========================= */
const Badge = ({children}) => <span className="zb-badge">{children}</span>;
const Pill = ({children, onClick, tone='default'}) =>
  <button className={`zb-pill zb-pill-${tone}`} onClick={onClick}>{children}</button>;
const Btn = ({children, onClick, tone='default', small=false}) =>
  <button className={`zb-btn zb-btn-${tone}${small?' zb-btn-sm':''}`} onClick={onClick}>{children}</button>;
const Collapse = ({title, right, open, onToggle, children}) => (
  <section className="zb-card">
    <header className="zb-card-h" onClick={onToggle}>
      <div>{title}</div>
      <div className="zb-card-h-right">{right} <span className="zb-caret">{open?'▾':'▸'}</span></div>
    </header>
    {open && <div className="zb-card-b">{children}</div>}
  </section>
);

/* ========================= App principal ========================= */
export default function App() {
  /* ---------- settings ---------- */
  const [settings, setSettings] = useState(() => loadLS(LSK_SETTINGS, { lang: 'es', lunar: false, location: null }));
  useEffect(() => saveLS(LSK_SETTINGS, settings), [settings]);

  /* ---------- catálogos (opcionales) ---------- */
  const [speciesDB, setSpeciesDB] = useState(null);
  const [stylesDB, setStylesDB]   = useState(null);
  const [tipsDB, setTipsDB]       = useState(null);
  const [toolsDB, setToolsDB]     = useState(null);
  const [propDB, setPropDB]       = useState(null);

  useEffect(() => { (async () => {
    setSpeciesDB(await safeJSON('/species.json'));
    setStylesDB(await safeJSON('/styles.json'));
    setTipsDB(await safeJSON('/tips.json'));
    setToolsDB(await safeJSON('/tools.json'));
    setPropDB(await safeJSON('/propagation.json'));
  })()}, []);

  /* ---------- astronomía / sugerencias ---------- */
  const [astro, setAstro] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const loc = settings.location;
        if (!loc?.lat || !loc?.lon) { setAstro(null); return; }
        const d = await loadAstronomy(loc.lat, loc.lon, loc.tz);
        setAstro(d);
      } catch (e) {
        console.error('Astronomy error', e);
        setAstro(null);
      }
    })();
  }, [settings?.location?.lat, settings?.location?.lon, settings?.location?.tz, settings?.lunar]);

  const suggestions = useMemo(() => {
    if (!astro?.time?.length) return [];
    const out = [];
    // Ejemplo simple: próximos 7 días
    for (let i=0;i<Math.min(7, astro.time.length);i++){
      const day = astro.time[i];
      const sunrise = astro.sunrise?.[i];
      const sunset  = astro.sunset?.[i];
      const moon    = astro.moon_phase?.[i];
      const label   = settings.lunar ? `Fase: ${moonPhaseLabel(moon)}` : `${new Date(sunrise).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} – ${new Date(sunset).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
      // Heurística simple: poda fina en luna menguante, alambrado en creciente, trasplante cerca de luna nueva
      let task = 'Revisión general';
      if (settings.lunar) {
        if (moon != null) {
          if (moon > 0.48 && moon < 0.78) task = 'Poda / reducción (menguante)';
          else if (moon > 0.20 && moon < 0.48) task = 'Alambrado y brotación (creciente)';
          else if (moon < 0.06 || moon > 0.94) task = 'Trasplante / raíces (cerca de luna nueva)';
        }
      } else {
        task = 'Riego/chequeo al amanecer';
      }
      out.push({ day, label, task });
    }
    return out;
  }, [astro, settings.lunar]);

  /* ---------- colección ---------- */
  const [bonsais, setBonsais] = useState(() => loadLS(LSK_BONSAIS, []));
  useEffect(() => saveLS(LSK_BONSAIS, bonsais), [bonsais]);

  const addBonsai = (b) => setBonsais(prev => [{ id: uid(), createdAt: todayISO(), photos: [], tasks: defaultTasks(), logs:{}, ...b }, ...prev]);
  const updateBonsai = (id, patch) => setBonsais(prev => prev.map(b => b.id===id ? { ...b, ...patch } : b));
  const removeBonsai = (id) => setBonsais(prev => prev.filter(b => b.id!==id));

  function defaultTasks(){
    return [
      { key:'water', name:'Riego', freq:2, unit:'d', next:Date.now() },
      { key:'fert',  name:'Abono', freq:21, unit:'d', next:Date.now() },
      { key:'prune', name:'Poda/Pinzado', freq:30, unit:'d', next:Date.now() },
    ];
  }

  /* ---------- Undo (deshacer) ---------- */
  const [undo, setUndo] = useState(null); // {type, bonsaiId, payload, at}
  function markTask(b, key){
    const t = (b.tasks||[]).find(x=>x.key===key); if(!t) return;
    const logKey = `log_${key}`;
    const entry = { at: todayISO() };
    const nextDue = Date.now() + (t.freq||1) * 86400e3;
    const newLogs = { ...(b.logs||{}), [logKey]: [ ...(b.logs?.[logKey]||[]), entry ] };
    const newTasks = (b.tasks||[]).map(x=> x.key===key ? { ...x, next: nextDue } : x);
    updateBonsai(b.id, { logs:newLogs, tasks:newTasks });
    setUndo({ type:'task', bonsaiId:b.id, payload:{ key, entry }, at: Date.now() });
  }
  function undoLast(){
    if(!undo) return;
    if(undo.type==='task'){
      const b = bonsais.find(x=>x.id===undo.bonsaiId); if(!b) return setUndo(null);
      const key = `log_${undo.payload.key}`;
      const logs = (b.logs?.[key]||[]).filter(x=>x.at!==undo.payload.entry.at);
      // no movemos el next; solo devolvemos un día al pasado para que vuelva a aparecer como “pendiente”
      const tasks = (b.tasks||[]).map(t => t.key===undo.payload.key ? { ...t, next: Date.now() - 1 } : t);
      updateBonsai(b.id, { logs:{ ...(b.logs||{}), [key]: logs }, tasks });
    }
    setUndo(null);
  }

  /* ---------- UI: modales y búsquedas ---------- */
  const [openLoc, setOpenLoc] = useState(false);
  const [openNew, setOpenNew] = useState(false);
  const [queryCol, setQueryCol] = useState('');
  const [qTools, setQTools] = useState('');
  const [qProp, setQProp] = useState('');
  const [qStyles, setQStyles] = useState('');

  const [openSug, setOpenSug] = useState(true);
  const [openCol, setOpenCol] = useState(true);
  const [openTools, setOpenTools] = useState(false);
  const [openProp, setOpenProp] = useState(false);

  /* ---------- helpers especie / sensores ---------- */
  function findSpeciesEntry(db, input){
    if(!db?.species?.length || !input) return null;
    const n = norm(input);
    let hit = db.species.find(sp => norm(sp.scientific_name)===n || norm(sp.name_es||'')===n || sp.common_names?.es?.map(norm).includes(n));
    if(hit) return hit;
    hit = db.species.find(sp => norm(sp.scientific_name)?.startsWith(n));
    if(hit) return hit;
    const genus = (input.split(' ')[0] || '').trim();
    if(!genus) return null;
    const candidates = db.species.filter(sp => norm(sp.scientific_name).startsWith(genus+' '));
    return candidates[0] || null;
  }
  function idealRangesForSpecies(sp){
    // Si tu species.json trae rangos, úsalos; si no, defaults
    const def = { fertility:'300–700 ppm', lux:'5,000–15,000 lx', humidity:'40–60 %' };
    if(!sp?.sensors) return def;
    const f = sp.sensors.fertility ? `${sp.sensors.fertility.min}–${sp.sensors.fertility.max} ${sp.sensors.fertility.unit||'ppm'}` : def.fertility;
    const l = sp.sensors.lux ? `${sp.sensors.lux.min}–${sp.sensors.lux.max} lx` : def.lux;
    const h = sp.sensors.humidity ? `${sp.sensors.humidity.min}–${sp.sensors.humidity.max} %` : def.humidity;
    return { fertility:f, lux:l, humidity:h };
  }

  /* ================================ Render ================================ */
  return (
    <div className="zb-app">
      <header className="zb-header">
        <div className="zb-header_inner">
          <div className="zb-brand">
            <span className="zb-logo">🌿</span> <b>ZenBonsai</b>
          </div>
          <div className="zb-actions">
            <Pill tone={settings?.location ? 'ok' : 'warn'} onClick={()=>setOpenLoc(true)}>
              {settings?.location
                ? `${settings.location?.label || 'Ubicación'} · Luna: ${settings.lunar?'on':'off'}`
                : 'Sin ubicación'}
            </Pill>
            <Pill onClick={()=>setOpenLoc(true)}>📍 Ubicación</Pill>
            <Btn tone="primary" onClick={()=>setOpenNew(true)}>+ Nuevo</Btn>
          </div>
        </div>
      </header>

      {/* Sugerencias / calendario */}
      <Collapse
        title={<><Badge>📅</Badge> Próximos días sugeridos</>}
        right={<Btn small tone="soft" onClick={(e)=>{e.stopPropagation(); setOpenLoc(true)}}>Configura ubicación</Btn>}
        open={openSug}
        onToggle={()=>setOpenSug(o=>!o)}
      >
        {!settings?.location
          ? <p>Abre “Ubicación” y activa (si quieres) calendario lunar.</p>
          : suggestions.length===0
            ? <p>No hay datos de astronomía aún. Intenta recargar o revisa tu conexión.</p>
            : (
              <div className="zb-list">
                {suggestions.map(s=>(
                  <div className="zb-item" key={s.day}>
                    <div className="zb-item_t">{new Date(s.day).toLocaleDateString()}</div>
                    <div className="zb-item_s">{s.task}</div>
                    <div className="zb-item_r">{s.label}</div>
                  </div>
                ))}
              </div>
            )
        }
      </Collapse>

      {/* Colección */}
      <Collapse
        title={<><Badge>🪴</Badge> Tu colección</>}
        right={<span>{bonsais.length}</span>}
        open={openCol}
        onToggle={()=>setOpenCol(o=>!o)}
      >
        <div className="zb-row">
          <input className="zb-input" placeholder="Buscar por nombre o especie…" value={queryCol} onChange={e=>setQueryCol(e.target.value)} />
          <Btn tone="primary" onClick={()=>setOpenNew(true)}>+ Nuevo</Btn>
        </div>

        {bonsais.length===0 && <p>Pulsa “Nuevo” para registrar el primero.</p>}

        <div className="zb-grid">
          {bonsais
            .filter(b => {
              const q = norm(queryCol);
              if(!q) return true;
              return norm(b.name).includes(q) || norm(b.species||'').includes(q) || norm(b.notes||'').includes(q);
            })
            .map(b => <BonsaiCard
              key={b.id}
              b={b}
              onUpdate={patch=>updateBonsai(b.id, patch)}
              onDelete={()=>removeBonsai(b.id)}
              onMark={key=>markTask(b, key)}
            />)}
        </div>
      </Collapse>

      {/* Herramientas y usos */}
      <Collapse
        title={<><Badge>🛠️</Badge> Herramientas y usos</>}
        right={<span/>}
        open={openTools}
        onToggle={()=>setOpenTools(o=>!o)}
      >
        {!toolsDB
          ? <p>Sin datos (aún). Si subes <code>/tools.json</code>, aparecerán aquí.</p>
          : <>
              <input className="zb-input" placeholder="Buscar herramienta…" value={qTools} onChange={e=>setQTools(e.target.value)} />
              <div className="zb-list">
                {toolsDB.items
                  .filter(t => norm(t.name).includes(norm(qTools)))
                  .map(t=>(
                    <div className="zb-item" key={t.id || t.name}>
                      <div className="zb-item_t">{t.name}</div>
                      <div className="zb-item_s">{t.use}</div>
                    </div>
                  ))}
              </div>
            </>
        }
      </Collapse>

      {/* Propagación */}
      <Collapse
        title={<><Badge>🌱</Badge> Propagación</>}
        right={<span/>}
        open={openProp}
        onToggle={()=>setOpenProp(o=>!o)}
      >
        {!propDB
          ? <p>Sin datos (aún). Si subes <code>/propagation.json</code>, aparecerán aquí.</p>
          : <>
              <input className="zb-input" placeholder="Buscar técnica…" value={qProp} onChange={e=>setQProp(e.target.value)} />
              <div className="zb-list">
                {propDB.items
                  .filter(t => norm(t.name).includes(norm(qProp)))
                  .map(t=>(
                  <div className="zb-item" key={t.id || t.name}>
                    <div className="zb-item_t">{t.name}</div>
                    <div className="zb-item_s">{t.method}</div>
                    <div className="zb-item_r">{t.season}</div>
                  </div>))}
              </div>
            </>
        }
      </Collapse>

      {/* Snackbar Undo */}
      {undo && (
        <div className="zb-snackbar">
          Acción registrada. <Btn small tone="link" onClick={undoLast}>Deshacer</Btn>
        </div>
      )}

      {/* Modal Ubicación */}
      {openLoc && (
        <LocationModal
          settings={settings}
          onClose={()=>setOpenLoc(false)}
          onSave={(patch)=>setSettings(s=>({ ...s, ...patch }))}
        />
      )}

      {/* Modal Nuevo */}
      {openNew && (
        <NewBonsaiModal
          speciesDB={speciesDB}
          onClose={()=>setOpenNew(false)}
          onCreate={(b)=>{ addBonsai(b); setOpenNew(false); }}
        />
      )}
    </div>
  );
}

/* ========================= Subcomponentes ========================= */

function BonsaiCard({ b, onUpdate, onDelete, onMark }){
  const [open, setOpen] = useState(false);
  const fileRef = useRef(null);

  const nextDueLabel = (t) => {
    const ms = (t.next||Date.now()) - Date.now();
    if (ms <= 0) return 'ahora';
    const d = Math.ceil(ms/86400e3);
    if (d<=1) return 'mañana';
    return `en ${d} días`;
  };

  const addPhoto = (file) => {
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ph = { id: uid(), at: todayISO(), data: reader.result };
      onUpdate({ photos:[ ph, ...(b.photos||[]) ] });
    };
    reader.readAsDataURL(file);
  };

  const useSensor = b.sensor?.use;
  const ranges = b.sensor?.ranges;

  return (
    <div className="zb-card zb-bonsai">
      <header className="zb-card-h" onClick={()=>setOpen(o=>!o)}>
        <div>
          <div className="zb-title">{b.name} <span className="zb-muted">· {b.species || 'Sin especie'}</span></div>
          <div className="zb-sub">{b.location || 'Ubicación no indicada'}</div>
        </div>
        <div className="zb-card-h-right">
          <Btn small tone="danger" onClick={(e)=>{ e.stopPropagation(); if(confirm('¿Eliminar?')) onDelete(); }}>Eliminar</Btn>
          <span className="zb-caret">{open?'▾':'▸'}</span>
        </div>
      </header>

      {open && (
        <div className="zb-card-b">
          {/* Fotos */}
          <div className="zb-file">
            <span>Fotos:</span>
            <input type="file" accept="image/*" ref={fileRef} onChange={(e)=>addPhoto(e.target.files?.[0])} />
          </div>
          {(b.photos?.length>0)
            ? <div className="zb-gallery">{b.photos.map(ph=>(
                <figure key={ph.id} className="zb-figure">
                  <img src={ph.data} alt="" />
                  <figcaption className="zb-sub">{new Date(ph.at).toLocaleString()}</figcaption>
                </figure>
              ))}</div>
            : <p className="zb-muted">Aún no hay fotos.</p>
          }

          {/* Checklist */}
          <h4 className="zb-sep">Checklist</h4>
          <div className="zb-list">
            {(b.tasks||[]).map(t=>(
              <div className="zb-item" key={t.key}>
                <div className="zb-item_t">{t.name}</div>
                <div className="zb-item_s">Cada {t.freq} días · Próximo: <b>{nextDueLabel(t)}</b></div>
                <div className="zb-item_r">
                  <Btn small tone="ok" onClick={()=>onMark(t.key)}>✓ Hecho</Btn>
                </div>
              </div>
            ))}
          </div>

          {/* Sensor */}
          <h4 className="zb-sep">Sensor</h4>
          {useSensor
            ? <div className="zb-list">
                <div className="zb-item"><div className="zb-item_t">Fertilidad</div><div className="zb-item_s">{ranges?.fertility || '—'}</div></div>
                <div className="zb-item"><div className="zb-item_t">Luz</div><div className="zb-item_s">{ranges?.lux || '—'}</div></div>
                <div className="zb-item"><div className="zb-item_t">Humedad</div><div className="zb-item_s">{ranges?.humidity || '—'}</div></div>
                <div className="zb-item"><div className="zb-item_t">Nota</div><div className="zb-item_s">Ajusta umbrales según estación y respuesta del árbol.</div></div>
              </div>
            : <p className="zb-muted">No usa sensor.</p>
          }

          {/* Notas */}
          <h4 className="zb-sep">Notas</h4>
          <textarea className="zb-textarea" placeholder="Escribe notas…" value={b.notes||''} onChange={e=>onUpdate({ notes:e.target.value })} />
        </div>
      )}
    </div>
  );
}

function LocationModal({ settings, onClose, onSave }){
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function doSearch(){
    try {
      setBusy(true); setMsg('');
      const g = await geocodeCity(q || '', settings.lang || 'es');
      onSave({ location: { lat:g.lat, lon:g.lon, tz:g.tz, label:`${g.city}${g.city?', ':''}${g.country}` } });
    } catch (e) {
      setMsg(e.message || 'No se pudo geocodificar');
    } finally { setBusy(false); }
  }
  async function useMyLocation(){
    setMsg('');
    if(!navigator.geolocation){ setMsg('Geolocalización no disponible'); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(async pos=>{
      try{
        const { latitude, longitude } = pos.coords;
        const rev = await reverseGeocode(latitude, longitude, settings.lang || 'es');
        onSave({ location: { lat:latitude, lon:longitude, tz:rev.tz, label:`${rev.city||''}${rev.city?', ':''}${rev.country||''}` } });
      }catch(e){ setMsg(e.message || 'Error ubicando'); }
      finally{ setBusy(false); }
    }, err=>{ setBusy(false); setMsg(err.message || 'No se pudo obtener tu ubicación'); }, { enableHighAccuracy:true, timeout:10000 });
  }

  return (
    <div className="zb-modal">
      <div className="zb-modal_dialog">
        <div className="zb-modal_h">
          <div>Ubicación y calendario</div>
          <button className="zb-x" onClick={onClose}>✕</button>
        </div>
        <div className="zb-modal_b">
          <div className="zb-row">
            <input className="zb-input" placeholder="Ciudad, país (p.ej. Lima, Perú)" value={q} onChange={e=>setQ(e.target.value)} />
            <Btn tone="primary" onClick={doSearch} disabled={busy}>Buscar</Btn>
          </div>
          <Btn tone="soft" onClick={useMyLocation} disabled={busy}>Usar mi ubicación</Btn>
          <div className="zb-row">
            <label><input type="checkbox" checked={!!settings.lunar} onChange={e=>onSave({ lunar: e.target.checked })} /> Calendario lunar</label>
          </div>
          {msg && <div className="zb-error">Open-Meteo: {msg}</div>}
          {settings.location && (
            <div className="zb-note">Actual: <b>{settings.location.label}</b> · TZ: {settings.location.tz}</div>
          )}
        </div>
        <div className="zb-modal_f">
          <Btn tone="soft" onClick={onClose}>Cerrar</Btn>
        </div>
      </div>
    </div>
  );
}

function NewBonsaiModal({ onClose, onCreate, speciesDB }){
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [loc, setLoc] = useState('');
  const [notes, setNotes] = useState('');
  const [useSensor, setUseSensor] = useState(false);

  const sp = useMemo(()=> findSpeciesEntry(speciesDB, species), [species, speciesDB]);
  const ranges = idealRangesForSpecies(sp);

  function submit(){
    if(!name.trim()) return alert('Ponle un nombre 😉');
    onCreate({ name:name.trim(), species:species.trim(), location:loc.trim(), notes:notes.trim(), sensor:{ use:useSensor, ranges: useSensor ? ranges : null } });
  }

  return (
    <div className="zb-modal">
      <div className="zb-modal_dialog">
        <div className="zb-modal_h">
          <div>Nuevo bonsái</div>
          <button className="zb-x" onClick={onClose}>✕</button>
        </div>
        <div className="zb-modal_b">
          <div className="zb-grid-form">
            <label>Nombre<input className="zb-input" value={name} onChange={e=>setName(e.target.value)} /></label>
            <label>Especie<input className="zb-input" value={species} onChange={e=>setSpecies(e.target.value)} placeholder="Ej. Ficus microcarpa" /></label>
            <label>Ubicación<input className="zb-input" value={loc} onChange={e=>setLoc(e.target.value)} placeholder="Interior luminoso, exterior sombra parcial…" /></label>
          </div>

          <div className="zb-row">
            <label><input type="checkbox" checked={useSensor} onChange={e=>setUseSensor(e.target.checked)} /> ¿Usas sensor (fertilidad/luz/humedad)?</label>
          </div>

          {useSensor && (
            <div className="zb-list">
              <div className="zb-item"><div className="zb-item_t">Fertilidad</div><div className="zb-item_s">{ranges.fertility}</div></div>
              <div className="zb-item"><div className="zb-item_t">Luz</div><div className="zb-item_s">{ranges.lux}</div></div>
              <div className="zb-item"><div className="zb-item_t">Humedad</div><div className="zb-item_s">{ranges.humidity}</div></div>
              {sp?.photos?.length>0 && (
                <div className="zb-item">
                  <div className="zb-item_t">Referencias</div>
                  <div className="zb-gallery sm">
                    {sp.photos.slice(0,6).map((src,i)=><img key={i} src={src} alt="" />)}
                  </div>
                </div>
              )}
            </div>
          )}

          {sp && (
            <div className="zb-note">Especie detectada: <b>{sp.name_es || sp.scientific_name}</b></div>
          )}
        </div>
        <div className="zb-modal_f">
          <Btn tone="soft" onClick={onClose}>Cancelar</Btn>
          <Btn tone="primary" onClick={submit}>Crear</Btn>
        </div>
      </div>
    </div>
  );
}

/* ========================= Helpers de especie/sensores ========================= */
// (duplicadas aquí para que el archivo sea auto-contenible)
function findSpeciesEntry(db, input){
  if(!db?.species?.length || !input) return null;
  const n = norm(input);
  let hit = db.species.find(sp => norm(sp.scientific_name)===n || norm(sp.name_es||'')===n || sp.common_names?.es?.map(norm).includes(n));
  if(hit) return hit;
  hit = db.species.find(sp => norm(sp.scientific_name)?.startsWith(n));
  if(hit) return hit;
  const genus = (input.split(' ')[0] || '').trim();
  if(!genus) return null;
  const candidates = db.species.filter(sp => norm(sp.scientific_name).startsWith(genus+' '));
  return candidates[0] || null;
}
function idealRangesForSpecies(sp){
  const def = { fertility:'300–700 ppm', lux:'5,000–15,000 lx', humidity:'40–60 %' };
  if(!sp?.sensors) return def;
  const f = sp.sensors.fertility ? `${sp.sensors.fertility.min}–${sp.sensors.fertility.max} ${sp.sensors.fertility.unit||'ppm'}` : def.fertility;
  const l = sp.sensors.lux ? `${sp.sensors.lux.min}–${sp.sensors.lux.max} lx` : def.lux;
  const h = sp.sensors.humidity ? `${sp.sensors.humidity.min}–${sp.sensors.humidity.max} %` : def.humidity;
  return { fertility:f, lux:l, humidity:h };
}
