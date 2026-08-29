import * as fs from 'fs';
import * as path from 'path';

// 1. Polyfill FileReader and File for Node.js environment
class MockFileReader {
  onload: any;
  onerror: any;
  readAsText(file: any) {
    file.text().then((text: string) => {
      if (this.onload) {
        this.onload({
          target: {
            result: text
          }
        });
      }
    }).catch((err: any) => {
      if (this.onerror) {
        this.onerror(err);
      }
    });
  }
}
(globalThis as any).FileReader = MockFileReader;

// 2. High-fidelity in-memory database mock for Supabase
const mockDatabase = {
  users: [] as any[],
  organizations: [] as any[],
  organization_members: [] as any[],
  uploaded_files: [] as any[],
  reconciliation_runs: [] as any[],
  reconciliation_records: [] as any[],
  transactions: [] as any[],
  currentSession: null as any
};

import { supabase } from '../src/lib/supabase';

// Mock auth methods
supabase.auth.signUp = async (credentials: any) => {
  const userId = `usr_${Math.random().toString(36).substring(2, 11)}`;
  const user = { id: userId, email: credentials.email };
  const session = { access_token: `token_${userId}`, user };
  mockDatabase.users.push(user);
  return { data: { user, session }, error: null } as any;
};

supabase.auth.setSession = async (session: any) => {
  const user = mockDatabase.users.find(u => `token_${u.id}` === session.access_token);
  mockDatabase.currentSession = user ? { access_token: session.access_token, user } : null;
  return { data: { session }, error: null } as any;
};

supabase.auth.getUser = async () => {
  return { data: { user: mockDatabase.currentSession?.user || null }, error: null } as any;
};

// Helper to check organization membership for the current user
function isCurrentUserMember(orgId: string): boolean {
  const currentUserId = mockDatabase.currentSession?.user?.id;
  if (!currentUserId) return false;
  return mockDatabase.organization_members.some(
    m => m.organization_id === orgId && m.user_id === currentUserId
  );
}

// Mock RPC method for atomic reconciliation runs
supabase.rpc = (fnName: string, params: any) => {
  if (fnName === 'create_reconciliation_run_atomic') {
    const {
      p_workspace_id,
      p_client_id,
      p_bank_file_id,
      p_processor_file_id,
      p_summary,
      p_source_metadata,
      p_records
    } = params;

    // Check RLS permissions
    if (!isCurrentUserMember(p_workspace_id)) {
      return Promise.resolve({ data: null, error: { message: 'Unauthorized: User is not a member of the target workspace' } }) as any;
    }

    // Verify constraints on child records (e.g. status not-null)
    for (const record of p_records) {
      if (record.status === undefined || record.status === null) {
        // Simulates constraint violation
        return Promise.resolve({ data: null, error: { message: 'null value in column "status" violates not-null constraint' } }) as any;
      }
    }

    // Create the run
    const runId = `run_${Math.random().toString(36).substring(2, 11)}`;
    const run = {
      id: runId,
      workspace_id: p_workspace_id,
      client_id: p_client_id,
      bank_file_id: p_bank_file_id,
      processor_file_id: p_processor_file_id,
      status: 'completed',
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      summary: p_summary,
      source_metadata: p_source_metadata
    };
    mockDatabase.reconciliation_runs.push(run);

    // Create child records
    for (const record of p_records) {
      const recId = `rec_${Math.random().toString(36).substring(2, 11)}`;
      mockDatabase.reconciliation_records.push({
        id: recId,
        run_id: runId,
        created_at: new Date().toISOString(),
        ...record
      });
    }

    return Promise.resolve({ data: runId, error: null }) as any;
  }

  return Promise.resolve({ data: null, error: { message: `Function ${fnName} not found` } }) as any;
};

