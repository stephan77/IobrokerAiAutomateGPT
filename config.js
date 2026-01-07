"use strict";

/**
 * Konfiguration normalisieren.
 * Verhindert undefinierte Felder und sorgt für saubere Defaults.
 */
module.exports = (adapter) => {

  /* =====================================================
     Hilfsfunktionen
  ===================================================== */

  const normalizeObjectId = (value) => {
    if (typeof value === "string") return value.trim();
    if (value && typeof value === "object") {
      return String(value.id || value._id || value.value || "").trim();
    }
    return "";
  };

  const normalizeEnabled = (value) =>
    value === true || value === "true" || value === 1 || value === "1";

  const sanitizeDataPoints = (entries) => {
    const list = Array.isArray(entries) ? entries : [];
    const cleaned = [];
    const seen = new Set();

    for (const entry of list) {
      if (!entry) continue;

      const objectId = normalizeObjectId(entry.objectId);
      if (!objectId || seen.has(objectId)) continue;

      seen.add(objectId);
      cleaned.push({ ...entry, objectId });
    }

    return cleaned;
  };

  /* =====================================================
     Sanitize (für onReady)
  ===================================================== */

  const sanitizeConfig = () => {
    const native = adapter.config || {};
    const original = Array.isArray(native.dataPoints) ? native.dataPoints : [];
    const dataPoints = sanitizeDataPoints(original);

    let changed = dataPoints.length !== original.length;
    if (!changed) {
      for (let i = 0; i < dataPoints.length; i++) {
        if (normalizeObjectId(original[i]?.objectId) !== dataPoints[i].objectId) {
          changed = true;
          break;
        }
      }
    }

    return { dataPoints, changed };
  };

  /* =====================================================
     Normalize (Hauptlogik)
  ===================================================== */

  function normalize() {
    const native = adapter.config || {};

    /* -----------------------------
       1. Strukturierte Felder
    ----------------------------- */

    const pvSources = Array.isArray(native.pvSources)
      ? native.pvSources
          .map(src => ({
            name: src.name || "",
            orientation: src.orientation || "",
            objectId: normalizeObjectId(src.objectId),
            unit: src.unit || "W",
          }))
          .filter(src => src.objectId.length > 0)
      : [];

    const history = native.history || {};
    const telegram = native.telegram || {};
    const scheduler = native.scheduler || {};
    const gpt = native.gpt || {};

    const openaiApiKey = native.openaiApiKey || gpt.openaiApiKey || "";

    /* -----------------------------
       2. DataPoints (primär)
    ----------------------------- */

    let dataPoints = sanitizeDataPoints(native.dataPoints);

    /* -----------------------------
       3. Fallback: DataPoints aus Admin-Feldern bauen
       (NUR wenn keine expliziten dataPoints existieren)
    ----------------------------- */

    if (!dataPoints.length) {
      const push = (objectId, category, description) => {
        const id = normalizeObjectId(objectId);
        if (!id) return;

        dataPoints.push({
          objectId: id,
          role: category,
          category,
          description,
          unit: "",
          enabled: true,
        });
      };

      // Energie
      if (native.energy) {
        push(native.energy.houseConsumption, "energy.houseConsumption", "Hausverbrauch");
        push(native.energy.gridPower, "energy.gridPower", "Netzleistung");
        push(native.energy.batterySoc, "energy.batterySoc", "Batterie SOC");
        push(native.energy.batteryPower, "energy.batteryPower", "Batterie Leistung");
        push(native.energy.wallbox, "energy.wallbox", "Wallbox");
      }

      // Temperatur
      if (native.temperature) {
        push(native.temperature.outside, "temperature.outside", "Außentemperatur");
        push(native.temperature.weather, "temperature.weather", "Wetter");
        push(native.temperature.frostRisk, "temperature.frostRisk", "Frostgefahr");
      }

      // Wasser
      if (native.water) {
        push(native.water.total, "water.total", "Wasser Gesamt");
        push(native.water.daily, "water.daily", "Wasser Tagesverbrauch");
        push(native.water.hotWater, "water.hotWater", "Warmwasser");
        push(native.water.boilerTemp, "water.boilerTemp", "Boiler Temperatur");
        push(native.water.circulation, "water.circulation", "Zirkulation");
      }

      // PV-Quellen (nur Leistung → KEINE Richtungslogik hier!)
      //for (const pv of pvSources) {
        //push(pv.objectId, "energy.pvPower", pv.name || "PV");
      //}

      // Verbraucher
      for (const c of native.consumers || []) {
        push(c.objectId, "consumer.power", c.name || "Verbraucher");
      }

      // Räume
      for (const r of native.rooms || []) {
        push(r.temperature, "room.temperature", r.name || "Raumtemperatur");
        push(r.heatingPower, "room.heating", r.name || "Heizung");
      }

      // Heizungen
      for (const h of native.heaters || []) {
        push(h.objectId, "heater", h.type || "Heizung");
      }

      // Fenster
      for (const w of native.windowContacts || []) {
        push(w.objectId, "window", w.name || "Fenster");
      }

      // Leckage
      for (const l of native.leakSensors || []) {
        push(l.objectId, "leak", l.name || "Leckage");
      }
    }

    /* -----------------------------
       4. Finales Normalize-Objekt
    ----------------------------- */

    return {
      dataPoints: dataPoints
        .map(entry => ({
          objectId: normalizeObjectId(entry.objectId),
          role: entry.role || "other",
          category: entry.category || "",
          description: entry.description || "",
          unit: entry.unit || "",
          enabled: normalizeEnabled(entry.enabled),
        }))
        .filter(dp => dp.objectId.length > 0),

      pvSources, // 🔥 WICHTIG: bleibt jetzt erhalten

      history: {
        mode: history.mode || "auto",
        instance: history.instance || "",
      },

      telegram: {
        enabled: telegram.enabled === true,
        instance: telegram.instance || "",
        recipients: Array.isArray(telegram.recipients)
          ? telegram.recipients
              .map(r => {
                if (!r) return null;
                if (typeof r === "string") return r.trim();
                return String(
                  r.id ??
                  r.chatId ??
                  r.value ??
                  ""
                ).trim();
              })
              .filter(Boolean)
          : [],
      },

      gpt: {
        enabled: Boolean(openaiApiKey),
        openaiApiKey,
        model: gpt.model || native.model || "gpt-4o-mini",
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
    sanitizeConfig,
  };
};