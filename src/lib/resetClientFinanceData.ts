import { supabase } from './supabase';

/**
 * Resets all financial data for a specific client within an organization.
 * This is a destructive operation used for cleaning up or re-importing data.
 *
 * Order of deletion (respects FK dependencies):
 * 1. notes           — linked to risks/vendors
 * 2. risk_events     — linked to transactions/vendors
 * 3. vendors         — linked to transactions
 * 4. reports         — linked to organizations/clients
 * 5. transactions    — linked to imports/files
 * 6. import_mappings — linked to imports (via org/client or import_id fallback)
 * 7. imports         — linked to uploaded_files
 * 8. uploaded_files
 *
 * Every delete is scoped to organization_id + client_id. Never global.
 */
export const resetClientFinanceData = async (organizationId: string, clientId: string) => {
  console.log(`[Reset] Starting full reset for client ${clientId} in org ${organizationId}`);

  try {
    // 1. Notes
    await safeDelete('notes', organizationId, clientId);

    // 2. Risk Events
    await safeDelete('risk_events', organizationId, clientId);

    // 3. Vendors
    await safeDelete('vendors', organizationId, clientId);

    // 4. Reports
    await safeDelete('reports', organizationId, clientId);

    // 5. Transactions
    await safeDelete('transactions', organizationId, clientId);

    // 6. Import Mappings
    // Preferred: direct org/client columns (added in migration 0006)
    // Fallback:  delete by import_id belonging to this client
    await deleteMappings(organizationId, clientId);

    // 7. Imports
    await safeDelete('imports', organizationId, clientId);

    // 7.5. Reconciliation Runs
    const { error: reconRunErr } = await supabase
      .from('reconciliation_runs')
      .delete()
      .eq('workspace_id', organizationId)
      .eq('client_id', clientId);
    if (reconRunErr) {
      console.error('[Reset] Failed deleting reconciliation_runs:', reconRunErr);
      throw reconRunErr;
    }
    console.log('[Reset] Deleted reconciliation_runs');

    // 8. Uploaded Files
    await safeDelete('uploaded_files', organizationId, clientId);

    console.log('[Reset] Full client data reset completed successfully');
    return { success: true };
  } catch (err: any) {
    console.error('[Reset] Critical error during data reset:', err);

    // Surface a clear schema-error hint for missing columns
    if (err.message?.includes('column') && err.message?.includes('does not exist')) {
      throw new Error('Database schema is out of date. Run the latest migration (0006_fix_import_mappings_scope.sql) in Supabase.');
    }

    throw new Error(`Reset failed: ${err.message}`);
  }
};

/**
 * Deletes rows from any table that has organization_id + client_id columns.
 */
const safeDelete = async (table: string, organizationId: string, clientId: string) => {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('organization_id', organizationId)
    .eq('client_id', clientId);

  if (error) {
    console.error(`[Reset] Failed deleting ${table}:`, error);
    throw error;
  }
  console.log(`[Reset] Deleted ${table}`);
};

/**
 * Deletes import_mappings with two strategies:
 * 1. Direct org/client match (works after migration 0006 is applied)
 * 2. Fallback via import_ids belonging to this client (safe for pre-migration rows)
 */
const deleteMappings = async (organizationId: string, clientId: string) => {
  // Strategy 1: direct columns (post-migration)
  const { error: directErr } = await supabase
    .from('import_mappings')
    .delete()
    .eq('organization_id', organizationId)
    .eq('client_id', clientId);

  if (!directErr) {
    console.log('[Reset] Deleted import_mappings (direct)');
    return;
  }

  // If columns don't exist yet, fall back to import_id scoping
  if (directErr.message?.includes('does not exist')) {
    console.warn('[Reset] import_mappings missing scope columns, using import_id fallback');

    // Fetch import IDs for this client
    const { data: imports, error: importFetchErr } = await supabase
      .from('imports')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('client_id', clientId);

    if (importFetchErr) throw importFetchErr;

    const importIds = (imports || []).map(i => i.id);
    if (importIds.length > 0) {
      const { error: fallbackErr } = await supabase
        .from('import_mappings')
        .delete()
        .in('import_id', importIds);

      if (fallbackErr) throw fallbackErr;
    }
    console.log('[Reset] Deleted import_mappings (fallback via import_id)');
    return;
  }

  throw directErr;
};
