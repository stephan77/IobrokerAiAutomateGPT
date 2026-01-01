'use strict';

module.exports = () => ({
  /* ===============================
     START SCHEDULER
     =============================== */

  startScheduler() {
    if (this.dailyReportTimer) {
      clearInterval(this.dailyReportTimer);
    }

    // alle 60 Sekunden prüfen (leichtgewichtig!)
    this.dailyReportTimer = setInterval(
      () => this.checkDailyReport(),
      60 * 1000
    );

    if (this.config.debug) {
      this.log.info('[DEBUG] Daily report scheduler started');
    }
  },

  /* ===============================
     CHECK DAILY REPORT CONDITIONS
     =============================== */

  async checkDailyReport() {
    const cfg = this.config.dailyReport || {};

    if (!cfg.enabled) return;

    const now = new Date();
    const today = now.toISOString().slice(0, 10); // YYYY-MM-DD

    // letzter Versand
    const lastSentState = await this.getStateAsync('meta.lastDailyReportTs');
    const lastSent = lastSentState?.val
      ? String(lastSentState.val).slice(0, 10)
      : null;

    // schon heute gesendet → STOP
    if (lastSent === today) return;

    // Wochentag prüfen (0=So … 6=Sa)
    if (Array.isArray(cfg.days) && cfg.days.length > 0) {
      const weekday = now.getDay();
      if (!cfg.days.includes(weekday)) return;
    }

    // Uhrzeit prüfen (HH:MM)
    if (!cfg.time || !/^\d{2}:\d{2}$/.test(cfg.time)) return;

    const [h, m] = cfg.time.split(':').map(Number);
    if (now.getHours() !== h || now.getMinutes() !== m) return;

    // 🔥 ALLE BEDINGUNGEN ERFÜLLT → SENDEN
    await this.sendDailyReport();
  },

  /* ===============================
     SEND DAILY REPORT
     =============================== */

  async sendDailyReport() {
    if (this.config.debug) {
      this.log.info('[DEBUG] Sending daily report');
    }

    try {
      const report = await this.buildDailyReportText();

      if (this.config.telegram?.enabled) {
        await this.sendTo(this.config.telegram.instance, 'sendMessage', {
          chat_id: this.config.telegram.chatId,
          text: report,
          parse_mode: 'Markdown'
        });
      }

      const nowIso = new Date().toISOString();
      await this.setStateAsync('meta.lastDailyReportTs', nowIso, true);
      await this.setStateAsync('report.dailyLastSent', nowIso, true);
    } catch (e) {
      this.handleError('Daily report failed', e, true);
    }
  },

  /* ===============================
     BUILD DAILY REPORT TEXT
     =============================== */

  async buildDailyReportText() {
    const lines = [];

    lines.push('📊 *AI Autopilot – Tagesbericht*');
    lines.push('');
    lines.push(`🕒 ${new Date().toLocaleString()}`);
    lines.push('');

    const lastReport = await this.getStateAsync('report.last');
    if (lastReport?.val) {
      lines.push('*Letzte Analyse:*');
      lines.push(String(lastReport.val).slice(0, 3500));
      lines.push('');
    }

    const actions = await this.getStateAsync('report.actions');
    if (actions?.val) {
      lines.push('*Vorgeschlagene Aktionen:*');
      lines.push('```');
      lines.push(String(actions.val).slice(0, 3000));
      lines.push('```');
    }

    return lines.join('\n');
  }
});