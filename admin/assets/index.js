import React, { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18.2.0";
import ReactDOM from "https://esm.sh/react-dom@18.2.0/client";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);

const ROLE_OPTIONS = ["consumer", "producer", "battery", "grid", "other"];

const DEFAULT_NATIVE = {
  dataPoints: [],
  discoveryCandidates: [],
  history: { mode: "auto", instance: "" },
  telegram: { enabled: false, instance: "", recipients: [] },
  gpt: { enabled: false, openaiApiKey: "", model: "gpt-4o-mini" },
  scheduler: {
    enabled: false,
    time: "08:00",
    days: "mon,tue,wed,thu,fri,sat,sun",
    timezone: "UTC",
  },
};

const createRowId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const sanitizeRows = (rows) =>
  rows.map((row) => ({
    objectId: row.objectId.trim(),
    role: ROLE_OPTIONS.includes(row.role) ? row.role : "other",
    category: row.category,
    description: row.description,
    unit: row.unit,
    enabled: Boolean(row.enabled),
  }));

const prepareRows = (dataPoints) => {
  if (!Array.isArray(dataPoints)) {
    return { rows: [], warnings: [] };
  }

  const rows = [];
  const warnings = [];
  const seen = new Set();
  const duplicates = [];
  const invalid = [];

  dataPoints.forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      return;
    }
    const objectId = String(entry.objectId || "").trim();
    if (!objectId) {
      invalid.push(entry);
      return;
    }
    if (seen.has(objectId)) {
      duplicates.push(objectId);
      return;
    }
    seen.add(objectId);
    rows.push({
      id: createRowId(),
      objectId,
      role: ROLE_OPTIONS.includes(entry.role) ? entry.role : "other",
      category: entry.category ?? "",
      description: entry.description ?? "",
      unit: entry.unit ?? "",
      enabled: Boolean(entry.enabled),
    });
  });

  if (invalid.length > 0) {
    warnings.push("Ungültige Einträge ohne ObjectId wurden entfernt.");
  }
  if (duplicates.length > 0) {
    warnings.push(
      `Doppelte ObjectIds wurden dedupliziert: ${[...new Set(duplicates)].join(
        ", "
      )}.`
    );
  }

  return { rows, warnings };
};

const validateRows = (rows) => {
  const counts = rows.reduce((acc, row) => {
    const key = row.objectId.trim();
    if (key) {
      acc[key] = (acc[key] || 0) + 1;
    }
    return acc;
  }, {});

  return rows.reduce((acc, row) => {
    const trimmed = row.objectId.trim();
    if (!trimmed) {
      acc[row.id] = "ObjectId ist Pflichtfeld.";
    } else if (counts[trimmed] > 1) {
      acc[row.id] = "ObjectId ist doppelt.";
    }
    return acc;
  }, {});
};

