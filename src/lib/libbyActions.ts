import { supabase } from './supabase';
import { trackAuditEvent } from './auditEngine';
import { getCleanTransactions } from './transactionFilters';

export interface LibbyAction {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id?: string;
  // Scope metadata — stamped at generation time so stale actions are detected immediately
  client_id?: string;
  organization_id?: string;
  title: string;
  description: string;
  proposed_changes: any;
  risk_level: 'safe' | 'low' | 'medium' | 'high';
  requires_confirmation: boolean;
  status: 'prepared' | 'approved' | 'applied' | 'rejected' | 'failed';
  created_at: string;
  affected_count?: number;
  example_item?: string;
}

export interface LibbyActionResult {
  success: boolean;
  message: string;
  affectedCount?: number;
}

/**
 * Action types that are fully wired to Supabase and can be executed.
 * Anything outside this set should be shown as a recommendation only (no Approve button).
 */
export const EXECUTABLE_ACTION_TYPES = new Set([
  'categorize_bulk',
  'mark_reviewed_bulk',
  'resolve_risk',
  'update_spend_rule',
]);

const STORAGE_KEY = 'kaeo_libby_actions';

export function loadLibbyActions(organizationId: string, clientId: string): LibbyAction[] {
  try {
    const data = localStorage.getItem(`${STORAGE_KEY}_${organizationId}_${clientId}`);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error('Failed to get Libby actions from storage:', err);
    return [];
  }
}

export function saveLibbyActions(organizationId: string, clientId: string, actions: LibbyAction[]): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${organizationId}_${clientId}`, JSON.stringify(actions));
  } catch (err) {
    console.error('Failed to save Libby actions to storage:', err);
  }
}

/**
 * Clears all prepared Libby actions for a given client scope.
 * Call this when the active client or org changes to avoid stale-scope rejections.
 */
export function clearLibbyActions(organizationId: string, clientId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_KEY}_${organizationId}_${clientId}`);
  } catch (err) {
    console.error('Failed to clear Libby actions from storage:', err);
  }
}

/**
 * Clears all legacy Libby actions keys from localStorage.
 */
export function clearAllLibbyActions(): void {
  try {
    localStorage.removeItem('libbyActions');
    localStorage.removeItem('kaeo_libby_actions');
    localStorage.removeItem('askKaeoActions');
    
    // Clear legacy keys from localStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        if (key.startsWith('kaeo_libby_actions')) {
          const parts = key.split('_');
          // New scoped key is kaeo_libby_actions_${orgId}_${clientId} which has 5 parts
          if (parts.length < 5) {
            keysToRemove.push(key);
          }
        }
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (err) {
    console.error('Failed to clear legacy Libby actions:', err);
  }
}

/**
 * Safely extracts target transaction/entity IDs from a Libby action.
 */
export function getTransactionTargetIds(action: LibbyAction): string[] {
  if (!action) return [];
  
  if (action.proposed_changes?.affected_transaction_ids && Array.isArray(action.proposed_changes.affected_transaction_ids)) {
    return action.proposed_changes.affected_transaction_ids;
  }
  if (action.proposed_changes?.entity_ids && Array.isArray(action.proposed_changes.entity_ids)) {
    return action.proposed_changes.entity_ids;
  }
  if (action.proposed_changes?.ids && Array.isArray(action.proposed_changes.ids)) {
    return action.proposed_changes.ids;
  }
  if (action.proposed_changes?.transactionIds && Array.isArray(action.proposed_changes.transactionIds)) {
    return action.proposed_changes.transactionIds;
  }
  if (action.proposed_changes?.targetIds && Array.isArray(action.proposed_changes.targetIds)) {
    return action.proposed_changes.targetIds;
  }
  if (action.proposed_changes?.affectedIds && Array.isArray(action.proposed_changes.affectedIds)) {
    return action.proposed_changes.affectedIds;
  }
  if (action.entity_id) {
    return [action.entity_id];
  }
  if (action.proposed_changes?.risk_id) {
    return [action.proposed_changes.risk_id];
  }
  return [];
}

export function prepareLibbyAction(
  organizationId: string,
  clientId: string,
  action: Omit<LibbyAction, 'id' | 'status' | 'created_at'>
): LibbyAction {
  const actions = loadLibbyActions(organizationId, clientId);
  const newAction: LibbyAction = {
    ...action,
    id: Math.random().toString(36).substring(2, 9),
    status: 'prepared',
    created_at: new Date().toISOString()
  };
  
  // Prevent duplicate prepared actions with the same action_type and entity_id
  const duplicateIdx = actions.findIndex(
    a => a.status === 'prepared' && a.action_type === action.action_type && a.entity_id === action.entity_id
  );
  if (duplicateIdx >= 0) {
    actions[duplicateIdx] = newAction;
  } else {
    actions.push(newAction);
  }
  
  saveLibbyActions(organizationId, clientId, actions);
  return newAction;
}

