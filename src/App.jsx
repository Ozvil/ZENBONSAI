import React, { useEffect, useMemo, useState } from "react";
import LocationPicker from "./components/LocationPicker.jsx";
import LunarCalendar from "./components/LunarCalendar.jsx";

/* ================== Utils: LocalStorage ================== */
const loadLS = function (k, fb) {
  try {
    var raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : fb;
  } catch (e) {
    return fb;
  }
};
const saveLS = function (k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {}
};

/* ================== Tipos y defaults ================== */
const SPECIES_PRESETS = [
  { key: "juniperus", name: "Juniperus (enebro)", waterDays: 5, notes: "Alta luz; no encharcar." },
  { key: "ficus", name: "Ficus", waterDays: 3, notes: "Tolera interior; pulverizar hojas." },
  { key: "olmo", name: "Olmo chino", waterDays: 4, notes: "Luz indirecta; revisar sustrato." },
  { key: "pino", name: "Pino", waterDays: 6, notes: "Sustrato drenante; riegos espaciados." },
  { key: "portulacaria", name: "Portulacaria", waterDays: 7, notes: "Suculenta; dejar secar entre riegos." }
];

const newId = function () {
  return Math.random().toString(36).slice(2, 10);
};
const todayISO = function () {
  return new Date().toISOString().slice(0, 10);
};
const toDate = function (v) {
  var d = v ? new Date(v) : null;
  return d && !isNaN(d.getTime()) ? d : null;
};
const addDays = function (isoDate, n) {
  var d = toDate(isoDate) || new Date();
  d.setDate(d.getDate() + (isFinite(n) ? Number(n) : 0));
  return d.toISOString().slice(0, 10);
};

/* ================== Componentes utilitarios ================== */
function Tabs(props) {
  var value = props.value;
  var onChange = props.onChange;
  var items = props.items || [];
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {items.map(function (it) {
          return (
            <button
              key={it.key}
              className="btn"
              style={{
                padding: "8px 12px",
                background: value === it.key ? "#f3f4f6" : "white",
                borderColor: value === it.key ? "#bbb" : "#ddd"
              }}
              onClick={function () {
                return onChange(it.key);
              }}
            >
              {it.label}
            </button>
          );
        })}
      </div>
      <div>{(items.find(function (it) { return it.key === value; }) || {}).render?.()}</div>
    </div>
  );
}

function Empty(props) {
  return (
    <div className="card" style={{ textAlign: "center", color: "#666" }}>
      {props.children}
    </div>
  );
}

