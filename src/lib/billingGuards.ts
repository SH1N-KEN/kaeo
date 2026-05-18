import { ensureDefaultSubscription, getPlans, getCurrentUsage, getPlanLimit } from './billing';
import type { BillingUsageEventType } from './billing';

export interface GuardResult {
  allowed: boolean;
  message?: string;
  used: number;
  limit: number;
}

/**
 * Centrally evaluates whether an organization is permitted to perform a billing-tracked activity.
 * Returns detailed metadata to build a clean limit alert UI or inside-page warnings.
 * Gracefully fails open under database connection/migration issues to protect live user sessions.
 */
export const checkUsageEventAllowed = async (
  organizationId: string,
  eventType: BillingUsageEventType,
  increment: number = 1
): Promise<GuardResult> => {
  try {
    if (!organizationId) {
      return { allowed: true, used: 0, limit: 0 };
    }

    // 1. Fetch Subscription & Plans
    const sub = await ensureDefaultSubscription(organizationId);
    const plans = await getPlans();
    const plan = plans.find(p => p.id === sub.plan_id);

    if (!plan) {
      return { allowed: true, used: 0, limit: 0 };
    }

    // 2. Fetch current aggregated usage
    const start = sub.current_period_start;
    const end = sub.current_period_end || new Date().toISOString();
    const usage = await getCurrentUsage(organizationId, start, end);

    const used = usage[eventType] ?? 0;
    const limit = getPlanLimit(plan, eventType);

    // 3. Compare with limits (null or 0 means unlimited)
    if (limit === null || limit <= 0) {
      return { allowed: true, used, limit: 0 };
    }

    if (used + increment > limit) {
      let friendlyName = 'items';
      switch (eventType) {
        case 'client_created':
          friendlyName = 'client workspaces';
          break;
        case 'transaction_imported':
          friendlyName = 'imported ledger rows';
          break;
        case 'file_uploaded':
          friendlyName = 'uploaded files';
          break;
        case 'ai_message_sent':
          friendlyName = 'AI advisor messages';
          break;
        case 'report_generated':
          friendlyName = 'financial reports';
          break;
      }

      return {
        allowed: false,
        used,
        limit,
        message: `Plan limit reached! This action would exceed your plan's monthly limit of ${limit.toLocaleString()} ${friendlyName}. (Currently used: ${used.toLocaleString()})`
      };
    }

    return { allowed: true, used, limit };
  } catch (err) {
    console.error('[Billing Guard] Limit check failed. Bypassing check to fail open safely:', err);
    // Safe fallback so transient client/network bugs do not halt operations for paying/trial users
    return { allowed: true, used: 0, limit: 0 };
  }
};
