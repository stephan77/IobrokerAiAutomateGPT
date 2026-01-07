"use strict";

/**
 * Statistiken berechnen und als JSON zurückgeben.
 */
module.exports = () => {

function compute(config, live, historyData) {
  const stats = {
    timestamp: new Date().toISOString(),
    energy: {
      houseConsumption: null,
      pvPower: null,
      gridPower: null,
      batterySoc: null,
      batteryPower: null,
      batteryState: "active",   // 👈 NEU
      wallboxPower: null,
    },
    temperature: {
      outside: null,
    },
    water: {
      total: null,
    },
    deviations: [],
  };

    /* =========================================
       1. LIVE-WERTE aus DataPoints (RAW)
    ========================================= */

    for (const dp of config.dataPoints || []) {
      const value = live?.raw?.[dp.objectId];
      if (!Number.isFinite(value)) continue;

      switch (dp.role) {
        case "energy.houseConsumption":
          stats.energy.houseConsumption = value;
          break;

        case "energy.gridPower":
          stats.energy.gridPower = value;
          break;

        case "energy.batterySoc":
          stats.energy.batterySoc = value;
          break;

        case "energy.wallbox":
          stats.energy.wallboxPower = value;
          break;

        case "temperature.outside":
          stats.temperature.outside = value;
          break;

        case "water.total":
          stats.water.total = value;
          break;

        case "energy.batteryPower":
          let v = Number(value);
          if (!Number.isFinite(v)) break;

          // Wenn dein Wert in kW kommt (0.46), in W umrechnen:

          if ((dp.unit || "").toLowerCase() === "kw") v = v * 1000;

          stats.energy.batteryPower = v;
          break;
      }
    }

    /* =========================================
       2. PV-Leistung (NUR aggregiert!)
    ========================================= */

    if (Number.isFinite(live?.energy?.pvPower)) {
      stats.energy.pvPower = live.energy.pvPower;
    }

    /* =========================================
       3. Grid-Leistung ableiten (optional)
       grid = house - pv - battery
    ========================================= */

    if (
      Number.isFinite(stats.energy.houseConsumption) &&
      Number.isFinite(stats.energy.pvPower)
    ) {
      const battery = Number.isFinite(stats.energy.batteryPower)
        ? stats.energy.batteryPower
        : 0;

      stats.energy.gridPower =
        stats.energy.houseConsumption -
        stats.energy.pvPower -
        battery;
    }

    /* =========================================
       4. HISTORIE → ABWEICHUNGEN
    ========================================= */

    for (const [objectId, series] of Object.entries(historyData || {})) {
      stats.deviations.push({
        objectId,
        avg: average(series),
        min: minimum(series),
        max: maximum(series),
        last: lastValue(series),
      });
    }
  /* =========================
     🔋 Batterie-Zustand ableiten
     ========================= */

  if (
    stats.energy.batterySoc !== null &&
    stats.energy.batterySoc < 20 &&
    stats.energy.batteryPower !== null &&
    Math.abs(stats.energy.batteryPower) < 5
  ) {
    stats.energy.batteryState = "shutdown"; // BMS hat abgeschaltet
  } else if (
    stats.energy.batteryPower !== null &&
    stats.energy.batteryPower > 10
  ) {
    stats.energy.batteryState = "discharging";
  } else if (
    stats.energy.batteryPower !== null &&
    stats.energy.batteryPower < -10
  ) {
    stats.energy.batteryState = "charging";
  } else {
    stats.energy.batteryState = "idle";
  }
    return stats;
  }

  /* =========================================
     Statistik-Helfer
  ========================================= */

  function average(series) {
    const values = series?.map(i => Number(i.val)).filter(Number.isFinite);
    return values?.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null;
  }

  function minimum(series) {
    const values = series?.map(i => Number(i.val)).filter(Number.isFinite);
    return values?.length ? Math.min(...values) : null;
  }

  function maximum(series) {
    const values = series?.map(i => Number(i.val)).filter(Number.isFinite);
    return values?.length ? Math.max(...values) : null;
  }

  function lastValue(series) {
    return series?.length
      ? series[series.length - 1]?.val ?? null
      : null;
  }

  return { compute };
};