/* ================== App principal ================== */
export default function App() {
  /* ---- Estado raíz ---- */
  const [bonsais, setBonsais] = useState(loadLS("bonsais", []));
  const [logs, setLogs] = useState(loadLS("careLogs", []));
  const [coords, setCoords] = useState(
    loadLS("coords", { lat: -12.0464, lon: -77.0428, label: "Lima, Perú" })
  );
  const [showLunar, setShowLunar] = useState(loadLS("useLunar", false));

  useEffect(function () { saveLS("bonsais", bonsais); }, [bonsais]);
  useEffect(function () { saveLS("careLogs", logs); }, [logs]);
  useEffect(function () { saveLS("coords", coords); }, [coords]);
  useEffect(function () { saveLS("useLunar", showLunar); }, [showLunar]);

  /* ---- Derivados ---- */
  const lastWaterByBonsai = useMemo(function () {
    var map = new Map();
    for (var i = 0; i < logs.length; i++) {
      var l = logs[i];
      if (l.type !== "riego") continue;
      var prev = map.get(l.bonsaiId);
      if (!prev || l.date > prev.date) map.set(l.bonsaiId, l);
    }
    return map;
  }, [logs]);

  const withNextWater = useMemo(function () {
    return bonsais.map(function (b) {
      var preset = SPECIES_PRESETS.find(function (s) { return s.key === b.speciesKey; });
      var baseDays = isFinite(b.customWaterDays) ? Number(b.customWaterDays) : (preset && preset.waterDays) || 4;
      var last = (lastWaterByBonsai.get(b.id) || {}).date || b.acquired || todayISO();
      var next = addDays(last, baseDays);
      return Object.assign({}, b, { baseDays: baseDays, lastWaterDate: last, nextWaterDate: next });
    });
  }, [bonsais, lastWaterByBonsai]);

  const dueToday = useMemo(function () {
    var t = todayISO();
    return withNextWater.filter(function (b) { return b.nextWaterDate <= t; });
  }, [withNextWater]);

  /* ---- CRUD Bonsáis ---- */
  const [form, setForm] = useState({
    id: null,
    name: "",
    speciesKey: "juniperus",
    acquired: todayISO(),
    pot: "",
    notes: "",
    customWaterDays: ""
  });
  const resetForm = function () {
    setForm({
      id: null,
      name: "",
      speciesKey: "juniperus",
      acquired: todayISO(),
      pot: "",
      notes: "",
      customWaterDays: ""
    });
  };

  const onSubmitBonsai = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    var id = form.id || newId();
    var rec = {
      id: id,
      name: (form.name || "").trim() || "Bonsái sin nombre",
      speciesKey: form.speciesKey,
      acquired: form.acquired || todayISO(),
      pot: form.pot || "",
      notes: form.notes || "",
      customWaterDays:
        form.customWaterDays === "" ? undefined : Math.max(1, Number(form.customWaterDays) || 0)
    };
    setBonsais(function (prev) {
      var idx = prev.findIndex(function (x) { return x.id === id; });
      if (idx >= 0) {
        var next = prev.slice();
        next[idx] = rec;
        return next;
      }
      return [rec].concat(prev);
    });
    resetForm();
  };

  const editBonsai = function (b) {
    setForm({
      id: b.id,
      name: b.name,
      speciesKey: b.speciesKey,
      acquired: b.acquired || todayISO(),
      pot: b.pot || "",
      notes: b.notes || "",
      customWaterDays: b.customWaterDays != null ? b.customWaterDays : ""
    });
  };

  const deleteBonsai = function (id) {
    if (!confirm("¿Eliminar este bonsái y sus registros?")) return;
    setBonsais(function (prev) { return prev.filter(function (x) { return x.id !== id; }); });
    setLogs(function (prev) { return prev.filter(function (x) { return x.bonsaiId !== id; }); });
  };

  /* ---- Registros de cuidado ---- */
  const quickLog = function (bonsaiId, type) {
    var types = ["riego", "fertilización", "poda", "observación"];
    if (types.indexOf(type) === -1) return;
    var note = type === "observación" ? prompt("Observación:") || "" : "";
    var rec = { id: newId(), bonsaiId: bonsaiId, type: type, date: todayISO(), note: note };
    setLogs(function (prev) { return [rec].concat(prev); });
  };

  const logsFor = function (bonsaiId) {
    return logs.filter(function (l) { return l.bonsaiId === bonsaiId; }).slice(0, 8);
  };

  /* ---- Pestañas / Vistas ---- */
  const [tab, setTab] = useState("hoy");

  function TabHoy() {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Hoy</h2>
        {dueToday.length === 0 ? (
          <Empty>Sin riegos pendientes por hoy. ¡Todo bajo control! 🌿</Empty>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 0" }}>Bonsái</th>
                <th style={{ textAlign: "left", padding: "8px 0" }}>Especie</th>
                <th style={{ textAlign: "left", padding: "8px 0" }}>Últ. riego</th>
                <th style={{ textAlign: "left", padding: "8px 0" }}>Cada</th>
                <th style={{ textAlign: "left", padding: "8px 0" }}>Próx. riego</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {dueToday.map(function (b) {
                return (
                  <tr key={b.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: "8px 0" }}>{b.name}</td>
                    <td style={{ padding: "8px 0" }}>
                      {(SPECIES_PRESETS.find(function (s) { return s.key === b.speciesKey; }) || {}).name ||
                        b.speciesKey}
                    </td>
                    <td style={{ padding: "8px 0" }}>{b.lastWaterDate || "—"}</td>
                    <td style={{ padding: "8px 0" }}>{b.baseDays} días</td>
                    <td style={{ padding: "8px 0" }}>{b.nextWaterDate}</td>
                    <td style={{ padding: "8px 0" }}>
                      <button className="btn" onClick={function () { return quickLog(b.id, "riego"); }}>
                        Registrar riego
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  function TabColeccion() {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Mi colección</h2>

        <form
          onSubmit={onSubmitBonsai}
          style={{
            display: "grid",
            gap: 8,
            gridTemplateColumns: "repeat(2, minmax(0,1fr))"
          }}
        >
          <input
            className="input"
            placeholder="Nombre"
            value={form.name}
            onChange={function (e) { return setForm(function (f) { return Object.assign({}, f, { name: e.target.value }); }); }}
          />
          <select
            className="input"
            value={form.speciesKey}
            onChange={function (e) { return setForm(function (f) { return Object.assign({}, f, { speciesKey: e.target.value }); }); }}
          >
            {SPECIES_PRESETS.map(function (s) {
              return (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              );
            })}
          </select>
          <input
            className="input"
            type="date"
            value={form.acquired}
            onChange={function (e) { return setForm(function (f) { return Object.assign({}, f, { acquired: e.target.value }); }); }}
          />
          <input
            className="input"
            placeholder="Maceta / sustrato"
            value={form.pot}
            onChange={function (e) { return setForm(function (f) { return Object.assign({}, f, { pot: e.target.value }); }); }}
          />
          <input
            className="input"
            placeholder="Días entre riegos (opcional)"
            value={form.customWaterDays}
            onChange={function (e) {
              var onlyNums = (e.target.value || "").replace(/[^0-9]/g, "");
              setForm(function (f) { return Object.assign({}, f, { customWaterDays: onlyNums }); });
            }}
          />
          <input
            className="input"
            placeholder="Notas"
            value={form.notes}
            onChange={function (e) { return setForm(function (f) { return Object.assign({}, f, { notes: e.target.value }); }); }}
          />
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
            <button className="btn" type="submit">
              {form.id ? "Guardar cambios" : "Agregar bonsái"}
            </button>
            {form.id ? (
              <button className="btn" type="button" onClick={resetForm}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>

        <div style={{ height: 12 }} />

        {bonsais.length === 0 ? (
          <Empty>Aún no agregas bonsáis. Empieza con el formulario de arriba.</Empty>
        ) : (
          <div className="card" style={{ background: "#fafafa" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 0" }}>Bonsái</th>
                  <th style={{ textAlign: "left", padding: "8px 0" }}>Especie</th>
                  <th style={{ textAlign: "left", padding: "8px 0" }}>Cada</th>
                  <th style={{ textAlign: "left", padding: "8px 0" }}>Próx. riego</th>
                  <th style={{ textAlign: "left", padding: "8px 0" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {withNextWater.map(function (b) {
                  var speciesName = (SPECIES_PRESETS.find(function (s) { return s.key === b.speciesKey; }) || {}).name || b.speciesKey;
                  return (
                    <tr key={b.id} style={{ borderTop: "1px solid #eee", verticalAlign: "top" }}>
                      <td style={{ padding: "8px 0" }}>
                        <div style={{ fontWeight: 600 }}>{b.name}</div>
                        <div style={{ fontSize: 13, color: "#666" }}>Adquirido: {b.acquired || "—"}</div>
                        {b.pot ? <div style={{ fontSize: 13, color: "#666" }}>Maceta/sustrato: {b.pot}</div> : null}
                        {b.notes ? <div style={{ fontSize: 13, color: "#666" }}>Notas: {b.notes}</div> : null}
                      </td>
                      <td style={{ padding: "8px 0" }}>{speciesName}</td>
                      <td style={{ padding: "8px 0" }}>{b.baseDays} días</td>
                      <td style={{ padding: "8px 0" }}>{b.nextWaterDate}</td>
                      <td style={{ padding: "8px 0" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button className="btn" onClick={function () { return quickLog(b.id, "riego"); }}>Riego</button>
                          <button className="btn" onClick={function () { return quickLog(b.id, "fertilización"); }}>Fertilización</button>
                          <button className="btn" onClick={function () { return quickLog(b.id, "poda"); }}>Poda</button>
                          <button className="btn" onClick={function () { return quickLog(b.id, "observación"); }}>Observación</button>
                          <button className="btn" onClick={function () { return editBonsai(b); }}>Editar</button>
                          <button className="btn" onClick={function () { return deleteBonsai(b.id); }}>Eliminar</button>
                        </div>
                        {logsFor(b.id).length > 0 ? (
                          <div style={{ marginTop: 8, fontSize: 13 }}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>Historial reciente</div>
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                              {logsFor(b.id).map(function (l) {
                                return (
                                  <li key={l.id}>
                                    {l.date} — {l.type}
                                    {l.note ? ": " + l.note : ""}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  function TabRegistros() {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Registros</h2>
        {logs.length === 0 ? (
          <Empty>No hay registros todavía.</Empty>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 0" }}>Fecha</th>
                <th style={{ textAlign: "left", padding: "8px 0" }}>Bonsái</th>
                <th style={{ textAlign: "left", padding: "8px 0" }}>Tipo</th>
                <th style={{ textAlign: "left", padding: "8px 0" }}>Nota</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 200).map(function (l) {
                var b = bonsais.find(function (x) { return x.id === l.bonsaiId; });
                return (
                  <tr key={l.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: "8px 0" }}>{l.date}</td>
                    <td style={{ padding: "8px 0" }}>{(b && b.name) || "—"}</td>
                    <td style={{ padding: "8px 0" }}>{l.type}</td>
                    <td style={{ padding: "8px 0" }}>{l.note || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  function TabAstronomia() {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Ubicación & Astronomía</h2>
        <LocationPicker value={coords} onChange={setCoords} />
        <LunarCalendar coords={coords} checked={showLunar} onCheckedChange={setShowLunar} />
        <p className="muted" style={{ marginTop: 8 }}>
          Tip: Puedes dejar marcada la opción de calendario lunar; se recuerda en tu dispositivo.
        </p>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>ZEN Bonsai</h1>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "hoy", label: "Hoy", render: function () { return <TabHoy />; } },
          { key: "coleccion", label: "Colección", render: function () { return <TabColeccion />; } },
          { key: "registros", label: "Registros", render: function () { return <TabRegistros />; } },
          { key: "astro", label: "Astronomía", render: function () { return <TabAstronomia />; } }
        ]}
      />
    </div>
  );
}
