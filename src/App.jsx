import React, { useEffect, useMemo, useRef, useState } from 'react'

/* ───────────────────────── Persistencia ───────────────────────── */
const LS_KEY = 'bonsaiKeeper:v1:data'
const LS_LANG = 'bonsaiKeeper:v1:lang'
const LS_ACH  = 'bonsaiKeeper:v1:ach'

function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36) }
function nowISO(){ return new Date().toISOString() }
function fmt(d, lang){ try{ return new Date(d).toLocaleString(lang==='es'?'es-PE':'en-US') }catch{ return d } }

/* ─────────── Comprimir imagen a JPG base64 (máx. 1280px) ─────────── */
async function compressImage(file, maxDim = 1280, quality = 0.82){
  const dataUrl = await new Promise((res, rej)=>{
    const fr = new FileReader()
    fr.onload = () => res(fr.result)
    fr.onerror = rej
    fr.readAsDataURL(file)
  })
  const img = await new Promise((res, rej)=>{
    const im = new Image()
    im.onload = () => res(im)
    im.onerror = rej
    im.src = dataUrl
  })
  const w = img.width, h = img.height
  const scale = Math.min(1, maxDim / Math.max(w, h))
  const cw = Math.round(w * scale), ch = Math.round(h * scale)
  const cnv = document.createElement('canvas')
  cnv.width = cw; cnv.height = ch
  const ctx = cnv.getContext('2d')
  ctx.drawImage(img, 0, 0, cw, ch)
  return cnv.toDataURL('image/jpeg', quality)
}

/* ───────────────────────────── i18n ───────────────────────────── */
const STR = {
  es: {
    app_title: 'ZenBonsai App',
    app_tag: 'Registra, identifica y cuida tu colección',
    search: 'Buscar…',
    all_species: 'Todas las especies',
    new: '+ Nuevo',
    empty_title: 'Aún no tienes bonsáis registrados',
    empty_sub: 'Agrega tu primer árbol y empecemos a cuidarlo.',
    new_bonsai: 'Nuevo bonsái',
    name: 'Nombre',
    location: 'Ubicación',
    loc_sun: 'Exterior soleado',
    loc_pshade: 'Exterior sombra parcial',
    loc_bright: 'Interior muy luminoso',
    species: 'Especie',
    notes_ident: 'Notas para identificar',
    notes_ph: 'Ej. aguja/escama, flor blanca, raíz gruesa…',
    suggest: 'Sugerencias',
    identify: 'Identificar especie',
    save: 'Guardar',
    cancel: 'Cancelar',
    photo: 'Foto',
    none_photo: 'Sin foto',
    species_tbc: 'Especie por confirmar',
    due_next: 'Próximos vencimientos',
    quick_actions: 'Acciones rápidas',
    log_water: 'Registrar riego',
    log_fert: 'Registrar abono',
    history: 'Historial',
    none_history: 'Sin registros aún.',
    care_tab: 'Cuidados',
    checklist_tab: 'Checklist',
    photos_tab: 'Fotos',
    learn_tab: 'Aprende & Inspírate',
    tips_tab: 'Tips generales',
    close: 'Cerrar',
    never: 'Nunca registrado',
    every: 'cada',
    days: 'días',
    overdue: '¡Vencido!',
    learn_loading: 'Cargando información…',
    learn_read: 'Leer en Wikipedia →',
    inspire_title: 'Inspiración (Wikimedia Commons)',
    inspire_note: 'Imágenes públicas desde Wikimedia Commons.',
    photo_note_ph: 'Nota de esta foto (opcional)',
    photos_empty: 'Aún no hay fotos. Agrega la primera para iniciar el control de cambios.',
    compare_title: 'Comparador (antes / después)',
    drag: 'Arrastra',
    before: 'Antes',
    after: 'Después',
    lang_label: 'Idioma',
    share: 'Compartir mi bonsái',
    // Tips
    tips_title: 'Tips generales de cuidado',
    tip1_t: 'Riega según necesidad, no por calendario',
    tip1_d: 'Prueba del dedo (1 cm). Si está ligeramente seco, riega a fondo.',
    tip2_t: 'Sustrato drenante',
    tip2_d: 'Akadama + pumice + lava. Evita encharcamientos.',
    tip3_t: 'Observa señales',
    tip3_d: 'Hojas decaídas que se recuperan tras regar = justo a tiempo.',
    tip4_t: 'Calidad y horario del riego',
    tip4_d: 'Mañana es ideal; lluvia/filtrada si es posible.',
    tip5_t: 'Paciencia y consistencia',
    tip5_d: 'Cada especie y clima mandan. Ajusta por estación.',
    // Logros
    ach_title: 'Logros',
    ach_first_tree: 'Primer bonsái registrado',
    ach_first_water: 'Primer riego registrado',
    ach_5_cares: '5 cuidados registrados',
    ach_before_after: 'Primer antes/después fotográfico',
    unlocked: 'Desbloqueado',
  },
  en: {
    app_title: 'ZenBonsai App',
    app_tag: 'Register, identify and care for your collection',
    search: 'Search…',
    all_species: 'All species',
    new: '+ New',
    empty_title: 'No bonsai registered yet',
    empty_sub: 'Add your first tree and let’s start caring for it.',
    new_bonsai: 'New bonsai',
    name: 'Name',
    location: 'Location',
    loc_sun: 'Sunny outdoor',
    loc_pshade: 'Partial shade outdoor',
    loc_bright: 'Very bright indoor',
    species: 'Species',
    notes_ident: 'Notes for identification',
    notes_ph: 'e.g., needles/scales, white flower, thick root…',
    suggest: 'Suggestions',
    identify: 'Identify species',
    save: 'Save',
    cancel: 'Cancel',
    photo: 'Photo',
    none_photo: 'No photo',
    species_tbc: 'Species to confirm',
    due_next: 'Upcoming due',
    quick_actions: 'Quick actions',
    log_water: 'Log watering',
    log_fert: 'Log fertilizing',
    history: 'History',
    none_history: 'No records yet.',
    care_tab: 'Care',
    checklist_tab: 'Checklist',
    photos_tab: 'Photos',
    learn_tab: 'Learn & Inspire',
    tips_tab: 'General Tips',
    close: 'Close',
    never: 'Never logged',
    every: 'every',
    days: 'days',
    overdue: 'Overdue!',
    learn_loading: 'Loading…',
    learn_read: 'Read on Wikipedia →',
    inspire_title: 'Inspiration (Wikimedia Commons)',
    inspire_note: 'Public images from Wikimedia Commons.',
    photo_note_ph: 'Note for this photo (optional)',
    photos_empty: 'No photos yet. Add one to start change tracking.',
    compare_title: 'Compare (before / after)',
    drag: 'Drag',
    before: 'Before',
    after: 'After',
    lang_label: 'Language',
    share: 'Share my bonsai',
    // Achievements
    ach_title: 'Achievements',
    ach_first_tree: 'First bonsai registered',
    ach_first_water: 'First watering logged',
    ach_5_cares: '5 care actions logged',
    ach_before_after: 'First before/after photo',
    unlocked: 'Unlocked',
  }
}

