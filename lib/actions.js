'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = () => ({
  /* =====================================
     ACTION FLOW
     pending → approved/rejected → executed
     ===================================== */

  async requestApproval(actions, reportText) {
    if (!Array.isArray(actions) || actions.length === 0) return;

    // Assign stable IDs
    const pending = actions.map((a) => ({
      ...a,
      actionId: a.actionId || uuidv4(),
      created: new Date().toISOString(),
      status: 'pending'
    }));

    this.pendingActions = pending;

    await this.setStateAsync(
      'actions.pending',
      JSON.stringify(pending, null, 2),
      true
    );

    await this.sendTelegramApproval(pending, reportText);
  },

  /* =====================================
     APPROVE
     ===================================== */

  async approveAction(actionId) {
    const action = this.findPendingAction(actionId);
    if (!action) return;

    action.status = 'approved';
    action.approvedAt = new Date().toISOString();

    await this.persistAction('actions.approved', action);
    await this.executeAction(action);
    await this.learnFromAction(action, true);

    await this.removePendingAction(actionId);
  },

  /* =====================================
     REJECT
     ===================================== */

  async rejectAction(actionId) {
    const action = this.findPendingAction(actionId);
    if (!action) return;

    action.status = 'rejected';
    action.rejectedAt = new Date().toISOString();

    await this.persistAction('actions.rejected', action);
    await this.learnFromAction(action, false);

    await this.removePendingAction(actionId);
  },

  /* =====================================
     EXECUTION (placeholder)
     ===================================== */

  async executeAction(action) {
    // Currently informational only
    action.executedAt = new Date().toISOString();
    action.executionResult = 'simulated';

    await this.persistAction('actions.executed', action);
  },

  /* =====================================
     HELPERS
     ===================================== */

  findPendingAction(actionId) {
    return (this.pendingActions || []).find((a) => a.actionId === actionId);
  },

  async removePendingAction(actionId) {
    this.pendingActions = (this.pendingActions || []).filter(
      (a) => a.actionId !== actionId
    );

    await this.setStateAsync(
      'actions.pending',
      JSON.stringify(this.pendingActions, null, 2),
      true
    );
  },

  async persistAction(stateId, action) {
    const current = await this.getStateAsync(stateId);
    let list = [];

    if (current?.val) {
      try {
        list = JSON.parse(current.val);
      } catch {
        list = [];
      }
    }

    list.push(action);

    await this.setStateAsync(stateId, JSON.stringify(list, null, 2), true);
  },

  /* =====================================
     LEARNING
     ===================================== */

  async learnFromAction(action, approved) {
    const entry = {
      timestamp: new Date().toISOString(),
      actionId: action.actionId,
      source: action.source,
      type: action.type,
      priority: action.priority,
      approved,
      reason: action.reason
    };

    this.learningHistoryEntries.push(entry);

    await this.setStateAsync(
      'memory.learning',
      JSON.stringify(this.learningHistoryEntries, null, 2),
      true
    );
  }
});