import React, { useEffect, useMemo, useRef, useState } from 'react';
import './zen.css';

/* ========= Helpers de almacenamiento / texto ========= */
const loadLS = (k, fb) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; } };
const saveLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g,' ').trim();
function setCache(key, value, ttlH=24){ const exp = Date.now()+ttlH*3600*1000; saveLS(key,{exp,value}); }
function getCache(key){ try{const raw=loadLS(key,null); if(!raw) return null; if(!raw.exp||Date.now()>raw.exp){localStorage.removeItem(key); return null;} return raw.value;}catch{return null;}}

/* ========= Búsqueda de especie en species.json ========= */
function findSpeciesEntry(db, input){
  if(!db?.species?.length||!input) return null;
  const n = norm(input);
  let hit = db.species.find(sp=>norm(sp.scientific_name)===n);
  if(!hit){
    hit = db.species.find(sp => {
      const es=(sp.common_names?.es||[]).map(norm);
      const en=(sp.common_names?.en||[]).map(norm);
      return es.includes(n)||en.includes(n);
    });
  }
  if(!hit) hit = db.species.find(sp => norm(sp.scientific_name).startsWith(n));
  if(!hit){
    const genus=n.split(' ')[0];
    if(genus){
      const candidates = db.species.filter(sp=>norm(sp.scientific_name).startsWith(genus+' '));
      if(candidates.length) hit = { ...candidates[0], _genusFallback:true };
    }
  }
  return hit||null;
}

/* ========= Open-Meteo (geocoding + astronomía) ========= */
async function geocodeCity(q, lang='es'){
  const url=`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=${lang}&format=json`;
  const r=await fetch(url); if(!r.ok) throw new Error('No se pudo geocodificar');
  const j=await r.json(); if(!j.results?.length) throw new Error('No encontrado');
  const { latitude, longitude, timezone, country, name, admin1 } = j.results[0];
  return { lat:latitude, lon:longitude, tz:timezone, country, city:name, region:admin1||'' };
}
async function reverseGeocode(lat,lon,lang='es'){
  const j = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=${lang}`).then(r=>r.json());
  const r=j.results?.[0]||{};
  return { tz:r.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone, country:r.country||'', city:r.name||r.admin1||'', region:r.admin1||'' };
}
async function getDeviceLocation(){
  return new Promise((res,rej)=>{
    if(!navigator.geolocation) return rej(new Error('Sin geolocalización'));
    navigator.geolocation.getCurrentPosition(p=>res({lat:p.coords.latitude, lon:p.coords.longitude}), rej, {enableHighAccuracy:true, timeout:12000});
  });
}
async function loadAstronomy(lat,lon,tz){
  const key=`astro_${lat.toFixed(3)}_${lon.toFixed(3)}_${tz}`;
  const c=getCache(key); if(c) return c;
  const j=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=sunrise,sunset,moon_phase,moonrise,moonset&timezone=${encodeURIComponent(tz)}`).then(r=>r.json());
  setCache(key, j.daily, 24); return j.daily;
}
const hemisphereFromLat = (lat)=> (lat>=0?'N':'S');
function moonLabel(x){ if(x==null) return ''; if(x<0.03||x>0.97) return 'Luna nueva'; if(x<0.22) return 'Creciente (c.)'; if(x<0.28) return 'Cuarto creciente'; if(x<0.47) return 'Gibosa creciente'; if(x<0.53) return 'Luna llena'; if(x<0.72) return 'Gibosa menguante'; if(x<0.78) return 'Cuarto menguante'; return 'Menguante (c.)'; }

/* ========= Ventanas por mes + regla lunar simple ========= */
const WINDOWS = {
  repot: { N:[2,3],  S:[8,9] },
  structural_prune: { N:[1,2,11,12], S:[5,6,7,8] },
  wiring: { N:[2,3,10,11], S:[4,5,8,9] },
  defoliation: { N:[6,7], S:[12,1] }
};
const monthsFor = (act, hemi)=> WINDOWS[act]?.[hemi]||[];
const lunarOk = (act, phase)=> {
  if(phase==null) return true;
  if(act==='structural_prune') return (phase>=0.50);
  if(act==='repot') return !(phase>0.45&&phase<0.55);
  return true;
};