/* ───────────────────── Biblioteca de cuidados ───────────────────── */
const CARE_LIBRARY = {
  "Juniperus (Junípero)": {
    es: { luz: "Pleno sol 4–8h/día (evita interior).", riego: "Deja secar la capa superior; riegos profundos. 2–4×/sem verano; 1–2×/sem invierno.", abono: "Orgánico de liberación lenta primavera-otoño; líquido cada 2–4 semanas.", poda: "Pinzado de brotes blandos; estructural a fines de invierno.", sustrato: "Drenante (akadama 60–70% + pomice/volcánica).", trasplante: "Cada 2–3 años (fin de invierno)." },
    en: { luz: "Full sun 4–8h/day (avoid indoors).", riego: "Let top layer dry; deep waterings. 2–4×/week summer; 1–2×/week winter.", abono: "Slow-release organic spring–autumn; liquid every 2–4 weeks.", poda: "Pinch soft growth; structural in late winter.", sustrato: "Free-draining (akadama 60–70% + pumice/lava).", trasplante: "Every 2–3 years (late winter)." },
    wiki: { es: "Juniperus", en: "Juniperus" },
    inspireTerm: { es: "bonsái Juniperus", en: "bonsai Juniperus" }
  },
  "Ficus (Benjamina/Retusa)": {
    es: { luz: "Mucha luz brillante; puede interior luminoso.", riego: "Ritmo estable, evita encharcar.", abono: "Primavera a otoño cada 2–3 semanas.", poda: "Formación agresiva tolerada en clima cálido.", sustrato: "Poroso y aireado; drena rápido.", trasplante: "Cada 1–2 años." },
    en: { luz: "Bright light; can be indoors if very bright.", riego: "Steady rhythm, avoid waterlogging.", abono: "Spring–autumn every 2–3 weeks.", poda: "Aggressive shaping tolerated in warm climates.", sustrato: "Porous & airy; fast drainage.", trasplante: "Every 1–2 years." },
    wiki: { es: "Ficus_microcarpa", en: "Ficus_microcarpa" },
    inspireTerm: { es: "bonsái Ficus retusa", en: "bonsai Ficus retusa" }
  }
}
const SPECIES_LIST = Object.keys(CARE_LIBRARY)

