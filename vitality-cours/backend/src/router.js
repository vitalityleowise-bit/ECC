'use strict';

// "Plizyè IA" = routing by task. A cheap, fast model handles quick corrections;
// a stronger model handles full conversation and detailed feedback.
// See the cost-aware-llm-pipeline skill.

const TASK = {
  QUICK_CORRECTION: 'quick_correction',
  CONVERSATION: 'conversation',
  DETAILED_FEEDBACK: 'detailed_feedback',
};

// Logical tiers. The real model id per provider is resolved from env in the
// LLM adapter, so swapping providers never changes this routing logic.
const TIER = {
  [TASK.QUICK_CORRECTION]: 'small',
  [TASK.CONVERSATION]: 'standard',
  [TASK.DETAILED_FEEDBACK]: 'large',
};

function pickTier(task) {
  const tier = TIER[task];
  if (!tier) throw new Error(`Unknown task for routing: ${task}`);
  return tier;
}

module.exports = { TASK, TIER, pickTier };