/* ========= Sensores (rangos base por tipo) ========= */
const IDEALS = {
  conifera:     { lux:[25000,80000], rh:[40,60],  ec:[0.8,1.5] },
  caducifolio:  { lux:[15000,60000], rh:[50,70],  ec:[1.0,1.8] },
  tropical:     { lux:[10000,40000], rh:[60,80],  ec:[1.2,2.0] }
};
function inferType(entry){
  const name = (entry?.scientific_name||'').toLowerCase();
  if(name.includes('juniperus')||name.includes('pinus')||name.includes('picea')||name.includes('taxus')) return 'conifera';
  if(name.includes('ficus')||name.includes('serissa')||name.includes('bougainvillea')||name.includes('carmona')) return 'tropical';
  return 'caducifolio';
}

/* ========= Imágenes de referencia (Wikipedia thumbs) ========= */
async function fetchSpeciesImages(scientific){
  if(!scientific) return [];
  const key=`imgs_${scientific}`;
  const c=getCache(key); if(c) return c;
  const q = encodeURIComponent(`${scientific} bonsai`);
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&generator=search&gsrsearch=${q}&gsrlimit=8&piprop=thumbnail&pithumbsize=360&format=json&origin=*`;
  try{
    const j=await fetch(url).then(r=>r.json());
    const pages = Object.values(j.query?.pages||{});
    const imgs = pages.map(p=>p.thumbnail?.source).filter(Boolean);
    setCache(key, imgs, 6); return imgs;
  }catch{ return []; }
}

/* ========= UI Atoms ========= */
const Chip = ({children,color}) => <span className="zb-chip" data-color={color||''}>{children}</span>;
function Button({children,onClick,kind='primary',...rest}){ return <button className={`zb-btn zb-btn--${kind}`} onClick={onClick} {...rest}>{children}</button>; }
function Icon({name}){ return <span className={`zb-ico zb-ico--${name}`} aria-hidden/>; }

function Accordion({icon,title,children,defaultOpen=false, extra}){
  const [open,setOpen]=useState(defaultOpen);
  return (
    <div className={`zb-accordion ${open?'is-open':''}`}>
      <button className="zb-accordion__head" onClick={()=>setOpen(o=>!o)}>
        <div className="zb-row"><Icon name={icon}/><strong>{title}</strong></div>
        <div className="zb-row">{extra}<span className="zb-caret"/></div>
      </button>
      {open && <div className="zb-accordion__body">{children}</div>}
    </div>
  );
}
function SearchBox({value,onChange,placeholder='Buscar...'}) {
  return (
    <div className="zb-search">
      <Icon name="search"/><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>
    </div>
  );
}

/* ========= Modal ========= */
function Modal({open,onClose,title,children,footer}){
  if(!open) return null;
  return (
    <div className="zb-modal__backdrop">
      <div className="zb-modal">
        <div className="zb-modal__head">
          <strong className="zb-modal__title">{title}</strong>
          <button className="zb-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="zb-modal__body">{children}</div>
        {footer && <div className="zb-modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ========= Style Wizard (galería) ========= */
function StyleWizard({open,onClose,stylesDB,onPick}){
  const [q,setQ]=useState({ recto:false, curvas:false, inclinacion:0, ramaCae:false, copaArriba:false, ramifina:false, viento:false });
  function score(e){ let s=0; if(q.recto && e.id==='chokkan') s+=3; if(q.curvas && e.id==='moyogi') s+=3; if(q.inclinacion>=25 && e.id==='shakkan') s+=3; if(q.ramaCae && (e.id==='kengai'||e.id==='han_kengai')) s+=3; if(q.copaArriba && e.id==='bunjin') s+=3; if(q.ramifina && e.id==='hokidachi') s+=3; if(q.viento && e.id==='fukinagashi') s+=3; return s; }
  const ranked = useMemo(()=> (stylesDB?.estilos||[]).map(e=>({...e,_score:score(e)})).sort((a,b)=>b._score-a._score).slice(0,8), [q,stylesDB]);

  return (
    <Modal open={open} onClose={onClose} title="Sugerir estilo">
      {!stylesDB ? <div className="zb-skeleton" style={{height:80}}/> : (
        <>
        <div className="zb-grid-auto">
          <label className="zb-check"><input type="checkbox" checked={q.recto} onChange={e=>setQ({...q,recto:e.target.checked})}/> Tronco recto</label>
          <label className="zb-check"><input type="checkbox" checked={q.curvas} onChange={e=>setQ({...q,curvas:e.target.checked})}/> Tronco sinuoso</label>
          <label className="zb-range__wrap">Inclinación (°)
            <input className="zb-range" type="range" min={0} max={80} value={q.inclinacion} onChange={e=>setQ({...q,inclinacion:+e.target.value})}/>
            <span className="zb-range__val">{q.inclinacion}°</span>
          </label>
          <label className="zb-check"><input type="checkbox" checked={q.ramaCae} onChange={e=>setQ({...q,ramaCae:e.target.checked})}/> Rama/ápice bajo el borde</label>
          <label className="zb-check"><input type="checkbox" checked={q.copaArriba} onChange={e=>setQ({...q,copaArriba:e.target.checked})}/> Copa muy alta</label>
          <label className="zb-check"><input type="checkbox" checked={q.ramifina} onChange={e=>setQ({...q,ramifina:e.target.checked})}/> Ramificación fina</label>
          <label className="zb-check"><input type="checkbox" checked={q.viento} onChange={e=>setQ({...q,viento:e.target.checked})}/> Viento</label>
        </div>

        <div className="zb-gallery">
          {ranked.map(e=>(
            <figure key={e.id} className="zb-card zb-figure hover-raise" onClick={()=>{ onPick?.(e); onClose(); }} title="Elegir estilo">
              <img className="zb-photo" alt={e.nombre}
                   src={`https://source.unsplash.com/400x300/?bonsai,${encodeURIComponent(e.nombre)}`}
                   onError={(ev)=> ev.currentTarget.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22></svg>'}/>
              <figcaption className="zb-row zb-figure__cap">
                <strong>{e.nombre}</strong>
                <Chip color="soft">Dif. {e.dificultad}/5</Chip>
              </figcaption>
            </figure>
          ))}
        </div>
        </>
      )}
    </Modal>
  );
}