/* ───────────────────── Checklist / Registro ───────────────────── */
const DEFAULT_TASKS = [
  { key:'riego', labelES:'Riego', labelEN:'Watering', freq:2 },
  { key:'abono', labelES:'Abono', labelEN:'Fertilizing', freq:14 },
  { key:'poda', labelES:'Poda/Pinzado', labelEN:'Pruning/Pinching', freq:30 },
  { key:'rotacion', labelES:'Rotación', labelEN:'Pot rotation', freq:7 },
  { key:'plagas', labelES:'Revisión de plagas', labelEN:'Pest check', freq:7 },
]
function initTasks(){ return DEFAULT_TASKS.map(t=>({ ...t, lastDone:null })) }
function nextDueLabel(tasks, lang){
  const out = {}
  tasks.forEach(t=>{
    if(!t.lastDone){ out[t.key] = `${STR[lang].never} · ${STR[lang].every} ${t.freq} ${STR[lang].days}`; return }
    const last = new Date(t.lastDone)
    const due = new Date(last.getTime()+t.freq*24*3600*1000)
    const days = Math.ceil((due - new Date())/(24*3600*1000))
    out[t.key] = days<=0 ? STR[lang].overdue : `${days} ${STR[lang].days}`
  })
  return out
}

/* ─────────────────────────── Logros ─────────────────────────── */
function defaultAch(){ return { firstTree:false, firstWater:false, fiveCares:false, beforeAfter:false, careCount:0 } }

