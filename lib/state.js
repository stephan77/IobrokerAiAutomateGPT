'use strict';

module.exports = () => ({
  async ensureStates() {
    const ensure = async (id, type, role, write = false, def = null) => {
      await this.setObjectNotExistsAsync(id, {
        type: 'state',
        common: {
          type,
          role,
          read: true,
          write,
          def
        },
        native: {}
      });
    };

    await ensure('control.run', 'boolean', 'button', true, false);
    await ensure('info.connection', 'boolean', 'indicator.connected', false, false);
    await ensure('info.lastError', 'string', 'text', false, '');
    await ensure('meta.running', 'boolean', 'indicator.running', false, false);
    await ensure('report.last', 'string', 'text', false, '');
  },

  async onStateChange(id, state) {
    if (!state || state.ack) return;

    if (id === `${this.namespace}.control.run` && state.val === true) {
      await this.setStateAsync('control.run', false, true);
      await this.runAnalysisWithLock();
    }
  },

  async runAnalysisWithLock() {
    if (this.running) return;

    this.running = true;
    await this.setStateAsync('meta.running', true, true);

    try {
      await this.runAnalysis();
    } catch (e) {
      await this.setStateAsync('info.lastError', e.message, true);
    } finally {
      await this.setStateAsync('meta.running', false, true);
      this.running = false;
    }
  }
});