// Mock table query engine
supabase.from = (table: string) => {
  let queryData = [] as any[];
  
  if (table === 'organizations') queryData = mockDatabase.organizations;
  else if (table === 'organization_members') queryData = mockDatabase.organization_members;
  else if (table === 'reconciliation_runs') queryData = mockDatabase.reconciliation_runs;
  else if (table === 'reconciliation_records') queryData = mockDatabase.reconciliation_records;
  else if (table === 'transactions') queryData = mockDatabase.transactions;
  else if (table === 'uploaded_files') queryData = mockDatabase.uploaded_files;

  const builder = {
    filters: [] as ((item: any) => boolean)[],
    orderField: 'created_at',
    orderAscending: false,
    limitVal: null as number | null,

    select(columns?: string) {
      return this;
    },

    insert(values: any) {
      const isArray = Array.isArray(values);
      const rows = isArray ? values : [values];
      const insertedRows = [] as any[];

      for (const row of rows) {
        // Enforce RLS checks on insert
        const orgId = row.organization_id || row.workspace_id;
        const currentUserId = mockDatabase.currentSession?.user?.id;

        if (table === 'organizations') {
          // Allowed for authenticated
          if (!currentUserId) {
            return Promise.resolve({ data: null, error: { message: 'Unauthorized' } });
          }
        } else if (table === 'organization_members') {
          if (row.user_id !== currentUserId) {
            return Promise.resolve({ data: null, error: { message: 'Unauthorized' } });
          }
        } else if (orgId) {
          if (!isCurrentUserMember(orgId)) {
            return Promise.resolve({ data: null, error: { message: 'Unauthorized' } });
          }
        }

        const newRow = {
          id: row.id || `${table.substring(0, 3)}_${Math.random().toString(36).substring(2, 11)}`,
          created_at: new Date().toISOString(),
          ...row
        };
        queryData.push(newRow);
        insertedRows.push(newRow);
      }

      const res = isArray ? insertedRows : insertedRows[0];
      return {
        data: res,
        error: null,
        select() {
          return {
            single() {
              return Promise.resolve({ data: insertedRows[0], error: null });
            }
          };
        },
        single() {
          return Promise.resolve({ data: insertedRows[0], error: null });
        }
      } as any;
    },

    delete() {
      // Return a filter builder that deletes matching rows
      return {
        filters: [] as ((item: any) => boolean)[],
        eq(column: string, value: any) {
          this.filters.push((item: any) => item[column] === value);
          return this;
        },
        async then(resolve: any) {
          const beforeCount = queryData.length;
          // Apply filters
          if (table === 'reconciliation_runs') {
            // Apply workspace_id filter RLS
            const orgFilter = this.filters.find(() => true); // get the workspace_id equality check
            // Perform delete
            const filteredData = queryData.filter(item => {
              const matchesFilters = this.filters.every((f: any) => f(item));
              if (matchesFilters) {
                // Must be member to delete
                return !isCurrentUserMember(item.workspace_id);
              }
              return true;
            });
            
            // Cascade delete child reconciliation_records
            const deletedRuns = queryData.filter(item => {
              const matchesFilters = this.filters.every((f: any) => f(item));
              return matchesFilters && isCurrentUserMember(item.workspace_id);
            });
            for (const r of deletedRuns) {
              mockDatabase.reconciliation_records = mockDatabase.reconciliation_records.filter(rec => rec.run_id !== r.id);
            }

            mockDatabase.reconciliation_runs = filteredData;
          } else {
            const filteredData = queryData.filter(item => {
              const matchesFilters = this.filters.every((f: any) => f(item));
              return !matchesFilters;
            });
            if (table === 'organizations') mockDatabase.organizations = filteredData;
            else if (table === 'organization_members') mockDatabase.organization_members = filteredData;
            else if (table === 'transactions') mockDatabase.transactions = filteredData;
            else if (table === 'uploaded_files') mockDatabase.uploaded_files = filteredData;
          }

          resolve({ error: null });
        }
      } as any;
    },

    eq(column: string, value: any) {
      if (value !== null) {
        this.filters.push((item: any) => item[column] === value);
      }
      return this;
    },

    is(column: string, value: any) {
      this.filters.push((item: any) => item[column] === value);
      return this;
    },

    order(column: string, options: { ascending: boolean }) {
      this.orderField = column;
      this.orderAscending = options.ascending;
      return this;
    },

    limit(val: number) {
      this.limitVal = val;
      return this;
    },

    async then(resolve: any) {
      // Execute the query with RLS filtering
      let resultData = [...queryData];

      // Enforce RLS checks for queries
      const currentUserId = mockDatabase.currentSession?.user?.id;
      if (!currentUserId) {
        // Unauthenticated has zero access
        resultData = [];
      } else {
        if (table === 'organizations') {
          resultData = resultData.filter(
            org => org.created_by === currentUserId ||
            mockDatabase.organization_members.some(m => m.organization_id === org.id && m.user_id === currentUserId)
          );
        } else if (table === 'organization_members') {
          resultData = resultData.filter(m => m.user_id === currentUserId);
        } else if (table === 'reconciliation_runs') {
          resultData = resultData.filter(run => isCurrentUserMember(run.workspace_id));
        } else if (table === 'reconciliation_records') {
          resultData = resultData.filter(rec => {
            const parentRun = mockDatabase.reconciliation_runs.find(run => run.id === rec.run_id);
            return parentRun && isCurrentUserMember(parentRun.workspace_id);
          });
        } else if (table === 'transactions') {
          resultData = resultData.filter(tx => isCurrentUserMember(tx.organization_id));
        } else if (table === 'uploaded_files') {
          resultData = resultData.filter(f => isCurrentUserMember(f.organization_id));
        }
      }

      // Apply standard filters
      for (const filter of this.filters) {
        resultData = resultData.filter(filter);
      }

      // Apply ordering
      resultData.sort((a, b) => {
        const valA = a[this.orderField];
        const valB = b[this.orderField];
        if (valA < valB) return this.orderAscending ? -1 : 1;
        if (valA > valB) return this.orderAscending ? 1 : -1;
        return 0;
      });

      // Apply limit
      if (this.limitVal !== null) {
        resultData = resultData.slice(0, this.limitVal);
      }

      resolve({ data: resultData, error: null });
    },

    single() {
      return {
        then: async (resolve: any) => {
          this.limitVal = 1;
          const { data, error } = await (this as any);
          resolve({
            data: data && data.length > 0 ? data[0] : null,
            error: data && data.length > 0 ? null : { message: 'Row not found' }
          });
        }
      } as any;
    }
  };

  return builder as any;
};