/* ────────────────────────── UI helpers ───────────────────────── */
function Section({title, children, right}){
  return (
    <div style={{margin:'18px 0'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <h3 style={{margin:'6px 0'}}>{title}</h3>
        {right}
      </div>
      <div>{children}</div>
    </div>
  )
}
function Pill({children}){ return <span style={{fontSize:12, padding:'4px 8px', background:'#eef2ff', borderRadius:999, marginRight:6}}>{children}</span> }

/* ───────────────────────────── App ───────────────────────────── */
export default function App(){
  const [lang, setLang] = useState(localStorage.getItem(LS_LANG) || 'es')
  const [data, setData] = useState(()=> {
    try{ return JSON.parse(localStorage.getItem(LS_KEY)) || [] }catch{ return [] }
  })
  const [ach, setAch] = useState(()=> {
    try{ return JSON.parse(localStorage.getItem(LS_ACH)) || defaultAch() }catch{ return defaultAch() }
  })
  const [query,setQuery]=useState('')
  const [filter,setFilter]=useState('all')
  const [showNew,setShowNew]=useState(false)
  const [editing,setEditing]=useState(null)

  // Guardados
  useEffect(() => { localStorage.setItem(LS_LANG, lang) }, [lang])
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data))
    } catch (e) {
      console.warn('Error guardando en localStorage', e)
      alert('Tu colección es grande o la foto es pesada. Usa imágenes más livianas o elimina alguna foto para seguir guardando.')
    }
  }, [data])
  useEffect(() => {
    try {
      localStorage.setItem(LS_ACH, JSON.stringify(ach))
    } catch (e) {
      console.warn('Error guardando logros', e)
    }
  }, [ach])

  const filtered = useMemo(()=>{
    const q = query.trim().toLowerCase()
    return data.filter(b=>{
      const okSpecies = filter==='all' || b.species===filter
      const okQ = !q || [b.name,b.species,b.location,b.notes].join(' ').toLowerCase().includes(q)
      return okSpecies && okQ
    })
  },[data,query,filter])

  function addBonsai(b){
    setData(prev=>[b,...prev])
    if(!ach.firstTree) setAch({...ach, firstTree:true})
  }
  function updateBonsai(id, patch){
    setData(prev=>prev.map(b=>b.id===id?{...b, ...patch}:b))
  }
  function addHistory(id, item){
    setData(prev=>prev.map(b=> b.id===id ? {...b, history:[item,...(b.history||[])]} : b))
  }
  function logCare(id, key){
    setData(prev=> prev.map(b=>{
      if(b.id!==id) return b
      const tasks = (b.tasks||[]).map(t=> t.key===key ? {...t, lastDone: nowISO()} : t)
      return {...b, tasks}
    }))
    const lbl = key==='riego' ? (lang==='es'?'Riego':'Watering') : key==='abono' ? (lang==='es'?'Abono':'Fertilizing') : key
    addHistory(id, { id:uid(), type:'care', action:key, label:lbl, at: nowISO() })
    const newCount = ach.careCount + 1
    setAch(a=>{
      const up = {...a, careCount:newCount}
      if(key==='riego' && !a.firstWater) up.firstWater = true
      if(newCount>=5 && !a.fiveCares) up.fiveCares = true
      return up
    })
  }

  return (
    <div style={{maxWidth:980, margin:'0 auto', padding:'20px 16px 80px'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between', gap:12, flexWrap:'wrap'}}>
        <div>
          <h1 style={{margin:'4px 0'}}>{STR[lang].app_title}</h1>
          <div style={{color:'#64748b'}}>{STR[lang].app_tag}</div>
        </div>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <label style={{fontSize:12, color:'#64748b'}}>{STR[lang].lang_label}</label>
          <select value={lang} onChange={e=>setLang(e.target.value)}>
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
          <button onClick={()=>setShowNew(true)} style={{padding:'8px 12px', borderRadius:8, background:'#0ea5e9', color:'#fff', border:'none'}}>{STR[lang].new}</button>
        </div>
      </div>

      {/* Search */}
      <div style={{display:'flex', gap:8, marginTop:16, flexWrap:'wrap'}}>
        <input placeholder={STR[lang].search} value={query} onChange={e=>setQuery(e.target.value)}
               style={{flex:'1 1 260px', padding:'10px 12px', border:'1px solid #e5e7eb', borderRadius:8}}/>
        <select value={filter} onChange={e=>setFilter(e.target.value)} style={{padding:'10px 12px', borderRadius:8}}>
          <option value="all">{STR[lang].all_species}</option>
          {SPECIES_LIST.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Achievements */}
      <Section title={STR[lang].ach_title}>
        <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
          <Pill>{ach.firstTree ? '✅' : '⬜️'} {STR[lang].ach_first_tree}</Pill>
          <Pill>{ach.firstWater ? '✅' : '⬜️'} {STR[lang].ach_first_water}</Pill>
          <Pill>{ach.fiveCares ? '✅' : '⬜️'} {STR[lang].ach_5_cares}</Pill>
          <Pill>{ach.beforeAfter ? '✅' : '⬜️'} {STR[lang].ach_before_after}</Pill>
        </div>
      </Section>

      {/* List */}
      {filtered.length===0 ? (
        <div style={{textAlign:'center', padding:'48px 12px', color:'#64748b'}}>
          <h3 style={{marginBottom:6}}>{STR[lang].empty_title}</h3>
          <div>{STR[lang].empty_sub}</div>
        </div>
      ) : (
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px,1fr))', gap:12, marginTop:8}}>
          {filtered.map(b=> <BonsaiCard key={b.id} b={b} lang={lang}
                                onOpen={()=>setEditing(b)}
                                onLog={(k)=>logCare(b.id,k)} />)}
        </div>
      )}

      {/* Modals */}
      {showNew && <NewBonsaiModal lang={lang} onClose={()=>setShowNew(false)} onSave={addBonsai} />}
      {editing && <BonsaiModal lang={lang} bonsai={editing} onClose={()=>setEditing(null)}
                               onUpdate={(p)=>updateBonsai(editing.id,p)}
                               onHistory={(i)=>addHistory(editing.id,i)}
                               onAch={(p)=>setAch(a=>({...a,...p}))}
                              />}
    </div>
  )
}

/* ─────────────────────────── Card ─────────────────────────── */
function BonsaiCard({b, lang, onOpen, onLog}){
  const care = nextDueLabel(b.tasks||[], lang)
  const t = (k)=> ({es:{
      riego:'Riego', abono:'Abono', poda:'Poda', rotacion:'Rotación', plagas:'Plagas'
    }, en:{ riego:'Water', abono:'Fertilize', poda:'Prune', rotacion:'Rotate', plagas:'Pests'}}[lang][k])

  return (
    <div style={{border:'1px solid #e5e7eb', borderRadius:12, padding:12, background:'#fff'}}>
      <div style={{display:'flex', gap:12}}>
        <div style={{width:72, height:72, borderRadius:8, background:'#f1f5f9', overflow:'hidden'}}>
          {b.photo ? <img src={b.photo} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}}/> :
            <div style={{fontSize:11, color:'#94a3b8', display:'flex',alignItems:'center',justifyContent:'center',height:'100%'}}>No photo</div>}
        </div>
        <div style={{flex:1}}>
          <div style={{fontWeight:600}}>{b.name||'—'}</div>
          <div style={{fontSize:12, color:'#64748b'}}>{b.species|| (lang==='es'? 'Especie por confirmar' : 'Species to confirm')}</div>
          <div style={{marginTop:6, display:'flex', gap:6, flexWrap:'wrap'}}>
            {Object.keys(care).slice(0,3).map(k=><Pill key={k}>{t(k)}: {care[k]}</Pill>)}
          </div>
        </div>
      </div>
      <div style={{display:'flex', gap:8, marginTop:10}}>
        <button onClick={()=>onLog('riego')} style={btn('emerald')}>{STR[lang].log_water}</button>
        <button onClick={()=>onLog('abono')}  style={btn('amber')}>{STR[lang].log_fert}</button>
        <button onClick={onOpen} style={{...btn('slate'), flex:1}}>Detalle</button>
      </div>
    </div>
  )
}

