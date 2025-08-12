import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * ZenBonsai — App.jsx (one-file, robust care + refs)
 *
 * Incluye:
 * - Registro de bonsáis (foto comprimida + historial)
 * - Autocompletar de especie desde /species.json
 * - Cuidados por especie (si existen) + Fallback por género + Referencias (libros/páginas)
 * - Tips generales, Herramientas y Propagación (desde JSON)
 * - Checklist con histórico de marcados
 * - Sugeridor de Estilos (wizard) usando /estilos.es.json
 * - Ubicación (búsqueda o GPS) con Open-Meteo: amanecer/atardecer + fase lunar
 * - Ventanas recomendadas (trasplante/poda/alambrado/defoliado) por hemisferio y modo lunar opcional
 *
 * Archivos esperados en /public:
 *  - species.json              (usa tu species_full.json renombrado)
 *  - estilos.es.json
 *  - tips_generales.es.json
 *  - tools.es.json
 *  - propagation.es.json
 */

/* ============== Utils almacenamiento ============== */
const loadLS = (key, fallback) => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
};
const saveLS = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };

/* ============== Cache con TTL ============== */
function setCache(key, value, ttlHours = 24) {
  const exp = Date.now() + ttlHours * 3600 * 1000;
  saveLS(key, { exp, value });
}
function getCache(key) {
  try {
    const raw = loadLS(key, null);
    if (!raw) return null;
    if (!raw.exp || Date.now() > raw.exp) { localStorage.removeItem(key); return null; }
    return raw.value;
  } catch { return null; }
}

/* ============== Normalización y búsqueda de especie (robusto) ============== */
const norm = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Busca especie con:
 * 1) match exacto científico (insensible a acentos/case),
 * 2) por nombres comunes (ES/EN),
 * 3) "empieza con…",
 * 4) Fallback por género (p. ej., "ficus ..." → usa la primera entrada del género).
 */
function findSpeciesEntry(speciesDB, input) {
  if (!speciesDB?.species?.length || !input) return null;
  const n = norm(input);

  // 1) científica exacta
  let hit = speciesDB.species.find(sp => norm(sp.scientific_name) === n);

  // 2) nombres comunes
  if (!hit) {
    hit = speciesDB.species.find(sp => {
      const es = (sp.common_names?.es || []).map(norm);
      const en = (sp.common_names?.en || []).map(norm);
      return es.includes(n) || en.includes(n);
    });
  }

  // 3) empieza con…
  if (!hit) {
    hit = speciesDB.species.find(sp => norm(sp.scientific_name).startsWith(n));
  }

  // 4) fallback por género
  if (!hit) {
    const genus = n.split(' ')[0];
    if (genus) {
      const candidates = speciesDB.species.filter(sp => norm(sp.scientific_name).startsWith(genus + ' '));
      if (candidates.length) {
        hit = { ...candidates[0], _genusFallback: true };
      }
    }
  }

  return hit || null;
}

