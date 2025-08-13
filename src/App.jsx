import React, { useEffect, useMemo, useRef, useState } from 'react';
import './zen.css';

/* ========= Helpers locales (sin lib) ========= */
const LS_BONSAIS = 'zb_bonsais';
const LS_SETTINGS = 'zb_settings';
const LS_LANG = 'zb_lang';

const wait = (ms) => new Promise(r => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const norm = (s='') => s.normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/\s+/g,' ').trim().toLowerCase();
const load = (k, fb) => { try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : fb; } catch { return fb; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

function fmtDate(d, lang='es-PE'){
  try {
    return new Date(d).toLocaleString(lang, { day:'2-digit', month:'short' });
  } catch { return d; }
}

function moonLabel(code) {
  // Open-Meteo: 0=new, 0.25=first quarter, 0.5=full, 0.75=last quarter
  const v = Number(code);
  if (isNaN(v)) return '—';
  if (v < 0.03 || v > 0.97) return 'Luna nueva';
  if (v >= 0.47 && v <= 0.53) return 'Luna llena';
  if (v >= 0.22 && v <= 0.28) return 'Cuarto creciente';
  if (v >= 0.72 && v <= 0.78) return 'Cuarto menguante';
  if (v < 0.5) return 'Creciente';
  return 'Menguante';
}

function pickSensorIdeals(speciesName='') {
  // Valores demostrativos. Si tienes tabla real, cámbiala aquí:
  const g = norm(speciesName);
  if (g.includes('juniper') || g.includes('junipero')) {
    return { lux: '20k–60k', humidity: '35–55%', ec: '0.8–1.4 mS/cm' };
  }
  if (g.includes('ficus')) {
    return { lux: '10k–30k', humidity: '45–65%', ec: '1.2–2.0 mS/cm' };
  }
  return { lux: '8k–25k', humidity: '40–60%', ec: '0.8–1.2 mS/cm' };
}

/* ========= Fetch Geo/Luna ========= */

async function geocodeByName(query, lang='es') {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=${lang}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Geocoding ${r.status}`);
  const j = await r.json();
  const item = j?.results?.[0];
  if (!item) throw new Error('No encontrado');
  return {
    name: [item.name, item.admin1, item.country].filter(Boolean).join(', '),
    lat: Number(item.latitude),
    lon: Number(item.longitude),
  };
}

async function reverseByCoords(lat, lon, lang='es') {
  const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=${lang}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Reverse ${r.status}`);
  const j = await r.json();
  const item = j?.results?.[0];
  return {
    name: item ? [item.name, item.admin1, item.country].filter(Boolean).join(', ') : `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
    lat: Number(lat),
    lon: Number(lon),
  };
}

function dateStr(d){ return d.toISOString().slice(0,10); }

async function fetchMoon(lat, lon, days=10) {
  if (isNaN(lat) || isNaN(lon)) throw new Error('coords inválidas');
  const start = new Date();
  const end = new Date(Date.now() + (days*86400000));
  const url = `https://api.open-meteo.com/v1/astronomy?latitude=${lat}&longitude=${lon}&daily=moon_phase&timezone=auto&start_date=${dateStr(start)}&end_date=${dateStr(end)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Astronomy ${r.status}`);
  const j = await r.json();
  const out = [];
  const dates = j?.daily?.time ?? [];
  const phases = j?.daily?.moon_phase ?? [];
  for (let i=0;i<dates.length;i++){
    out.push({ date: dates[i], phase: phases[i] });
  }
  return out;
}

/* ========= Componentes UI simples ========= */

function Chip({ children, onClick, tone='neutral', active }) {
  return (
    <button className={`zb-chip zb-chip--${tone} ${active ? 'is-active':''}`} onClick={onClick}>{children}</button>
  );
}

function SectionCard({ title, icon, count, children, right, collapsible=true }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="zb-card">
      <div className="zb-card_head">
        <div className="zb-title"><span className="zb-ico">{icon}</span>{title}</div>
        <div className="zb-card_actions">
          {typeof count==='number' && <span className="zb-count">{count}</span>}
          {right}
          {collapsible && (
            <button className="zb-toggle" onClick={()=>setOpen(v=>!v)} aria-label="toggle">▾</button>
          )}
        </div>
      </div>
      {(!collapsible || open) && <div className="zb-card_body">{children}</div>}
    </div>
  );
}

