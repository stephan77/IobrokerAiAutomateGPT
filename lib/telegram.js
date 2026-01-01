'use strict';

module.exports = () => ({
  /* ===============================
     SEND APPROVAL MESSAGE
     =============================== */

  async sendTelegramApproval(actions, reportText) {
    if (!this.config.telegram?.enabled) return;

    const telegram = this.getForeignObject(this.config.telegram.instance);
    if (!telegram) {
      this.log.warn('Telegram instance not found');
      return;
    }

    for (const action of actions) {
      const message =
        `🤖 *AI Autopilot – Vorschlag*\n\n` +
        `🆔 ${action.id}\n` +
        `📌 ${action.suggestion || 'Aktion'}\n` +
        (action.reason ? `ℹ️ ${action.reason}\n` : '') +
        `⚡ Priorität: ${action.priority}\n\n` +
        `_Freigeben oder ablehnen?_`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '✅ Approve', callback_data: `approve:${action.id}` },
            { text: '❌ Reject', callback_data: `reject:${action.id}` }
          ]
        ]
      };

      await this.sendTo(this.config.telegram.instance, 'sendMessage', {
        chat_id: this.config.telegram.chatId,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: JSON.stringify(keyboard)
      });

      await this.setStateAsync('meta.lastTelegram', new Date().toISOString(), true);
    }
  },

  /* ===============================
     HANDLE CALLBACK
     =============================== */

  async handleTelegramCallback({ callbackData, payload }) {
    if (!callbackData) return;

    const [cmd, actionId] = callbackData.split(':');
    if (!cmd || !actionId) return;

    let responseText = 'Unbekannte Aktion';

    try {
      if (cmd === 'approve') {
        const ok = await this.approveAction(actionId);
        responseText = ok
          ? '✅ Aktion freigegeben und ausgeführt'
          : '⚠️ Aktion nicht gefunden';
      }

      if (cmd === 'reject') {
        const ok = await this.rejectAction(actionId, 'Rejected via Telegram');
        responseText = ok
          ? '❌ Aktion abgelehnt'
          : '⚠️ Aktion nicht gefunden';
      }
    } catch (e) {
      this.log.error('Telegram callback error: ' + e.message);
      responseText = '❌ Fehler bei Verarbeitung';
    }

    // Telegram Callback beantworten (Spinner stoppen!)
    if (payload?.callback_query?.id) {
      await this.sendTo(this.config.telegram.instance, 'answerCallbackQuery', {
        callback_query_id: payload.callback_query.id,
        text: responseText,
        show_alert: false
      });
    }
  },

  /* ===============================
     HANDLE TEXT INPUT
     =============================== */

  async handleTelegramText(text) {
    if (!text) return;

    // optional: später Chat-Commands wie "status", "help", etc.
    this.log.info(`Telegram text received: ${text}`);
  }
});