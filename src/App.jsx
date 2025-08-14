import React, { useEffect, useMemo, useRef, useState } from 'react';
import './zen.css';

/* ========= helpers de ubicación (simples, sin claves) ========= */
// Geocoding gratis (Open-Meteo geocoding)
async function geocode(q) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=es`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('geo');
  const j = await r.json();
  return (j.results || []).map(it => ({
    name: `${it.name}${it.admin1 ? ', ' + it.admin1 : ''}${it.country ? ', ' + it.country : ''}`,
    lat: it.latitude,
    lon: it.longitude
  }));
}
async function reverseGeocode(lat, lon) {
  const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=es`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('rev');
  const j = await r.json();
  const it = (j.results || [])[0];
  return {
    name: it ? `${it.name}${it.admin1 ? ', ' + it.admin1 : ''}${it.country ? ', ' + it.country : ''}` : `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
    lat, lon
  };
}

/* ========= Open-Meteo Astronomy (endpoint correcto) ========= */
async function fetchAstronomy(lat, lon, startISO, endISO) {
  // Tomamos 5 días empezando en startISO; Open-Meteo acepta "start_date" y "end_date" (YYYY-MM-DD)
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: 'auto',
    daily: 'moonrise,moonset,moon_phase',
    start_date: startISO,
    end_date: endISO
  });
  const url = `https://api.open-meteo.com/v1/astronomy?${params.toString()}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
  return resp.json();
}

/* ========= util LS ========= */
const loadLS = (k, fb) => { try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : fb; } catch { return fb; } };
const saveLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* ========= UI gadgets ========= */
function Chip({ children, onClick, title }) {
  return <button className="zb-chip" onClick={onClick} title={title}>{children}</button>;
}
function Section({ icon, title, children, right, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="zb-card">
      <div className="zb-card_head">
        <div className="zb-card_title"><span className="zb-ico">{icon}</span> {title}</div>
        <div className="zb-card_right">
          {right}
          <button className="zb-iconbtn" onClick={() => setOpen(o => !o)} aria-label="Abrir/cerrar">
            {open ? '▾' : '▸'}
          </button>
        </div>
      </div>
      {open && <div className="zb-card_body">{children}</div>}
    </div>
  );
}

