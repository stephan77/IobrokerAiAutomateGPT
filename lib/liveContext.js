'use strict';

module.exports = () => ({
  /* ===============================
     LIVE DATA COLLECTION
     =============================== */

  async collectLiveData() {
    const read = async (id) => {
      if (!id) return null;
      try {
        const s = await this.getForeignStateAsync(id);
        return s ? s.val : null;
      } catch {
        return null;
      }
    };

    /* ===============================
       ENERGY
       =============================== */

    const energy = [];

    // Hausverbrauch
    if (this.config.energy?.houseConsumption) {
      energy.push({
        role: 'houseConsumption',
        value: await read(this.config.energy.houseConsumption)
      });
    }

    // Netzbezug / Einspeisung
    if (this.config.energy?.gridPower) {
      energy.push({
        role: 'gridPower',
        value: await read(this.config.energy.gridPower)
      });
    }

    // Batterie SOC
    if (this.config.energy?.batterySoc) {
      energy.push({
        role: 'batterySoc',
        value: await read(this.config.energy.batterySoc)
      });
    }

    // Batterie Leistung
    if (this.config.energy?.batteryPower) {
      energy.push({
        role: 'batteryPower',
        value: await read(this.config.energy.batteryPower)
      });
    }

    // PV-Leistung
    if (Array.isArray(this.config.pvSources)) {
      for (const id of this.config.pvSources) {
        const val = await read(id);
        if (val !== null) {
          energy.push({ role: 'pvPower', value: val });
        }
      }
    }

    // PV-Tagesenergie
    if (Array.isArray(this.config.pvDailySources)) {
      for (const id of this.config.pvDailySources) {
        const val = await read(id);
        if (val !== null) {
          energy.push({ role: 'pvDailyEnergy', value: val });
        }
      }
    }

    /* ===============================
       ROOMS
       =============================== */

    const rooms = [];

    if (Array.isArray(this.config.rooms)) {
      for (const room of this.config.rooms) {
        rooms.push({
          name: room.name || 'Raum',
          temperature: await read(room.temperature),
          target: await read(room.target)
        });
      }
    }

    /* ===============================
       TEMPERATURE
       =============================== */

    const temperature = {
      outside: await read(this.config.temperature?.outside),
      weather: await read(this.config.temperature?.weather),
      frostRisk: await read(this.config.temperature?.frostRisk)
    };

    /* ===============================
       WATER
       =============================== */

    const water = {
      total: await read(this.config.water?.total),
      daily: await read(this.config.water?.daily),
      hotWater: await read(this.config.water?.hotWater),
      coldWater: await read(this.config.water?.coldWater),
      additionalSources: [],
      flowSources: []
    };

    if (Array.isArray(this.config.water?.additionalSources)) {
      for (const id of this.config.water.additionalSources) {
        const v = await read(id);
        if (v !== null) water.additionalSources.push(v);
      }
    }

    if (Array.isArray(this.config.water?.flowSources)) {
      for (const id of this.config.water.flowSources) {
        const v = await read(id);
        if (v !== null) water.flowSources.push(v);
      }
    }

    /* ===============================
       LEAK SENSORS
       =============================== */

    const leaks = [];

    if (Array.isArray(this.config.leakSensors)) {
      for (const id of this.config.leakSensors) {
        const v = await read(id);
        if (v !== null) {
          leaks.push({ id, value: !!v });
        }
      }
    }

    /* ===============================
       RETURN STRUCTURE
       =============================== */

    return {
      energy,
      rooms,
      temperature,
      water,
      leaks
    };
  }
});