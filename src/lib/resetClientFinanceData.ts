import { supabase } from './supabase';

/**
 * Resets all financial data for a specific client within an organization.
 * This is a destructive operation used for cleaning up or re-importing data.
 * 
 * Order of deletion (dependencies):
 * 1. notes (linked to risks/vendors)
 * 2. risk_events (linked to transactions/vendors)
 * 3. vendors (linked to transactions)
 * 4. transactions
 * 5. import_mappings
 * 6. imports
 * 7. uploaded_files
 */
export const resetClientFinanceData = async (organizationId: string, clientId: string) => {
  console.log(`[Reset] Starting full reset for client ${clientId} in org ${organizationId}`);

  const deleteOptions = {
    organization_id: organizationId,
    client_id: clientId
  };

  try {
    // 1. Delete Notes
    const { error: notesError } = await supabase
      .from('notes')
      .delete()
      .match(deleteOptions);
    if (notesError) throw notesError;
    console.log('[Reset] Deleted notes');

    // 2. Delete Risk Events
    const { error: riskError } = await supabase
      .from('risk_events')
      .delete()
      .match(deleteOptions);
    if (riskError) throw riskError;
    console.log('[Reset] Deleted risk_events');

    // 3. Delete Vendors
    const { error: vendorError } = await supabase
      .from('vendors')
      .delete()
      .match(deleteOptions);
    if (vendorError) throw vendorError;
    console.log('[Reset] Deleted vendors');

    // 4. Delete Transactions
    const { error: txError } = await supabase
      .from('transactions')
      .delete()
      .match(deleteOptions);
    if (txError) throw txError;
    console.log('[Reset] Deleted transactions');

    // 5. Delete Import Mappings
    const { error: mappingError } = await supabase
      .from('import_mappings')
      .delete()
      .match(deleteOptions);
    if (mappingError) throw mappingError;
    console.log('[Reset] Deleted import_mappings');

    // 6. Delete Import Sessions
    const { error: importError } = await supabase
      .from('imports')
      .delete()
      .match(deleteOptions);
    if (importError) throw importError;
    console.log('[Reset] Deleted imports');

    // 7. Delete Uploaded Files
    const { error: fileError } = await supabase
      .from('uploaded_files')
      .delete()
      .match(deleteOptions);
    if (fileError) throw fileError;
    console.log('[Reset] Deleted uploaded_files');

    console.log('[Reset] Full client data reset completed successfully');
    return { success: true };
  } catch (err: any) {
    console.error('[Reset] Critical error during data reset:', err);
    throw new Error(`Reset failed: ${err.message}`);
  }
};
