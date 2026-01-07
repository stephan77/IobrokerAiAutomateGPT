"use strict";

const utils = require("@iobroker/adapter-core");
const createConfig = require("./lib/config");
const createState = require("./lib/state");
const createDiscovery = require("./lib/discovery");
const createLiveContext = require("./lib/liveContext");
const createHistory = require("./lib/history");
const createStats = require("./lib/stats");
const createRules = require("./lib/rules");
const createActions = require("./lib/actions");
const createReport = require("./lib/report");
const createTelegram = require("./lib/telegram");
const createGpt = require("./lib/gpt");
const createScheduler = require("./lib/scheduler");

function startAdapter(options) {
  const adapter = new utils.Adapter({ ...options, name: "ai-autopilot" });

  const config = createConfig(adapter);
  const state = createState(adapter);
  const discovery = createDiscovery(adapter);
  const liveContext = createLiveContext(adapter);
  const history = createHistory(adapter);
  const stats = createStats(adapter);
  const rules = createRules(adapter);
  const actions = createActions(adapter);
  const report = createReport(adapter);
  const telegram = createTelegram(adapter);
  const gpt = createGpt(adapter);
  const scheduler = createScheduler(adapter);

  let analysisRunning = false;

  const isDebug = () => adapter.config?.debug === true;

  const debugLog = (msg, obj) => {
    if (!isDebug()) return;
    if (obj !== undefined) {
      adapter.log.info(`[DEBUG] ${msg}: ${JSON.stringify(obj, null, 2)}`);
    } else {
      adapter.log.info(`[DEBUG] ${msg}`);
    }
  };

  async function runAnalysisWithLock(trigger) {
    if (analysisRunning) {
      adapter.log.info(`Analyse bereits aktiv, Trigger '${trigger}' ignoriert.`);
      return;
    }
    analysisRunning = true;
    adapter.log.info(`Starte Analyse (Trigger: ${trigger})`);

    try {
      await runAnalysis();
      await state.setMeta("lastRun", new Date().toISOString());
    } catch (err) {
      adapter.log.error(`Analyse fehlgeschlagen: ${err.message}`);
      await state.setInfo("lastError", String(err.message || err));
    } finally {
      analysisRunning = false;
    }
  }

  async function runAnalysis() {
    const normalizedConfig = config.normalize();
    debugLog("Normalisierte Konfiguration", normalizedConfig);

    if (!normalizedConfig.dataPoints.length) {
      adapter.log.info("Keine Datenpunkte konfiguriert. Analyse im Leerlauf.");
      await report.persistEmpty();
      return;
    }

    debugLog("Datenpunkte", normalizedConfig.dataPoints);

    const live = await liveContext.collect(normalizedConfig);
    debugLog("Live-Daten", live);

    const historyData = await history.collect(normalizedConfig, live);
    debugLog("History-Daten", historyData);

    const computedStats = stats.compute(normalizedConfig, live, historyData);
    debugLog("Statistiken", computedStats);

    const deviations = rules.detectDeviations(
      normalizedConfig,
      live,
      historyData,
      computedStats
    );
    debugLog("Abweichungen", deviations);

    let actionList = actions.build(normalizedConfig, computedStats, deviations);
    debugLog("Aktionen (vor GPT)", actionList);

    // 🔥 DEBUG-FALLBACK → GPT IMMER AUFRUFEN
    if (!actionList.length && isDebug()) {
      actionList.push({
        type: "analysis",
        severity: "info",
        message: "Debug-Analyse ohne erkannte Abweichungen",
      });
      debugLog("Fallback-Aktion erzeugt");
    }

    const enrichedActions = await gpt.enrichActions(
      normalizedConfig,
      actionList,
      computedStats
    );
    debugLog("GPT-Aktionen", enrichedActions);

    for (const action of enrichedActions) {
      if (!action.description) continue;

      // nur relevante Dinge schicken
      if (action.priority !== "high") continue;

      telegram.sendMessage(
        `⚠️ ${action.category.toUpperCase()}\n` +
        `${action.title}\n\n` +
        action.description
    );
}

    const finalReport = report.build(
      normalizedConfig,
      live,
      historyData,
      computedStats,
      enrichedActions
    );
    debugLog("Finaler Report", finalReport);

    await report.persist(finalReport);
    adapter.log.info("Analyse abgeschlossen");
  }

  adapter.on("ready", async () => {
    try {
      await state.ensureStates();
      await state.setInfo("connection", true);
      await state.setInfo("lastError", "");

      const normalizedConfig = config.normalize();
      await telegram.setup(normalizedConfig);
      await scheduler.start(normalizedConfig, () =>
        runAnalysisWithLock("scheduler")
      );

      adapter.subscribeStates("control.run");
      adapter.log.info("Adapter ist bereit");
    } catch (err) {
      adapter.log.error(`onReady Fehler: ${err.message}`);
      await state.setInfo("connection", false);
    }
  });

  adapter.on("stateChange", async (id, stateObj) => {
    if (!stateObj || stateObj.ack) return;
    if (id.endsWith("control.run") && stateObj.val === true) {
      await adapter.setStateAsync("control.run", false, true);
      await runAnalysisWithLock("control.run");
    }
  });

  adapter.on("message", async (msg) => {
    if (!msg?.command) return;

    if (msg.command === "runDiscovery") {
      adapter.log.info("Discovery gestartet");
      const result = await discovery.runDiscovery();
      await adapter.extendForeignObjectAsync(adapter.namespace, {
        native: { discoveryCandidates: result },
      });
      adapter.sendTo(msg.from, msg.command, { ok: true }, msg.callback);
    }
  });

  adapter.on("unload", async (cb) => {
    await scheduler.stop();
    await telegram.stop();
    await state.setInfo("connection", false);
    cb();
  });

  return adapter;
}

if (require.main !== module) {
  module.exports = startAdapter;
} else {
  startAdapter();
}