function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="zb-modal_back" onClick={onClose}>
      <div className="zb-modal" onClick={e=>e.stopPropagation()}>
        <div className="zb-modal_head">
          <div className="zb-title">{title}</div>
          <button className="zb-close" onClick={onClose}>✕</button>
        </div>
        <div className="zb-modal_body">{children}</div>
        {footer && <div className="zb-modal_foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ========= App ========= */

export default function App(){
  const [lang, setLang] = useState(load(LS_LANG, 'es'));
  const [settings, setSettings] = useState(load(LS_SETTINGS, { lunar:false, location:null }));
  const [bonsais, setBonsais] = useState(load(LS_BONSAIS, []));
  const [speciesDB, setSpeciesDB] = useState(null);
  const [stylesDB, setStylesDB] = useState(null);
  const [tipsDB, setTipsDB] = useState(null);
  const [toolsDB, setToolsDB] = useState(null);
  const [propagationDB, setPropagationDB] = useState(null);

  const [moon, setMoon] = useState({ status:'idle', rows:[], error:null });
  const [showNew, setShowNew] = useState(false);
  const [showLoc, setShowLoc] = useState(false);

  /* ======= persist ======= */
  useEffect(()=>save(LS_BONSAIS, bonsais), [bonsais]);
  useEffect(()=>save(LS_SETTINGS, settings), [settings]);
  useEffect(()=>save(LS_LANG, lang), [lang]);

  /* ======= carga catálogos (desde /public) ======= */
  useEffect(()=>{ fetch('/species.json').then(r=>r.json()).then(setSpeciesDB).catch(()=>setSpeciesDB(null)); },[]);
  useEffect(()=>{ fetch('/styles.json').then(r=>r.json()).then(setStylesDB).catch(()=>setStylesDB(null)); },[]);
  useEffect(()=>{ fetch('/tips.json').then(r=>r.json()).then(setTipsDB).catch(()=>setTipsDB(null)); },[]);
  useEffect(()=>{ fetch('/tools.json').then(r=>r.json()).then(setToolsDB).catch(()=>setToolsDB(null)); },[]);
  useEffect(()=>{ fetch('/propagation.json').then(r=>r.json()).then(setPropagationDB).catch(()=>setPropagationDB(null)); },[]);

  /* ======= luna sugerencias ======= */
  useEffect(()=>{
    (async ()=>{
      if (!settings?.lunar || !settings?.location) { setMoon({status:'idle', rows:[], error:null}); return; }
      try{
        setMoon(m=>({ ...m, status:'loading', error:null }));
        const rows = await fetchMoon(settings.location.lat, settings.location.lon, 8);
        setMoon({ status:'done', rows, error:null });
      }catch(err){
        setMoon({ status:'error', rows:[], error: err?.message || 'Error lunar' });
      }
    })();
  }, [settings?.lunar, settings?.location?.lat, settings?.location?.lon]);

  /* ======= utilidades de especie/cuidados ======= */
  function findSpeciesEntry(input){
    if (!speciesDB?.species?.length) return null;
    const q = norm(input||'');
    if (!q) return null;
    // exact by scientific name
    let hit = speciesDB.species.find(sp => norm(sp.scientific_name) === q);
    if (hit) return hit;
    // prefix scientific
    hit = speciesDB.species.find(sp => norm(sp.scientific_name).startsWith(q));
    if (hit) return hit;
    // by common names
    const candidates = speciesDB.species.filter(sp =>
      (sp.common_names?.es || sp.common_names?.en || []).map(norm).some(n => q.includes(n) || n.includes(q))
    );
    return candidates[0] || null;
  }

  /* ======= CRUD bonsáis ======= */
  function addBonsai(newB){
    setBonsais(prev => [{ id: uid(), ...newB }, ...prev]);
    setShowNew(false);
  }
  function updateBonsai(id, patch){
    setBonsais(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
  }
  function removeBonsai(id){
    setBonsais(prev => prev.filter(b => b.id !== id));
  }

  /* ======= Checklist con deshacer ======= */
  function toggleTask(bid, key){
    setBonsais(prev => prev.map(b=>{
      if (b.id !== bid) return b;
      const tasks = b.tasks || [];
      const at = tasks.find(t => t.key === key);
      if (!at){
        return { ...b, tasks: [...tasks, { key, doneAt: Date.now() }] };
      } else {
        // deshacer
        return { ...b, tasks: tasks.filter(t => t.key !== key) };
      }
    }));
  }
  function nextDueLabel(tasks=[], lang='es'){
    // placeholder sencillo: 3 días riego, 30 abono:
    const rule = {
      water: 3, // días
      fertilize: 30,
      prune: 90
    };
    const out = {};
    ['water','fertilize','prune'].forEach(k=>{
      const last = tasks.find(t => t.key===k)?.doneAt || 0;
      const due = new Date((last||Date.now()) + (rule[k]*86400000));
      out[k] = fmtDate(due, lang);
    });
    return out;
  }

  /* ======= UI ======= */
  const [locQuery, setLocQuery] = useState('');
  const [locError, setLocError] = useState('');

  async function handleUseMyLocation(){
    setLocError('');
    if (!('geolocation' in navigator)){ setLocError('Tu navegador no permite geolocalización.'); return; }
    navigator.geolocation.getCurrentPosition(async (pos)=>{
      try{
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const place = await reverseByCoords(lat, lon, 'es');
        setSettings(s => ({ ...s, location: place }));
      }catch(err){ setLocError(err?.message || 'Error al ubicar'); }
    }, (err)=>{
      setLocError(err?.message || 'No se pudo acceder a la ubicación');
    }, { enableHighAccuracy:true, timeout: 10000 });
  }

  async function handleSearchLocation(){
    setLocError('');
    const q = locQuery.trim();
    if (!q) { setLocError('Escribe una ciudad (ej. Lima, Perú)'); return; }
    try{
      const place = await geocodeByName(q, 'es');
      setSettings(s=>({ ...s, location: place }));
    }catch(err){
      setLocError('No encontrado. Intenta “Ciudad, País”.');
    }
  }

  /* ======= Derivados ======= */
  const countBonsais = bonsais.length;

  /* ======= Forms ======= */
  function NewForm({ onCancel, onSave }){
    const [name, setName] = useState('');
    const [species, setSpecies] = useState('');
    const [notes, setNotes] = useState('');
    const [useSensor, setUseSensor] = useState(false);
    const [photo, setPhoto] = useState(null);

    const ideals = useMemo(()=> pickSensorIdeals(species), [species]);

    function onFile(e){
      const f = e.target.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = (ev)=> setPhoto(ev.target.result);
      reader.readAsDataURL(f);
    }

    return (
      <Modal open title="Nuevo bonsái" onClose={onCancel}
        footer={
          <>
            <button className="zb-btn" onClick={onCancel}>Cancelar</button>
            <button className="zb-btn zb-btn--primary" onClick={()=>{
              onSave({
                name: name || 'Sin nombre',
                species,
                notes,
                photo,
                photos: photo ? [{src:photo, at:Date.now()}] : [],
                createdAt: Date.now(),
                tasks: [],
                sensor: useSensor ? { use:true, ideals } : { use:false }
              });
            }}>Guardar</button>
          </>
        }>
        <div className="zb-form">
          <label>Nombre<input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej. Junípero shohin" /></label>
          <label>Especie<input value={species} onChange={e=>setSpecies(e.target.value)} placeholder="Ej. Juniperus chinensis" /></label>
          <label>Foto inicial<input type="file" accept="image/*" onChange={onFile} /></label>
          {photo && <img alt="preview" src={photo} className="zb-photo_prev" />}
          <label>Notas<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Apuntes, procedencia, etc." /></label>
          <label className="zb-row">
            <span>¿Usar sensor?</span>
            <input type="checkbox" checked={useSensor} onChange={e=>setUseSensor(e.target.checked)} />
          </label>
          {useSensor && (
            <div className="zb-sensor_box">
              <div><b>Lux:</b> {ideals.lux}</div>
              <div><b>Humedad sustrato:</b> {ideals.humidity}</div>
              <div><b>EC (fertilidad):</b> {ideals.ec}</div>
              <small>Estos son rangos ideales estimados según la especie.</small>
            </div>
          )}
        </div>
      </Modal>
    );
  }

  function LocationModal(){
    return (
      <Modal open={showLoc} onClose={()=>setShowLoc(false)} title="Ubicación y calendario">
        <div className="zb-form">
          <div className="zb-row">
            <input value={locQuery} onChange={e=>setLocQuery(e.target.value)} placeholder="Ej. Lima, Perú" />
            <button className="zb-btn" onClick={handleSearchLocation}>Buscar</button>
          </div>
          <button className="zb-btn" onClick={handleUseMyLocation}>Usar mi ubicación</button>
          <label className="zb-row">
            <span>Calendario lunar</span>
            <input type="checkbox" checked={!!settings.lunar} onChange={e=>setSettings(s=>({...s, lunar:e.target.checked}))} />
          </label>
          {!!locError && <div className="zb-error">Open-Meteo: {locError}</div>}
          <div className="zb-help">
            {settings.location
              ? <>Actual: <b>{settings.location.name}</b></>
              : <>Sin ubicación configurada.</>}
          </div>
        </div>
      </Modal>
    );
  }

  function BonsaiCard({ b }){
    const tasks = b.tasks || [];
    const next = nextDueLabel(tasks, lang);
    const spec = b.species ? findSpeciesEntry(b.species) : null;

    return (
      <div className="zb-item">
        <div className="zb-item_media">
          {b.photo
            ? <img src={b.photo} alt={b.name} />
            : <div className="zb-ph">🌱</div>}
        </div>
        <div className="zb-item_body">
          <div className="zb-item_title">{b.name}</div>
          <div className="zb-item_sub">
            {b.species || 'Especie no definida'}
          </div>

          {/* Checklist rápida con toggle/undo */}
          <div className="zb-chip_row">
            <Chip tone="teal" active={!!tasks.find(t=>t.key==='water')} onClick={()=>toggleTask(b.id,'water')}>💧 Riego · prox {next.water}</Chip>
            <Chip tone="amber" active={!!tasks.find(t=>t.key==='fertilize')} onClick={()=>toggleTask(b.id,'fertilize')}>🧪 Abono · prox {next.fertilize}</Chip>
            <Chip tone="pink" active={!!tasks.find(t=>t.key==='prune')} onClick={()=>toggleTask(b.id,'prune')}>✂️ Poda · prox {next.prune}</Chip>
          </div>

          {/* Sensores (si activó) */}
          {b?.sensor?.use && (
            <div className="zb-sensor_inline">
              <div><b>Lux:</b> {b.sensor.ideals.lux}</div>
              <div><b>Hum.:</b> {b.sensor.ideals.humidity}</div>
              <div><b>EC:</b> {b.sensor.ideals.ec}</div>
            </div>
          )}

          {/* Cuidados de especie (resumen) */}
          {spec && tipsDB?.species && (
            <details className="zb-details">
              <summary>Cuidados de tu especie</summary>
              <div className="zb-text">
                {tipsDB.species[spec.scientific_name]
                  ? tipsDB.species[spec.scientific_name]
                  : 'Consejos generales: riega cuando el sustrato lo pida (no por días fijos), abona en temporada de crecimiento y evita enraizar encharcado.'}
              </div>
            </details>
          )}
        </div>
        <div className="zb-item_actions">
          <button className="zb-icon" title="Eliminar" onClick={()=>removeBonsai(b.id)}>🗑️</button>
        </div>
      </div>
    );
  }

  return (
    <div className="zb-app">
      {/* Header */}
      <header className="zb-header">
        <div className="zb-header_inner">
          <div className="zb-brand">
            <span className="zb-leaf">🍃</span> <b>ZenBonsai</b>
          </div>
          <div className="zb-header_actions">
            <Chip onClick={()=>{}} tone="neutral" active>
              {settings.location ? settings.location.name : 'Sin ubicación'} · Luna: {settings.lunar ? 'on':'off'}
            </Chip>
            <Chip onClick={()=>setShowLoc(true)} tone="indigo">📍 Ubicación</Chip>
            <Chip onClick={()=>setShowNew(true)} tone="green">➕ Nuevo</Chip>
          </div>
        </div>
      </header>

      <main className="zb-main">
        {/* Próximos días sugeridos */}
        <SectionCard title="Próximos días sugeridos" icon="🗓" right={
          <button className="zb-pill zb-pill--alert" onClick={()=>setShowLoc(true)}>Configura ubicación</button>
        }>
          {settings.lunar && settings.location && moon.status==='done' && moon.rows.length>0 ? (
            <div className="zb-row_wrap">
              {moon.rows.slice(0,6).map((m)=>(
                <div key={m.date} className="zb-sugg">
                  <div className="zb-sugg_title">{fmtDate(m.date, lang)}</div>
                  <div className="zb-sugg_badge">{moonLabel(m.phase)}</div>
                  <div className="zb-sugg_note">Si usas calendario lunar, úsalo como referencia complementaria.</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="zb-empty">
              {settings.lunar
                ? 'Necesitas una ubicación para calcular fases lunares.'
                : 'Abre “Ubicación” y activa (si quieres) calendario lunar.'}
              {moon.status==='error' && <div className="zb-error">Open-Meteo: {moon.error}</div>}
            </div>
          )}
        </SectionCard>

        {/* Colección */}
        <SectionCard title="Tu colección" icon="🪴" count={countBonsais} right={null}>
          {countBonsais===0 ? (
            <div className="zb-empty">Pulsa “Nuevo” para registrar el primero.</div>
          ) : (
            <div className="zb-list">
              {bonsais.map(b => <BonsaiCard key={b.id} b={b} />)}
            </div>
          )}
        </SectionCard>

        {/* Herramientas */}
        <SectionCard title="Herramientas y usos" icon="🛠">
          {!toolsDB?.tools
            ? <div className="zb-empty">Sin datos de herramientas.</div>
            : (
              <div className="zb-grid">
                {toolsDB.tools.map(t => (
                  <div key={t.id} className="zb-tile">
                    <div className="zb-tile_title">{t.name}</div>
                    <div className="zb-tile_sub">{t.uses?.join(' · ')}</div>
                  </div>
                ))}
              </div>
            )}
        </SectionCard>

        {/* Estilos (galería compacta) */}
        <SectionCard title="Estilos" icon="🎴">
          {!stylesDB?.styles
            ? <div className="zb-empty">Sin estilos cargados.</div>
            : (
              <div className="zb-grid">
                {stylesDB.styles.map(st => (
                  <div key={st.id} className="zb-tile">
                    {st.image && <img src={st.image} alt={st.name} className="zb-figure" />}
                    <div className="zb-tile_title">{st.name}</div>
                    <div className="zb-tile_sub">{st.alias || ''}</div>
                  </div>
                ))}
              </div>
            )}
        </SectionCard>

        {/* Propagación */}
        <SectionCard title="Propagación" icon="🌱">
          {!propagationDB?.methods
            ? <div className="zb-empty">Sin métodos cargados.</div>
            : (
              <ul className="zb-bullets">
                {propagationDB.methods.map(m => <li key={m.id}><b>{m.name}:</b> {m.summary}</li>)}
              </ul>
            )}
        </SectionCard>
      </main>

      {/* Modales */}
      {showNew && <NewForm onCancel={()=>setShowNew(false)} onSave={addBonsai} />}
      <LocationModal />
    </div>
  );
}
