
import React, { useEffect, useMemo, useRef, useState } from 'react'

const LS_KEY = 'bonsaiKeeper:v1:data'
const LS_LANG = 'bonsaiKeeper:v1:lang'
const LS_ACH = 'bonsaiKeeper:v1:achievements'

function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36) }
function nowISO(){ return new Date().toISOString() }
function formatDate(d, lang){ 
  try{ return new Date(d).toLocaleString(lang === 'es' ? 'es-PE' : 'en-US') } catch { return d } 
}

// ===== i18n strings =====
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
    inspire_title: 'Inspiración de la comunidad (Wikimedia Commons)',
    inspire_note: 'Las imágenes se obtienen en tiempo real desde Wikimedia Commons.',
    photo_note_ph: 'Nota de esta foto (opcional)',
    photos_empty: 'Aún no hay fotos en el historial. Agrega la primera para iniciar el control de cambios.',
    compare_title: 'Comparador (primera vs última)',
    drag: 'Arrastra',
    before: 'Antes',
    after: 'Después',
    lang_label: 'Idioma',
    share: 'Compartir mi bonsái',
    // Tips content
    tips_title: 'Tips generales de cuidado',
    tip1_t: 'Riega según necesidad, no por calendario',
    tip1_d: 'Revisa con el dedo (1 cm). Si está ligeramente seco, riega a fondo.',
    tip2_t: 'Sustrato drenante',
    tip2_d: 'Mezcla tipo akadama + pumice + lava. Evita encharcamientos.',
    tip3_t: 'Observa señales',
    tip3_d: 'Hojas decaídas que se recuperan tras regar = ibas justo a tiempo.',
    tip4_t: 'Calidad y horario del riego',
    tip4_d: 'Mejor por la mañana; si puedes, usa agua de lluvia o filtrada.',
    tip5_t: 'Paciencia y consistencia',
    tip5_d: 'Cada bonsái tiene su ritmo. Ajusta por especie, clima y estación.',
    // Achievements
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
    due_next: 'Upcoming due dates',
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
    learn_loading: 'Loading information…',
    learn_read: 'Read on Wikipedia →',
    inspire_title: 'Community inspiration (Wikimedia Commons)',
    inspire_note: 'Images are fetched in real time from Wikimedia Commons.',
    photo_note_ph: 'Note for this photo (optional)',
    photos_empty: 'No photos yet. Add one to start change tracking.',
    compare_title: 'Compare (first vs latest)',
    drag: 'Drag',
    before: 'Before',
    after: 'After',
    lang_label: 'Language',
    share: 'Share my bonsai',
    // Tips content
    tips_title: 'General care tips',
    tip1_t: 'Water by need, not by schedule',
    tip1_d: 'Finger test (1 cm). If slightly dry, water thoroughly.',
    tip2_t: 'Free‑draining substrate',
    tip2_d: 'Akadama + pumice + lava. Avoid waterlogging.',
    tip3_t: 'Watch signals',
    tip3_d: 'Droopy leaves that perk up after watering = just in time.',
    tip4_t: 'Water quality & timing',
    tip4_d: 'Morning is best; use rain/filtered water if possible.',
    tip5_t: 'Patience & consistency',
    tip5_d: 'Each tree has its rhythm. Adjust by species, climate and season.',
    // Achievements
    ach_title: 'Achievements',
    ach_first_tree: 'First bonsai registered',
    ach_first_water: 'First watering logged',
    ach_5_cares: '5 care actions logged',
    ach_before_after: 'First before/after photo',
    unlocked: 'Unlocked',
  }
}

