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
  display_name: string;
  total_spend: number;
  transaction_count: number;
  first_seen: string;
  last_seen: string;
  monthly_average: number;
  recurrence_pattern: 'monthly' | 'weekly' | 'irregular';
  trend: 'increasing' | 'decreasing' | 'stable';
  category: string | null;
  recommendation: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface RiskEvent {
  id: string;
  organization_id: string;
  client_id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  risk_type: string;
  amount_at_risk: number;
  evidence: any;
  suggested_action: string | null;
  status: 'open' | 'reviewed' | 'confirmed' | 'false_positive' | 'ignored';
  related_transaction_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  organization_id: string;
  client_id: string;
  parent_type: string;
  parent_id: string;
  content: string;
  created_by: string;
  created_at: string;
}