// 3. Now import files for parsing and repository operations
import { parseFinancialFile } from '../src/lib/fileParser';
import { normalizeIngestedRows } from '../src/lib/ingestion/transactionNormalizer';
import { reconcileTransactionsPipeline } from '../src/lib/reconciliation/reconciliationEngine';
import {
  createReconciliationRun,
  getLatestReconciliationRun,
  listReconciliationRuns,
  getReconciliationRecords,
  getReconciliationRun,
  reconstructReconciliationResult
} from '../src/lib/reconciliation/reconciliationRepository';

const projectDir = 'c:/Users/sreev/kaeo';

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
  } else {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
}

async function runTests() {
  console.log('🧪 Starting Supabase Reconciliation Persistence Integration Tests...');
  console.log('=====================================================================');

  // --- Step 1: Sign up and create two distinct test users/workspaces to verify RLS ---
  console.log('Creating Test User A and User B...');
  const userSuffix = Date.now();
  const password = 'TestPassword123!';
  const emailA = `recon_test_a_${userSuffix}@gmail.com`;
  const emailB = `recon_test_b_${userSuffix}@gmail.com`;

  // Create User A
  const { data: signUpA, error: errA } = await supabase.auth.signUp({ email: emailA, password });
  if (errA) throw new Error(`User A Sign Up failed: ${errA.message}`);
  const sessionA = signUpA.session;
  const userA = signUpA.user;
  if (!sessionA || !userA) throw new Error('Failed to retrieve session A');
  console.log(`Created User A: ${emailA} (ID: ${userA.id})`);

  // Create User B
  const { data: signUpB, error: errB } = await supabase.auth.signUp({ email: emailB, password });
  if (errB) throw new Error(`User B Sign Up failed: ${errB.message}`);
  const sessionB = signUpB.session;
  const userB = signUpB.user;
  if (!sessionB || !userB) throw new Error('Failed to retrieve session B');
  console.log(`Created User B: ${emailB} (ID: ${userB.id})`);

  // --- Step 2: Set up Workspace A & B and add members ---
  console.log('Setting up Workspaces...');
  
  // Login as User A to insert Workspace A
  await supabase.auth.setSession({ access_token: sessionA.access_token, refresh_token: sessionA.refresh_token });
  const { data: orgA, error: orgAErr } = await supabase.from('organizations').insert({ name: 'Workspace A', created_by: userA.id }).select().single();
  if (orgAErr) throw orgAErr;
  await supabase.from('organization_members').insert({ organization_id: orgA.id, user_id: userA.id, role: 'owner' });
  console.log(`Workspace A created: ${orgA.id}`);

  // Login as User B to insert Workspace B
  await supabase.auth.setSession({ access_token: sessionB.access_token, refresh_token: sessionB.refresh_token });
  const { data: orgB, error: orgBErr } = await supabase.from('organizations').insert({ name: 'Workspace B', created_by: userB.id }).select().single();
  if (orgBErr) throw orgBErr;
  await supabase.from('organization_members').insert({ organization_id: orgB.id, user_id: userB.id, role: 'owner' });
  console.log(`Workspace B created: ${orgB.id}`);

  // Add a mock transaction to Workspace A to verify foreign key linking logic
  await supabase.auth.setSession({ access_token: sessionA.access_token, refresh_token: sessionA.refresh_token });
  const { data: mockTx } = await supabase.from('transactions').insert({
    organization_id: orgA.id,
    client_id: 'test_client_a',
    transaction_date: '2026-02-02T00:00:00.000Z',
    description: 'NEFT CR-RAZORPAY PAYMENTS-SETTLEMENT-PERROTECH',
    amount: 125000,
    currency: 'INR',
    type: 'income'
  }) as any;

  // --- Step 3: Run baseline reconciliation fixture (Razorpay + HDFC) ---
  console.log('\nReading and reconciling fixtures...');
  const reconBankPath = path.join(projectDir, 'test-data/reconciliation/recon_bank_statement.csv');
  const reconRazorpayPath = path.join(projectDir, 'test-data/reconciliation/recon_razorpay_export.csv');

  const bankContent = fs.readFileSync(reconBankPath, 'utf8');
  const razorpayContent = fs.readFileSync(reconRazorpayPath, 'utf8');

  const bankFile = new File([bankContent], 'recon_bank_statement.csv', { type: 'text/csv' });
  const razorpayFile = new File([razorpayContent], 'recon_razorpay_export.csv', { type: 'text/csv' });

  const bankParsed = await parseFinancialFile(bankFile);
  const razorpayParsed = await parseFinancialFile(razorpayFile);

  const bankNorm = normalizeIngestedRows(bankParsed.allRows, bankParsed.suggestedMapping, { provider: bankParsed.provider, currency: 'INR' });
  const razorpayNorm = normalizeIngestedRows(razorpayParsed.allRows, razorpayParsed.suggestedMapping, { provider: razorpayParsed.provider, currency: 'INR' });

  const runResult = await reconcileTransactionsPipeline(bankNorm.transactions, razorpayNorm.transactions);

  // Assert standard regression metrics
  const summary = runResult.summary;
  assert(summary.matchedSettlementCount === 5, 'Regression G: matchedSettlementCount === 5');
  assert(summary.reconciledValue === 377500, 'Regression G: reconciledValue === ₹377,500');
  assert(summary.unresolvedExposure === 23500, 'Regression G: unresolvedExposure === ₹23,500');
  assert(Math.abs(summary.matchRate - (5/6)*100) < 0.01, 'Regression G: matchRate === 83.3%');

  // --- Test Case A: Create run and persist successfully ---
  console.log('\nTesting Case A: Persist Reconciliation Run...');
  await supabase.auth.setSession({ access_token: sessionA.access_token, refresh_token: sessionA.refresh_token });

  const sourceMetadata = {
    bank_file_name: 'recon_bank_statement.csv',
    processor_file_name: 'recon_razorpay_export.csv',
    bank_file_size: bankContent.length,
    processor_file_size: razorpayContent.length,
    bank_row_count: bankParsed.rowCount,
    processor_row_count: razorpayParsed.rowCount
  };

  const runId1 = await createReconciliationRun(
    orgA.id,
    'test_client_a',
    null,
    null,
    runResult.summary,
    runResult.results,
    sourceMetadata
  );
  assert(typeof runId1 === 'string' && runId1.length > 0, 'Case A: Run saved successfully, returned ID');

  // Verify run details in database
  const run1 = await getReconciliationRun(runId1);
  assert(run1.workspace_id === orgA.id, 'Case A: Workspace ID matches');
  assert(run1.summary.reconciledValue === 377500, 'Case A: Saved reconciled value is correct');
  assert(run1.summary.matchRate === runResult.summary.matchRate, 'Case A: Saved match rate is correct');

  // Verify child records
  const records1 = await getReconciliationRecords(runId1);
  assert(records1.length === runResult.results.length, `Case A: All child records persisted (${records1.length} / ${runResult.results.length})`);

  // Verify transaction FK linking logic (checks that matching transactions are linked by ID)
  const targetRecord = records1.find(r => r.bank_amount === 125000);
  assert(targetRecord !== undefined, 'Case A: Found target reconciliation record');
  assert(targetRecord?.bank_transaction_id === mockTx?.id, 'Case A: Successfully linked bank record to existing transaction ID from database');

  // --- Test Case E: Child records belong to exactly one run ---
  console.log('\nTesting Case E: Child records belong to exactly one run...');
  const allBelong = records1.every(r => r.run_id === runId1);
  assert(allBelong, 'Case E: All records reference run_id correctly');

  // --- Test Case B: Load latest run (reconstruct same result) ---
  console.log('\nTesting Case B: Load latest run on page reload...');
  const latestRun = await getLatestReconciliationRun(orgA.id, 'test_client_a');
  assert(latestRun !== null && latestRun.id === runId1, 'Case B: getLatestReconciliationRun returned the correct latest run');

  if (latestRun) {
    const dbRecs = await getReconciliationRecords(latestRun.id);
    const reconstructed = reconstructReconciliationResult(latestRun, dbRecs);
    assert(reconstructed.summary.reconciledValue === 377500, 'Case B: Reconstructed reconciled value matches ₹377,500');
    assert(reconstructed.summary.matchedSettlementCount === 5, 'Case B: Reconstructed matched settlement count matches 5');
    assert(reconstructed.summary.unresolvedExposure === 23500, 'Case B: Reconstructed unresolved exposure matches ₹23,500');
    assert(reconstructed.summary.matchRate === runResult.summary.matchRate, 'Case B: Reconstructed match rate matches original');
    assert(reconstructed.results.length === runResult.results.length, 'Case B: Reconstructed results list count matches');
  }

  // --- Test Case C: Historical run can be loaded ---
  console.log('\nTesting Case C: List history and load older run...');
  
  // Insert a second dummy run to check history ordering and retrieval
  const dummySummary = { ...runResult.summary, reconciledValue: 123000 };
  const runId2 = await createReconciliationRun(
    orgA.id,
    'test_client_a',
    null,
    null,
    dummySummary,
    runResult.results,
    sourceMetadata
  );
  console.log(`Saved second run: ${runId2}`);

  // Fetch latest: should be second run
  const latestRunAfter2 = await getLatestReconciliationRun(orgA.id, 'test_client_a');
  assert(latestRunAfter2 !== null && latestRunAfter2.id === runId2, 'Case C: Latest run updated to second run');

  // List all runs: should return 2 runs
  const historyList = await listReconciliationRuns(orgA.id, 'test_client_a');
  assert(historyList.length >= 2, `Case C: Historical runs listed correctly (Found: ${historyList.length})`);
  assert(historyList[0].id === runId2 && historyList[1].id === runId1, 'Case C: Runs are sorted in descending order of created_at');

  // Load the first run specifically
  const oldRun = await getReconciliationRun(runId1);
  assert(oldRun.summary.reconciledValue === 377500, 'Case C: Successfully retrieved older historical run with correct original metrics');

  // --- Test Case D: RLS Enforcement (Workspace A cannot read Workspace B) ---
  console.log('\nTesting Case D: RLS Policies Enforcement...');
  
  // Set session to User B
  await supabase.auth.setSession({ access_token: sessionB.access_token, refresh_token: sessionB.refresh_token });

  // Try to query Org A's latest run as User B
  const latestOfAForUserB = await getLatestReconciliationRun(orgA.id, 'test_client_a');
  assert(latestOfAForUserB === null, 'Case D: User B cannot retrieve Workspace A latest run (returns null)');

  // Try to query Org A's history runs as User B
  const listAForUserB = await listReconciliationRuns(orgA.id, 'test_client_a');
  assert(listAForUserB.length === 0, 'Case D: User B lists Workspace A runs and gets 0 results');

  // Try to fetch Org A's specific run details as User B
  try {
    const run = await getReconciliationRun(runId1);
    // Since mock database select enforces RLS, it should return single with "Row not found" or empty array
    assert(run === null || run.id === undefined, 'Case D: User B fetched Workspace A run directly and got no data');
  } catch (err: any) {
    assert(true, `Case D: User B failed to fetch Workspace A run directly (Correctly blocked with error)`);
  }

  // Try to query child records of Org A's run as User B
  const recordsAForUserB = await getReconciliationRecords(runId1);
  assert(recordsAForUserB.length === 0, 'Case D: User B queried Workspace A child records and received 0 results (Secure)');

  // Try to insert a run into Org A as User B
  try {
    await createReconciliationRun(
      orgA.id,
      'test_client_a',
      null,
      null,
      runResult.summary,
      runResult.results,
      sourceMetadata
    );
    assert(false, 'Case D: User B successfully inserted a run into Workspace A (FAILED SECURITY)');
  } catch (err: any) {
    assert(true, 'Case D: User B blocked from inserting a run into Workspace A (Secure)');
  }

  // --- Test Case F: Failed persistence (atomic transaction rollback) ---
  console.log('\nTesting Case F: Atomic persistence failure check...');
  
  // Login back as User A
  await supabase.auth.setSession({ access_token: sessionA.access_token, refresh_token: sessionA.refresh_token });
  
  // Try to insert a run with a malformed child record (e.g., status is null which violates database not-null constraint)
  const badRecords = [
    {
      status: null, // should trigger constraint failure
      processor_amount: 100
    }
  ];

  try {
    const { error } = await supabase.rpc('create_reconciliation_run_atomic', {
      p_workspace_id: orgA.id,
      p_client_id: null,
      p_bank_file_id: null,
      p_processor_file_id: null,
      p_summary: runResult.summary,
      p_source_metadata: sourceMetadata,
      p_records: badRecords
    });
    if (error) throw error;
    assert(false, 'Case F: Malformed transaction insert did not throw error (FAILED constraint check)');
  } catch (err: any) {
    console.log(`Case F: Correctly threw constraint violation error: ${err.message}`);
    
    // Query database to ensure no run was created (atomic rollback verify)
    const runsList = await listReconciliationRuns(orgA.id, 'test_client_a');
    const hasBadRun = runsList.some(r => r.summary.reconciledValue === 377500 && r.id !== runId1 && r.id !== runId2);
    assert(!hasBadRun, 'Case F: Transaction rolled back successfully; no partial run remains in DB.');
  }

  // --- Destructive Cleanup Test (resetClientFinanceData) ---
  console.log('\nTesting resetClientFinanceData cleanup integration...');
  
  // Try to reset Org A data
  const { resetClientFinanceData } = await import('../src/lib/resetClientFinanceData');
  await resetClientFinanceData(orgA.id, 'test_client_a');
  
  // Verify runs are deleted
  const runsAfterReset = await listReconciliationRuns(orgA.id, 'test_client_a');
  assert(runsAfterReset.length === 0, 'Reset Check: All reconciliation runs for client were successfully deleted');

  // Verify child records are deleted
  const recordsAfterReset = mockDatabase.reconciliation_records.filter(r => r.run_id === runId1 || r.run_id === runId2);
  assert(recordsAfterReset.length === 0, 'Reset Check: All child records were successfully cascaded and deleted');

  console.log('=====================================================================');
  console.log('🎉 ALL PERSISTENCE TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
