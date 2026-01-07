"use strict";

/**
 * Vorschläge (Aktionen) generieren.
 */
module.exports = () => {

  function build(config, stats, deviations) {
    const now = Date.now();
    const actions = [];

    for (const deviation of deviations) {
      const metric =
        deviation.metric ||
        deviation.objectId ||
        deviation.type ||
        "unbekannter Wert";

      const current =
        deviation.current ??
        deviation.value ??
        null;

      const reference =
        deviation.average ??
        deviation.threshold ??
        null;

      actions.push({
        id: `${metric}-${now}`,
        category: deviation.category || "deviation",
        type: "suggestion",
        priority: deviation.severity || "medium",
        title: deviation.title || "Abweichung erkannt",
        description:
          deviation.message ||
          `Der Wert von ${metric} weicht vom erwarteten Bereich ab.`,
        reason: buildReason(current, reference),
        requiresApproval: true,
        learningKey: metric,
        timestamp: new Date().toISOString(),
        status: "proposed",
      });
    }

    return actions;
  }

  function buildReason(current, reference) {
    if (current !== null && reference !== null) {
      return `Aktuell ${current}, Referenz ${reference}`;
    }
    if (current !== null) {
      return `Aktueller Wert: ${current}`;
    }
    return "Keine Vergleichsdaten verfügbar";
  }

  return { build };
};