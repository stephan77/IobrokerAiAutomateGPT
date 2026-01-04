import React from "react";
import {
  Box,
  Button,
  Checkbox,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";

const ROLE_OPTIONS = ["consumer", "producer", "battery", "grid", "other"];

const createRowId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const emptyRow = () => ({
  id: createRowId(),
  objectId: "",
  role: "consumer",
  category: "",
  description: "",
  unit: "",
  enabled: false,
});

export const validateRows = (rows) => {
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

const DataPointsGrid = ({
  rows,
  setRows,
  onMarkChanged,
  onSave,
  validationErrors,
}) => {
  const handleRowChange = (id, field, value) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
    onMarkChanged();
  };

  const handleAdd = () => {
    setRows((prev) => [...prev, emptyRow()]);
    onMarkChanged();
  };

  const handleDelete = (id) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
    onMarkChanged();
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
    onMarkChanged();
  };

  const enabledCount = rows.filter((row) => row.enabled).length;
  const errors = React.useMemo(() => validateRows(rows), [rows]);
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" className="section-title" gutterBottom>
          Datenpunkte für GPT
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Nur Datenpunkte mit <strong>Enabled = true</strong> werden später an
          GPT übergeben. Aktuell aktiviert: {enabledCount} von {rows.length}.
        </Typography>
      </Box>

      <Stack direction="row" spacing={1}>
        <Button variant="contained" onClick={handleAdd}>
          + Zeile hinzufügen
        </Button>
        <Button
          variant="outlined"
          onClick={() => onSave(errors)}
          disabled={hasErrors}
        >
          Speichern
        </Button>
      </Stack>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Enabled</TableCell>
              <TableCell>Object ID *</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Kategorie</TableCell>
              <TableCell>Beschreibung</TableCell>
              <TableCell>Unit</TableCell>
              <TableCell>Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Checkbox
                    checked={row.enabled}
                    onChange={(event) =>
                      handleRowChange(row.id, "enabled", event.target.checked)
                    }
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    value={row.objectId}
                    onChange={(event) =>
                      handleRowChange(row.id, "objectId", event.target.value)
                    }
                    size="small"
                    fullWidth
                    error={Boolean(errors[row.id])}
                    helperText={errors[row.id]}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    select
                    value={row.role}
                    onChange={(event) =>
                      handleRowChange(row.id, "role", event.target.value)
                    }
                    size="small"
                    fullWidth
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <MenuItem key={role} value={role}>
                        {role}
                      </MenuItem>
                    ))}
                  </TextField>
                </TableCell>
                <TableCell>
                  <TextField
                    value={row.category}
                    onChange={(event) =>
                      handleRowChange(row.id, "category", event.target.value)
                    }
                    size="small"
                    fullWidth
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    value={row.description}
                    onChange={(event) =>
                      handleRowChange(row.id, "description", event.target.value)
                    }
                    size="small"
                    fullWidth
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    value={row.unit}
                    onChange={(event) =>
                      handleRowChange(row.id, "unit", event.target.value)
                    }
                    size="small"
                    fullWidth
                  />
                </TableCell>
                <TableCell className="table-cell-actions">
                  <IconButton
                    aria-label="duplicate"
                    onClick={() => handleDuplicate(row)}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label="delete"
                    color="error"
                    onClick={() => handleDelete(row.id)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {validationErrors.length > 0 ? (
        <Box className="helper-text">
          {validationErrors.map((message) => (
            <Typography key={message} variant="body2" color="warning.main">
              {message}
            </Typography>
          ))}
        </Box>
      ) : null}

      {hasErrors ? (
        <Typography variant="body2" color="error" className="helper-text">
          Bitte fehlende oder doppelte ObjectIds korrigieren.
        </Typography>
      ) : (
        <Typography variant="body2" color="text.secondary" className="helper-text">
          ObjectId ist Pflichtfeld und muss eindeutig sein.
        </Typography>
      )}
    </Stack>
  );
};

export const sanitizeRows = (rows) =>
  rows.map((row) => ({
    objectId: row.objectId.trim(),
    role: ROLE_OPTIONS.includes(row.role) ? row.role : "other",
    category: row.category,
    description: row.description,
    unit: row.unit,
    enabled: Boolean(row.enabled),
  }));

export const prepareRows = (dataPoints) => {
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

export default DataPointsGrid;