/* ============== Open-Meteo (geocoding/astronomía) ============== */
async function geocodeCity(query, lang = 'es') {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=${lang}&format=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('No se pudo consultar geocoding');
  const j = await r.json();
  if (!j.results || !j.results.length) throw new Error('No encontrado');
  const { latitude, longitude, timezone, country, name, admin1 } = j.results[0];
  return { lat: latitude, lon: longitude, tz: timezone, country, city: name, region: admin1 || '' };
}
async function reverseGeocode(lat, lon, lang = 'es') {
  const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=${lang}`;
  const r = await fetch(url);
  const j = await r.json();
  const res = j.results?.[0] || {};
  return { tz: res.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone, country: res.country || '', city: res.name || res.admin1 || '', region: res.admin1 || '' };
}
async function getDeviceLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocalización no disponible'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  });
}
async function loadAstronomy(lat, lon, tz) {
  const cacheKey = `astro_${lat.toFixed(3)}_${lon.toFixed(3)}_${tz}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=sunrise,sunset,moon_phase,moonrise,moonset&timezone=${encodeURIComponent(tz)}`;
  const r = await fetch(url);
  const j = await r.json();
  setCache(cacheKey, j.daily, 24);
  return j.daily;
}

/* ============== Tiempo / fases ============== */
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

/* ============== Ventanas genéricas (fallback) ============== */
const GENERIC_WINDOWS = {
  repot: { N: [2, 3], S: [8, 9] },               // fin de invierno/inicio primavera
  structural_prune: { N: [1, 2, 11, 12], S: [5, 6, 7, 8] }, // dormancia
  defoliation: { N: [6, 7], S: [12, 1] },        // avanzado
  wiring: { N: [2, 3, 10, 11], S: [4, 5, 8, 9] } // flexible
};
const monthsFor = (action, hemi) => GENERIC_WINDOWS[action]?.[hemi] || [];
function lunarOk(action, moonPhase) {
  if (moonPhase === null || moonPhase === undefined) return true;
  if (action === 'structural_prune') return (moonPhase >= 0.50); // menguante
  if (action === 'repot') return !(moonPhase > 0.45 && moonPhase < 0.55); // evitar llena
  return true;
}

/* ============== Imagen: compresión simple a JPEG ============== */
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

/* ============== UI básicos ============== */
function Section({ title, right, children }) {
  return (
    <section style={{ margin: '16px 0', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14 }}>
      <div style={{ padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
        {right}
      </div>
      <div style={{ padding: 12 }}>{children}</div>
    </section>
  );
}
const Chip = ({ children, color = '#e2e8f0' }) =>
  <span style={{ background: color, borderRadius: 999, padding: '2px 10px', fontSize: 12 }}>{children}</span>;

function Button({ children, onClick, kind = 'primary', ...rest }) {
  const palette = ({
    primary: { bg: '#2563eb', fg: '#fff' },
    ghost: { bg: '#f8fafc', fg: '#0f172a' },
    warn: { bg: '#f97316', fg: '#fff' },
    ok: { bg: '#059669', fg: '#fff' },
  })[kind];
  return (
    <button onClick={onClick} {...rest}
      style={{ background: palette.bg, color: palette.fg, border: 'none', borderRadius: 10, padding: '8px 12px', cursor: 'pointer' }}>
      {children}
    </button>
  );
}
function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 40, display: 'grid', placeItems: 'center', padding: 12 }}>
      <div style={{ width: 'min(920px, 96vw)', maxHeight: '90vh', overflow: 'auto', borderRadius: 16, background: '#fff', boxShadow: '0 10px 40px rgba(2,6,23,0.25)' }}>
        <div style={{ padding: 14, borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 18 }}>{title}</strong>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 14 }}>{children}</div>
        {footer && <div style={{ padding: 14, borderTop: '1px solid #f1f5f9' }}>{footer}</div>}
      </div>
    </div>
  );
}

/* ============== Wizard de estilos ============== */
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
      {!stylesDB ? <div>Cargando estilos…</div> : (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 12 }}>
            <label><input type="checkbox" checked={q.recto} onChange={e => setQ({ ...q, recto: e.target.checked })} /> Tronco recto con conicidad</label>
            <label><input type="checkbox" checked={q.curvas} onChange={e => setQ({ ...q, curvas: e.target.checked })} /> Tronco sinuoso con curvas</label>
            <label> Inclinación (°)
              <input type="range" min={0} max={80} value={q.inclinacion} onChange={e => setQ({ ...q, inclinacion: +e.target.value })} /> {q.inclinacion}°
            </label>
            <label><input type="checkbox" checked={q.ramaCae} onChange={e => setQ({ ...q, ramaCae: e.target.checked })} /> ¿Rama/ápice puede caer bajo el borde?</label>
            <label><input type="checkbox" checked={q.copaArriba} onChange={e => setQ({ ...q, copaArriba: e.target.checked })} /> ¿Masa de follaje muy arriba?</label>
            <label><input type="checkbox" checked={q.ramifina} onChange={e => setQ({ ...q, ramifina: e.target.checked })} /> ¿Caducifolio con ramificación fina?</label>
            <label><input type="checkbox" checked={q.viento} onChange={e => setQ({ ...q, viento: e.target.checked })} /> ¿Todo empuja a un lado (viento)?</label>
          </div>

          <div>
            <h4 style={{ margin: '12px 0 6px' }}>Recomendados</h4>
            {!ranked.length ? <div>Marca algunas características para ver sugerencias.</div> : (
              <div style={{ display: 'grid', gap: 10 }}>
                {ranked.map(e => (
                  <div key={e.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{e.nombre}</strong> <Chip>{e.dificultad === 1 ? 'Fácil' : e.dificultad === 2 ? 'Media-' : e.dificultad === 3 ? 'Media' : e.dificultad === 4 ? 'Media+' : 'Avanzada'}</Chip>
                      </div>
                      <Button kind="ok" onClick={() => { onPick?.(e); onClose(); }}>Usar estilo</Button>
                    </div>
                    <div style={{ fontSize: 13, color: '#475569', marginTop: 6 }}>{e.descripcion}</div>
                    {e.reglas_clave?.length ? (
                      <ul style={{ margin: '6px 0 0 18px', fontSize: 13 }}>
                        {e.reglas_clave.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    ) : null}
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

/* ============== Modal Ajustes (ubicación) ============== */
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
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
          <input placeholder="Ej: Lima, Perú" value={query} onChange={e => setQuery(e.target.value)}
                 style={{ padding: 10, borderRadius: 10, border: '1px solid #e5e7eb' }} />
          <Button onClick={handleSearch} disabled={!query || saving}>Buscar</Button>
        </div>
        <div>
          <Button kind="ghost" onClick={useDevice} disabled={saving}>Usar mi ubicación</Button>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={!!settings.useLunar} onChange={e => setSettings({ ...settings, useLunar: e.target.checked })} />
          Activar calendario lunar (experimental)
        </label>
        {error && <div style={{ color: '#b91c1c' }}>{error}</div>}
        {settings?.location && (
          <div style={{ fontSize: 13, color: '#475569' }}>
            Ubicación: <strong>{settings.location.city}</strong>, {settings.location.country} · TZ {settings.location.tz} · Hemi {settings.hemi}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ============== Modal: Nuevo Bonsái ============== */
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
      footer={<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button kind="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} disabled={busy}>Guardar</Button>
      </div>}>
      <div style={{ display: 'grid', gap: 10 }}>
        <label>Nombre
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Opcional"
                 style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e5e7eb' }} />
        </label>
        <label>Especie (científico)
          <input value={species} onChange={e => setSpecies(e.target.value)} placeholder="Ej: Juniperus chinensis" list="speciesList"
                 style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e5e7eb' }} />
          <datalist id="speciesList">
            {(speciesList || []).map((s) => <option key={s} value={s} />)}
          </datalist>
        </label>
        <label>Notas
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                    style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e5e7eb' }} />
        </label>
        <label>Foto inicial (opcional)
          <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
        </label>
      </div>
    </Modal>
  );
}

/* ============== Próximos días sugeridos (ubicación) ============== */
function NextDaysPanel({ settings }) {
  if (!settings?.astro) return (
    <Section title="Próximos días sugeridos" right={<Chip color="#fee2e2">Configura tu ubicación</Chip>}>
      <div>Abre “Ubicación” para ver ventanas de trasplante, poda, etc., según tu hemisferio y (si quieres) fase lunar.</div>
    </Section>
  );

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

  if (!items.length) return (
    <Section title="Próximos días sugeridos">
      <div>No hay acciones destacadas en las próximas 3 semanas para tu hemisferio. Aun así, sigue la fenología de tu árbol.</div>
    </Section>
  );

  return (
    <Section title="Próximos días sugeridos" right={<Chip>{settings.location?.city}, {settings.location?.country}</Chip>}>
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map((it, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 10px' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{new Date(it.date).toLocaleDateString()}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{settings.useLunar ? `Luna: ${moonLabel(it.moon)}` : 'Lunar desactivado'}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {it.actions.map((a, i) => <Chip key={i} color="#ecfeff">{a}</Chip>)}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ============== Cuidados + Referencias (con fallback por género) ============== */
function CardKV({ k, v }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
      <div style={{ fontSize: 12, color: '#64748b' }}>{k}</div>
      <div style={{ fontWeight: 600 }}>{v}</div>
    </div>
  );
}

function CareAndRefs({ speciesDB, speciesName, tipsDB }) {
  const entry = useMemo(() => findSpeciesEntry(speciesDB, speciesName), [speciesDB, speciesName]);
  if (!speciesName) return <div style={{ color: '#64748b' }}>Define la especie para ver cuidados y referencias.</div>;
  if (!entry) return <div style={{ color: '#64748b' }}>No encontré esta especie en el catálogo. Usa el autocompletar o revisa la ortografía.</div>;

  const care = entry.care || null;
  const refs = entry.references || [];
  const hasAny = care && Object.values(care).some(v => (v?.es || v?.en));

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {entry._genusFallback && (
        <div style={{ background: '#fff8e1', border: '1px solid #facc15', padding: 10, borderRadius: 8 }}>
          No hallé coincidencia exacta para <b>{speciesName}</b>. Te muestro recomendaciones generales del género <b>{entry.scientific_name.split(' ')[0]}</b>.
        </div>
      )}

      {hasAny ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}>
          {care.light?.es && <CardKV k="Luz" v={care.light.es} />}
          {care.watering?.es && <CardKV k="Riego" v={care.watering.es} />}
          {care.substrate?.es && <CardKV k="Sustrato" v={care.substrate.es} />}
          {care.fertilization?.es && <CardKV k="Abono" v={care.fertilization.es} />}
          {care.pruning?.es && <CardKV k="Poda" v={care.pruning.es} />}
          {care.repotting?.es && <CardKV k="Trasplante" v={care.repotting.es} />}
          {care.wiring?.es && <CardKV k="Alambrado" v={care.wiring.es} />}
        </div>
      ) : (
        <div style={{ color: '#475569' }}>
          Aún no tenemos una ficha de cuidados específica para <b>{entry.scientific_name}</b>.
          Aplica estos <b>tips generales</b> mientras tanto:
          {tipsDB?.tips?.length > 0 && (
            <ul style={{ marginTop: 8 }}>
              {tipsDB.tips.slice(0, 5).map(t => <li key={t.id}><b>{t.title}</b>: {t.summary}</li>)}
            </ul>
          )}
        </div>
      )}

      <div>
        <div style={{ fontWeight: 600, marginTop: 6, marginBottom: 4 }}>Referencias (libros/páginas)</div>
        {refs.length ? (
          <ul style={{ margin: '6px 0 0 18px' }}>
            {refs.map((r, i) => <li key={i} style={{ fontSize: 13 }}>{r.title} — <em>{r.pages}</em></li>)}
          </ul>
        ) : <div style={{ fontSize: 13, color: '#94a3b8' }}>Sin referencias asociadas en esta especie.</div>}
      </div>
    </div>
  );
}

/* ============== Tips / Herramientas / Propagación ============== */
function TipCards({ tipsDB }) {
  if (!tipsDB?.tips?.length) return null;
  return (
    <Section title="Tips generales">
      <div style={{ display: 'grid', gap: 10 }}>
        {tipsDB.tips.map(t => (
          <div key={t.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{t.title}</strong>
              <Chip>{t.id}</Chip>
            </div>
            <div style={{ color: '#475569', marginTop: 6 }}>{t.summary}</div>
            {t.details && <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>{t.details}</div>}
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
      <div style={{ display: 'grid', gap: 8 }}>
        {toolsDB.map(tool => (
          <div key={tool.key} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{tool.name_es}</strong>
              <Chip>{tool.key}</Chip>
            </div>
            <div style={{ fontSize: 13, color: '#475569', marginTop: 6 }}><b>Uso:</b> {tool.usage}</div>
            <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}><b>Por qué:</b> {tool.why}</div>
            <div style={{ fontSize: 13, color: '#b45309', marginTop: 4 }}><b>Precauciones:</b> {tool.cautions}</div>
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
      <div style={{ display: 'grid', gap: 8 }}>
        {propagationDB.map(p => (
          <div key={p.key} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{p.title_es}</strong>
              <Chip>{p.key}</Chip>
            </div>
            <div style={{ color: '#475569', marginTop: 6 }}>{p.summary_es}</div>
            {p.tips_es && <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>{p.tips_es}</div>}
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ============== Tarjeta de Bonsái ============== */
function BonsaiCard({ item, onUpdate, speciesDB, stylesDB, tipsDB }) {
  const [tab, setTab] = useState('overview');
  const fileRef = useRef();

  const speciesList = useMemo(() => (speciesDB?.species || [])
    .map(s => s.scientific_name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b)), [speciesDB]);

  function update(patch) { onUpdate?.({ ...item, ...patch }); }

  async function addPhoto(f) {
    if (!f) return;
    const url = await compressImage(f, 1600, 0.85);
    const ph = { id: 'p' + Math.random().toString(36).slice(2, 7), url, at: new Date().toISOString() };
    update({ photos: [...(item.photos || []), ph], photo: item.photo || url });
  }

  // Checklist base + especie
  const speciesEntry = useMemo(() => findSpeciesEntry(speciesDB, item.species), [speciesDB, item.species]);
  const defaults = useMemo(() => ([
    { key: 'riego', label: 'Riego', freq: 2 },
    { key: 'abono', label: 'Abono', freq: 14 },
    { key: 'poda', label: 'Poda/Pinzado', freq: 30 },
    { key: 'rotacion', label: 'Rotación', freq: 7 },
    { key: 'plagas', label: 'Revisión plagas', freq: 7 },
  ]), []);
  const mergedTasks = useMemo(() => {
    const extra = (speciesEntry?.checklist_defaults || [])
      .map(t => ({ key: t.key, label: t.labelES || t.labelEN || t.key, freq: t.freq_days || 7 }));
    const map = new Map();
    for (const t of defaults) map.set(t.key, t);
    for (const t of extra) map.set(t.key, t);
    const stateMap = new Map((item.tasks || []).map(t => [t.key, t]));
    return Array.from(map.values()).map(t => ({ ...t, lastDone: stateMap.get(t.key)?.lastDone || null }));
  }, [speciesEntry, item.tasks, defaults]);

  function markTask(key) {
    const now = new Date().toISOString();
    const next = (item.tasks || []).filter(t => t.key !== key);
    next.push({ key, lastDone: now });
    const hist = [{ at: now, type: 'task', key }, ...(item.history || [])];
    update({ tasks: next, history: hist });
  }

  const [openStyle, setOpenStyle] = useState(false);

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 12, borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
        <img src={item.photo || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48"></svg>'}
             alt="cover" style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 8, background: '#e2e8f0' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>{item.name}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{item.species || 'Especie no definida'}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Button kind="ghost" onClick={() => setTab('overview')}>Resumen</Button>
          <Button kind="ghost" onClick={() => setTab('care')}>Cuidados</Button>
          <Button kind="ghost" onClick={() => setTab('checklist')}>Checklist</Button>
          <Button kind="ghost" onClick={() => setTab('photos')}>Fotos</Button>
          <Button kind="ghost" onClick={() => setTab('style')}>Estilos</Button>
        </div>
      </div>

      <div style={{ padding: 12 }}>
        {tab === 'overview' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <Section title="Datos básicos">
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Nombre</div>
                  <input value={item.name} onChange={e => update({ name: e.target.value })}
                         style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e5e7eb' }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Especie (científico)</div>
                  <input value={item.species} list="speciesAll" onChange={e => update({ species: e.target.value })}
                         placeholder="Ej: Ficus microcarpa"
                         style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e5e7eb' }} />
                  <datalist id="speciesAll">{speciesList.map(s => <option key={s} value={s} />)}</datalist>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Notas</div>
                  <textarea value={item.notes || ''} onChange={e => update({ notes: e.target.value })}
                            rows={3} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e5e7eb' }} />
                </div>
              </div>
            </Section>

            <Section title="Aprende & Planifica">
              <div style={{ fontSize: 13, color: '#475569' }}>
                Ve a la pestaña <b>Cuidados</b> para ver las recomendaciones de tu especie y las <b>Referencias</b> de tus libros.
              </div>
            </Section>
          </div>
        )}

        {tab === 'care' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <CareAndRefs speciesDB={speciesDB} speciesName={item.species} tipsDB={tipsDB} />
            <TipCards tipsDB={tipsDB} />
          </div>
        )}

        {tab === 'checklist' && (
          <div>
            {(mergedTasks || []).map((t) => (
              <div key={t.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                         border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', margin: '8px 0' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{t.label}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Cada {t.freq} días {t.lastDone && <>· última: <b>{new Date(t.lastDone).toLocaleDateString()}</b></>}
                  </div>
                </div>
                <Button kind="ok" onClick={() => markTask(t.key)}>✓</Button>
              </div>
            ))}
          </div>
        )}

        {tab === 'photos' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <input ref={fileRef} type="file" accept="image/*" onChange={e => addPhoto(e.target.files?.[0])} />
            </div>
            {(!item.photos || !item.photos.length) ? (
              <div style={{ color: '#64748b' }}>Aún no hay fotos. Agrega una para iniciar el historial.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8 }}>
                {item.photos.map(ph => (
                  <figure key={ph.id} style={{ margin: 0 }}>
                    <img src={ph.url} alt="ph" style={{ width: '100%', borderRadius: 10 }} />
                    <figcaption style={{ fontSize: 12, color: '#64748b' }}>{new Date(ph.at).toLocaleString()}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'style' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => setOpenStyle(true)}>Sugerir estilo</Button>
              {item.style && <Chip color="#dcfce7">Actual: {item.style.nombre}</Chip>}
            </div>
            {item.style && (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{item.style.nombre}</strong>
                  <Chip>Dificultad {item.style.dificultad}/5</Chip>
                </div>
                <div style={{ color: '#475569', marginTop: 6 }}>{item.style.descripcion}</div>
                {item.style.reglas_clave?.length ? (
                  <ul style={{ margin: '6px 0 0 18px', fontSize: 13 }}>
                    {item.style.reglas_clave.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      <StyleWizard open={openStyle} onClose={() => setOpenStyle(false)} stylesDB={stylesDB} onPick={(st) => update({ style: st })} />
    </div>
  );
}

/* ============== App principal ============== */
export default function App() {
  const [bonsais, setBonsais] = useState(() => loadLS('zb_bonsais', []));
  useEffect(() => saveLS('zb_bonsais', bonsais), [bonsais]);

  const [settings, setSettings] = useState(() => loadLS('zb_settings', { useLunar: false }));
  useEffect(() => saveLS('zb_settings', settings), [settings]);

  const [openNew, setOpenNew] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);

  // Datasets
  const [speciesDB, setSpeciesDB] = useState(null);
  const [stylesDB, setStylesDB] = useState(null);
  const [tipsDB, setTipsDB] = useState(null);
  const [toolsDB, setToolsDB] = useState(null);
  const [propagationDB, setPropagationDB] = useState(null);

  useEffect(() => { fetch('/species.json').then(r => r.json()).then(setSpeciesDB).catch(() => setSpeciesDB(null)); }, []);
  useEffect(() => { fetch('/estilos.es.json').then(r => r.json()).then(setStylesDB).catch(() => setStylesDB(null)); }, []);
  useEffect(() => { fetch('/tips_generales.es.json').then(r => r.json()).then(setTipsDB).catch(() => setTipsDB(null)); }, []);
  useEffect(() => { fetch('/tools.es.json').then(r => r.json()).then(setToolsDB).catch(() => setToolsDB(null)); }, []);
  useEffect(() => { fetch('/propagation.es.json').then(r => r.json()).then(setPropagationDB).catch(() => setPropagationDB(null)); }, []);

  const speciesList = useMemo(() => (speciesDB?.species || []).map(s => s.scientific_name).filter(Boolean).sort((a, b) => a.localeCompare(b)), [speciesDB]);

  const addBonsai = (item) => setBonsais([item, ...bonsais]);
  const updateBonsai = (updated) => setBonsais(bonsais.map(b => (b.id === updated.id ? updated : b)));

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, backdropFilter: 'saturate(1.1) blur(6px)', background: 'rgba(241,245,249,0.75)', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '12px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>🌿 ZenBonsai</div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {settings?.location ? (
              <Chip>{settings.location.city}, {settings.location.country} · {settings.useLunar ? `Luna: on` : 'Luna: off'}</Chip>
            ) : (
              <Chip color="#fee2e2">Sin ubicación</Chip>
            )}
            <Button kind="ghost" onClick={() => setOpenSettings(true)}>Ubicación</Button>
            <Button onClick={() => setOpenNew(true)}>+ Nuevo bonsái</Button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: 12 }}>
        <NextDaysPanel settings={settings} />

        {bonsais.length === 0 ? (
          <Section title="Tu colección">
            <div style={{ color: '#64748b' }}>Aún no hay bonsáis. Pulsa “+ Nuevo bonsái” para registrar el primero. 👇</div>
          </Section>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {bonsais.map(b => (
              <BonsaiCard key={b.id} item={b} onUpdate={updateBonsai}
                          speciesDB={speciesDB} stylesDB={stylesDB} tipsDB={tipsDB} />
            ))}
          </div>
        )}

        <ToolsList toolsDB={toolsDB} />
        <PropagationList propagationDB={propagationDB} />
      </main>

      <NewBonsaiModal open={openNew} onClose={() => setOpenNew(false)} onSave={addBonsai} speciesList={speciesList} />
      <SettingsModal open={openSettings} onClose={() => setOpenSettings(false)} settings={settings} setSettings={setSettings} />
    </div>
  );
}
