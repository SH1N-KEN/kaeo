import { supabase } from './supabase';
import { trackAuditEvent } from './auditEngine';

export interface LibbyAction {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id?: string;
  title: string;
  description: string;
  proposed_changes: any;
  risk_level: 'safe' | 'low' | 'medium' | 'high';
  requires_confirmation: boolean;
  status: 'prepared' | 'approved' | 'applied' | 'rejected' | 'failed';
  created_at: string;
}

const STORAGE_KEY = 'kaeo_libby_actions';

export function getStoredLibbyActions(clientId: string): LibbyAction[] {
  try {
    const data = localStorage.getItem(`${STORAGE_KEY}_${clientId}`);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error('Failed to get Libby actions from storage:', err);
    return [];
  }
}

export function saveStoredLibbyActions(clientId: string, actions: LibbyAction[]) {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${clientId}`, JSON.stringify(actions));
  } catch (err) {
    console.error('Failed to save Libby actions to storage:', err);
  }
}

export function prepareLibbyAction(
  clientId: string,
  action: Omit<LibbyAction, 'id' | 'status' | 'created_at'>
): LibbyAction {
  const actions = getStoredLibbyActions(clientId);
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
  
  saveStoredLibbyActions(clientId, actions);
  return newAction;
}

export async function applyLibbyAction(
  clientId: string,
  actionId: string,
  userId?: string
): Promise<boolean> {
  const actions = getStoredLibbyActions(clientId);
  const actionIdx = actions.findIndex(a => a.id === actionId);
  if (actionIdx === -1) return false;

  const action = actions[actionIdx];
  
  try {
    const orgId = action.proposed_changes?.organization_id;
    
    // 1. Database execution based on action_type
    if (action.action_type === 'categorize_bulk') {
      const { ids, category } = action.proposed_changes;
      if (ids && ids.length > 0) {
        const { error } = await supabase
          .from('transactions')
          .update({ category })
          .in('id', ids);
        if (error) throw error;
        
        if (orgId) {
          await trackAuditEvent(orgId, 'libby_action_applied', 'transaction' as any, ids[0], {
            action_type: 'categorize_bulk',
            entity_type: 'transaction',
            proposed_changes: action.proposed_changes
          });
        }
      }
    } 
    else if (action.action_type === 'mark_reviewed_bulk') {
      const { ids } = action.proposed_changes;
      if (ids && ids.length > 0) {
        const { error } = await supabase
          .from('transactions')
          .update({
            review_status: 'reviewed',
            reviewed_at: new Date().toISOString(),
            reviewed_by: userId || null
          })
          .in('id', ids);
        if (error) throw error;
        
        if (orgId) {
          await trackAuditEvent(orgId, 'libby_action_applied', 'transaction' as any, ids[0], {
            action_type: 'mark_reviewed_bulk',
            entity_type: 'transaction',
            proposed_changes: action.proposed_changes
          });
        }
      }
    }
    else if (action.action_type === 'update_spend_rule') {
      const { rule_type, threshold_amount, threshold_days, enabled } = action.proposed_changes;
      if (orgId) {
        // Find existing rule
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
        
        await trackAuditEvent(orgId, 'libby_action_applied', 'spend_rule' as any, undefined, {
          action_type: 'update_spend_rule',
          entity_type: 'spend_rule',
          proposed_changes: action.proposed_changes
        });
      }
    }
    else if (action.action_type === 'resolve_risk') {
      const { risk_id } = action.proposed_changes;
      if (risk_id) {
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
        
        if (orgId) {
          await trackAuditEvent(orgId, 'libby_action_applied', 'risk' as any, risk_id, {
            action_type: 'resolve_risk',
            entity_type: 'risk',
            proposed_changes: action.proposed_changes
          });
        }
      }
    }
    else if (action.action_type === 'save_vendor_note') {
      const { note } = action.proposed_changes;
      if (note) {
        const { error } = await supabase
          .from('notes')
          .insert({
            client_id: clientId,
            note: `Libby Note (Vendor Review): ${note}`,
            created_by: userId || null
          });
        if (error) throw error;
      }
    }
    
    // 2. Update local state status
    action.status = 'applied';
    actions[actionIdx] = action;
    saveStoredLibbyActions(clientId, actions);
    
    // 3. Track audit trail
    if (orgId) {
      await trackAuditEvent(orgId, 'libby_action_approved', 'libby_action' as any, action.id, {
        action_type: action.action_type,
        entity_type: action.entity_type,
        risk_level: action.risk_level
      });
    }
    return true;
  } catch (err) {
    console.error('Failed to apply Libby action:', err);
    action.status = 'failed';
    actions[actionIdx] = action;
    saveStoredLibbyActions(clientId, actions);
    return false;
  }
}

export async function rejectLibbyAction(
  clientId: string,
  actionId: string,
  userId?: string
): Promise<boolean> {
  const actions = getStoredLibbyActions(clientId);
  const actionIdx = actions.findIndex(a => a.id === actionId);
  if (actionIdx === -1) return false;

  const action = actions[actionIdx];
  action.status = 'rejected';
  actions[actionIdx] = action;
  saveStoredLibbyActions(clientId, actions);

  const orgId = action.proposed_changes?.organization_id;
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
  const actions = getStoredLibbyActions(clientId);
  
  // Retain non-prepared actions (applied, rejected, etc.) and filter out duplicate prepared actions
  const activeActions = actions.filter(a => a.status !== 'prepared');
  
  const prepared: LibbyAction[] = [];

  // Fetch transactions, spend rules, risks
  const [txRes, rulesRes, riskRes] = await Promise.all([
    supabase.from('transactions').select('*').eq('client_id', clientId),
    supabase.from('spend_rules').select('*').eq('organization_id', orgId),
    supabase.from('risk_events').select('*').eq('client_id', clientId).eq('status', 'open')
  ]);

  const transactions = txRes.data || [];
  const rules = rulesRes.data || [];
  const risks = riskRes.data || [];

  // 1. Suggest bulk categorization if uncategorized rows exist
  const uncategorized = transactions.filter(t => !t.category || t.category === 'Uncategorized');
  if (uncategorized.length > 0) {
    const softwareList = uncategorized.filter(t => 
      /aws|github|google|zoom|slack|figma|vercel|stripe|supabase/i.test(t.description || '')
    );
    
    if (softwareList.length > 0) {
      prepared.push({
        id: `libby_cat_software_${clientId}`,
        action_type: 'categorize_bulk',
        entity_type: 'transaction',
        title: `Categorize ${softwareList.length} SaaS payments`,
        description: `Map ${softwareList.length} uncategorized SaaS transaction rows to Software / SaaS.`,
        proposed_changes: {
          organization_id: orgId,
          ids: softwareList.map(t => t.id),
          category: 'Software / SaaS'
        },
        risk_level: 'low',
        requires_confirmation: true,
        status: 'prepared',
        created_at: new Date().toISOString()
      });
    } else {
      prepared.push({
        id: `libby_cat_bulk_${clientId}`,
        action_type: 'categorize_bulk',
        entity_type: 'transaction',
        title: `Categorize ${uncategorized.length} transaction rows`,
        description: `Define categories for ${uncategorized.length} uncategorized transaction lines.`,
        proposed_changes: {
          organization_id: orgId,
          ids: uncategorized.map(t => t.id),
          category: 'Office Expenses'
        },
        risk_level: 'low',
        requires_confirmation: true,
        status: 'prepared',
        created_at: new Date().toISOString()
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
    prepared.push({
      id: `libby_rev_bulk_${clientId}`,
      action_type: 'mark_reviewed_bulk',
      entity_type: 'transaction',
      title: `Mark ${unreviewedLowRisk.length} low-risk transactions as reviewed`,
      description: `Approve and validate ${unreviewedLowRisk.length} fully-categorized transactions under ₹15,000.`,
      proposed_changes: {
        organization_id: orgId,
        ids: unreviewedLowRisk.map(t => t.id)
      },
      risk_level: 'safe',
      requires_confirmation: true,
      status: 'prepared',
      created_at: new Date().toISOString()
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
      created_at: new Date().toISOString()
    });
  }

  // 4. Suggest resolving duplicate risks
  const duplicateRisks = risks.filter(r => r.risk_type === 'duplicate_payment');
  if (duplicateRisks.length > 0) {
    prepared.push({
      id: `libby_resolve_duplicate_${duplicateRisks[0].id}`,
      action_type: 'resolve_risk',
      entity_type: 'risk',
      title: `Review duplicate payment: ${duplicateRisks[0].title}`,
      description: `Verify and mark duplicate payment risk as resolved. Amount at risk: ₹${Number(duplicateRisks[0].amount_at_risk || 0).toLocaleString('en-IN')}.`,
      proposed_changes: {
        organization_id: orgId,
        risk_id: duplicateRisks[0].id
      },
      risk_level: 'high',
      requires_confirmation: true,
      status: 'prepared',
      created_at: new Date().toISOString()
    });
  }

  // Combine and save
  const finalActions = [...activeActions, ...prepared];
  saveStoredLibbyActions(clientId, finalActions);
  
  // Return only prepared items for this run
  return prepared;
}
