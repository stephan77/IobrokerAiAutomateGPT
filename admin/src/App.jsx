import React from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import DataPointsGrid, {
  prepareRows,
  sanitizeRows,
  validateRows,
} from "./components/DataPointsGrid.jsx";
import TabPanel from "./components/TabPanel.jsx";

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

const App = () => {
  const [tabIndex, setTabIndex] = React.useState(0);
  const [rows, setRows] = React.useState([]);
  const [warnings, setWarnings] = React.useState([]);
  const [saveMessage, setSaveMessage] = React.useState(null);
  const settingsRef = React.useRef({ native: DEFAULT_NATIVE });
  const onChangeRef = React.useRef(null);
  const rowsRef = React.useRef([]);

  const markChanged = () => {
    if (onChangeRef.current) {
      onChangeRef.current(true);
    }
  };

  const handleSave = (errors) => {
    if (Object.keys(errors).length > 0) {
      return;
    }
    performSave();
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
            setSaveMessage({
              type: "error",
              text: "Speichern fehlgeschlagen.",
            });
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

  React.useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  React.useEffect(() => {
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

  return (
    <Box className="page-container">
      <Stack spacing={2}>
        <Typography variant="h4">AI Autopilot Adapter</Typography>
        <Tabs
          value={tabIndex}
          onChange={(_, newValue) => setTabIndex(newValue)}
        >
          <Tab label="Allgemein" />
          <Tab label="GPT" />
          <Tab label="Telegram" />
          <Tab label="History" />
          <Tab label="Scheduler" />
        </Tabs>
        <Divider />
        <TabPanel value={tabIndex} index={0}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button variant="outlined" disabled>
                Discovery (Stub)
              </Button>
              <Typography variant="body2" color="text.secondary">
                Discovery ist aktuell noch nicht implementiert.
              </Typography>
            </Stack>
            {warnings.map((warning) => (
              <Alert key={warning} severity="warning">
                {warning}
              </Alert>
            ))}
            {saveMessage ? (
              <Alert severity={saveMessage.type}>{saveMessage.text}</Alert>
            ) : null}
            <DataPointsGrid
              rows={rows}
              setRows={setRows}
              onMarkChanged={markChanged}
              onSave={handleSave}
              validationErrors={warnings}
            />
          </Stack>
        </TabPanel>
        <TabPanel value={tabIndex} index={1}>
          <Typography variant="body1">
            GPT-Einstellungen werden hier ergänzt.
          </Typography>
        </TabPanel>
        <TabPanel value={tabIndex} index={2}>
          <Typography variant="body1">
            Telegram-Einstellungen werden hier ergänzt.
          </Typography>
        </TabPanel>
        <TabPanel value={tabIndex} index={3}>
          <Typography variant="body1">
            History-Einstellungen werden hier ergänzt.
          </Typography>
        </TabPanel>
        <TabPanel value={tabIndex} index={4}>
          <Typography variant="body1">
            Scheduler-Einstellungen werden hier ergänzt.
          </Typography>
        </TabPanel>
      </Stack>
    </Box>
  );
};

export default App;
