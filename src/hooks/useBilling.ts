import { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from './useWorkspace';
import { useAuth } from '../components/auth/AuthProvider';
import {
  getPlans,
  ensureDefaultSubscription,
  getCurrentUsage,
  getPlanLimit
} from '../lib/billing';
import type {
  Plan,
  Subscription,
  CurrentUsage,
  BillingUsageEventType
} from '../lib/billing';

export const useBilling = () => {
  const { activeOrg } = useWorkspace();
  const { user } = useAuth();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [usage, setUsage] = useState<CurrentUsage | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schemaMissing, setSchemaMissing] = useState(false);

  const fetchBillingData = useCallback(async () => {
    if (!activeOrg) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSchemaMissing(false);

    try {
      // 1. Fetch Plans
      let allPlans: Plan[] = [];
      try {
        allPlans = await getPlans();
        setPlans(allPlans);
      } catch (err: any) {
        if (err.message?.includes('relation') && err.message?.includes('does not exist')) {
          setSchemaMissing(true);
          setError('Billing schema missing. Run latest migration.');
          setLoading(false);
          return;
        }
        throw err;
      }

      // 2. Fetch or create default subscription
      const sub = await ensureDefaultSubscription(activeOrg.id, user?.id);
      setSubscription(sub);

      // 3. Match subscription plan
      const matchedPlan = allPlans.find(p => p.id === sub.plan_id) || null;
      setCurrentPlan(matchedPlan);

      // 4. Calculate date period and usage
      const start = sub.current_period_start;
      const end = sub.current_period_end || new Date().toISOString();
      const currentUsage = await getCurrentUsage(activeOrg.id, start, end);
      setUsage(currentUsage);

    } catch (err: any) {
      console.error('[useBilling] Error fetching billing details:', err);
      
      // Secondary check for missing relation on subsequent steps
      if (err.message?.includes('relation') && err.message?.includes('does not exist')) {
        setSchemaMissing(true);
        setError('Billing schema missing. Run latest migration.');
      } else {
        setError(err.message || 'Failed to load billing metrics.');
      }
    } finally {
      setLoading(false);
    }
  }, [activeOrg, user?.id]);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  const isOverLimit = (eventType: BillingUsageEventType): boolean => {
    if (!currentPlan || !usage) return false;
    const limit = getPlanLimit(currentPlan, eventType);
    if (limit === null || limit <= 0) return false;
    return usage[eventType] >= limit;
  };

  const getUsagePercent = (eventType: BillingUsageEventType): number => {
    if (!currentPlan || !usage) return 0;
    const limit = getPlanLimit(currentPlan, eventType);
    if (limit === null || limit <= 0) return 0;
    const used = usage[eventType];
    const percent = (used / limit) * 100;
    return Math.min(100, Math.round(percent));
  };

  return {
    plans,
    subscription,
    currentPlan,
    usage,
    loading,
    error,
    schemaMissing,
    refreshBilling: fetchBillingData,
    isOverLimit,
    getUsagePercent
  };
};