const App = () => {
  const [tabIndex, setTabIndex] = useState(0);
  const [rows, setRows] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [saveMessage, setSaveMessage] = useState(null);
  const settingsRef = useRef({ native: DEFAULT_NATIVE });
  const onChangeRef = useRef(null);
  const rowsRef = useRef([]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    window.loadSettings = (settings, onChange) => {
      settingsRef.current = settings || { native: DEFAULT_NATIVE };
      onChangeRef.current = onChange;
      const { rows: preparedRows, warnings: loadWarnings } = prepareRows(
        settings?.native?.dataPoints
      );
      setRows(preparedRows);
      setWarnings(loadWarnings);
      if (onChange) {
        onChange(loadWarnings.length > 0);
      }
    };

    window.saveSettings = (callback) => {
      const errors = validateRows(rowsRef.current);
      if (Object.keys(errors).length > 0) {
        setSaveMessage({
          type: "error",
          text: "Bitte korrigiere fehlende oder doppelte ObjectIds.",
        });
        return;
      }
      const native = {
        ...(settingsRef.current.native || DEFAULT_NATIVE),
        dataPoints: sanitizeRows(rowsRef.current).filter((row) => row.objectId),
      };
      const updatedSettings = { ...settingsRef.current, native };
      settingsRef.current = updatedSettings;
      if (callback) {
        callback(updatedSettings);
      }
    };

    window.load = window.loadSettings;
    window.save = window.saveSettings;
  }, []);

  const errors = useMemo(() => validateRows(rows), [rows]);
  const hasErrors = Object.keys(errors).length > 0;

  const markChanged = () => {
    if (onChangeRef.current) {
      onChangeRef.current(true);
    }
  };

  const handleAdd = () => {
    setRows((prev) => [
      ...prev,
      {
        id: createRowId(),
        objectId: "",
        role: "consumer",
        category: "",
        description: "",
        unit: "",
        enabled: false,
      },
    ]);
    markChanged();
  };

  const handleUpdate = (id, field, value) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
    markChanged();
  };

  const handleDelete = (id) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
    markChanged();
  };

  const handleDuplicate = (row) => {
    setRows((prev) => [
      ...prev,
      {
        ...row,
        id: createRowId(),
        objectId: "",
      },
    ]);
    markChanged();
  };

  const performSave = () => {
    const instanceId = `system.adapter.${window.adapter}.${window.instance}`;
    const native = {
      ...(settingsRef.current.native || DEFAULT_NATIVE),
      dataPoints: sanitizeRows(rowsRef.current).filter((row) => row.objectId),
    };

    if (window.socket && !instanceId.includes("undefined")) {
      window.socket.emit("getObject", instanceId, (error, obj) => {
        if (error || !obj) {
          setSaveMessage({
            type: "error",
            text: "Speichern fehlgeschlagen: Instanz nicht gefunden.",
          });
          return;
        }
        const updated = { ...obj, native };
        window.socket.emit("setObject", instanceId, updated, (saveError) => {
          if (saveError) {
            setSaveMessage({ type: "error", text: "Speichern fehlgeschlagen." });
            return;
          }
          settingsRef.current = { ...settingsRef.current, native };
          if (onChangeRef.current) {
            onChangeRef.current(false);
          }
          setSaveMessage({ type: "success", text: "Gespeichert." });
        });
      });
      return;
    }

    setSaveMessage({
      type: "error",
      text: "Speichern fehlgeschlagen: Admin-Socket nicht verfügbar.",
    });
  };

  return html`
    <div className="page">
      <h1>AI Autopilot Adapter</h1>
      <div className="tabs">
        ${["Allgemein", "GPT", "Telegram", "History", "Scheduler"].map(
          (label, index) => html`
            <button
              className=${tabIndex === index ? "active" : ""}
              onClick=${() => setTabIndex(index)}
            >
              ${label}
            </button>
          `
        )}
      </div>
      ${tabIndex === 0 &&
      html`
        <div className="section">
          <div className="grid-actions">
            <button disabled>Discovery (Stub)</button>
            <span>Discovery ist aktuell noch nicht implementiert.</span>
          </div>
          ${warnings.map(
            (warning) => html`<div className="badge-warning">${warning}</div>`
          )}
          ${saveMessage
            ? html`<div className="notice ${saveMessage.type}">
                ${saveMessage.text}
              </div>`
            : ""}
          <div className="grid-actions">
            <button className="primary" onClick=${handleAdd}>
              + Zeile hinzufügen
            </button>
            <button
              onClick=${performSave}
              disabled=${hasErrors}
              title=${hasErrors
                ? "Bitte korrigiere die ObjectIds vor dem Speichern."
                : ""}
            >
              Speichern
            </button>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Enabled</th>
                  <th>Object ID *</th>
                  <th>Role</th>
                  <th>Kategorie</th>
                  <th>Beschreibung</th>
                  <th>Unit</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map(
                  (row) => html`
                    <tr>
                      <td>
                        <input
                          type="checkbox"
                          checked=${row.enabled}
                          onChange=${(event) =>
                            handleUpdate(
                              row.id,
                              "enabled",
                              event.target.checked
                            )}
                        />
                      </td>
                      <td>
                        <input
                          className=${errors[row.id] ? "error" : ""}
                          type="text"
                          value=${row.objectId}
                          onInput=${(event) =>
                            handleUpdate(row.id, "objectId", event.target.value)}
                        />
                        ${errors[row.id]
                          ? html`<div className="helper error">
                              ${errors[row.id]}
                            </div>`
                          : ""}
                      </td>
                      <td>
                        <select
                          value=${row.role}
                          onChange=${(event) =>
                            handleUpdate(row.id, "role", event.target.value)}
                        >
                          ${ROLE_OPTIONS.map(
                            (role) => html`
                              <option value=${role}>${role}</option>
                            `
                          )}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          value=${row.category}
                          onInput=${(event) =>
                            handleUpdate(row.id, "category", event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value=${row.description}
                          onInput=${(event) =>
                            handleUpdate(
                              row.id,
                              "description",
                              event.target.value
                            )}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value=${row.unit}
                          onInput=${(event) =>
                            handleUpdate(row.id, "unit", event.target.value)}
                        />
                      </td>
                      <td>
                        <button onClick=${() => handleDuplicate(row)}>
                          Duplizieren
                        </button>
                        <button onClick=${() => handleDelete(row.id)}>
                          Löschen
                        </button>
                      </td>
                    </tr>
                  `
                )}
              </tbody>
            </table>
          </div>
          ${hasErrors
            ? html`<div className="helper error">
                Bitte fehlende oder doppelte ObjectIds korrigieren.
              </div>`
            : html`<div className="helper">
                ObjectId ist Pflichtfeld und muss eindeutig sein.
              </div>`}
        </div>
      `}
      ${tabIndex === 1 &&
      html`<div className="section">GPT-Einstellungen werden hier ergänzt.</div>`}
      ${tabIndex === 2 &&
      html`<div className="section">
        Telegram-Einstellungen werden hier ergänzt.
      </div>`}
      ${tabIndex === 3 &&
      html`<div className="section">History-Einstellungen werden hier ergänzt.</div>`}
      ${tabIndex === 4 &&
      html`<div className="section">
        Scheduler-Einstellungen werden hier ergänzt.
      </div>`}
    </div>
  `;
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(html`<${App} />`);
