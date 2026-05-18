import { supabase } from './supabase';

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  price_monthly_inr: number;
  price_yearly_inr: number | null;
  max_clients: number | null;
  max_transactions_per_month: number | null;
  max_file_uploads_per_month: number | null;
  max_ai_messages_per_month: number | null;
  max_reports_per_month: number | null;
  features_json: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  organization_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  current_period_start: string;
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
  razorpay_customer_id: string | null;
  razorpay_subscription_id: string | null;
  razorpay_plan_id: string | null;
  razorpay_payment_link_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type BillingUsageEventType = 
  | 'transaction_imported'
  | 'file_uploaded'
  | 'ai_message_sent'
  | 'report_generated'
  | 'client_created';

export interface UsageEventInput {
  organizationId: string;
  clientId?: string | null;
  eventType: BillingUsageEventType;
  quantity?: number;
  metadata?: any;
  userId?: string;
}

export interface CurrentUsage {
  transaction_imported: number;
  file_uploaded: number;
  ai_message_sent: number;
  report_generated: number;
  client_created: number;
}

/**
 * Fetches all active billing plans from the database.
 */
export const getPlans = async (): Promise<Plan[]> => {
  const { data, error } = await supabase
    .from('billing_plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[Billing] Error fetching plans:', error);
    throw error;
  }
  return data as Plan[];
};

/**
 * Fetches subscription details for a specific organization.
 */
export const getOrganizationSubscription = async (organizationId: string): Promise<Subscription | null> => {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    console.error('[Billing] Error fetching subscription:', error);
    throw error;
  }
  return data as Subscription | null;
};

/**
 * Ensures an organization has an active subscription.
 * If not, provisions a default 'Free' plan subscription.
 */
export const ensureDefaultSubscription = async (organizationId: string, userId?: string): Promise<Subscription> => {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    console.error('[Billing] Error checking default subscription:', error);
    throw error;
  }

  if (data) {
    return data as Subscription;
  }

  // Insert default Free subscription
  const trialDays = 14;
  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + trialDays);

  const start = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + 1);

  const { data: newSub, error: insertError } = await supabase
    .from('subscriptions')
    .insert({
      organization_id: organizationId,
      plan_id: 'free',
      status: 'trialing',
      billing_cycle: 'monthly',
      current_period_start: start.toISOString(),
      current_period_end: end.toISOString(),
      trial_ends_at: trialEnds.toISOString(),
      created_by: userId || null
    })
    .select('*')
    .single();

  if (insertError) {
    console.error('[Billing] Error creating default Free subscription:', insertError);
    throw insertError;
  }

  return newSub as Subscription;
};

/**
 * Calculates total usage for each event type within a date window.
 * Bypasses window for client counts since client creation is a total capacity limit.
 */
export const getCurrentUsage = async (
  organizationId: string,
  periodStart: string,
  periodEnd: string
): Promise<CurrentUsage> => {
  const usage: CurrentUsage = {
    transaction_imported: 0,
    file_uploaded: 0,
    ai_message_sent: 0,
    report_generated: 0,
    client_created: 0
  };

  // 1. Fetch time-bounded usage logs
  const { data: events, error: eventsErr } = await supabase
    .from('usage_events')
    .select('event_type, quantity')
    .eq('organization_id', organizationId)
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd);

  if (eventsErr) {
    console.error('[Billing] Error fetching usage events:', eventsErr);
    throw eventsErr;
  }

  if (events) {
    events.forEach(event => {
      const type = event.event_type as BillingUsageEventType;
      if (usage[type] !== undefined) {
        usage[type] += (event.quantity || 1);
      }
    });
  }

  // 2. Fetch live client capacity count (which is total/permanent, not monthly reset)
  const { count, error: clientCountErr } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'active');

  if (clientCountErr) {
    console.error('[Billing] Error counting active clients:', clientCountErr);
  } else if (count !== null) {
    usage.client_created = count;
  }

  return usage;
};