/* ========= Ajustes (ubicación + lunar) ========= */
function SettingsModal({open,onClose,settings,setSettings}){
  const [q,setQ]=useState(''); const [busy,setBusy]=useState(false); const [err,setErr]=useState('');
  async function bySearch(){ setBusy(true); setErr(''); try{ const geo=await geocodeCity(q,'es'); const astro=await loadAstronomy(geo.lat,geo.lon,geo.tz); setSettings({...settings, location:geo, astro, hemi:hemisphereFromLat(geo.lat)}); onClose?.(); }catch(e){setErr(e.message||'Error')}finally{setBusy(false);} }
  async function byDevice(){ setBusy(true); setErr(''); try{ const d=await getDeviceLocation(); const rev=await reverseGeocode(d.lat,d.lon,'es'); const geo={lat:d.lat,lon:d.lon,tz:rev.tz,country:rev.country,city:rev.city,region:rev.region}; const astro=await loadAstronomy(geo.lat,geo.lon,geo.tz); setSettings({...settings, location:geo, astro, hemi:hemisphereFromLat(geo.lat)}); onClose?.(); }catch(e){setErr(e.message||'Error')}finally{setBusy(false);} }
  return (
    <Modal open={open} onClose={onClose} title="Ubicación y calendario">
      <div className="zb-stack">
        <div className="zb-row">
          <input className="zb-input" placeholder="Ej: Lima, Perú" value={q} onChange={e=>setQ(e.target.value)}/>
          <Button onClick={bySearch} disabled={!q||busy}>Buscar</Button>
        </div>
        <Button kind="ghost" onClick={byDevice} disabled={busy}>Usar mi ubicación</Button>
        <label className="zb-switch"><input type="checkbox" checked={!!settings.useLunar} onChange={e=>setSettings({...settings,useLunar:e.target.checked})}/><span>Calendario lunar</span></label>
        {err && <div className="zb-error">{err}</div>}
        {settings?.location && <div className="zb-subtle">Ubicación: <b>{settings.location.city}</b>, {settings.location.country} · TZ {settings.location.tz} · Hemi {settings.hemi}</div>}
      </div>
    </Modal>
  );
}

