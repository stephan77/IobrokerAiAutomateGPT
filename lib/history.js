'use strict';

module.exports = () => ({
  /* ===============================
     HISTORY COLLECTION
     =============================== */

  async collectHistoryData() {
    const result = {
      influx: [],
      mysql: []
    };

    /* ===============================
       INFLUXDB
       =============================== */

    if (this.config.history?.influx?.enabled) {
      const cfg = this.config.history.influx;

      for (const dp of cfg.dataPoints || []) {
        const values = await this.readHistory(
          cfg.instance,
          dp.id,
          cfg.timeframeHours * 3600,
          cfg.resolutionMinutes * 60
        );

        result.influx.push({
          id: dp.id,
          role: dp.role || '',
          pointsLoaded: values.length,
          values
        });
      }
    }

    /* ===============================
       MYSQL
       =============================== */

    if (this.config.history?.mysql?.enabled) {
      const cfg = this.config.history.mysql;

      for (const dp of cfg.dataPoints || []) {
        const values = await this.readHistory(
          cfg.instance,
          dp.id,
          cfg.timeframeDays * 86400,
          cfg.resolutionMinutes * 60
        );

        result.mysql.push({
          id: dp.id,
          role: dp.role || '',
          pointsLoaded: values.length,
          values
        });
      }
    }

    return result;
  },

  /* ===============================
     READ HISTORY (GENERIC)
     =============================== */

  async readHistory(instance, id, seconds, step) {
    if (!id || !instance) return [];

    try {
      const now = Date.now();
      const start = now - seconds * 1000;

      const res = await this.sendToAsync(instance, 'getHistory', {
        id,
        options: {
          start,
          end: now,
          step,
          aggregate: 'average'
        }
      });

      if (!Array.isArray(res)) return [];

      return res
        .map((e) => (typeof e.val === 'number' ? e.val : null))
        .filter((v) => v !== null);
    } catch (e) {
      this.log.warn(`History read failed for ${id}: ${e.message}`);
      return [];
    }
  },

  /* ===============================
     AGGREGATION
     =============================== */

  aggregateData(history) {
    const aggregateSeries = (series) => {
      if (!series.values.length) return null;

      const sum = series.values.reduce((a, b) => a + b, 0);
      const avg = sum / series.values.length;

      return {
        avg,
        min: Math.min(...series.values),
        max: Math.max(...series.values)
      };
    };

    const process = (list) =>
      list.map((s) => ({
        id: s.id,
        role: s.role,
        pointsLoaded: s.pointsLoaded,
        aggregate: aggregateSeries(s)
      }));

    return {
      influx: process(history.influx),
      mysql: process(history.mysql)
    };
  },

  /* ===============================
     BASELINES & DEVIATIONS
     =============================== */

  buildHistoryContext(aggregates) {
    const baselines = {};
    const deviations = [];

    const all = [...aggregates.influx, ...aggregates.mysql];

    for (const s of all) {
      if (!s.aggregate) continue;

      baselines[s.role] = s.aggregate.avg;

      const threshold = s.aggregate.avg * 0.3;
      const last = s.aggregate.max;

      if (Math.abs(last - s.aggregate.avg) > threshold) {
        deviations.push({
          role: s.role,
          baseline: s.aggregate.avg,
          current: last,
          delta: last - s.aggregate.avg
        });
      }
    }

    return { baselines, deviations };
  }
});