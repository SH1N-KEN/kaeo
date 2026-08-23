import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDb() {
  console.log('Querying Database information...');

  // 1. Fetch organizations (workspaces)
  const { data: orgs, error: orgsError } = await supabase.from('organizations').select('*');
  if (orgsError) {
    console.error('Error fetching organizations:', orgsError);
    return;
  }
  console.log(`Found ${orgs.length} organizations:`);
  for (const org of orgs) {
    console.log(`  - Org ID: ${org.id}, Name: "${org.name}", Type: ${org.type}`);
  }

  // 2. Fetch clients
  const { data: clients, error: clientsError } = await supabase.from('clients').select('*');
  if (clientsError) {
    console.error('Error fetching clients:', clientsError);
    return;
  }
  console.log(`Found ${clients.length} clients:`);
  for (const client of clients) {
    console.log(`  - Client ID: ${client.id}, Name: "${client.name}", Org ID: ${client.organization_id}`);
  }

  // 3. Fetch transaction counts grouped by client_id
  const { data: txs, error: txsError } = await supabase.from('transactions').select('client_id, id');
  if (txsError) {
    console.error('Error fetching transactions:', txsError);
    return;
  }
  
  const counts = {};
  txs.forEach(tx => {
    counts[tx.client_id] = (counts[tx.client_id] || 0) + 1;
  });

  console.log('Transaction counts per Client ID:');
  for (const cid of Object.keys(counts)) {
    const clientName = clients.find(c => c.id === cid)?.name || 'Unknown';
    console.log(`  - Client ID: ${cid} ("${clientName}"): ${counts[cid]} transactions`);
  }
}

checkDb();