/* ========= Registro (con sensores) ========= */
function NewBonsaiModal({open,onClose,onSave,speciesList}){
  const [name,setName]=useState(''); const [species,setSpecies]=useState(''); const [notes,setNotes]=useState('');
  const [file,setFile]=useState(null); const [busy,setBusy]=useState(false);
  const [useSensor,setUseSensor]=useState(false);
  const [type,setType]=useState('caducifolio');

  async function compress(file,maxW=1600,q=0.85){
    if(!file) return null;
    const img=document.createElement('img'); const url=URL.createObjectURL(file);
    await new Promise((res,rej)=>{img.onload=res; img.onerror=rej; img.src=url;});
    const scale=Math.min(1, maxW/img.width); const w=Math.round(img.width*scale), h=Math.round(img.height*scale);
    const c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h);
    const data=c.toDataURL('image/jpeg', q); URL.revokeObjectURL(url); return data;
  }
  async function save(){
    setBusy(true);
    try{
      let photo = await compress(file);
      const sensors = useSensor ? { enabled:true, type, targets: IDEALS[type] } : { enabled:false };
      onSave?.({
        id:'b'+Math.random().toString(36).slice(2,9),
        name: name.trim() || species || 'Mi bonsái',
        species: species.trim(),
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
        photo, photos: photo ? [{id:'p1',url:photo,at:new Date().toISOString()}] : [],
        tasks: [], history: [], style:null, sensors
      });
      onClose?.();
    } finally{ setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar bonsái" footer={<div className="zb-row-right"><Button kind="ghost" onClick={onClose}>Cancelar</Button><Button onClick={save} disabled={busy}>Guardar</Button></div>}>
      <div className="zb-form">
        <label>Nombre<input className="zb-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Opcional"/></label>
        <label>Especie (científico)
          <input className="zb-input" value={species} onChange={e=>setSpecies(e.target.value)} placeholder="Ej: Juniperus chinensis" list="speciesList"/>
          <datalist id="speciesList">{(speciesList||[]).map(s=><option key={s} value={s}/>)}</datalist>
        </label>
        <label>Notas<textarea className="zb-textarea" rows={3} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
        <label className="zb-file"><span>Foto inicial (opcional)</span><input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>

        <Accordion icon="sensor" title="¿Usas sensor? (lux / humedad / EC)" defaultOpen={false}
          extra={<label className="zb-switch"><input type="checkbox" checked={useSensor} onChange={e=>setUseSensor(e.target.checked)}/><span>{useSensor?'Sí':'No'}</span></label>}>
          {useSensor && (
            <>
              <div className="zb-row-wrap">
                <label className="zb-check"><input type="radio" name="t" checked={type==='conifera'} onChange={()=>setType('conifera')}/> Conífera</label>
                <label className="zb-check"><input type="radio" name="t" checked={type==='caducifolio'} onChange={()=>setType('caducifolio')}/> Caducifolio</label>
                <label className="zb-check"><input type="radio" name="t" checked={type==='tropical'} onChange={()=>setType('tropical')}/> Tropical</label>
              </div>
              <div className="zb-grid-auto">
                <div className="zb-card"><div className="zb-subtle">Lux</div><div className="zb-strong">{IDEALS[type].lux[0].toLocaleString()} – {IDEALS[type].lux[1].toLocaleString()}</div></div>
                <div className="zb-card"><div className="zb-subtle">Humedad (%)</div><div className="zb-strong">{IDEALS[type].rh[0]} – {IDEALS[type].rh[1]}</div></div>
                <div className="zb-card"><div className="zb-subtle">EC (mS/cm)</div><div className="zb-strong">{IDEALS[type].ec[0]} – {IDEALS[type].ec[1]}</div></div>
              </div>
            </>
          )}
        </Accordion>
      </div>
    </Modal>
  );
}

