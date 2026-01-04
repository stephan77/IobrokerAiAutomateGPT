"use strict";

/**
 * Konfiguration normalisieren.
 * Verhindert undefinierte Felder und sorgt für saubere Defaults.
 */
module.exports = (adapter) => {
  /**
   * Liefert eine normalisierte Konfiguration aus native.
   */
  function normalize() {
    const native = adapter.config || {};

    const dataPoints = Array.isArray(native.dataPoints) ? native.dataPoints : [];
    const history = native.history || {};
    const telegram = native.telegram || {};
    const gpt = native.gpt || {};
    const scheduler = native.scheduler || {};

    const normalizeObjectId = (value) => {
      if (typeof value === "string") {
        return value.trim();
      }
      if (value && typeof value === "object") {
        return String(value.id || value._id || value.value || "").trim();
      }
      return "";
    };

    const normalizeEnabled = (value) =>
      value === true || value === "true" || value === 1 || value === "1";

    return {
      dataPoints: dataPoints
        .map((entry) => {
          if (!entry) {
            return null;
          }
          const objectId = normalizeObjectId(entry.objectId);
          if (!objectId) {
            return null;
          }
          return {
            objectId,
            role: entry.role || "other",
            category: entry.category || "",
            description: entry.description || "",
            unit: entry.unit || "",
            enabled: normalizeEnabled(entry.enabled),
          };
        })
        .filter(Boolean),
      history: {
        mode: history.mode || "auto",
        instance: history.instance || "",
      },
      telegram: {
        enabled: telegram.enabled === true,
        instance: telegram.instance || "",
        recipients: Array.isArray(telegram.recipients)
          ? telegram.recipients
              .map((entry) => (entry && entry.id ? String(entry.id).trim() : ""))
              .filter((entry) => entry.length > 0)
          : [],
      },
      gpt: {
        enabled: gpt.enabled === true,
        openaiApiKey: gpt.openaiApiKey || "",
        model: gpt.model || "",
      },
      scheduler: {
        enabled: scheduler.enabled === true,
        time: scheduler.time || "08:00",
        days: scheduler.days || "mon,tue,wed,thu,fri,sat,sun",
        timezone: scheduler.timezone || "UTC",
      },
    };
  }

  return {
    normalize,
  };
};
