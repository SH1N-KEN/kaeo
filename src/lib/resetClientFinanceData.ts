import { supabase } from './supabase';

/**
 * Resets all finance-related data for a specific client within an organization.
 * Clears transactions, mappings, imports, and uploaded files.
 */
export const resetClientFinanceData = async (orgId: string, clientId: string) => {
  if (!orgId || !clientId) throw new Error('Organization ID and Client ID are required for reset.');

  console.log(`[Data Management] Resetting finance data for client: ${clientId} in org: ${orgId}`);

  try {
    // 1. Delete transactions (Dependent on imports/files)
    const { count: txCount, error: txErr } = await supabase
      .from('transactions')
      .delete({ count: 'exact' })
      .eq('organization_id', orgId)
      .eq('client_id', clientId);
    if (txErr) throw txErr;
    console.log(`[Reset] Deleted ${txCount || 0} transactions.`);

    // 2. Delete import mappings (Dependent on imports)
    const { count: mapCount, error: mapErr } = await supabase
      .from('import_mappings')
      .delete({ count: 'exact' })
      .eq('organization_id', orgId)
      .eq('client_id', clientId);
    if (mapErr) {
      console.warn('[Reset] import_mappings delete failed, table might lack direct org/client cols. Attempting subquery deletion...');
      
      // Fallback: Delete mappings where import_id belongs to this client
      const { data: clientImports } = await supabase.from('imports').select('id').eq('client_id', clientId);
      const importIds = clientImports?.map(i => i.id) || [];
      
      if (importIds.length > 0) {
        const { count: subMapCount, error: subMapErr } = await supabase
          .from('import_mappings')
          .delete({ count: 'exact' })
          .in('import_id', importIds);
        if (subMapErr) throw subMapErr;
        console.log(`[Reset] Deleted ${subMapCount || 0} mappings via subquery.`);
      }
    } else {
      console.log(`[Reset] Deleted ${mapCount || 0} mappings.`);
    }

    // 3. Delete imports (Dependent on uploaded_files)
    const { count: impCount, error: impErr } = await supabase
      .from('imports')
      .delete({ count: 'exact' })
      .eq('organization_id', orgId)
      .eq('client_id', clientId);
    if (impErr) throw impErr;
    console.log(`[Reset] Deleted ${impCount || 0} imports.`);

    // 4. Delete uploaded_files
    const { count: fileCount, error: fileErr } = await supabase
      .from('uploaded_files')
      .delete({ count: 'exact' })
      .eq('organization_id', orgId)
      .eq('client_id', clientId);
    if (fileErr) throw fileErr;
    console.log(`[Reset] Deleted ${fileCount || 0} files.`);

    console.log('[Data Management] Client finance data reset successfully.');
    return { success: true };
  } catch (err: any) {
    console.error('[Data Management] Reset failed:', err);
    throw err;
  }
};
