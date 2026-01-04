import React from "https://esm.sh/react@18.2.0";
import ReactDOM from "https://esm.sh/react-dom@18.2.0/client";
import {
  Box,
  Button,
  Stack,
  Typography,
} from "https://esm.sh/@mui/material@5.15.10";
import { DataGrid } from "https://esm.sh/@mui/x-data-grid@6.19.5";

const ROLE_OPTIONS = ["consumer", "producer", "battery", "grid", "other"];
let rowIdCounter = 1;

const createRowId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${rowIdCounter++}`;
};

const normalizeDataPoints = (dataPoints) => {
  if (!Array.isArray(dataPoints)) {
    return [];
  }
  return dataPoints
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      id: createRowId(),
      objectId: entry.objectId ?? "",
      role: entry.role ?? "other",
      category: entry.category ?? "",
      description: entry.description ?? "",
      unit: entry.unit ?? "",
      enabled: Boolean(entry.enabled),
    }));
};

const validateRows = (rows) => {
  const counts = rows.reduce((acc, row) => {
    const key = row.objectId?.trim();
    if (key) {
      acc[key] = (acc[key] || 0) + 1;
    }
    return acc;
  }, {});
  return rows.reduce((acc, row) => {
    const rowErrors = {};
    const trimmed = row.objectId?.trim();
    if (!trimmed) {
      rowErrors.objectId = "ObjectId ist Pflichtfeld.";
    } else if (counts[trimmed] > 1) {
      rowErrors.objectId = "ObjectId ist doppelt.";
    }
    if (Object.keys(rowErrors).length) {
      acc[row.id] = rowErrors;
    }
    return acc;
  }, {});
};

const sanitizeRows = (rows) =>
  rows.map((row) => ({
    objectId: row.objectId?.trim() ?? "",
    role: ROLE_OPTIONS.includes(row.role) ? row.role : "other",
    category: row.category ?? "",
    description: row.description ?? "",
    unit: row.unit ?? "",
    enabled: Boolean(row.enabled),
  }));

const App = () => {
  const [rows, setRows] = React.useState([]);
  const [selection, setSelection] = React.useState([]);
  const [errors, setErrors] = React.useState({});
  const rowsRef = React.useRef(rows);
  const changeRef = React.useRef(null);

  React.useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  React.useEffect(() => {
    window.__adminUiApi = {
      setRows: (data) => setRows(data),
      getRows: () => rowsRef.current,
      setErrors: (data) => setErrors(data),
      setOnChange: (onChange) => {
        changeRef.current = onChange;
      },
      markChanged: () => {
        if (changeRef.current) {
          changeRef.current(true);
        }
      },
    };
  }, []);

  const markChanged = () => {
    if (changeRef.current) {
      changeRef.current(true);
    }
  };

  const handleAdd = () => {
    const newRow = {
      id: createRowId(),
      objectId: "",
      role: "consumer",
      category: "",
      description: "",
      unit: "",
      enabled: false,
    };
    setRows((prev) => [...prev, newRow]);
    markChanged();
  };

  const handleDelete = () => {
    if (!selection.length) {
      return;
    }
    setRows((prev) => prev.filter((row) => !selection.includes(row.id)));
    setSelection([]);
    markChanged();
  };

  const handleDuplicate = () => {
    if (!selection.length) {
      return;
    }
    setRows((prev) => {
      const duplicates = prev
        .filter((row) => selection.includes(row.id))
        .map((row) => ({
          ...row,
          id: createRowId(),
          objectId: "",
        }));
      return [...prev, ...duplicates];
    });
    markChanged();
  };

  const processRowUpdate = (newRow) => {
    setRows((prev) =>
      prev.map((row) => (row.id === newRow.id ? newRow : row))
    );
    markChanged();
    return newRow;
  };

  const enabledCount = rows.filter((row) => row.enabled).length;

  const columns = [
    {
      field: "enabled",
      headerName: "Enabled",
      type: "boolean",
      editable: true,
      width: 110,
    },
    {
      field: "objectId",
      headerName: "Object ID",
      editable: true,
      flex: 1.4,
    },
    {
      field: "role",
      headerName: "Role",
      editable: true,
      type: "singleSelect",
      valueOptions: ROLE_OPTIONS,
      flex: 0.8,
    },
    {
      field: "category",
      headerName: "Kategorie",
      editable: true,
      flex: 1,
    },
    {
      field: "description",
      headerName: "Beschreibung",
      editable: true,
      flex: 1.4,
    },
    {
      field: "unit",
      headerName: "Unit",
      editable: true,
      flex: 0.6,
    },
  ];

  return (
    <Box>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5" gutterBottom>
            Datenpunkte für GPT
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Nur Datenpunkte mit <strong>Enabled = true</strong> werden später an
            GPT übergeben. Aktuell aktiviert: {enabledCount} von {rows.length}.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={handleAdd}>
            + hinzufügen
          </Button>
          <Button
            variant="outlined"
            onClick={handleDuplicate}
            disabled={!selection.length}
          >
            Duplizieren
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={handleDelete}
            disabled={!selection.length}
          >
            Zeile löschen
          </Button>
        </Stack>

        <div className="grid-container">
          <DataGrid
            rows={rows}
            columns={columns}
            checkboxSelection
            disableRowSelectionOnClick
            editMode="cell"
            processRowUpdate={processRowUpdate}
            onProcessRowUpdateError={(error) => {
              console.error("Row update error", error);
            }}
            rowSelectionModel={selection}
            onRowSelectionModelChange={(newSelection) =>
              setSelection(newSelection)
            }
            getRowClassName={(params) =>
              params.row.enabled ? "" : "row-disabled"
            }
            getCellClassName={(params) => {
              const rowErrors = errors[params.id];
              if (rowErrors && rowErrors[params.field]) {
                return "cell-error";
              }
              return "";
            }}
            hideFooterSelectedRowCount
          />
        </div>

        {Object.keys(errors).length > 0 ? (
          <Box className="helper-text">
            <Typography variant="body2" color="error">
              Bitte fehlende oder doppelte ObjectIds korrigieren.
            </Typography>
          </Box>
        ) : (
          <Typography variant="body2" className="helper-text">
            ObjectId ist Pflichtfeld und muss eindeutig sein.
          </Typography>
        )}
      </Stack>
    </Box>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

window.loadSettings = (settings, onChange) => {
  window.__adminSettings = settings || {};
  const dataPoints = settings?.native?.dataPoints ?? [];
  const normalized = normalizeDataPoints(dataPoints);
  if (window.__adminUiApi) {
    window.__adminUiApi.setRows(normalized);
    window.__adminUiApi.setErrors({});
    window.__adminUiApi.setOnChange(onChange);
  }
  if (onChange) {
    onChange(false);
  }
};

window.saveSettings = (callback) => {
  const currentRows = window.__adminUiApi?.getRows() ?? [];
  const validationErrors = validateRows(currentRows);
  if (window.__adminUiApi) {
    window.__adminUiApi.setErrors(validationErrors);
  }
  if (Object.keys(validationErrors).length > 0) {
    alert("Bitte korrigiere die fehlerhaften ObjectIds vor dem Speichern.");
    return;
  }
  const cleaned = sanitizeRows(currentRows);
  const uniqueMap = new Map();
  cleaned.forEach((row) => {
    if (row.objectId) {
      uniqueMap.set(row.objectId, row);
    }
  });
  const native = {
    ...(window.__adminSettings?.native ?? {}),
    dataPoints: Array.from(uniqueMap.values()),
  };
  if (callback) {
    callback({
      ...(window.__adminSettings ?? {}),
      native,
    });
  }
};

window.load = window.loadSettings;
window.save = window.saveSettings;