/* ─────────────────────── New Modal ─────────────────────── */
function NewBonsaiModal({lang, onClose, onSave}){
  const [name,setName]=useState('')
  const [species,setSpecies]=useState('')
  const [location,setLocation]=useState('sun')
  const [notes,setNotes]=useState('')
  const [photo,setPhoto]=useState('')

  const suggestions = useMemo(()=> SPECIES_LIST.filter(s=> s.toLowerCase().includes(notes.toLowerCase()) || s.toLowerCase().includes(name.toLowerCase())).slice(0,5), [notes,name])

  async function handleFile(e){
    const f = e.target.files?.[0]; if(!f) return
    try{
      const small = await compressImage(f, 1280, 0.82)
      setPhoto(small)
    }catch(err){
      console.warn('No se pudo comprimir la imagen', err)
      alert('No se pudo procesar la imagen. Intenta con otra foto.')
    }
  }
  function save(){
    onSave({
      id: uid(),
      name, species: species||'', location,
      notes, photo,
      createdAt: nowISO(),
      tasks: initTasks(),
      history: [],
      photos: photo ? [{id:uid(), at:nowISO(), src:photo, note:''}] : []
    })
    onClose()
  }

  return (
    <Modal onClose={onClose} title={STR[lang].new_bonsai} lang={lang}>
      <div style={grid2}>
        <div>
          <label className="lbl">{STR[lang].name}</label>
          <input className="in" value={name} onChange={e=>setName(e.target.value)}/>
        </div>
        <div>
          <label className="lbl">{STR[lang].species}</label>
          <input className="in" value={species} onChange={e=>setSpecies(e.target.value)} list="speciesList"/>
          <datalist id="speciesList">
            {SPECIES_LIST.map(s=><option key={s} value={s}/>)}
          </datalist>
        </div>
        <div>
          <label className="lbl">{STR[lang].location}</label>
          <select className="in" value={location} onChange={e=>setLocation(e.target.value)}>
            <option value="sun">{STR[lang].loc_sun}</option>
            <option value="pshade">{STR[lang].loc_pshade}</option>
            <option value="bright">{STR[lang].loc_bright}</option>
          </select>
        </div>
        <div>
          <label className="lbl">{STR[lang].notes_ident}</label>
          <input className="in" value={notes} onChange={e=>setNotes(e.target.value)} placeholder={STR[lang].notes_ph}/>
          {suggestions.length>0 && (
            <div style={{marginTop:4, fontSize:12}}>
              <b>{STR[lang].suggest}:</b> {suggestions.join(' · ')}
            </div>
          )}
        </div>
        <div>
          <label className="lbl">{STR[lang].photo}</label>
          <input type="file" accept="image/*" onChange={handleFile}/>
          <div style={{marginTop:6, width:'100%', maxWidth:220, borderRadius:8, overflow:'hidden', background:'#f1f5f9'}}>
            {photo ? <img src={photo} style={{width:'100%', display:'block'}}/> : <div style={{padding:12, fontSize:12, color:'#94a3b8'}}>{STR[lang].none_photo}</div>}
          </div>
        </div>
      </div>
      <div style={{display:'flex', gap:8, marginTop:12}}>
        <button onClick={save} style={btn('emerald')}>{STR[lang].save}</button>
        <button onClick={onClose} style={btn('slate')}>{STR[lang].cancel}</button>
      </div>
    </Modal>
  )
}