/* ========= Panels ========= */
function NextDaysPanel({settings}){
  if(!settings?.astro){
    return <Accordion icon="calendar" title="Próximos días sugeridos" defaultOpen={true} extra={<Chip color="danger">Configura ubicación</Chip>}>
      <div className="zb-muted">Abre “Ubicación” y activa (si quieres) calendario lunar.</div>
    </Accordion>;
  }
  const { time, moon_phase } = settings.astro; const hemi=settings.hemi||'N'; const items=[];
  for(let i=0;i<time.length;i++){ const d=time[i]; const m=Number(d.split('-')[1]); const moon=moon_phase?.[i];
    const actions=[]; if(monthsFor('repot',hemi).includes(m) && (!settings.useLunar||lunarOk('repot',moon))) actions.push('Trasplante');
    if(monthsFor('structural_prune',hemi).includes(m) && (!settings.useLunar||lunarOk('structural_prune',moon))) actions.push('Poda estructural');
    if(monthsFor('wiring',hemi).includes(m)) actions.push('Alambrado'); if(monthsFor('defoliation',hemi).includes(m)) actions.push('Defoliado parcial');
    if(actions.length) items.push({date:d, moon, actions}); if(items.length>=21) break;
  }
  return (
    <Accordion icon="calendar" title="Próximos días sugeridos" defaultOpen={true} extra={<Chip>{settings.location?.city}, {settings.location?.country}</Chip>}>
      {!items.length ? <div className="zb-muted">No hay acciones destacadas en las próximas semanas.</div> :
        <div className="zb-stack">{items.map((it,idx)=>(
          <div key={idx} className="zb-tile">
            <div><div className="zb-strong">{new Date(it.date).toLocaleDateString()}</div><div className="zb-subtle">{settings.useLunar?`Luna: ${moonLabel(it.moon)}`:'Lunar desactivado'}</div></div>
            <div className="zb-row-wrap">{it.actions.map((a,i)=><Chip key={i} color="mint">{a}</Chip>)}</div>
          </div>))}</div>}
    </Accordion>
  );
}

const KV = ({k,v}) => <div className="zb-card"><div className="zb-subtle">{k}</div><div className="zb-strong">{v}</div></div>;

function CareAndRefs({db,speciesName,tipsDB}){
  const [q,setQ]=useState('');
  const entry=useMemo(()=>findSpeciesEntry(db,speciesName),[db,speciesName]);
  if(!speciesName) return <div className="zb-muted">Define la especie para ver cuidados y referencias.</div>;
  if(!entry) return <div className="zb-muted">No encontré esta especie.</div>;
  const care=entry.care||null; const refs=entry.references||[]; const hasAny = care && Object.values(care).some(v=>v?.es||v?.en);
  function matches(txt){ const n=norm(q); return !n || (txt||'').toLowerCase().includes(n); }

  return (
    <>
    {entry._genusFallback && <div className="zb-callout">Te muestro recomendaciones del género <b>{entry.scientific_name.split(' ')[0]}</b>.</div>}
    <SearchBox value={q} onChange={setQ} placeholder="Buscar (luz, riego, abono, página…)" />
    {hasAny ? (
      <div className="zb-grid-auto">
        {care.light?.es && matches(care.light.es) && <KV k="Luz" v={care.light.es}/>}
        {care.watering?.es && matches(care.watering.es) && <KV k="Riego" v={care.watering.es}/>}
        {care.substrate?.es && matches(care.substrate.es) && <KV k="Sustrato" v={care.substrate.es}/>}
        {care.fertilization?.es && matches(care.fertilization.es) && <KV k="Abono" v={care.fertilization.es}/>}
        {care.pruning?.es && matches(care.pruning.es) && <KV k="Poda" v={care.pruning.es}/>}
        {care.repotting?.es && matches(care.repotting.es) && <KV k="Trasplante" v={care.repotting.es}/>}
        {care.wiring?.es && matches(care.wiring.es) && <KV k="Alambrado" v={care.wiring.es}/>}
      </div>
    ) : (
      <div className="zb-body">Aplica estos <b>tips generales</b> mientras tanto.</div>
    )}
    <div className="zb-strong" style={{marginTop:8}}>Referencias</div>
    {refs.length ? <ul className="zb-list">{refs.filter(r=>matches(`${r.title} ${r.pages}`)).map((r,i)=><li key={i}><span>{r.title}</span> — <em>{r.pages}</em></li>)}</ul> : <div className="zb-muted">Sin referencias.</div>}
    </>
  );
}

