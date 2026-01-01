'use strict';

const utils = require('@iobroker/adapter-core');

class AiAutopilot extends utils.Adapter {
  constructor(options = {}) {
    super({ ...options, name: 'ai-autopilot' });
    this.on('ready', this.onReady.bind(this));
    this.on('unload', this.onUnload.bind(this));
  }

  async onReady() {
    await this.setObjectNotExistsAsync('info.connection', {
      type: 'state',
      common: {
        type: 'boolean',
        role: 'indicator.connected',
        read: true,
        write: false,
        def: false
      },
      native: {}
    });

    await this.setObjectNotExistsAsync('report.last', {
      type: 'state',
      common: {
        type: 'string',
        role: 'text',
        read: true,
        write: false,
        def: ''
      },
      native: {}
    });

    await this.setStateAsync('info.connection', true, true);
    this.log.info('ai-autopilot MINIMAL READY');
  }

  onUnload(cb) {
    cb();
  }
}

module.exports = (options) => new AiAutopilot(options);