'use strict';

module.exports = () => ({
  /**
   * Create objects AND initialize values
   */
  async ensureStates() {
    const ensure = async (id, common, initialValue) => {
      await this.setObjectNotExistsAsync(id, {
        type: 'state',
        common: {
          name: common.name || id,
          type: common.type,
          role: common.role,
          read: common.read !== false,
          write: !!common.write,
          def: common.def
        },
        native: {}
      });

      if (initialValue !== undefined) {
        await this.setStateAsync(id, initialValue, true);
      }
    };

    /* ========= CONTROL / INFO ========= */

    await ensure('control.run', {
      type: 'boolean',
      role: 'button',
      write: true,
      def: false
    }, false);

    await ensure('info.connection', {
      type: 'boolean',
      role: 'indicator.connected'
    }, false);

    await ensure('info.lastError', {
      type: 'string',
      role: 'text'
    }, '');

    /* ========= META ========= */

    await ensure('meta.running', {
      type: 'boolean',
      role: 'indicator.running'
    }, false);

    await ensure('meta.lastRun', {
      type: 'string',
      role: 'value.time'
    }, '');

    await ensure('meta.lastTelegram', {
      type: 'string',
      role: 'value.time'
    }, '');

    await ensure('meta.lastDailyReportTs', {
      type: 'string',
      role: 'value.time'
    }, '');

    /* ========= REPORT ========= */

    await ensure('report.last', {
      type: 'string',
      role: 'text'
    }, '');

    await ensure('report.actions', {
      type: 'string',
      role: 'json'
    }, '[]');

    await ensure('report.actionHistory', {
      type: 'string',
      role: 'json'
    }, '[]');

    await ensure('report.dailyLastSent', {
      type: 'string',
      role: 'text'
    }, '');

    /* ========= MEMORY ========= */

    await ensure('memory.feedback', {
      type: 'string',
      role: 'text',
      write: true
    }, '');

    await ensure('memory.learning', {
      type: 'string',
      role: 'text',
      write: true
    }, '');

    await ensure('memory.history', {
      type: 'string',
      role: 'text',
      write: true
    }, '');

    await ensure('memory.policy', {
      type: 'string',
      role: 'text',
      write: true
    }, '');

    /* ========= CONFIG MIRROR (READ ONLY) ========= */

    await ensure('config.mode', {
      type: 'string',
      role: 'text'
    }, this.config.mode || '');

    await ensure('config.dryRun', {
      type: 'boolean',
      role: 'indicator'
    }, !!this.config.dryRun);

    await ensure('config.intervalMin', {
      type: 'number',
      role: 'value'
    }, Number(this.config.intervalMin || 0));

    await ensure('config.telegram.enabled', {
      type: 'boolean',
      role: 'indicator'
    }, !!this.config.telegram?.enabled);

    await ensure('config.telegram.chatId', {
      type: 'string',
      role: 'text'
    }, this.config.telegram?.chatId || '');

    await ensure('config.dailyReport.enabled', {
      type: 'boolean',
      role: 'indicator'
    }, !!this.config.dailyReport?.enabled);

    await ensure('config.dailyReport.time', {
      type: 'string',
      role: 'text'
    }, this.config.dailyReport?.time || '');

    await ensure('config.dailyReport.days', {
      type: 'string',
      role: 'json'
    }, JSON.stringify(this.config.dailyReport?.days || []));
  },

  /**
   * Handle state changes
   */
  async onStateChange(id, state) {
    if (!state || state.ack) return;

    /* ===== control.run (IMPULSE) ===== */
    if (id === `${this.namespace}.control.run` && state.val === true) {
      // reset immediately
      await this.setStateAsync('control.run', false, true);

      await this.runAnalysisWithLock('control.run').catch((e) =>
        this.handleError('Analyse fehlgeschlagen', e, true)
      );
      return;
    }

    /* ===== feedback input ===== */
    if (id === `${this.namespace}.memory.feedback`) {
      await this.processFeedback(String(state.val || '').trim());
    }
  }
});