function PhotoStrip({species}){
  const [imgs,setImgs]=useState([]);
  useEffect(()=>{ let alive=true; (async()=>{
    const list=await fetchSpeciesImages(species); if(alive) setImgs(list);
  })(); return ()=>{alive=false}},[species]);
  if(!species) return null;
  return (
    <Accordion icon="images" title="Inspiración: trabajos en esta especie" defaultOpen={false}>
      {!imgs.length ? <div className="zb-muted">Cargando imágenes…</div> :
        <div className="zb-gallery">{imgs.map((src,i)=><img key={i} src={src} className="zb-photo" alt="ref"/>)}</div>}
    </Accordion>
  );
}

/* ========= Tarjeta de bonsái ========= */
function BonsaiCard({item,onUpdate,speciesDB,stylesDB,tipsDB}){
  const fileRef=useRef();
  const speciesEntry=useMemo(()=>findSpeciesEntry(speciesDB,item.species),[speciesDB,item.species]);

  const defaults = useMemo(()=>[
    { key:'riego', label:'Riego', freq:2 },
    { key:'abono', label:'Abono', freq:14 },
    { key:'poda', label:'Poda/Pinzado', freq:30 },
    { key:'rotacion', label:'Rotación', freq:7 },
    { key:'plagas', label:'Revisión plagas', freq:7 },
  ],[]);
  const mergedTasks = useMemo(()=>{
    const extra=(speciesEntry?.checklist_defaults||[]).map(t=>({key:t.key,label:t.labelES||t.labelEN||t.key,freq:t.freq_days||7}));
    const base=new Map(defaults.map(t=>[t.key,t])); for(const t of extra) base.set(t.key,t);
    const state=new Map((item.tasks||[]).map(t=>[t.key,t]));
    return Array.from(base.values()).map(t=>({...t,lastDone:state.get(t.key)?.lastDone||null}));
  },[speciesEntry,item.tasks,defaults]);

  function update(patch){ onUpdate?.({...item,...patch}); }
  async function addPhoto(f){ if(!f) return; const url=await (async(file,maxW=1600,q=0.85)=>{const img=document.createElement('img');const u=URL.createObjectURL(file);await new Promise((r,j)=>{img.onload=r;img.onerror=j;img.src=u;});const s=Math.min(1,maxW/img.width);const w=Math.round(img.width*s),h=Math.round(img.height*s);const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);const d=c.toDataURL('image/jpeg',q);URL.revokeObjectURL(u);return d;})(f);
    const ph={id:'p'+Math.random().toString(36).slice(2,7), url, at:new Date().toISOString()};
    update({ photos:[...(item.photos||[]),ph], photo:item.photo||url });
  }
  function toggleTask(key){
    const now=new Date().toISOString();
    const current=item.tasks||[];
    const idx=current.findIndex(t=>t.key===key);
    let next, hist;
    if(idx>=0 && current[idx].lastDone){ // deshacer
      next=[...current]; next[idx]={...next[idx], lastDone:null};
      hist=[{at:now,type:'undo_task',key},...(item.history||[])];
    }else{ // marcar
      const filtered=current.filter(t=>t.key!==key);
      filtered.push({key,lastDone:now});
      next=filtered;
      hist=[{at:now,type:'task',key},...(item.history||[])];
    }
    update({tasks:next, history:hist});
  }

  const [openStyle,setOpenStyle]=useState(false);

  // Sensores (mostrar info si activados)
  const activeType = item.sensors?.enabled ? (item.sensors.type || inferType(speciesEntry)) : null;
  const targets = activeType ? (item.sensors.targets || IDEALS[activeType]) : null;

  return (
    <div className="zb-card zb-card--panel">
      <div className="zb-card__top">
        <img src={item.photo || 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2264%22 height=%2248%22></svg>'} alt="cover" className="zb-cover"/>
        <div className="zb-grow">
          <div className="zb-title">{item.name}</div>
          <div className="zb-subtle">{item.species || 'Especie no definida'}</div>
        </div>
        <Button kind="ghost" onClick={()=>setOpenStyle(true)}><Icon name="style"/> Estilo</Button>
      </div>

      <div className="zb-card__body">
        <Accordion icon="info" title="Datos básicos" defaultOpen={false}>
          <div className="zb-grid-auto">
            <div><div className="zb-subtle">Nombre</div><input className="zb-input" value={item.name} onChange={e=>update({name:e.target.value})}/></div>
            <div><div className="zb-subtle">Especie</div><input className="zb-input" value={item.species} onChange={e=>update({species:e.target.value})} placeholder="Ej: Ficus microcarpa"/></div>
            <div className="zb-col-span"><div className="zb-subtle">Notas</div><textarea className="zb-textarea" rows={3} value={item.notes||''} onChange={e=>update({notes:e.target.value})}/></div>
          </div>
        </Accordion>

        <Accordion icon="care" title="Cuidados de tu especie" defaultOpen={true}>
          <CareAndRefs db={speciesDB} speciesName={item.species} tipsDB={tipsDB}/>
        </Accordion>

        <Accordion icon="check" title="Checklist" defaultOpen={false}>
          <div className="zb-stack">
            {mergedTasks.map(t=>(
              <div key={t.key} className="zb-tile">
                <div>
                  <div className="zb-strong">{t.label}</div>
                  <div className="zb-subtle">Cada {t.freq} días {t.lastDone && <>· última: <b>{new Date(t.lastDone).toLocaleDateString()}</b></>}</div>
                </div>
                <div className="zb-row">
                  {t.lastDone ? <Button kind="warn" onClick={()=>toggleTask(t.key)}>Deshacer</Button> : <Button kind="ok" onClick={()=>toggleTask(t.key)}>✓</Button>}
                </div>
              </div>
            ))}
          </div>
        </Accordion>

        {item.sensors?.enabled && targets && (
          <Accordion icon="sensor" title="Sensores y rangos ideales" defaultOpen={false} extra={<Chip color="soft">{activeType}</Chip>}>
            <div className="zb-grid-auto">
              <div className="zb-card"><div className="zb-subtle">Lux</div><div className="zb-strong">{targets.lux[0].toLocaleString()} – {targets.lux[1].toLocaleString()}</div></div>
              <div className="zb-card"><div className="zb-subtle">Humedad (%)</div><div className="zb-strong">{targets.rh[0]} – {targets.rh[1]}</div></div>
              <div className="zb-card"><div className="zb-subtle">EC (mS/cm)</div><div className="zb-strong">{targets.ec[0]} – {targets.ec[1]}</div></div>
            </div>
          </Accordion>
        )}

        <Accordion icon="photos" title="Evolución (fotos)" defaultOpen={false}>
          <label className="zb-file"><span>Agregar foto</span><input ref={fileRef} type="file" accept="image/*" onChange={e=>addPhoto(e.target.files?.[0])}/></label>
          {(!item.photos||!item.photos.length) ? <div className="zb-muted">Aún no hay fotos.</div> :
            <div className="zb-gallery">{item.photos.map(ph=>(
              <figure key={ph.id} className="zb-figure"><img src={ph.url} alt="" className="zb-photo"/><figcaption className="zb-subtle">{new Date(ph.at).toLocaleString()}</figcaption></figure>
            ))}</div>}
        </Accordion>

        <PhotoStrip species={item.species}/>
      </div>

      <StyleWizard open={openStyle} onClose={()=>setOpenStyle(false)} stylesDB={stylesDB} onPick={(st)=>update({style:st})}/>
    </div>
  );
}

