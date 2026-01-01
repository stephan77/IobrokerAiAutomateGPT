'use strict';

module.exports = () => ({
  /* =====================================
     LIVE RULE ACTIONS (IMMEDIATE)
     ===================================== */

  buildLiveRuleActions(context) {
    const actions = [];
    const energy = context.summary || {};
    const live = context.live || {};

    /* ===============================
       BATTERY SOC
       =============================== */

    if (typeof energy.batterySoc === 'number') {
      if (energy.batterySoc < 15) {
        actions.push({
          id: 'battery_soc_critical',
          type: 'warning',
          priority: 'high',
          reason: 'Battery SOC critically low (<15%). Risk of deep discharge.',
          context: { batterySoc: energy.batterySoc },
          source: 'rules'
        });
      } else if (energy.batterySoc < 25) {
        actions.push({
          id: 'battery_soc_low',
          type: 'suggestion',
          priority: 'medium',
          reason: 'Battery SOC low (<25%). Consider reducing consumption.',
          context: { batterySoc: energy.batterySoc },
          source: 'rules'
        });
      }
    }

    /* ===============================
       PV SURPLUS
       =============================== */

    if (
      typeof energy.pvPower === 'number' &&
      typeof energy.houseConsumption === 'number'
    ) {
      if (energy.pvPower > energy.houseConsumption * 1.2) {
        actions.push({
          id: 'pv_surplus',
          type: 'suggestion',
          priority: 'medium',
          reason: 'PV surplus detected. Shift flexible consumers.',
          context: {
            pvPower: energy.pvPower,
            houseConsumption: energy.houseConsumption
          },
          source: 'rules'
        });
      }
    }

    /* ===============================
       GRID IMPORT
       =============================== */

    if (
      typeof energy.gridPower === 'number' &&
      energy.gridPower > this.constants.DEFAULT_GRID_POWER_THRESHOLD
    ) {
      actions.push({
        id: 'high_grid_import',
        type: 'warning',
        priority: 'medium',
        reason: 'High grid import detected.',
        context: { gridPower: energy.gridPower },
        source: 'rules'
      });
    }

    /* ===============================
       TEMPERATURE / FROST
       =============================== */

    if (
      typeof live.temperature?.outside === 'number' &&
      live.temperature.outside < 2
    ) {
      actions.push({
        id: 'frost_risk',
        type: 'warning',
        priority: 'high',
        reason: 'Outside temperature near freezing. Frost protection required.',
        context: { outsideTemp: live.temperature.outside },
        source: 'rules'
      });
    }

    return actions;
  },

  /* =====================================
     HISTORY DEVIATION ACTIONS
     ===================================== */

  buildDeviationActions(context) {
    const actions = [];
    const deviations = context.history?.deviations || [];

    for (const dev of deviations) {
      actions.push({
        id: `history_deviation_${dev.role}`,
        type: 'analysis',
        priority: 'medium',
        reason: `Deviation detected for ${dev.role}: ${Math.round(dev.delta * 100) / 100}`,
        context: dev,
        source: 'history'
      });
    }

    return actions;
  }
});