/**
 * Tracks a new usage event quietly without interrupting user tasks.
 */
export const trackUsageEvent = async (input: UsageEventInput): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('usage_events')
      .insert({
        organization_id: input.organizationId,
        client_id: input.clientId || null,
        event_type: input.eventType,
        quantity: input.quantity ?? 1,
        metadata_json: input.metadata || {},
        created_by: input.userId || null
      });

    if (error) {
      console.warn(`[Billing Usage Event] Silent tracking failed for ${input.eventType}:`, error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn(`[Billing Usage Event] Silent exception for ${input.eventType}:`, err.message || err);
    return false;
  }
};

/**
 * Compares current usage limits for a specific event type.
 */
export const checkUsageLimit = async (
  organizationId: string,
  eventType: BillingUsageEventType
): Promise<{ nearLimit: boolean; overLimit: boolean; used: number; limit: number }> => {
  try {
    const sub = await ensureDefaultSubscription(organizationId);
    const plans = await getPlans();
    const plan = plans.find(p => p.id === sub.plan_id);

    if (!plan) {
      return { nearLimit: false, overLimit: false, used: 0, limit: 0 };
    }

    const start = sub.current_period_start;
    const end = sub.current_period_end || new Date().toISOString();
    const usage = await getCurrentUsage(organizationId, start, end);

    const used = usage[eventType];
    const limit = getPlanLimit(plan, eventType);

    if (limit === null || limit <= 0) {
      return { nearLimit: false, overLimit: false, used, limit: 0 };
    }

    const overLimit = used >= limit;
    const nearLimit = used >= (limit * 0.8) && !overLimit;

    return { nearLimit, overLimit, used, limit };
  } catch (err) {
    console.warn('[Billing Limit Check] Silent failure:', err);
    return { nearLimit: false, overLimit: false, used: 0, limit: 0 };
  }
};

/**
 * Helper to get the correct limit value from the Plan object.
 */
export const getPlanLimit = (plan: Plan, eventType: BillingUsageEventType): number | null => {
  switch (eventType) {
    case 'client_created':
      return plan.max_clients;
    case 'transaction_imported':
      return plan.max_transactions_per_month;
    case 'file_uploaded':
      return plan.max_file_uploads_per_month;
    case 'ai_message_sent':
      return plan.max_ai_messages_per_month;
    case 'report_generated':
      return plan.max_reports_per_month;
    default:
      return null;
  }
};

/**
 * Helper to display plan price cleanly.
 */
export const formatPlanPrice = (plan: Plan, isYearly: boolean = false): string => {
  if (isYearly) {
    const price = plan.price_yearly_inr ?? (plan.price_monthly_inr * 10);
    return price === 0 ? 'Free' : `₹${price.toLocaleString('en-IN')}/yr`;
  }
  return plan.price_monthly_inr === 0 ? 'Free' : `₹${plan.price_monthly_inr.toLocaleString('en-IN')}/mo`;
};

export interface RazorpayCheckoutInput {
  organizationId: string;
  planId: string;
  billingCycle: 'monthly' | 'yearly';
}

export interface RazorpayCheckoutResult {
  checkoutUrl: string;
  razorpaySubscriptionId: string;
  status: string;
}

/**
 * Initiates Razorpay payment checkout by calling our Supabase Edge Function
 */
export const startRazorpayCheckout = async (
  input: RazorpayCheckoutInput
): Promise<RazorpayCheckoutResult> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('User is not authenticated. Please log in first.');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const response = await fetch(`${supabaseUrl}/functions/v1/create-razorpay-subscription`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': anonKey
    },
    body: JSON.stringify({
      organization_id: input.organizationId,
      plan_id: input.planId,
      billing_cycle: input.billingCycle
    })
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'Failed to initialize Razorpay checkout.');
  }

  return {
    checkoutUrl: result.checkout_url,
    razorpaySubscriptionId: result.razorpay_subscription_id,
    status: result.status
  };
};