/* ========= Modal de ubicación ========= */
function LocationModal({ open, onClose, onPick }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [err, setErr] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { if (open) { setResults([]); setErr(''); setTimeout(() => inputRef.current?.focus(), 0); } }, [open]);

  async function doSearch() {
    const q = query.trim();
    if (!q) return;
    setErr('');
    try {
      const r = await geocode(q);
      setResults(r);
      if (!r.length) setErr('No se encontraron lugares.');
    } catch {
      setErr('Error buscando lugar.');
    }
  }
  async function useMyLocation() {
    setErr('');
    if (!navigator.geolocation) { setErr('Tu navegador no permite geolocalización.'); return; }
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const loc = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        onPick(loc); onClose();
      } catch { setErr('No se pudo resolver tu ubicación.'); }
    }, () => setErr('No se pudo obtener tu ubicación.'));
  }
  if (!open) return null;

  return (
    <div className="zb-modal_back">
      <div className="zb-modal" role="dialog" aria-modal="true">
        <div className="zb-modal_head">
          <b>Ubicación y calendario</b>
          <button className="zb-close" onClick={onClose}>Cerrar</button>
        </div>
        <div className="zb-modal_body">
          <div className="zb-row" style={{ gap: 8 }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') doSearch(); }}
              placeholder="Ciudad, país (p. ej. Lima, Perú)"
              aria-label="Buscar ubicación"
            />
            <button className="zb-btn" onClick={doSearch}>Buscar</button>
          </div>
          <div className="zb-help" style={{ marginTop: 8 }}>
            o <button className="zb-chip" onClick={useMyLocation}>Usar mi ubicación</button>
          </div>
          {err && <div className="zb-error" style={{ marginTop: 8 }}>{err}</div>}
          {!!results.length && (
            <div className="zb-list" style={{ marginTop: 12 }}>
              {results.map((r, i) => (
                <div key={i} className="zb-item" style={{ gridTemplateColumns: '1fr auto' }}>
                  <div className="zb-item_body">
                    <div className="zb-item_title">{r.name}</div>
                    <div className="zb-item_sub">lat {r.lat.toFixed(3)}, lon {r.lon.toFixed(3)}</div>
                  </div>
                  <div className="zb-item_actions">
                    <button className="zb-btn zb-btn--primary" onClick={() => { onPick(r); onClose(); }}>
                      Elegir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ========= App ========= */
export default function App() {
  const [settings, setSettings] = useState(() =>
    loadLS('zb_settings', { location: null, lunar: false, lang: 'es' })
  );
  const [bonsais, setBonsais] = useState(() => loadLS('zb_bonsais', []));
  const [openLoc, setOpenLoc] = useState(false);

  useEffect(() => saveLS('zb_settings', settings), [settings]);
  useEffect(() => saveLS('zb_bonsais', bonsais), [bonsais]);

  const loc = settings.location;
  const [astro, setAstro] = useState({ days: [], error: '' });

  // util para YYYY-MM-DD
  const toISODate = (d) => d.toISOString().slice(0, 10);

  useEffect(() => {
    (async () => {
      if (!settings.lunar || !loc) { setAstro({ days: [], error: '' }); return; }
      try {
        const today = new Date();
        const start = toISODate(today);
        const end = toISODate(new Date(today.getTime() + 4 * 86400e3)); // +4 días
        const a = await fetchAstronomy(loc.lat, loc.lon, start, end);

        const days = (a.daily?.time || []).map((d, i) => ({
          date: d,
          phase: a.daily.moon_phase?.[i],
          moonrise: a.daily.moonrise?.[i],
          moonset: a.daily.moonset?.[i]
        }));
        setAstro({ days, error: '' });
      } catch (e) {
        setAstro({ days: [], error: `Open-Meteo: ${e.message || 'error'}` });
      }
    })();
  }, [settings.lunar, loc?.lat, loc?.lon]);

  const moonPhaseLabel = (p) => {
    if (p == null) return '—';
    const deg = Number(p);
    if (deg < 22.5) return 'Nueva';
    if (deg < 67.5) return 'Creciente c.';
    if (deg < 112.5) return 'Cuarto creciente';
    if (deg < 157.5) return 'Creciente g.';
    if (deg < 202.5) return 'Llena';
    if (deg < 247.5) return 'Menguante g.';
    if (deg < 292.5) return 'Cuarto menguante';
    if (deg < 337.5) return 'Menguante c.';
    return 'Nueva';
  };

  const headerLocation = useMemo(() => {
    const tag = settings.lunar ? 'Luna: on' : 'Luna: off';
    if (!loc) return `Sin ubicación · ${tag}`;
    return `${loc.name} · ${tag}`;
  }, [settings.lunar, loc]);

  function toggleLunar() { setSettings(s => ({ ...s, lunar: !s.lunar })); }
  function addDummy() { setBonsais(x => [...x, { id: Date.now(), name: 'Mi bonsái', species: 'Ficus' }]); }

  return (
    <div className="zb-app">
      <header className="zb-header">
        <div className="zb-header_inner">
          <div className="zb-brand"><span className="zb-ico">🌿</span> <b>ZenBonsai</b></div>
          <div className="zb-header_actions">
            <Chip title="Ubicación actual">{headerLocation}</Chip>
            <Chip onClick={() => setOpenLoc(true)}>📍 Ubicación</Chip>
            <Chip onClick={toggleLunar}>{settings.lunar ? '🌕 Luna: on' : '🌑 Luna: off'}</Chip>
            <Chip onClick={addDummy}>➕ Nuevo</Chip>
          </div>
        </div>
      </header>

      <main className="zb-main">
        <Section
          icon="📅"
          title="Próximos días sugeridos"
          right={<button className="zb-pill warn" onClick={() => setOpenLoc(true)}>Configura ubicación</button>}
        >
          {!settings.lunar && <div className="zb-help">Activa el calendario lunar (arriba) para ver sugerencias.</div>}
          {settings.lunar && !loc && <div className="zb-error">Necesitas una ubicación para calcular fases lunares.</div>}
          {settings.lunar && loc && astro.error && <div className="zb-error">{astro.error}</div>}
          {settings.lunar && loc && !astro.error && !astro.days.length && <div className="zb-help">Calculando…</div>}

          {settings.lunar && loc && !!astro.days.length && (
            <div className="zb-row_wrap">
              {astro.days.map(d => (
                <div key={d.date} className="zb-sugg">
                  <div className="zb-sugg_title">{new Date(d.date).toLocaleDateString()}</div>
                  <div className="zb-sugg_badge">{moonPhaseLabel(d.phase)}</div>
                  <div className="zb-sugg_note">Salida: {d.moonrise ?? '—'} · Puesta: {d.moonset ?? '—'}</div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section icon="🪴" title="Tu colección" right={<span className="zb-dot">{bonsais.length}</span>}>
          {!bonsais.length && <div className="zb-help">Pulsa “Nuevo” para registrar el primero.</div>}
          {!!bonsais.length && (
            <div className="zb-list">
              {bonsais.map(b => (
                <div key={b.id} className="zb-item">
                  <div className="zb-item_body">
                    <div className="zb-item_title">{b.name}</div>
                    <div className="zb-item_sub">{b.species}</div>
                  </div>
                  <div className="zb-item_actions"><button className="zb-btn">Abrir</button></div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section icon="🛠️" title="Herramientas y usos" defaultOpen={false}>
          <div className="zb-help">Sin datos de herramientas.</div>
        </Section>

        <Section icon="🏳️" title="Estilos" defaultOpen={false}>
          <div className="zb-help">Sin estilos cargados.</div>
        </Section>

        <Section icon="🌱" title="Propagación" defaultOpen={false}>
          <div className="zb-help">Sin métodos cargados.</div>
        </Section>
      </main>

      <LocationModal
        open={openLoc}
        onClose={() => setOpenLoc(false)}
        onPick={(locPicked) => setSettings(s => ({ ...s, location: locPicked }))}
      />
    </div>
  );
}
