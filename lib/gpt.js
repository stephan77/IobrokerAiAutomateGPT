"use strict";

/**
 * GPT-Integration (optional) zur Textanreicherung.
 */
module.exports = (adapter) => {
  function buildGptPayload(config) {
    const dataPoints = Array.isArray(config.dataPoints) ? config.dataPoints : [];
    return {
      dataPoints: dataPoints
        .filter((entry) => entry && entry.enabled === true)
        .map((entry) => ({ ...entry })),
    };
  }

  /**
   * Ergänzt Aktionen optional durch GPT.
   */
  async function enrichActions(config, actions, stats) {
    if (!config.gpt.enabled || !config.gpt.openaiApiKey) {
      return actions;
    }

    const gptPayload = buildGptPayload(config);
    adapter.log.info("GPT ist aktiviert, es erfolgt jedoch keine Änderung der Logik.");
    return actions;
  }

  return {
    buildGptPayload,
    enrichActions,
  };
};
