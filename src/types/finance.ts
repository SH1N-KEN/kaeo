export interface NormalizedTransaction {
  id: string;
  organization_id: string;
  client_id: string;
  import_id: string | null;
  file_id: string | null;
  transaction_date: string;
  description: string;
  amount: number;
  currency: string;
  type: 'income' | 'expense' | 'vendor_payment' | 'subscription' | 'transfer' | 'refund' | 'failed' | 'failed_payment' | 'unknown';
  category: string | null;
  counterparty_name: string | null;
  source_provider: string | null;
  raw_row_json: any;
  created_at?: string;
}

export interface ImportMapping {
  id: string;
  import_id: string;
  confirmed_mapping_json: Record<string, string>;
  confirmed_by: string;
  confirmed_at: string;
  organization_id?: string;
  client_id?: string;
}

export interface ImportSession {
  id: string;
  organization_id: string;
  client_id: string;
  file_id: string;
  status: 'parsing' | 'mapping_required' | 'ready_to_import' | 'imported' | 'failed';
  row_count: number;
  provider_detected: string;
}

export interface Vendor {
  id: string;
  organization_id: string;
  client_id: string;
  name: string;
  normalized_name: string;
  category: string | null;
  total_spend: number;
  monthly_average: number;
  transaction_count: number;
  first_seen: string;
  last_seen: string;
  recurrence_pattern: 'monthly' | 'weekly' | 'quarterly' | 'annual' | 'irregular' | 'unknown';
  trend: 'rising' | 'falling' | 'flat' | 'unknown';
  recommendation: 'keep' | 'review' | 'downgrade' | 'replace' | 'cancel_candidate' | null;
  recommendation_reason: string | null;
  alternatives_json: any[];
  metadata_json: any;
  created_at: string;
  updated_at: string;
}

export interface RiskEvent {
  id: string;
  organization_id: string;
  client_id: string;
  transaction_id: string | null;
  vendor_id: string | null;
  risk_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string | null;
  amount_at_risk: number;
  evidence_json: any;
  suggested_action: string | null;
  status: 'open' | 'reviewed' | 'confirmed' | 'false_positive' | 'ignored' | 'resolved';
  reviewed_by: string | null;
  reviewed_at: string | null;
  assigned_to: string | null;
  follow_up_at: string | null;
  created_at: string;
  updated_at: string;
  // Computed fields for UI
  notes_count?: number;
}

export interface Note {
  id: string;
  organization_id: string;
  client_id: string;
  entity_type: string;
  entity_id: string;
  note: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
