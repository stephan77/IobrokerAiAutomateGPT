'use strict';

const utils = require('@iobroker/adapter-core');
const stateMethods = require('./lib/state');

class AiAutopilot extends utils.Adapter {
  constructor(options = {}) {
    super({ ...options, name: 'ai-autopilot' });

    this.on('ready', this.onReady.bind(this));
    this.on('stateChange', this.onStateChange.bind(this));
    this.on('unload', this.onUnload.bind(this));

    this.running = false;
  }

  async onReady() {
    await this.ensureStates();
    await this.setStateAsync('info.connection', true, true);
    this.log.info('ai-autopilot minimal ready');
  }

  async onUnload(cb) {
    cb();
  }

  async runAnalysis() {
    const read = async (id) => {
      if (!id) return null;
      const s = await this.getForeignStateAsync(id);
      return s ? s.val : null;
    };

    const house = await read(this.config.energy.houseConsumption);
    const pv = await read(this.config.energy.pvPower);
    const grid = await read(this.config.energy.gridPower);

    const report = [
      `House: ${house}`,
      `PV: ${pv}`,
      `Grid: ${grid}`
    ].join('\n');

    await this.setStateAsync('report.last', report, true);
  }
}

Object.assign(AiAutopilot.prototype, stateMethods());

module.exports = (options) => new AiAutopilot(options);