/* ========= APP ========= */
export default function App(){
  const [bonsais,setBonsais]=useState(()=>loadLS('zb_bonsais',[])); useEffect(()=>saveLS('zb_bonsais',bonsais),[bonsais]);
  const [settings,setSettings]=useState(()=>loadLS('zb_settings',{useLunar:false})); useEffect(()=>saveLS('zb_settings',settings),[settings]);

  const [openNew,setOpenNew]=useState(false); const [openSettings,setOpenSettings]=useState(false);

  const [speciesDB,setSpeciesDB]=useState(null); const [stylesDB,setStylesDB]=useState(null);
  const [tipsDB,setTipsDB]=useState(null); const [toolsDB,setToolsDB]=useState(null); const [propagationDB,setPropagationDB]=useState(null);

  // Carga de datasets
  useEffect(()=>{ fetch('/species.json').then(r=>r.json()).then(setSpeciesDB).catch(()=>setSpeciesDB(null)); },[]);
  useEffect(()=>{ fetch('/estilos.es.json').then(r=>r.json()).then(setStylesDB).catch(()=>setStylesDB(null)); },[]);
  useEffect(()=>{ fetch('/tips_generales.es.json').then(r=>r.json()).then(setTipsDB).catch(()=>setTipsDB(null)); },[]);
  useEffect(()=>{ fetch('/tools.es.json').then(r=>r.json()).then(setToolsDB).catch(()=>setToolsDB(null)); },[]);
  useEffect(()=>{ fetch('/propagation.es.json').then(r=>r.json()).then(setPropagationDB).catch(()=>setPropagationDB(null)); },[]);

  // 🔧 Auto-cargar astronomía cuando ya hay ubicación
  useEffect(() => {
    (async () => {
      try {
        if (settings?.location && !settings?.astro) {
          const { lat, lon, tz } = settings.location;
          const astro = await loadAstronomy(lat, lon, tz);
          setSettings(s => ({
            ...s,
            astro,
            hemi: s.hemi || hemisphereFromLat(lat),
          }));
        }
      } catch (e) {
        console.error('No se pudo cargar astro:', e);
      }
    })();
  }, [settings.location]);

  const speciesList = useMemo(()=> (speciesDB?.species||[]).map(s=>s.scientific_name).filter(Boolean).sort((a,b)=>a.localeCompare(b)),[speciesDB]);

  const addBonsai = (it)=> setBonsais([it,...bonsais]);
  const updateBonsai = (u)=> setBonsais(bonsais.map(b=>b.id===u.id?u:b));

  return (
    <div className="zb-app">
      <header className="zb-header">
        <div className="zb-header__inner">
          <div className="zb-brand">🌿 ZenBonsai</div>
          <div className="zb-grow"/>
          <div className="zb-row">
            {settings?.location ? <Chip>{settings.location.city}, {settings.location.country} · {settings.useLunar?'Luna: on':'Luna: off'}</Chip> : <Chip color="danger">Sin ubicación</Chip>}
            <Button kind="ghost" onClick={()=>setOpenSettings(true)}><Icon name="gps"/> Ubicación</Button>
            <Button onClick={()=>setOpenNew(true)}><Icon name="plus"/> Nuevo</Button>
          </div>
        </div>
      </header>

      <main className="zb-main">
        <NextDaysPanel settings={settings}/>
        <Accordion icon="collection" title="Tu colección" defaultOpen={true} extra={<Chip color="soft">{bonsais.length}</Chip>}>
          {bonsais.length===0 ? <div className="zb-muted">Pulsa “Nuevo” para registrar el primero.</div> :
            <div className="zb-stack">{bonsais.map(b=> <BonsaiCard key={b.id} item={b} onUpdate={updateBonsai} speciesDB={speciesDB} stylesDB={stylesDB} tipsDB={tipsDB}/> )}</div>}
        </Accordion>

        {toolsDB?.length>0 && (
          <Accordion icon="tools" title="Herramientas y usos" defaultOpen={false}>
            <div className="zb-stack">{toolsDB.map(t=>(
              <div key={t.key} className="zb-card hover-raise">
                <div className="zb-card__row"><strong>{t.name_es}</strong><Chip color="soft">{t.key}</Chip></div>
                <div className="zb-body"><b>Uso:</b> {t.usage}</div>
                <div className="zb-body"><b>Por qué:</b> {t.why}</div>
                <div className="zb-warn"><b>Precauciones:</b> {t.cautions}</div>
              </div>
            ))}</div>
          </Accordion>
        )}
        {propagationDB?.length>0 && (
          <Accordion icon="prop" title="Propagación" defaultOpen={false}>
            <div className="zb-grid-auto">{propagationDB.map(p=>(
              <div key={p.key} className="zb-card hover-raise">
                <div className="zb-card__row"><strong>{p.title_es}</strong><Chip color="soft">{p.key}</Chip></div>
                <div className="zb-body">{p.summary_es}</div>
                {p.tips_es && <div className="zb-subtle" style={{marginTop:6}}>{p.tips_es}</div>}
              </div>
            ))}</div>
          </Accordion>
        )}
      </main>

      <NewBonsaiModal open={openNew} onClose={()=>setOpenNew(false)} onSave={addBonsai} speciesList={speciesList}/>
      <SettingsModal open={openSettings} onClose={()=>setOpenSettings(false)} settings={settings} setSettings={setSettings}/>
    </div>
  );
}
