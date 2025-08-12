import React, { useEffect, useMemo, useRef, useState } from 'react';
import './zen.css';

/**
 * ZenBonsai — App.jsx (UI Premium)
 * - Misma lógica funcional que tu versión anterior
 * - UI con tema premium (glass, sombras, tipografía Inter, dark mode)
 * - Componentes estilizados por clases CSS (sin inline styles)
 *
 * Requiere: zen.css en src/
 * Datos esperados en /public:
 *  - species.json, estilos.es.json, tips_generales.es.json, tools.es.json, propagation.es.json
 */

/* ===== LocalStorage utils ===== */
const loadLS = (k, fb) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; } };
const saveLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* ===== TTL cache ===== */
function setCache(key, value, ttlHours = 24) { const exp = Date.now() + ttlHours * 3600 * 1000; saveLS(key, { exp, value }); }
function getCache(key) {
  try { const raw = loadLS(key, null); if (!raw) return null; if (!raw.exp || Date.now() > raw.exp) { localStorage.removeItem(key); return null; } return raw.value; }
  catch { return null; }
}

/* ===== Species finder (robusto) ===== */
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();
function findSpeciesEntry(speciesDB, input) {
  if (!speciesDB?.species?.length || !input) return null;
  const n = norm(input);
  let hit = speciesDB.species.find(sp => norm(sp.scientific_name) === n);
  if (!hit) {
    hit = speciesDB.species.find(sp => {
      const es = (sp.common_names?.es || []).map(norm);
      const en = (sp.common_names?.en || []).map(norm);
      return es.includes(n) || en.includes(n);
    });
  }
  if (!hit) hit = speciesDB.species.find(sp => norm(sp.scientific_name).startsWith(n));
  if (!hit) {
    const genus = n.split(' ')[0];
    if (genus) {
      const candidates = speciesDB.species.filter(sp => norm(sp.scientific_name).startsWith(genus + ' '));
      if (candidates.length) hit = { ...candidates[0], _genusFallback: true };
    }
  }
  return hit || null;
}

/* ===== Open-Meteo ===== */
async function geocodeCity(query, lang = 'es') {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=${lang}&format=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('No se pudo consultar geocoding');
  const j = await r.json();
  if (!j.results?.length) throw new Error('No encontrado');
  const { latitude, longitude, timezone, country, name, admin1 } = j.results[0];
  return { lat: latitude, lon: longitude, tz: timezone, country, city: name, region: admin1 || '' };
}
async function reverseGeocode(lat, lon, lang = 'es') {
  const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=${lang}`;
  const j = await fetch(url).then(r => r.json());
  const res = j.results?.[0] || {};
  return { tz: res.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone, country: res.country || '', city: res.name || res.admin1 || '', region: res.admin1 || '' };
}
async function getDeviceLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocalización no disponible'));
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  });
}
async function loadAstronomy(lat, lon, tz) {
  const cacheKey = `astro_${lat.toFixed(3)}_${lon.toFixed(3)}_${tz}`;
  const cached = getCache(cacheKey); if (cached) return cached;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=sunrise,sunset,moon_phase,moonrise,moonset&timezone=${encodeURIComponent(tz)}`;
  const j = await fetch(url).then(r => r.json());
  setCache(cacheKey, j.daily, 24);
  return j.daily;
}

/* ===== Tiempo / fases ===== */
function moonLabel(x) {
  if (x === null || x === undefined) return '';
  if (x < 0.03 || x > 0.97) return 'Luna nueva';
  if (x < 0.22) return 'Creciente (c.)';
  if (x < 0.28) return 'Cuarto creciente';
  if (x < 0.47) return 'Gibosa creciente';
  if (x < 0.53) return 'Luna llena';
  if (x < 0.72) return 'Gibosa menguante';
  if (x < 0.78) return 'Cuarto menguante';
  return 'Menguante (c.)';
}
const hemisphereFromLat = (lat) => (lat >= 0 ? 'N' : 'S');

/* ===== Ventanas genéricas ===== */
const GENERIC_WINDOWS = {
  repot: { N: [2, 3], S: [8, 9] },
  structural_prune: { N: [1, 2, 11, 12], S: [5, 6, 7, 8] },
  defoliation: { N: [6, 7], S: [12, 1] },
  wiring: { N: [2, 3, 10, 11], S: [4, 5, 8, 9] },
};
const monthsFor = (action, hemi) => GENERIC_WINDOWS[action]?.[hemi] || [];
function lunarOk(action, moonPhase) {
  if (moonPhase === null || moonPhase === undefined) return true;
  if (action === 'structural_prune') return (moonPhase >= 0.50);
  if (action === 'repot') return !(moonPhase > 0.45 && moonPhase < 0.55);
  return true;
}

