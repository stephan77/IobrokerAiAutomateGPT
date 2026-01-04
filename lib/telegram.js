"use strict";

/**
 * Telegram-Integration (optional).
 * Wird nur aktiv, wenn enabled und eine Telegram-Instanz gesetzt sind.
 */
module.exports = (adapter) => {
  let enabled = false;
  let telegramInstance = "";
  let recipients = [];

  /**
   * Initialisiert Telegram, falls gewünscht.
   */
  async function setup(config) {
    telegramInstance = config.telegram.instance || "";
    recipients = Array.isArray(config.telegram.recipients) ? config.telegram.recipients : [];
    enabled = config.telegram.enabled && telegramInstance.length > 0;
    if (!enabled) {
      adapter.log.info("Telegram ist deaktiviert.");
    } else {
      const recipientInfo = recipients.length ? ` (${recipients.length} Empfänger)` : "";
      adapter.log.info(`Telegram ist aktiviert.${recipientInfo}`);
    }
  }

  function sendMessage(text) {
    if (!enabled) {
      return;
    }
    if (!text) {
      adapter.log.warn("Telegram-Nachricht leer, Versand übersprungen.");
      return;
    }
    if (!recipients.length) {
      adapter.log.warn("Keine Telegram-Empfänger konfiguriert, Versand übersprungen.");
      return;
    }

    recipients.forEach((recipient) => {
      adapter.sendTo(telegramInstance, "send", {
        text,
        user: recipient,
      });
    });
  }

  /**
   * Behandelt Aktionen aus der Telegram-UI.
   */
  async function handleAction(msg) {
    if (!enabled) {
      return;
    }
    const payload = msg && msg.message ? msg.message : {};
    const text =
      typeof payload === "string"
        ? payload
        : payload.text || payload.message || JSON.stringify(payload);
    adapter.log.info(`Telegram-Aktion empfangen: ${JSON.stringify(payload)}`);
    sendMessage(text);
  }

  /**
   * Stoppt Telegram-bezogene Prozesse.
   */
  async function stop() {
    enabled = false;
  }

  return {
    setup,
    handleAction,
    stop,
  };
};
