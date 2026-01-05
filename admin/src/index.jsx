import React from "react";
import ReactDOM from "react-dom/client";
import { AdminConnection } from "@iobroker/adapter-react-v5";
import App from "./App.jsx";
import "./index.css";

const rootElement = document.getElementById("root");
const root = ReactDOM.createRoot(rootElement);

const renderApp = (socket) => {
  root.render(<App socket={socket} />);
};

const renderError = (message) => {
  root.render(
    <div style={{ padding: "1.5rem", fontFamily: "sans-serif" }}>{message}</div>
  );
};

const socket = new AdminConnection({
  name: "ai-autopilot",
  onReady: () => renderApp(socket),
  onError: (error) =>
    renderError(
      typeof error === "string" ? error : "Admin-Socket nicht verfügbar."
    ),
});