export async function applyLibbyAction(
  organizationId: string,
  clientId: string,
  actionId: string,
  userId?: string
): Promise<LibbyActionResult> {
  const actions = loadLibbyActions(organizationId, clientId);
  const actionIdx = actions.findIndex(a => a.id === actionId);
  if (actionIdx === -1) {
    return { success: false, message: 'Action not found. It may have already been applied or dismissed.' };
  }

  const action = actions[actionIdx];

  // Guard: only allow executable action types
  if (!EXECUTABLE_ACTION_TYPES.has(action.action_type)) {
    return {
      success: false,
      message: `"${action.action_type}" is a recommendation only and cannot be auto-applied. Please review it manually.`
    };
  }

  // Guard: scope mismatch check — stale action belongs to a different business/workspace
  if (action.client_id && action.client_id !== clientId) {
    action.status = 'rejected';
    actions[actionIdx] = action;
    saveLibbyActions(organizationId, clientId, actions);
    return {
      success: false,
      message: 'This suggestion belongs to a different business. Refresh Libby to get fresh suggestions.'
    };
  }
  if (action.organization_id && organizationId && action.organization_id !== organizationId) {
    action.status = 'rejected';
    actions[actionIdx] = action;
    saveLibbyActions(organizationId, clientId, actions);
    return {
      success: false,
      message: 'This suggestion belongs to a different business. Refresh Libby to get fresh suggestions.'
    };
  }

  try {
    const orgId = action.proposed_changes?.organization_id || organizationId;
    let affectedCount = 0;

    // 1. Database execution based on action_type
    if (action.action_type === 'categorize_bulk') {
      const ids = getTransactionTargetIds(action);
      if (!ids || ids.length === 0) {
        return { success: false, message: 'No transaction IDs found in this action. It may be stale.' };
      }
      
      // Validate records belong to active client and org
      const { data: check, error: checkErr } = await supabase
        .from('transactions')
        .select('id, client_id, organization_id')
        .in('id', ids);
      if (checkErr) throw checkErr;

      // Dev diagnostic log
      if (import.meta.env.DEV) {
        console.debug('[Libby Dev Diagnostics] applyLibbyAction validation for categorize_bulk:', {
          actionId: action.id,
          actionType: action.action_type,
          actionClientId: action.client_id,
          actionOrgId: action.organization_id,
          callerClientId: clientId,
          callerOrgId: organizationId,
          targetIds: ids,
          targetCount: ids.length,
          dbRows: check || []
        });
      }

      if (!check || check.length === 0) {
        return { success: false, message: 'These transactions no longer exist. Refresh Libby.' };
      }

      const matchingRows = check.filter(row => {
        if (row.client_id !== clientId) return false;
        if (row.organization_id && organizationId && row.organization_id !== organizationId) return false;
        return true;
      });

      if (matchingRows.length === 0) {
        return { success: false, message: 'This suggestion is out of date. Refresh Libby.' };
      }

      if (matchingRows.length < check.length) {
        return { success: false, message: 'Some target transactions do not belong to this business or workspace. Please refresh Libby.' };
      }

      const validIds = matchingRows.map(r => r.id);
      const { category } = action.proposed_changes;
      
      const { error } = await supabase
        .from('transactions')
        .update({ category })
        .in('id', validIds);
      if (error) throw error;
      affectedCount = validIds.length;
      if (orgId) {
        await trackAuditEvent(orgId, 'libby_action_applied', 'transaction' as any, validIds[0], {
          action_type: 'categorize_bulk',
          entity_type: 'transaction',
          proposed_changes: action.proposed_changes
        });
      }
    }
    else if (action.action_type === 'mark_reviewed_bulk') {
      const ids = getTransactionTargetIds(action);
      if (!ids || ids.length === 0) {
        return { success: false, message: 'No transaction IDs found in this action. It may be stale.' };
      }

      // Validate records belong to active client and org
      const { data: check, error: checkErr } = await supabase
        .from('transactions')
        .select('id, client_id, organization_id')
        .in('id', ids);
      if (checkErr) throw checkErr;

      // Dev diagnostic log
      if (import.meta.env.DEV) {
        console.debug('[Libby Dev Diagnostics] applyLibbyAction validation for mark_reviewed_bulk:', {
          actionId: action.id,
          actionType: action.action_type,
          actionClientId: action.client_id,
          actionOrgId: action.organization_id,
          callerClientId: clientId,
          callerOrgId: organizationId,
          targetIds: ids,
          targetCount: ids.length,
          dbRows: check || []
        });
      }

      if (!check || check.length === 0) {
        return { success: false, message: 'These transactions no longer exist. Refresh Libby.' };
      }

      const matchingRows = check.filter(row => {
        if (row.client_id !== clientId) return false;
        if (row.organization_id && organizationId && row.organization_id !== organizationId) return false;
        return true;
      });

      if (matchingRows.length === 0) {
        return { success: false, message: 'This suggestion is out of date. Refresh Libby.' };
      }

      if (matchingRows.length < check.length) {
        return { success: false, message: 'Some target transactions do not belong to this business or workspace. Please refresh Libby.' };
      }

      const validIds = matchingRows.map(r => r.id);

      const { error } = await supabase
        .from('transactions')
        .update({
          review_status: 'reviewed',
          reviewed_at: new Date().toISOString(),
          reviewed_by: userId || null
        })
        .in('id', validIds);
      if (error) throw error;
      affectedCount = validIds.length;
      if (orgId) {
        await trackAuditEvent(orgId, 'libby_action_applied', 'transaction' as any, validIds[0], {
          action_type: 'mark_reviewed_bulk',
          entity_type: 'transaction',
          proposed_changes: action.proposed_changes
        });
      }
    }
    else if (action.action_type === 'update_spend_rule') {
      const { rule_type, threshold_amount, threshold_days, enabled } = action.proposed_changes;
      if (!orgId) {
        return { success: false, message: 'No organization context found for this action.' };
      }

      // Dev diagnostic log
      if (import.meta.env.DEV) {
        console.debug('[Libby Dev Diagnostics] applyLibbyAction execution for update_spend_rule:', {
          actionId: action.id,
          actionType: action.action_type,
          callerOrgId: organizationId,
          ruleType: rule_type
        });
      }

      const { data: existingRules } = await supabase
        .from('spend_rules')
        .select('*')
        .eq('organization_id', orgId)
        .eq('rule_type', rule_type);
      const ruleId = existingRules && existingRules.length > 0 ? existingRules[0].id : null;
      let error;
      if (ruleId) {
        const res = await supabase
          .from('spend_rules')
          .update({
            enabled,
            threshold_amount,
            threshold_days,
            updated_at: new Date().toISOString()
          })
          .eq('id', ruleId);
        error = res.error;
      } else {
        const res = await supabase
          .from('spend_rules')
          .insert({
            organization_id: orgId,
            rule_type,
            name: rule_type.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            enabled,
            threshold_amount,
            threshold_days
          });
        error = res.error;
      }
      if (error) throw error;
      affectedCount = 1;
      await trackAuditEvent(orgId, 'libby_action_applied', 'spend_rule' as any, undefined, {
        action_type: 'update_spend_rule',
        entity_type: 'spend_rule',
        proposed_changes: action.proposed_changes
      });
    }
    else if (action.action_type === 'resolve_risk') {
      const { risk_id } = action.proposed_changes;
      if (!risk_id) {
        return { success: false, message: 'No risk ID found in this action.' };
      }
      // Validate risk belongs to this client and org
      const { data: check, error: checkErr } = await supabase
        .from('risk_events')
        .select('id, client_id, organization_id')
        .eq('id', risk_id);
      if (checkErr) throw checkErr;

      // Dev diagnostic log
      if (import.meta.env.DEV) {
        console.debug('[Libby Dev Diagnostics] applyLibbyAction validation for resolve_risk:', {
          actionId: action.id,
          actionType: action.action_type,
          actionClientId: action.client_id,
          actionOrgId: action.organization_id,
          callerClientId: clientId,
          callerOrgId: organizationId,
          riskId: risk_id,
          dbRows: check || []
        });
      }

      if (!check || check.length === 0) {
        return { success: false, message: 'Risk event not found.' };
      }

      const matchingRows = check.filter(row => {
        if (row.client_id !== clientId) return false;
        if (row.organization_id && organizationId && row.organization_id !== organizationId) return false;
        return true;
      });

      if (matchingRows.length === 0) {
        return { success: false, message: 'Risk event belongs to a different business context.' };
      }

      const { error } = await supabase
        .from('risk_events')
        .update({
          status: 'resolved',
          reviewed_by: userId || null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', risk_id);
      if (error) throw error;
      affectedCount = 1;
      if (orgId) {
        await trackAuditEvent(orgId, 'libby_action_applied', 'risk' as any, risk_id, {
          action_type: 'resolve_risk',
          entity_type: 'risk',
          proposed_changes: action.proposed_changes
        });
      }
    }

    // 2. Update local state status
    action.status = 'applied';
    actions[actionIdx] = action;
    saveLibbyActions(organizationId, clientId, actions);

    // 3. Shared audit trail
    if (orgId) {
      await trackAuditEvent(orgId, 'libby_action_approved', 'libby_action' as any, action.id, {
        action_type: action.action_type,
        entity_type: action.entity_type,
        risk_level: action.risk_level
      });
    }

    return {
      success: true,
      message: `Done. ${affectedCount > 0 ? `${affectedCount} record${affectedCount === 1 ? '' : 's'} updated.` : 'Changes applied.'}`,
      affectedCount
    };
  } catch (err: any) {
    console.error('[Libby] Action failed:', err);
    action.status = 'failed';
    actions[actionIdx] = action;
    saveLibbyActions(organizationId, clientId, actions);
    const msg = err?.message || 'Something went wrong applying this action.';
    return { success: false, message: msg };
  }
}

export async function rejectLibbyAction(
  organizationId: string,
  clientId: string,
  actionId: string,
  userId?: string
): Promise<boolean> {
  const actions = loadLibbyActions(organizationId, clientId);
  const actionIdx = actions.findIndex(a => a.id === actionId);
  if (actionIdx === -1) return false;

  const action = actions[actionIdx];
  action.status = 'rejected';
  actions[actionIdx] = action;
  saveLibbyActions(organizationId, clientId, actions);

  const orgId = action.proposed_changes?.organization_id || organizationId;
  if (orgId && userId) {
    await trackAuditEvent(orgId, 'libby_action_rejected', 'libby_action' as any, action.id, {
      action_type: action.action_type,
      entity_type: action.entity_type
    });
  }
  return true;
}

export async function getAvailableLibbyActionsForContext(
  clientId: string,
  orgId: string
): Promise<LibbyAction[]> {
  const actions = loadLibbyActions(orgId, clientId);
  
  // Retain non-prepared actions (applied, rejected, etc.) and filter out duplicate prepared actions
  const activeActions = actions.filter(a => a.status !== 'prepared');
  
  const prepared: LibbyAction[] = [];

  // Fetch transactions, spend rules, risks with proper organization scoping if orgId is provided
  let txQuery = supabase.from('transactions').select('*').eq('client_id', clientId);
  if (orgId) {
    txQuery = txQuery.eq('organization_id', orgId);
  }

  let riskQuery = supabase.from('risk_events').select('*').eq('client_id', clientId).eq('status', 'open');
  if (orgId) {
    riskQuery = riskQuery.eq('organization_id', orgId);
  }

  const [txRes, rulesRes, riskRes] = await Promise.all([
    txQuery,
    supabase.from('spend_rules').select('*').eq('organization_id', orgId),
    riskQuery
  ]);

  const transactions = getCleanTransactions(txRes.data || []);
  const rules = rulesRes.data || [];
  const risks = riskRes.data || [];

  // 1. Suggest bulk categorization if uncategorized rows exist
  const uncategorized = transactions.filter(t => !t.category || t.category === 'Uncategorized');
  if (uncategorized.length > 0) {
    const softwareList = uncategorized.filter(t => 
      /aws|github|google|zoom|slack|figma|vercel|stripe|supabase/i.test(t.description || '')
    );
    
    if (softwareList.length > 0) {
      const isSingular = softwareList.length === 1;
      prepared.push({
        id: `libby_cat_software_${clientId}`,
        action_type: 'categorize_bulk',
        entity_type: 'transaction',
        client_id: clientId,
        organization_id: orgId,
        title: isSingular ? `Categorize 1 SaaS payment` : `Categorize ${softwareList.length} SaaS payments`,
        description: isSingular 
          ? `Map 1 uncategorized SaaS transaction to Software / SaaS.` 
          : `Map ${softwareList.length} uncategorized SaaS transactions to Software / SaaS.`,
        proposed_changes: {
          organization_id: orgId,
          affected_transaction_ids: softwareList.map(t => t.id),
          category: 'Software / SaaS'
        },
        risk_level: softwareList.length > 5 ? 'medium' : 'low',
        requires_confirmation: true,
        status: 'prepared',
        created_at: new Date().toISOString(),
        affected_count: softwareList.length,
        example_item: softwareList[0]?.description || undefined
      });
    } else {
      const isSingular = uncategorized.length === 1;
      prepared.push({
        id: `libby_cat_bulk_${clientId}`,
        action_type: 'categorize_bulk',
        entity_type: 'transaction',
        client_id: clientId,
        organization_id: orgId,
        title: isSingular ? `Categorize 1 transaction` : `Categorize ${uncategorized.length} transactions`,
        description: isSingular 
          ? `Define category for 1 uncategorized transaction.` 
          : `Define categories for ${uncategorized.length} uncategorized transactions.`,
        proposed_changes: {
          organization_id: orgId,
          affected_transaction_ids: uncategorized.map(t => t.id),
          category: 'Office Expenses'
        },
        risk_level: uncategorized.length > 5 ? 'medium' : 'low',
        requires_confirmation: true,
        status: 'prepared',
        created_at: new Date().toISOString(),
        affected_count: uncategorized.length,
        example_item: uncategorized[0]?.description || undefined
      });
    }
  }

  // 2. Suggest bulk review for low-risk transactions
  const unreviewedLowRisk = transactions.filter(t => 
    (!t.review_status || t.review_status === 'new' || t.review_status === 'needs_review') &&
    t.category && t.category !== 'Uncategorized' &&
    Math.abs(t.amount) < 15000
  );
  if (unreviewedLowRisk.length > 0) {
    const isSingular = unreviewedLowRisk.length === 1;
    prepared.push({
      id: `libby_rev_bulk_${clientId}`,
      action_type: 'mark_reviewed_bulk',
      entity_type: 'transaction',
      client_id: clientId,
      organization_id: orgId,
      title: isSingular ? `Mark 1 low-risk transaction as reviewed` : `Mark ${unreviewedLowRisk.length} low-risk transactions as reviewed`,
      description: isSingular 
        ? `Approve and validate 1 fully-categorized transaction under ₹15,000.` 
        : `Approve and validate ${unreviewedLowRisk.length} fully-categorized transactions under ₹15,000.`,
      proposed_changes: {
        organization_id: orgId,
        affected_transaction_ids: unreviewedLowRisk.map(t => t.id)
      },
      risk_level: unreviewedLowRisk.length > 5 ? 'medium' : 'safe',
      requires_confirmation: true,
      status: 'prepared',
      created_at: new Date().toISOString(),
      affected_count: unreviewedLowRisk.length,
      example_item: unreviewedLowRisk[0]?.description || undefined
    });
  }

  // 3. Spend rules suggestion: e.g. Update high-value threshold to ₹50,000
  const highValueRule = rules.find(r => r.rule_type === 'high_value_payment');
  const currentThreshold = highValueRule?.threshold_amount ?? 100000;
  if (currentThreshold !== 50000) {
    prepared.push({
      id: `libby_rule_highval_${clientId}`,
      action_type: 'update_spend_rule',
      entity_type: 'spend_rule',
      client_id: clientId,
      organization_id: orgId,
      title: `Update high-value threshold to ₹50,000`,
      description: `Tune high-value flag limit from ₹${currentThreshold.toLocaleString('en-IN')} to ₹50,000 to catch smaller outliers.`,
      proposed_changes: {
        organization_id: orgId,
        rule_type: 'high_value_payment',
        threshold_amount: 50000,
        enabled: true
      },
      risk_level: 'medium',
      requires_confirmation: true,
      status: 'prepared',
      created_at: new Date().toISOString(),
      affected_count: 1,
      example_item: "High-value Payment Rule"
    });
  }

  // 4. Suggest resolving duplicate risks
  const duplicateRisks = risks.filter(r => r.risk_type === 'duplicate_payment');
  if (duplicateRisks.length > 0) {
    prepared.push({
      id: `libby_resolve_duplicate_${duplicateRisks[0].id}`,
      action_type: 'resolve_risk',
      entity_type: 'risk',
      client_id: clientId,
      organization_id: orgId,
      title: `Review duplicate payment: ${duplicateRisks[0].title}`,
      description: `Verify and mark duplicate payment risk as resolved. Amount at risk: ₹${Number(duplicateRisks[0].amount_at_risk || 0).toLocaleString('en-IN')}.`,
      proposed_changes: {
        organization_id: orgId,
        risk_id: duplicateRisks[0].id
      },
      risk_level: 'high',
      requires_confirmation: true,
      status: 'prepared',
      created_at: new Date().toISOString(),
      affected_count: 1,
      example_item: duplicateRisks[0].title || undefined
    });
  }

  // Combine and save
  const finalActions = [...activeActions, ...prepared];
  saveLibbyActions(orgId, clientId, finalActions);
  
  // Return only prepared items for this run
  return prepared;
}
