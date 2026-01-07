"use strict";

/**
 * Regeln und Abweichungen erkennen.
 */
module.exports = (adapter) => {

  /* =====================================================
     Hilfsfunktionen
  ===================================================== */

  function getTimeWindow(date = new Date()) {
    const hour = date.getHours();
    if (hour >= 6 && hour < 11) return "morning";
    if (hour >= 11 && hour < 15) return "midday";
    if (hour >= 15 && hour < 19) return "afternoon";
    return "night";
  }

  function normalizeOrientation(orientation = "") {
    if (!orientation) return "other";

    const o = orientation
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss");

    // Zwischenrichtungen zuerst
    if (o.includes("nordost") || o.includes("north-east") || o.includes("north east") || o === "no") {
      return "north_east";
    }
    if (o.includes("nordwest") || o.includes("north-west") || o.includes("north west") || o === "nw") {
      return "north_west";
    }
    if (o.includes("suedost") || o.includes("southeast") || o.includes("south-east") || o === "so") {
      return "south_east";
    }
    if (o.includes("suedwest") || o.includes("southwest") || o.includes("south-west") || o === "sw") {
      return "south_west";
    }

    // Hauptachsen
    if (o.includes("nord") || o.includes("north")) return "north";
    if (o.includes("sued") || o.includes("south")) return "south";
    if (o.includes("ost")  || o.includes("east"))  return "east";
    if (o.includes("west")) return "west";

    return "other";
  }

  function groupPvByOrientation(pvSources = []) {
    const result = {
      east: 0,
      south: 0,
      west: 0,
      north: 0,
    };

    for (const src of pvSources) {
      if (!Number.isFinite(src.value)) continue;

      const o = normalizeOrientation(src.orientation);

      switch (o) {
        case "north_east":
          result.north += src.value * 0.5;
          result.east  += src.value * 0.5;
          break;
        case "south_east":
          result.south += src.value * 0.5;
          result.east  += src.value * 0.5;
          break;
        case "south_west":
          result.south += src.value * 0.5;
          result.west  += src.value * 0.5;
          break;
        case "north_west":
          result.north += src.value * 0.5;
          result.west  += src.value * 0.5;
          break;
        case "north":
        case "south":
        case "east":
        case "west":
          result[o] += src.value;
          break;
        default:
          // other (Dach, Carport, Garage, etc.) → nicht für Richtungslogik
          break;
      }
    }

    return result;
  }

  function seriesAverage(series) {
    const values = series.map(v => Number(v.val)).filter(Number.isFinite);
    return values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null;
  }

  /* =====================================================
     Hauptlogik
  ===================================================== */

  function detectDeviations(config, live, historyData, stats) {
    const deviations = [];

    /* =================================================
       1. PV-Plausibilitätsregel (Ausrichtung)
    ================================================= */

    if (live?.energy?.pvSources?.length >= 2) {
      const pvByOrientation = groupPvByOrientation(live.energy.pvSources);
      const timeWindow = getTimeWindow();

      const east  = pvByOrientation.east;
      const south = pvByOrientation.south;
      const west  = pvByOrientation.west;
      const north = pvByOrientation.north;

      const total = east + south + west + north;

      if (total > 300) {

        if (timeWindow === "midday" && south < Math.max(east, west) * 0.7) {
          deviations.push({
            type: "pv_plausibility",
            category: "energy",
            severity: "warning",
            title: "PV-Ausrichtung mittags ungewöhnlich",
            message:
              "Zur Mittagszeit ist die Leistung der südlich ausgerichteten PV-Anlagen im Verhältnis zu Ost/West ungewöhnlich niedrig.",
            details: { east, south, west, north, timeWindow },
          });
        }

        if (timeWindow === "morning" && east < south * 0.5) {
          deviations.push({
            type: "pv_plausibility",
            category: "energy",
            severity: "info",
            title: "PV Ost liefert morgens wenig",
            message:
              "Am Vormittag ist die Leistung der ostseitigen PV-Anlagen ungewöhnlich niedrig.",
            details: { east, south, west, north, timeWindow },
          });
        }

        if (timeWindow === "afternoon" && west < south * 0.5) {
          deviations.push({
            type: "pv_plausibility",
            category: "energy",
            severity: "info",
            title: "PV West liefert nachmittags wenig",
            message:
              "Am Nachmittag ist die Leistung der westseitigen PV-Anlagen ungewöhnlich niedrig.",
            details: { east, south, west, north, timeWindow },
          });
        }

        if (north > south * 0.8) {
          deviations.push({
            type: "pv_plausibility",
            category: "energy",
            severity: "info",
            title: "PV Nord ungewöhnlich hoch",
            message:
              "Die nordseitige PV-Leistung ist im Verhältnis zur Südseite ungewöhnlich hoch.",
            details: { east, south, west, north, timeWindow },
          });
        }
      }
    }

    /* =================================================
       2. Live-Regeln
    ================================================= */

    if (stats.energy.houseConsumption !== null && stats.energy.houseConsumption > 3000) {
      deviations.push({
        objectId: "energy.houseConsumption",
        metric: "houseConsumption",
        category: "energy",
        current: stats.energy.houseConsumption,
        threshold: 3000,
        severity: "medium",
        message: `Hoher Hausverbrauch (${stats.energy.houseConsumption.toFixed(0)} W)`
      });
    }

    if (stats.energy.batterySoc !== null && stats.energy.batterySoc < 20) {
      deviations.push({
        objectId: "energy.batterySoc",
        metric: "batterySoc",
        category: "energy",
        current: stats.energy.batterySoc,
        threshold: 20,
        severity: "high",
        message: `Batterie-Ladestand niedrig (${stats.energy.batterySoc} %)`
      });
    }

    /* =================================================
       3. Historien-Regeln
    ================================================= */

    for (const entry of config.dataPoints || []) {
      if (!entry.enabled) continue;

      const series = historyData?.[entry.objectId];
      if (!series || !series.length) continue;

      const avg = seriesAverage(series);
      const current = live?.raw?.[entry.objectId];

      if (avg !== null && current !== null) {
        const diff = Number(current) - avg;
        if (Math.abs(diff) > Math.abs(avg) * 0.3) {
          deviations.push({
            type: "history",
            category: entry.category || "other",
            severity: "info",
            message: `Abweichung von Historie bei ${entry.objectId}`,
            current,
            average: avg,
            delta: diff,
          });
        }
      }
    }

    adapter.log.info(`Regeln: ${deviations.length} Abweichungen erkannt`);
    return deviations;
  }

  return { detectDeviations };
};