'use strict';

module.exports = () => ({
  async ensureStates() {
    const ensure = async (id, common) => {
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
    };

    // Controls / info
    await ensure('control.run', {
      name: 'Run analysis',
      type: 'boolean',
      role: 'button',
      read: true,
      write: true,
      def: false
    });

    await ensure('info.connection', {
      name: 'Connection',
      type: 'boolean',
      role: 'indicator.connected',
      read: true,
      write: false,
      def: false
    });

    await ensure('info.lastError', {
      name: 'Last error',
      type: 'string',
      role: 'text',
      read: true,
      write: false,
      def: ''
    });

    // Reports
    await ensure('report.last', {
      name: 'Last report',
      type: 'string',
      role: 'text',
      read: true,
      write: false,
      def: ''
    });

    await ensure('report.actions', {
      name: 'Suggested actions (json)',
      type: 'string',
      role: 'json',
      read: true,
      write: false,
      def: ''
    });

    await ensure('report.actionHistory', {
      name: 'Action history (json)',
      type: 'string',
      role: 'json',
      read: true,
      write: false,
      def: ''
    });

    await ensure('report.dailyLastSent', {
      name: 'Daily report last sent',
      type: 'string',
      role: 'text',
      read: true,
      write: false,
      def: ''
    });

    // Meta
    await ensure('meta.running', {
      name: 'Analysis running',
      type: 'boolean',
      role: 'indicator.running',
      read: true,
      write: false,
      def: false
    });

    await ensure('meta.lastRun', {
      name: 'Last run timestamp',
      type: 'string',
      role: 'value.time',
      read: true,
      write: false,
      def: ''
    });

    await ensure('meta.lastTelegram', {
      name: 'Last telegram interaction',
      type: 'string',
      role: 'value.time',
      read: true,
      write: false,
      def: ''
    });

    await ensure('meta.lastDailyReportTs', {
      name: 'Last daily report timestamp',
      type: 'string',
      role: 'value.time',
      read: true,
      write: false,
      def: ''
    });

    // Memory input
    await ensure('memory.feedback', {
      name: 'User feedback',
      type: 'string',
      role: 'text',
      read: true,
      write: true,
      def: ''
    });

    await ensure('memory.learning', {
      name: 'Learning notes',
      type: 'string',
      role: 'text',
      read: true,
      write: true,
      def: ''
    });

    await ensure('memory.history', {
      name: 'History context',
      type: 'string',
      role: 'text',
      read: true,
      write: true,
      def: ''
    });

    await ensure('memory.policy', {
      name: 'Policy',
      type: 'string',
      role: 'text',
      read: true,
      write: true,
      def: ''
    });

    // Expose selected config as read-only states (helps debugging)
    await ensure('config.mode', {
      name: 'Configured mode',
      type: 'string',
      role: 'text',
      read: true,
      write: false,
      def: ''
    });

    await ensure('config.dryRun', {
      name: 'Dry run enabled',
      type: 'boolean',
      role: 'indicator',
      read: true,
      write: false,
      def: false
    });

    await ensure('config.intervalMin', {
      name: 'Interval minutes',
      type: 'number',
      role: 'value',
      read: true,
      write: false,
      def: 0
    });

    await ensure('config.telegram.enabled', {
      name: 'Telegram enabled',
      type: 'boolean',
      role: 'indicator',
      read: true,
      write: false,
      def: false
    });

    await ensure('config.telegram.chatId', {
      name: 'Telegram chatId',
      type: 'string',
      role: 'text',
      read: true,
      write: false,
      def: ''
    });

    await ensure('config.dailyReport.enabled', {
      name: 'Daily report enabled',
      type: 'boolean',
      role: 'indicator',
      read: true,
      write: false,
      def: false
    });

    await ensure('config.dailyReport.time', {
      name: 'Daily report time (HH:MM)',
      type: 'string',
      role: 'text',
      read: true,
      write: false,
      def: ''
    });

    await ensure('config.dailyReport.days', {
      name: 'Daily report days (json array)',
      type: 'string',
      role: 'json',
      read: true,
      write: false,
      def: '[]'
    });
  },

  async onStateChange(id, state) {
    if (!state || state.ack) return;

    // control.run is an impulse button
    if (id === `${this.namespace}.control.run` && state.val === true) {
      // reset immediately (ack=true)
      await this.setStateAsync('control.run', false, true);

      // prevent parallel runs
      await this.runAnalysisWithLock('control.run').catch((e) => {
        this.handleError('Analyse fehlgeschlagen', e, true);
      });
      return;
    }

    // free text feedback
    if (id === `${this.namespace}.memory.feedback`) {
      await this.processFeedback(String(state.val || '').trim());
      return;
    }
  },

  async runAnalysisWithLock(trigger) {
    if (this.running) {
      this.log.warn('Analysis already running, trigger ignored');
      return;
    }

    this.running = true;
    await this.setStateAsync('meta.running', true, true);
    try {
      await this.setStateAsync('meta.lastRun', new Date().toISOString(), true);
      await this.runAnalysis(trigger);
    } finally {
      await this.setStateAsync('meta.running', false, true);
      this.running = false;
    }
  }
});