/* ===== Imagen: compresión ===== */
async function compressImage(file, maxW = 1600, quality = 0.85) {
  const img = document.createElement('img');
  const url = URL.createObjectURL(file);
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const scale = Math.min(1, maxW / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  URL.revokeObjectURL(url);
  return dataUrl;
}

/* ===== UI atoms ===== */
const Chip = ({ children, color }) => (
  <span className={`zb-chip ${color ? '' : ''}`} data-color={color || ''}>{children}</span>
);
function Button({ children, onClick, kind = 'primary', ...rest }) {
  return (
    <button className={`zb-btn zb-btn--${kind}`} onClick={onClick} {...rest}>{children}</button>
  );
}
function Section({ title, right, children }) {
  return (
    <section className="zb-section">
      <div className="zb-section__head">
        <h3 className="zb-h3">{title}</h3>
        {right}
      </div>
      <div className="zb-section__body">{children}</div>
    </section>
  );
}
function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="zb-modal__backdrop">
      <div className="zb-modal">
        <div className="zb-modal__head">
          <strong className="zb-modal__title">{title}</strong>
          <button className="zb-modal__close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="zb-modal__body">{children}</div>
        {footer && <div className="zb-modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ===== Wizard estilos ===== */
function StyleWizard({ open, onClose, stylesDB, onPick }) {
  const [q, setQ] = useState({ recto: false, curvas: false, inclinacion: 0, ramaCae: false, copaArriba: false, ramifina: false, viento: false });
  function score(est) {
    let s = 0;
    if (q.recto) s += est.id === 'chokkan' ? 3 : 0;
    if (q.curvas) s += est.id === 'moyogi' ? 3 : 0;
    if (q.inclinacion >= 25) s += est.id === 'shakkan' ? 3 : 0;
    if (q.ramaCae) s += est.id === 'kengai' ? 4 : (est.id === 'han_kengai' ? 3 : 0);
    if (q.copaArriba) s += est.id === 'bunjin' ? 3 : 0;
    if (q.ramifina && est.id === 'hokidachi') s += 3;
    if (q.viento && est.id === 'fukinagashi') s += 3;
    return s;
  }
  const ranked = useMemo(() => {
    if (!stylesDB?.estilos) return [];
    const arr = stylesDB.estilos.map(e => ({ ...e, _score: score(e) }));
    return arr.sort((a, b) => b._score - a._score).slice(0, 3);
  }, [q, stylesDB]);

  return (
    <Modal open={open} onClose={onClose} title="Sugerir estilo">
      {!stylesDB ? <div className="zb-skeleton" style={{ height: 80 }} /> : (
        <div className="zb-grid">
          <div className="zb-grid-auto">
            <label className="zb-check"><input type="checkbox" checked={q.recto} onChange={e => setQ({ ...q, recto: e.target.checked })} /> Tronco recto con conicidad</label>
            <label className="zb-check"><input type="checkbox" checked={q.curvas} onChange={e => setQ({ ...q, curvas: e.target.checked })} /> Tronco sinuoso con curvas</label>
            <label className="zb-range__wrap">Inclinación (°)
              <input className="zb-range" type="range" min={0} max={80} value={q.inclinacion} onChange={e => setQ({ ...q, inclinacion: +e.target.value })} />
              <span className="zb-range__val">{q.inclinacion}°</span>
            </label>
            <label className="zb-check"><input type="checkbox" checked={q.ramaCae} onChange={e => setQ({ ...q, ramaCae: e.target.checked })} /> ¿Rama/ápice puede caer bajo el borde?</label>
            <label className="zb-check"><input type="checkbox" checked={q.copaArriba} onChange={e => setQ({ ...q, copaArriba: e.target.checked })} /> ¿Masa de follaje muy arriba?</label>
            <label className="zb-check"><input type="checkbox" checked={q.ramifina} onChange={e => setQ({ ...q, ramifina: e.target.checked })} /> ¿Caducifolio con ramificación fina?</label>
            <label className="zb-check"><input type="checkbox" checked={q.viento} onChange={e => setQ({ ...q, viento: e.target.checked })} /> ¿Todo empuja a un lado (viento)?</label>
          </div>

          <div>
            <h4 className="zb-h4">Recomendados</h4>
            {!ranked.length ? <div className="zb-muted">Marca algunas características para ver sugerencias.</div> : (
              <div className="zb-stack">
                {ranked.map(e => (
                  <div key={e.id} className="zb-card">
                    <div className="zb-card__row">
                      <div>
                        <strong>{e.nombre}</strong> <Chip color="soft">{e.dificultad === 1 ? 'Fácil' : e.dificultad === 2 ? 'Media-' : e.dificultad === 3 ? 'Media' : e.dificultad === 4 ? 'Media+' : 'Avanzada'}</Chip>
                      </div>
                      <Button kind="ok" onClick={() => { onPick?.(e); onClose(); }}>Usar estilo</Button>
                    </div>
                    <div className="zb-subtle">{e.descripcion}</div>
                    {e.reglas_clave?.length ? <ul className="zb-list">{e.reglas_clave.map((r, i) => <li key={i}>{r}</li>)}</ul> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ===== Ajustes (ubicación) ===== */
function SettingsModal({ open, onClose, settings, setSettings }) {
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSearch() {
    setSaving(true); setError('');
    try {
      const geo = await geocodeCity(query, 'es');
      const astro = await loadAstronomy(geo.lat, geo.lon, geo.tz);
      setSettings({ ...settings, location: geo, astro, hemi: hemisphereFromLat(geo.lat) });
      onClose?.();
    } catch (e) { setError(e.message || 'Error'); }
    finally { setSaving(false); }
  }
  async function useDevice() {
    setSaving(true); setError('');
    try {
      const dev = await getDeviceLocation();
      const rev = await reverseGeocode(dev.lat, dev.lon, 'es');
      const geo = { lat: dev.lat, lon: dev.lon, tz: rev.tz, country: rev.country, city: rev.city, region: rev.region };
      const astro = await loadAstronomy(geo.lat, geo.lon, geo.tz);
      setSettings({ ...settings, location: geo, astro, hemi: hemisphereFromLat(geo.lat) });
      onClose?.();
    } catch (e) { setError(e.message || 'Error'); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Ubicación y calendario">
      <div className="zb-stack">
        <div className="zb-row">
          <input className="zb-input" placeholder="Ej: Lima, Perú" value={query} onChange={e => setQuery(e.target.value)} />
          <Button onClick={handleSearch} disabled={!query || saving}>Buscar</Button>
        </div>
        <div><Button kind="ghost" onClick={useDevice} disabled={saving}>Usar mi ubicación</Button></div>
        <label className="zb-switch">
          <input type="checkbox" checked={!!settings.useLunar} onChange={e => setSettings({ ...settings, useLunar: e.target.checked })} />
          <span>Calendario lunar (experimental)</span>
        </label>
        {error && <div className="zb-error">{error}</div>}
        {settings?.location && (
          <div className="zb-subtle">
            Ubicación: <strong>{settings.location.city}</strong>, {settings.location.country} · TZ {settings.location.tz} · Hemi {settings.hemi}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ===== Nuevo Bonsái ===== */
function NewBonsaiModal({ open, onClose, onSave, speciesList }) {
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    try {
      let photo = null;
      if (file) photo = await compressImage(file, 1600, 0.85);
      const item = {
        id: 'b' + Math.random().toString(36).slice(2, 9),
        name: name.trim() || species || 'Mi bonsái',
        species: species.trim(),
        createdAt: new Date().toISOString(),
        notes: notes.trim(),
        photo,
        photos: photo ? [{ id: 'p1', url: photo, at: new Date().toISOString() }] : [],
        tasks: [],
        history: [],
        style: null,
      };
      onSave?.(item);
      onClose?.();
    } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar bonsái"
      footer={<div className="zb-row-right">
        <Button kind="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} disabled={busy}>Guardar</Button>
      </div>}>
      <div className="zb-form">
        <label>Nombre
          <input className="zb-input" value={name} onChange={e => setName(e.target.value)} placeholder="Opcional" />
        </label>
        <label>Especie (científico)
          <input className="zb-input" value={species} onChange={e => setSpecies(e.target.value)} placeholder="Ej: Juniperus chinensis" list="speciesList" />
          <datalist id="speciesList">{(speciesList || []).map(s => <option key={s} value={s} />)}</datalist>
        </label>
        <label>Notas
          <textarea className="zb-textarea" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
        </label>
        <label className="zb-file">
          <span>Foto inicial (opcional)</span>
          <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
        </label>
      </div>
    </Modal>
  );
}

/* ===== Próximos días sugeridos ===== */
function NextDaysPanel({ settings }) {
  if (!settings?.astro) {
    return (
      <Section title="Próximos días sugeridos" right={<Chip color="danger">Configura tu ubicación</Chip>}>
        <div className="zb-muted">Abre “Ubicación” para ver ventanas de trasplante, poda, etc., según tu hemisferio y (si quieres) fase lunar.</div>
      </Section>
    );
  }
  const { time, moon_phase } = settings.astro;
  const hemi = settings.hemi || 'N';
  const items = [];
  for (let i = 0; i < time.length; i++) {
    const date = time[i];
    const m = Number(date.split('-')[1]);
    const moon = moon_phase?.[i];
    const actions = [];
    if (monthsFor('repot', hemi).includes(m) && (!settings.useLunar || lunarOk('repot', moon))) actions.push('Trasplante');
    if (monthsFor('structural_prune', hemi).includes(m) && (!settings.useLunar || lunarOk('structural_prune', moon))) actions.push('Poda estructural');
    if (monthsFor('wiring', hemi).includes(m)) actions.push('Alambrado (revisar marcas)');
    if (monthsFor('defoliation', hemi).includes(m)) actions.push('Defoliado parcial (avanzado)');
    if (actions.length) items.push({ date, moon, actions });
    if (items.length >= 21) break;
  }
  return (
    <Section title="Próximos días sugeridos" right={<Chip>{settings.location?.city}, {settings.location?.country}</Chip>}>
      {!items.length ? (
        <div className="zb-muted">No hay acciones destacadas en las próximas 3 semanas. Aun así, sigue la fenología de tu árbol.</div>
      ) : (
        <div className="zb-stack">
          {items.map((it, idx) => (
            <div key={idx} className="zb-tile">
              <div>
                <div className="zb-strong">{new Date(it.date).toLocaleDateString()}</div>
                <div className="zb-subtle">{settings.useLunar ? `Luna: ${moonLabel(it.moon)}` : 'Lunar desactivado'}</div>
              </div>
              <div className="zb-row-wrap">
                {it.actions.map((a, i) => <Chip key={i} color="mint">{a}</Chip>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/* ===== Care + References ===== */
function CardKV({ k, v }) {
  return (
    <div className="zb-card">
      <div className="zb-subtle">{k}</div>
      <div className="zb-strong">{v}</div>
    </div>
  );
}
function CareAndRefs({ speciesDB, speciesName, tipsDB }) {
  const entry = useMemo(() => findSpeciesEntry(speciesDB, speciesName), [speciesDB, speciesName]);
  if (!speciesName) return <div className="zb-muted">Define la especie para ver cuidados y referencias.</div>;
  if (!entry) return <div className="zb-muted">No encontré esta especie en el catálogo. Usa el autocompletar o revisa la ortografía.</div>;
  const care = entry.care || null;
  const refs = entry.references || [];
  const hasAny = care && Object.values(care).some(v => (v?.es || v?.en));

  return (
    <div className="zb-stack">
      {entry._genusFallback && (
        <div className="zb-callout">
          No hallé coincidencia exacta para <b>{speciesName}</b>. Te muestro recomendaciones del género <b>{entry.scientific_name.split(' ')[0]}</b>.
        </div>
      )}
      {hasAny ? (
        <div className="zb-grid-auto">
          {care.light?.es && <CardKV k="Luz" v={care.light.es} />}
          {care.watering?.es && <CardKV k="Riego" v={care.watering.es} />}
          {care.substrate?.es && <CardKV k="Sustrato" v={care.substrate.es} />}
          {care.fertilization?.es && <CardKV k="Abono" v={care.fertilization.es} />}
          {care.pruning?.es && <CardKV k="Poda" v={care.pruning.es} />}
          {care.repotting?.es && <CardKV k="Trasplante" v={care.repotting.es} />}
          {care.wiring?.es && <CardKV k="Alambrado" v={care.wiring.es} />}
        </div>
      ) : (
        <div className="zb-body">
          Aún no tenemos una ficha específica para <b>{entry.scientific_name}</b>. Aplica estos <b>tips generales</b> mientras tanto:
          {tipsDB?.tips?.length > 0 && (
            <ul className="zb-list" style={{ marginTop: 8 }}>
              {tipsDB.tips.slice(0, 5).map(t => <li key={t.id}><b>{t.title}</b>: {t.summary}</li>)}
            </ul>
          )}
        </div>
      )}
      <div>
        <div className="zb-strong" style={{ marginBottom: 6 }}>Referencias (libros/páginas)</div>
        {refs.length ? (
          <ul className="zb-list">
            {refs.map((r, i) => <li key={i}><span>{r.title}</span> — <em>{r.pages}</em></li>)}
          </ul>
        ) : <div className="zb-muted">Sin referencias asociadas en esta especie.</div>}
      </div>
    </div>
  );
}

/* ===== Tips / Tools / Propagation ===== */
function TipCards({ tipsDB }) {
  if (!tipsDB?.tips?.length) return null;
  return (
    <Section title="Tips generales">
      <div className="zb-stack">
        {tipsDB.tips.map(t => (
          <div key={t.id} className="zb-card hover-raise">
            <div className="zb-card__row">
              <strong>{t.title}</strong>
              <Chip color="soft">{t.id}</Chip>
            </div>
            <div className="zb-body">{t.summary}</div>
            {t.details && <div className="zb-subtle" style={{ marginTop: 6 }}>{t.details}</div>}
          </div>
        ))}
      </div>
    </Section>
  );
}
function ToolsList({ toolsDB }) {
  if (!toolsDB?.length) return null;
  return (
    <Section title="Herramientas y usos">
      <div className="zb-stack">
        {toolsDB.map(tool => (
          <div key={tool.key} className="zb-card hover-raise">
            <div className="zb-card__row">
              <strong>{tool.name_es}</strong>
              <Chip color="soft">{tool.key}</Chip>
            </div>
            <div className="zb-body"><b>Uso:</b> {tool.usage}</div>
            <div className="zb-body"><b>Por qué:</b> {tool.why}</div>
            <div className="zb-warn"><b>Precauciones:</b> {tool.cautions}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}
function PropagationList({ propagationDB }) {
  if (!propagationDB?.length) return null;
  return (
    <Section title="Propagación">
      <div className="zb-grid-auto">
        {propagationDB.map(p => (
          <div key={p.key} className="zb-card hover-raise">
            <div className="zb-card__row">
              <strong>{p.title_es}</strong>
              <Chip color="soft">{p.key}</Chip>
            </div>
            <div className="zb-body">{p.summary_es}</div>
            {p.tips_es && <div className="zb-subtle" style={{ marginTop: 6 }}>{p.tips_es}</div>}
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ===== Tarjeta de Bonsái ===== */
function BonsaiCard({ item, onUpdate, speciesDB, stylesDB, tipsDB }) {
  const [tab, setTab] = useState('overview');
  const fileRef = useRef();
  const speciesList = useMemo(() => (speciesDB?.species || []).map(s => s.scientific_name).filter(Boolean).sort((a, b) => a.localeCompare(b)), [speciesDB]);
  function update(patch) { onUpdate?.({ ...item, ...patch }); }
  async function addPhoto(f) {
    if (!f) return;
    const url = await compressImage(f, 1600, 0.85);
    const ph = { id: 'p' + Math.random().toString(36).slice(2, 7), url, at: new Date().toISOString() };
    update({ photos: [...(item.photos || []), ph], photo: item.photo || url });
  }
  const speciesEntry = useMemo(() => findSpeciesEntry(speciesDB, item.species), [speciesDB, item.species]);
  const defaults = useMemo(() => ([
    { key: 'riego', label: 'Riego', freq: 2 },
    { key: 'abono', label: 'Abono', freq: 14 },
    { key: 'poda', label: 'Poda/Pinzado', freq: 30 },
    { key: 'rotacion', label: 'Rotación', freq: 7 },
    { key: 'plagas', label: 'Revisión plagas', freq: 7 },
  ]), []);
  const mergedTasks = useMemo(() => {
    const extra = (speciesEntry?.checklist_defaults || []).map(t => ({ key: t.key, label: t.labelES || t.labelEN || t.key, freq: t.freq_days || 7 }));
    const map = new Map(); for (const t of defaults) map.set(t.key, t); for (const t of extra) map.set(t.key, t);
    const stateMap = new Map((item.tasks || []).map(t => [t.key, t]));
    return Array.from(map.values()).map(t => ({ ...t, lastDone: stateMap.get(t.key)?.lastDone || null }));
  }, [speciesEntry, item.tasks, defaults]);
  function markTask(key) {
    const now = new Date().toISOString();
    const next = (item.tasks || []).filter(t => t.key !== key); next.push({ key, lastDone: now });
    const hist = [{ at: now, type: 'task', key }, ...(item.history || [])];
    update({ tasks: next, history: hist });
  }

  const [openStyle, setOpenStyle] = useState(false);

  return (
    <div className="zb-card zb-card--panel">
      <div className="zb-card__top">
        <img src={item.photo || 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2264%22 height=%2248%22></svg>'} alt="cover" className="zb-cover" />
        <div className="zb-grow">
          <div className="zb-title">{item.name}</div>
          <div className="zb-subtle">{item.species || 'Especie no definida'}</div>
        </div>
        <div className="zb-tabs">
          <button className={`zb-tab ${tab==='overview'?'is-active':''}`} onClick={()=>setTab('overview')}>Resumen</button>
          <button className={`zb-tab ${tab==='care'?'is-active':''}`} onClick={()=>setTab('care')}>Cuidados</button>
          <button className={`zb-tab ${tab==='checklist'?'is-active':''}`} onClick={()=>setTab('checklist')}>Checklist</button>
          <button className={`zb-tab ${tab==='photos'?'is-active':''}`} onClick={()=>setTab('photos')}>Fotos</button>
          <button className={`zb-tab ${tab==='style'?'is-active':''}`} onClick={()=>setTab('style')}>Estilos</button>
        </div>
      </div>

      <div className="zb-card__body">
        {tab === 'overview' && (
          <div className="zb-stack">
            <Section title="Datos básicos">
              <div className="zb-grid-auto">
                <div>
                  <div className="zb-subtle">Nombre</div>
                  <input className="zb-input" value={item.name} onChange={e => update({ name: e.target.value })} />
                </div>
                <div>
                  <div className="zb-subtle">Especie (científico)</div>
                  <input className="zb-input" value={item.species} list="speciesAll" onChange={e => update({ species: e.target.value })} placeholder="Ej: Ficus microcarpa" />
                  <datalist id="speciesAll">{speciesList.map(s => <option key={s} value={s} />)}</datalist>
                </div>
                <div className="zb-col-span">
                  <div className="zb-subtle">Notas</div>
                  <textarea className="zb-textarea" rows={3} value={item.notes || ''} onChange={e => update({ notes: e.target.value })} />
                </div>
              </div>
            </Section>

            <Section title="Aprende & Planifica">
              <div className="zb-body">Ve a la pestaña <b>Cuidados</b> para ver recomendaciones de tu especie y las <b>Referencias</b> de tus libros.</div>
            </Section>
          </div>
        )}

        {tab === 'care' && (
          <div className="zb-stack">
            <CareAndRefs speciesDB={speciesDB} speciesName={item.species} tipsDB={tipsDB} />
            <TipCards tipsDB={tipsDB} />
          </div>
        )}

        {tab === 'checklist' && (
          <div className="zb-stack">
            {(mergedTasks || []).map((t) => (
              <div key={t.key} className="zb-tile">
                <div>
                  <div className="zb-strong">{t.label}</div>
                  <div className="zb-subtle">Cada {t.freq} días {t.lastDone && <>· última: <b>{new Date(t.lastDone).toLocaleDateString()}</b></>}</div>
                </div>
                <Button kind="ok" onClick={() => markTask(t.key)}>✓</Button>
              </div>
            ))}
          </div>
        )}

        {tab === 'photos' && (
          <div className="zb-stack">
            <label className="zb-file">
              <span>Agregar foto</span>
              <input ref={fileRef} type="file" accept="image/*" onChange={e => addPhoto(e.target.files?.[0])} />
            </label>
            {(!item.photos || !item.photos.length) ? (
              <div className="zb-muted">Aún no hay fotos. Agrega una para iniciar el historial.</div>
            ) : (
              <div className="zb-gallery">
                {item.photos.map(ph => (
                  <figure key={ph.id} className="zb-figure">
                    <img src={ph.url} alt="ph" className="zb-photo" />
                    <figcaption className="zb-subtle">{new Date(ph.at).toLocaleString()}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'style' && (
          <div className="zb-stack">
            <div className="zb-row">
              <Button onClick={() => setOpenStyle(true)}>Sugerir estilo</Button>
              {item.style && <Chip color="mint">Actual: {item.style.nombre}</Chip>}
            </div>
            {item.style && (
              <div className="zb-card">
                <div className="zb-card__row">
                  <strong>{item.style.nombre}</strong>
                  <Chip color="soft">Dificultad {item.style.dificultad}/5</Chip>
                </div>
                <div className="zb-body">{item.style.descripcion}</div>
                {item.style.reglas_clave?.length ? <ul className="zb-list">{item.style.reglas_clave.map((r, i) => <li key={i}>{r}</li>)}</ul> : null}
              </div>
            )}
          </div>
        )}
      </div>

      <StyleWizard open={openStyle} onClose={() => setOpenStyle(false)} stylesDB={stylesDB} onPick={(st) => update({ style: st })} />
    </div>
  );
}

/* ===== App ===== */
export default function App() {
  const [bonsais, setBonsais] = useState(() => loadLS('zb_bonsais', []));
  useEffect(() => saveLS('zb_bonsais', bonsais), [bonsais]);

  const [settings, setSettings] = useState(() => loadLS('zb_settings', { useLunar: false }));
  useEffect(() => saveLS('zb_settings', settings), [settings]);

  const [openNew, setOpenNew] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);

  const [speciesDB, setSpeciesDB] = useState(null);
  const [stylesDB, setStylesDB] = useState(null);
  const [tipsDB, setTipsDB] = useState(null);
  const [toolsDB, setToolsDB] = useState(null);
  const [propagationDB, setPropagationDB] = useState(null);

  useEffect(() => { fetch('/species.json').then(r => r.json()).then(setSpeciesDB).catch(()=>setSpeciesDB(null)); }, []);
  useEffect(() => { fetch('/estilos.es.json').then(r => r.json()).then(setStylesDB).catch(()=>setStylesDB(null)); }, []);
  useEffect(() => { fetch('/tips_generales.es.json').then(r => r.json()).then(setTipsDB).catch(()=>setTipsDB(null)); }, []);
  useEffect(() => { fetch('/tools.es.json').then(r => r.json()).then(setToolsDB).catch(()=>setToolsDB(null)); }, []);
  useEffect(() => { fetch('/propagation.es.json').then(r => r.json()).then(setPropagationDB).catch(()=>setPropagationDB(null)); }, []);

  const speciesList = useMemo(() => (speciesDB?.species || []).map(s => s.scientific_name).filter(Boolean).sort((a,b)=>a.localeCompare(b)), [speciesDB]);

  const addBonsai   = (item)    => setBonsais([item, ...bonsais]);
  const updateBonsai= (updated) => setBonsais(bonsais.map(b => (b.id === updated.id ? updated : b)));

  return (
    <div className="zb-app">
      <header className="zb-header">
        <div className="zb-header__inner">
          <div className="zb-brand">🌿 ZenBonsai</div>
          <div className="zb-grow" />
          <div className="zb-row">
            {settings?.location ? (
              <Chip>{settings.location.city}, {settings.location.country} · {settings.useLunar ? 'Luna: on' : 'Luna: off'}</Chip>
            ) : <Chip color="danger">Sin ubicación</Chip>}
            <Button kind="ghost" onClick={()=>setOpenSettings(true)}>Ubicación</Button>
            <Button onClick={()=>setOpenNew(true)}>+ Nuevo bonsái</Button>
          </div>
        </div>
      </header>

      <main className="zb-main">
        <NextDaysPanel settings={settings} />

        {bonsais.length === 0 ? (
          <Section title="Tu colección">
            <div className="zb-muted">Aún no hay bonsáis. Pulsa “+ Nuevo bonsái” para registrar el primero. 👇</div>
          </Section>
        ) : (
          <div className="zb-stack">
            {bonsais.map(b => (
              <BonsaiCard key={b.id} item={b} onUpdate={updateBonsai}
                          speciesDB={speciesDB} stylesDB={stylesDB} tipsDB={tipsDB} />
            ))}
          </div>
        )}

        <ToolsList toolsDB={toolsDB} />
        <PropagationList propagationDB={propagationDB} />
      </main>

      <NewBonsaiModal open={openNew} onClose={()=>setOpenNew(false)} onSave={addBonsai} speciesList={speciesList} />
      <SettingsModal open={openSettings} onClose={()=>setOpenSettings(false)} settings={settings} setSettings={setSettings} />
    </div>
  );
}
