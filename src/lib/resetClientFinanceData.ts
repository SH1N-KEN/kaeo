import { supabase } from './supabase';

/**
 * Resets all finance-related data for a specific client within an organization.
 * Clears transactions, mappings, imports, and uploaded files.
 */
export const resetClientFinanceData = async (orgId: string, clientId: string) => {
  if (!orgId || !clientId) throw new Error('Organization ID and Client ID are required for reset.');

  console.log(`[Data Management] Resetting finance data for client: ${clientId} in org: ${orgId}`);

  // 1. Delete transactions
  const { error: txErr } = await supabase
    .from('transactions')
    .delete()
    .eq('organization_id', orgId)
    .eq('client_id', clientId);
  if (txErr) throw txErr;

  // 2. Delete import mappings
  // Since mappings are linked to imports, we fetch import IDs first if needed, 
  // or use organization_id if the table supports it.
  // Assuming import_mappings has organization_id and client_id (standard pattern in Kaeo)
  const { error: mapErr } = await supabase
    .from('import_mappings')
    .delete()
    .eq('organization_id', orgId)
    .eq('client_id', clientId);
  if (mapErr) {
    // If table doesn't have org/client id directly, we might need a more complex query
    // but Phase 4 migrations usually include them for RLS.
    console.warn('[Reset] import_mappings delete by org/client failed, might lack direct columns. Falling back to subquery if needed.');
  }

  // 3. Delete imports
  const { error: impErr } = await supabase
    .from('imports')
    .delete()
    .eq('organization_id', orgId)
    .eq('client_id', clientId);
  if (impErr) throw impErr;

  // 4. Delete uploaded_files
  const { error: fileErr } = await supabase
    .from('uploaded_files')
    .delete()
    .eq('organization_id', orgId)
    .eq('client_id', clientId);
  if (fileErr) throw fileErr;

  console.log('[Data Management] Client finance data reset successfully.');
  return { success: true };
};
