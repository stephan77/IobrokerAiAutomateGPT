"use strict";

/**
 * Erzeugt den Live-Kontext anhand der konfigurierten Datenpunkte.
 */
module.exports = (adapter) => {

  /**
   * Liest aktuelle Zustände und baut ein Kontext-Objekt.
   */
  async function collect(config) {
    adapter.log.warn(
  `[DEBUG] pvSources in config: ${JSON.stringify(config.pvSources)}`
    );
    const context = {
      energy: {},
      temperature: {},
      water: {},
      leaks: [],
      rooms: [],
      raw: {},
    };

    /* =========================
       1. dataPoints lesen
    ========================= */

    for (const entry of config.dataPoints || []) {
      if (!entry.enabled || !entry.objectId) {
        continue;
      }

      const stateValue = await readState(entry.objectId);
      context.raw[entry.objectId] = stateValue;

      const payload = {
        objectId: entry.objectId,
        category: entry.category,
        value: stateValue,
        unit: entry.unit,
        description: entry.description,
      };

      if (entry.category?.startsWith("energy")) {
        context.energy[entry.category] = payload;
      } else if (entry.category?.startsWith("temperature")) {
        context.temperature[entry.category] = payload;
      } else if (entry.category?.startsWith("water")) {
        context.water[entry.category] = payload;
      } else if (entry.category === "leak") {
        context.leaks.push(payload);
      } else if (entry.category === "room") {
        context.rooms.push(payload);
      }
    }
    adapter.log.warn(
  `[DEBUG] raw keys: ${JSON.stringify(Object.keys(context.raw))}`
);

/* =========================
   1.5 PV-Quellen EXPLIZIT lesen  🔥 DAS FEHLT
========================= */

for (const src of config.pvSources || []) {
  if (!src.objectId) continue;

  const value = await readState(src.objectId);
  context.raw[src.objectId] = value;

  adapter.log.warn(
    `[DEBUG] PV read ${src.objectId} = ${value}`
  );
}

adapter.log.warn(
  `[DEBUG] raw keys: ${JSON.stringify(Object.keys(context.raw))}`
);

    /* =========================
       2. PV-Quellen aggregieren
    ========================= */

    const pv = collectPvPower(config, context.raw);

    context.energy.pvPower = pv.total;
    context.energy.pvSources = pv.sources;

    return context;
  }

  /**
   * Aggregiert PV-Leistungen aus Admin-pvSources
   */
  function collectPvPower(config, raw) {
    const sources = Array.isArray(config.pvSources) ? config.pvSources : [];

    let totalPower = 0;
    let validSources = 0;
    const details = [];

    for (const src of sources) {
      const id = src?.objectId;
      if (!id) continue;

      const value = raw[id] ?? null;
      if (!Number.isFinite(value)) continue;

      totalPower += Number(value);
      validSources++;

      details.push({
        name: src.name || id,
        orientation: src.orientation || "unknown",
        value: Number(value),
        unit: src.unit || "W",
      });
    }

    return {
      total: validSources > 0 ? totalPower : null,
      sources: details,
    };
  }

  /**
   * Liest einen Zustand, lokal oder fremd.
   */
  async function readState(objectId) {
    if (!objectId) {
      return null;
    }
    try {
      if (objectId.startsWith(`${adapter.namespace}.`)) {
        const state = await adapter.getStateAsync(objectId);
        return state ? state.val : null;
      }
      const foreignState = await adapter.getForeignStateAsync(objectId);
      return foreignState ? foreignState.val : null;
    } catch (error) {
      adapter.log.warn(
        `Zustand ${objectId} konnte nicht gelesen werden: ${error.message}`
      );
      return null;
    }
  }

  return {
    collect,
  };
};