/* ────────────────────── Detail Modal ────────────────────── */
function BonsaiModal({lang, bonsai, onClose, onUpdate, onHistory, onAch}){
  const [tab, setTab] = useState('care') // care | checklist | photos | learn | tips
  const lib = CARE_LIBRARY[bonsai.species] || null

  const [wiki, setWiki] = useState({loading:false, title:'', extract:'', url:''})
  const [pics, setPics] = useState([])

  useEffect(()=>{
    if(tab!=='learn') return
    if(!lib) return
    const title = lib.wiki?.[lang] || lib.wiki?.es || ''
    if(!title) return
    setWiki({loading:true})
    fetch(`https://${lang==='es'?'es':'en'}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
      .then(r=>r.json())
      .then(j=> setWiki({loading:false, title:j.title, extract:j.extract, url:j.content_urls?.desktop?.page || j.content_urls?.mobile?.page || ''}))
      .catch(()=> setWiki({loading:false, title:'', extract:'', url:''}))

    const term = lib.inspireTerm?.[lang] || lib.inspireTerm?.es || bonsai.species
    fetch(`https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(term)}&gsrlimit=8&prop=imageinfo&iiprop=url`)
      .then(r=>r.json())
      .then(j=>{
        const arr = Object.values(j.query?.pages||{}).map(p=> p.imageinfo?.[0]?.url).filter(Boolean)
        setPics(arr)
      }).catch(()=>setPics([]))
  },[tab, lang, bonsai.species])

  function mark(taskKey){
    onUpdate({ tasks: (bonsai.tasks||[]).map(t=> t.key===taskKey ? {...t, lastDone:nowISO()} : t) })
    onHistory({ id:uid(), type:'care', action:taskKey, label:taskKey, at:nowISO() })
  }

  async function addPhoto(file, note){
    try{
      const small = await compressImage(file, 1280, 0.82)
      const entry = { id:uid(), at:nowISO(), src:small, note:note||'' }
      const list = [entry, ...(bonsai.photos||[])]
      onUpdate({ photos:list })
      onHistory({ id:uid(), type:'photo', at:nowISO(), note })
      if(list.length>=2) onAch({ beforeAfter:true })
    }catch(err){
      console.warn('No se pudo agregar la foto', err)
      alert('La foto es muy pesada o no se pudo procesar.')
    }
  }

  function shareImage(){
    const imgSrc = (bonsai.photos?.[0]?.src) || bonsai.photo
    const cnv = document.createElement('canvas')
    const W=1080,H=1350; cnv.width=W; cnv.height=H
    const ctx = cnv.getContext('2d')
    ctx.fillStyle='#0f172a'; ctx.fillRect(0,0,W,H)
    function draw(){
      if(img){
        const r = Math.min((W-160)/img.width, (H-540)/img.height)
        const w = img.width*r, h = img.height*r
        const x = (W-w)/2, y = 140
        ctx.drawImage(img, x,y,w,h)
      } else {
        ctx.fillStyle='#1e293b'; ctx.fillRect(80,140,W-160,H-540)
      }
      ctx.fillStyle='#10b981'; ctx.font='bold 56px system-ui, -apple-system'
      ctx.fillText('ZenBonsai', 80, 88)
      ctx.fillStyle='#e2e8f0'; ctx.font='bold 54px system-ui'
      ctx.fillText(bonsai.name || 'Mi bonsái', 80, H-300)
      ctx.fillStyle='#94a3b8'; ctx.font='28px system-ui'
      ctx.fillText((bonsai.species|| (lang==='es'?STR[lang].species_tbc:'Species to confirm')), 80, H-252)
      ctx.fillStyle='#64748b'; ctx.font='24px system-ui'
      ctx.fillText((lang==='es'?'Crecimiento · Checklist · Antes/Después':'Growth · Checklist · Before/After'), 80, H-210)
      const url = 'zenbonsai.vercel.app'
      ctx.fillStyle='#94a3b8'; ctx.font='24px system-ui'; ctx.fillText(url, 80, H-170)

      const data = cnv.toDataURL('image/png')
      const a = document.createElement('a'); a.href=data; a.download='ZenBonsai-share.png'; a.click()
      if(navigator.share){
        try{ fetch(data).then(r=>r.blob()).then(b=>{
          const file = new File([b], 'ZenBonsai.png', {type:'image/png'})
          navigator.share({ files:[file], title:'ZenBonsai', text:bonsai.name||'Mi bonsái' })
        }) }catch{}
      }
    }
    let img = null
    if(imgSrc){ img = new Image(); img.crossOrigin='anonymous'; img.onload=draw; img.src=imgSrc } else { draw() }
  }

  const care = nextDueLabel(bonsai.tasks||[], lang)

  return (
    <Modal onClose={onClose} title={bonsai.name || 'Bonsái'} lang={lang}>
      {/* Tabs */}
      <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:8}}>
        {['care','checklist','photos','learn','tips'].map(k=>
          <button key={k} onClick={()=>setTab(k)}
                  style={{padding:'8px 10px', borderRadius:999, border:'1px solid #e5e7eb',
                          background: tab===k? '#0ea5e9' : '#fff', color: tab===k? '#fff':'#334155'}}>
            {k==='care'?STR[lang].care_tab: k==='checklist'?STR[lang].checklist_tab: k==='photos'?STR[lang].photos_tab: k==='learn'?STR[lang].learn_tab: STR[lang].tips_tab}
          </button>)}
        <div style={{flex:1}}/>
        <button onClick={shareImage} style={btn('emerald')}>{STR[lang].share}</button>
      </div>

      {tab==='care' && (
        <div>
          <div style={{display:'flex', gap:12}}>
            <div style={{width:120, height:120, borderRadius:12, overflow:'hidden', background:'#f1f5f9'}}>
              {bonsai.photo ? <img src={bonsai.photo} style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <div style={{padding:12, fontSize:12, color:'#94a3b8'}}>{STR[lang].none_photo}</div>}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:18, fontWeight:700}}>{bonsai.name}</div>
              <div style={{fontSize:13, color:'#64748b', marginBottom:6}}>{bonsai.species || (lang==='es'?STR[lang].species_tbc:'Species to confirm')}</div>
              <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                {Object.keys(care).map(k=> <Pill key={k}>{(k==='riego'&&lang==='es')?'Riego': (k==='abono'&&lang==='es')?'Abono' : k}: {care[k]}</Pill>)}
              </div>
            </div>
          </div>

          <Section title={STR[lang].history}>
            {(bonsai.history||[]).length===0
              ? <div style={{color:'#94a3b8'}}>{STR[lang].none_history}</div>
              : <ul style={{paddingLeft:16, margin:0}}>
                  {(bonsai.history||[]).map(h=> <li key={h.id} style={{marginBottom:6}}>
                    <span style={{fontWeight:600}}>{h.type==='photo' ? '📷' : '✅'} {h.label || h.action}</span>
                    <span style={{color:'#64748b'}}> · {fmt(h.at, lang)}</span>
                  </li>)}
                </ul>}
          </Section>
        </div>
      )}

      {tab==='checklist' && (
       <div>
    {(bonsai.tasks || []).map((t) => {
      return (
        <div
          key={t.key}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            padding: '10px 12px',
            margin: '8px 0'
          }}
        >
          <div>
            <div style={{ fontWeight: 600 }}>
              {lang === 'es' ? t.labelES : t.labelEN}
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {STR[lang].every} {t.freq} {STR[lang].days} ·{' '}
              <b>{nextDueLabel([t], lang)[t.key]}</b>
            </div>
          </div>
          <button
            type="button"
            onClick={() => mark(t.key)}
            style={btn('emerald')}
          >
            ✓
          </button>
        </div>
      );
    })}
  </div>
)}


      {tab==='photos' && (
        <div>
          <div style={{display:'flex', gap:8, alignItems:'center', margin:'8px 0'}}>
            <input id="addphoto" type="file" accept="image/*" onChange={e=>{ const f=e.target.files?.[0]; if(!f) return; const note=prompt(STR[lang].photo_note_ph)||''; addPhoto(f,note) }}/>
          </div>

          {(bonsai.photos||[]).length===0 ? (
            <div style={{color:'#94a3b8'}}>{STR[lang].photos_empty}</div>
          ) : (
            <>
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:8}}>
                {bonsai.photos.map(p=>(
                  <figure key={p.id} style={{margin:0}}>
                    <img src={p.src} style={{width:'100%', borderRadius:10, display:'block'}}/>
                    <figcaption style={{fontSize:11,color:'#64748b', marginTop:4}}>{fmt(p.at,lang)} {p.note?`· ${p.note}`:''}</figcaption>
                  </figure>
                ))}
              </div>

              {bonsai.photos.length>=2 && (
                <Section title={STR[lang].compare_title}>
                  <BeforeAfter before={bonsai.photos[bonsai.photos.length-1].src} after={bonsai.photos[0].src} lang={lang}/>
                </Section>
              )}
            </>
          )}
        </div>
      )}

      {tab==='learn' && (
        <div>
          {!lib ? <div style={{color:'#94a3b8'}}>{lang==='es'?'Selecciona o escribe una especie para ver información.':'Choose or set a species to see info.'}</div> :
            <>
              <Section title="Wikipedia">
                {wiki.loading ? <div>{STR[lang].learn_loading}</div> :
                  <div>
                    <div style={{fontWeight:700}}>{wiki.title}</div>
                    <p style={{marginTop:6, lineHeight:1.5}}>{wiki.extract}</p>
                    {wiki.url && <a href={wiki.url} target="_blank" rel="noreferrer">{STR[lang].learn_read}</a>}
                  </div>}
              </Section>

              <Section title={STR[lang].inspire_title} right={<span style={{fontSize:12, color:'#64748b'}}>{STR[lang].inspire_note}</span>}>
                {pics.length===0 ? <div style={{color:'#94a3b8'}}>—</div> :
                  <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:8}}>
                    {pics.map((u,i)=><img key={i} src={u} style={{width:'100%', borderRadius:10}}/>)}
                  </div>}
              </Section>
            </>
          }
        </div>
      )}

      {tab==='tips' && (
        <div>
          <h3 style={{marginBottom:8}}>{STR[lang].tips_title}</h3>
          <ul style={{lineHeight:1.6}}>
            <li><b>{STR[lang].tip1_t}:</b> {STR[lang].tip1_d}</li>
            <li><b>{STR[lang].tip2_t}:</b> {STR[lang].tip2_d}</li>
            <li><b>{STR[lang].tip3_t}:</b> {STR[lang].tip3_d}</li>
            <li><b>{STR[lang].tip4_t}:</b> {STR[lang].tip4_d}</li>
            <li><b>{STR[lang].tip5_t}:</b> {STR[lang].tip5_d}</li>
          </ul>
        </div>
      )}
    </Modal>
  )
}

/* ─────────────────────── Before/After ─────────────────────── */
function BeforeAfter({before, after, lang}){
  const [pos,setPos]=useState(50)
  return (
    <div style={{position:'relative', width:'100%', maxWidth:720, margin:'6px 0'}}>
      <div style={{position:'relative', width:'100%', paddingTop:'56%', borderRadius:12, overflow:'hidden', background:'#e2e8f0'}}>
        <img src={before} style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover'}}/>
        <img src={after} style={{position:'absolute', inset:0, width:`${pos}%`, height:'100%', objectFit:'cover', borderRight:'2px solid white'}}/>
        <div style={{position:'absolute', left:8, top:8, padding:'4px 8px', background:'rgba(0,0,0,.55)', color:'#fff', borderRadius:6, fontSize:12}}>{STR[lang].before}</div>
        <div style={{position:'absolute', right:8, top:8, padding:'4px 8px', background:'rgba(0,0,0,.55)', color:'#fff', borderRadius:6, fontSize:12}}>{STR[lang].after}</div>
      </div>
      <input type="range" min="0" max="100" value={pos} onChange={e=>setPos(+e.target.value)} style={{width:'100%', marginTop:8}}/>
      <div style={{fontSize:12, color:'#64748b'}}>{STR[lang].drag}</div>
    </div>
  )
}

/* ─────────────────────────── Modal ─────────────────────────── */
function Modal({title, children, onClose, lang}){
  useEffect(()=>{
    const onEsc=(e)=>{ if(e.key==='Escape') onClose() }
    document.addEventListener('keydown', onEsc); return ()=>document.removeEventListener('keydown', onEsc)
  },[onClose])
  return (
    <div style={{position:'fixed', inset:0, background:'rgba(15,23,42,.4)', padding:16, zIndex:50}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{maxWidth:920, margin:'40px auto', background:'#fff', borderRadius:14, padding:16}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <h2 style={{margin:'6px 0'}}>{title}</h2>
          <button onClick={onClose} style={btn('slate')}>{STR[lang].close}</button>
        </div>
        <div>{children}</div>
      </div>
      <style>{`
        .lbl{display:block; font-size:12px; color:#64748b; margin-bottom:4px}
        .in{width:100%; padding:10px 12px; border:1px solid #e5e7eb; border-radius:8px}
      `}</style>
    </div>
  )
}

/* ──────────────────────── Estilos helper ─────────────────────── */
function btn(color){
  const base = { padding:'8px 12px', borderRadius:8, border:'1px solid transparent', cursor:'pointer' }
  if(color==='emerald') return {...base, background:'#10b981', color:'#fff'}
  if(color==='amber')  return {...base, background:'#f59e0b', color:'#111827'}
  if(color==='slate')  return {...base, background:'#fff', color:'#334155', border:'1px solid #e5e7eb'}
  return base
}
const grid2 = { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:12 }
