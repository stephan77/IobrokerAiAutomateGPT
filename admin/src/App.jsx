import React from "react";
import { Box, Button, Stack, Typography } from "@mui/material";

const App = ({ socket }) => {
  const [message, setMessage] = React.useState("");

  const handleTestSave = async () => {
    setMessage("");
    try {
      const instance =
        typeof socket?.instance === "number" ? socket.instance : 0;
      const instanceId = `system.adapter.ai-autopilot.${instance}`;
      const current = await socket.getObject(instanceId);
      if (!current) {
        setMessage("Speichern fehlgeschlagen: Instanz nicht gefunden.");
        return;
      }
      const updated = {
        ...current,
        native: {
          ...(current.native || {}),
          test: `ok-${Date.now()}`,
        },
      };
      await socket.setObject(instanceId, updated);
      setMessage("Gespeichert.");
    } catch (error) {
      setMessage("Speichern fehlgeschlagen.");
    }
  };

  return (
    <Box className="page-container">
      <Stack spacing={2}>
        <Typography variant="h4">AI Autopilot Admin geladen</Typography>
        <Button variant="contained" onClick={handleTestSave}>
          Test speichern
        </Button>
        {message ? <Typography>{message}</Typography> : null}
      </Stack>
    </Box>
  );
};

export default App;