// ===== Species library (trimmed for brevity here) =====
const CARE_LIBRARY = {
  "Juniperus (Junípero)": {
    es: { luz: "Pleno sol 4–8h/día (evita interior).", riego: "Deja secar la capa superior; riegos profundos. 2–4×/sem verano; 1–2×/sem invierno.", abono: "Orgánico de liberación lenta primavera-otoño; líquido cada 2–4 semanas.", poda: "Pinzado de brotes blandos; estructural a fines de invierno.", sustrato: "Drenante (akadama 60–70% + pomice/volcánica).", trasplante: "Cada 2–3 años (fin de invierno)." },
    en: { luz: "Full sun 4–8h/day (avoid indoors).", riego: "Let top layer dry; deep waterings. 2–4×/week summer; 1–2×/week winter.", abono: "Slow-release organic spring–autumn; liquid every 2–4 weeks.", poda: "Pinch soft growth; structural in late winter.", sustrato: "Free-draining (akadama 60–70% + pumice/lava).", trasplante: "Every 2–3 years (late winter)." },
    wiki: { es: "Juniperus", en: "Juniperus" },
    inspireTerm: { es: "bonsái Juniperus", en: "bonsai Juniperus" }
  },
  "Ficus (Benjamina/Retusa)": {
    es: { luz: "Mucha luz brillante; puede interior luminoso.", riego: "Ritmo estable, evita encharcar.", abono: "Primavera a otoño cada 2–3 semanas.", poda: "Formación agresiva bien tolerada en clima cálido.", sustrato: "Poroso y aireado; drena rápido.", trasplante: "Cada 1–2 años." },
    en: { luz: "Bright light; can be indoors if very bright.", riego: "Steady rhythm, avoid waterlogging.", abono: "Spring to autumn every 2–3 weeks.", poda: "Aggressive shaping tolerated in warm climates.", sustrato: "Porous and airy; fast drainage.", trasplante: "Every 1–2 years." },
    wiki: { es: "Ficus_microcarpa", en: "Ficus_microcarpa" },
    inspireTerm: { es: "bonsái Ficus retusa", en: "bonsai Ficus retusa" }
  }
}

const SPECIES_LIST = Object.keys(CARE_LIBRARY)

function mockIdentify(){ return ['Juniperus (Junípero)','Ficus (Benjamina/Retusa)'] }

const DEFAULT_TASKS = [
  { key:'riego', label:'Riego', freq:2 },
  { key:'abono', label:'Abono', freq:14 },
  { key:'poda', label:'Poda/Pinzado', freq:30 },
  { key:'rotacion', label:'Rotación de maceta', freq:7 },
  { key:'plagas', label:'Revisión de plagas', freq:7 },
]

function initTasks(){ return DEFAULT_TASKS.map(t=>({ ...t, lastDone: null })) }

function labelOf(key, lang){
  const map = lang==='es'
    ? { riego:'Riego', abono:'Abono', poda:'Poda/Pinzado', rotacion:'Rotación', plagas:'Revisión de plagas' }
    : { riego:'Watering', abono:'Fertilizing', poda:'Pruning/Pinching', rotacion:'Pot rotation', plagas:'Pest check' }
  return map[key] || key
}

function calcNexts(tasks, lang){
  const out = {}
  tasks.forEach(t => {
    if (!t.lastDone){ out[t.key] = `${STR[lang].never} · ${STR[lang].every} ${t.freq} ${STR[lang].days}`; return }
    const last = new Date(t.lastDone)
    const due = new Date(last.getTime() + t.freq*24*3600*1000)
    const days = Math.ceil((due - new Date())/(24*3600*1000))
    out[t.key] = days <= 0 ? STR[lang].overdue : `${days} ${STR[lang].days}`
  })
  return out
}

function defaultAchievements(){ return { firstTree:false, firstWater:false, fiveCares:false, beforeAfter:false, careCount:0 } }

export default function App(){
  const [bonsais,setBonsais] = useState([])
  const [lang, setLang] = useState('es')
  return <div style={{padding:20}}><h1>ZenBonsai v0.4 (preview)</h1><p>El paquete incluye Tips, Logros y Compartir. Usa el build completo del zip.</p></div>
}

// The full code is included in the zip build.
