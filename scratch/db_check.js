import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pbptkhdhefphxsyghvjk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHRraGRoZWZwaHhzeWdodmprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODY5NzksImV4cCI6MjA5NDQ2Mjk3OX0.GBfK2svpc8DfEuVPtQABZ6J7GucAVo-VKkMhic2wLdo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('--- DIAGNOSTICS ---');
  
  // 1. Fetch all clients
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('*');
    
  if (clientsError) {
    console.error('Error fetching clients:', clientsError);
  } else {
    console.log(`Found ${clients?.length || 0} clients:`);
    console.log(JSON.stringify(clients, null, 2));
  }

  // 2. Fetch all organizations
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('*');
    
  if (orgsError) {
    console.error('Error fetching organizations:', orgsError);
  } else {
    console.log(`Found ${orgs?.length || 0} organizations:`);
    console.log(JSON.stringify(orgs, null, 2));
  }

  // 3. Fetch all profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*');
    
  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
  } else {
    console.log(`Found ${profiles?.length || 0} profiles:`);
    console.log(JSON.stringify(profiles, null, 2));
  }

  // 4. Fetch all organization_members
  const { data: members, error: membersError } = await supabase
    .from('organization_members')
    .select('*');
    
  if (membersError) {
    console.error('Error fetching members:', membersError);
  } else {
    console.log(`Found ${members?.length || 0} members:`);
    console.log(JSON.stringify(members, null, 2));
  }
}

run();
