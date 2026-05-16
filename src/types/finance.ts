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
