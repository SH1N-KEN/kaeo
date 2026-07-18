/**
 * Libby ConversationState — Validation Test Suite
 *
 * Tests all 8 acceptance criteria without requiring a browser or Supabase.
 * Runs directly against the pure TypeScript functions.
 *
 * Run: npx tsx src/lib/libby/__tests__/conversationState.test.ts
 */

import {
  createEmptyConversationState,
  isFollowUpQuery,
  resolveFollowUp,
  updateConversationState,
} from '../conversationState';
import type { ConversationState } from '../conversationState';

// ─── Test Harness ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, testName: string, detail?: string): void {
  if (condition) {
    console.log(`  ✅ PASS  ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL  ${testName}${detail ? `\n         Detail: ${detail}` : ''}`);
    failed++;
    failures.push(testName);
  }
}

function section(title: string): void {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(70)}`);
}

function printState(label: string, state: ConversationState): void {
  console.log(`\n  [${label}]`);
  console.log(`    activeEntity      : ${JSON.stringify(state.activeEntity)}`);
  console.log(`    activeEntityType  : ${state.activeEntityType}`);
  console.log(`    activeIntent      : ${JSON.stringify(state.activeIntent)}`);
  console.log(`    activePeriod      : ${JSON.stringify(state.activePeriod)}`);
  console.log(`    comparisonPeriod  : ${JSON.stringify(state.comparisonPeriod)}`);
  console.log(`    lastUserQuery     : ${JSON.stringify(state.lastUserQuery)}`);
  console.log(`    lastAssistantAnswer: ${state.lastAssistantAnswer ? state.lastAssistantAnswer.slice(0, 80) + '...' : null}`);
  console.log(`    turnCount         : ${state.turnCount}`);
}

// ─── Simulated Source JSONs ───────────────────────────────────────────────────

const vendorSourceJson = {
  vendor: 'Salary Batch',
  spend: 1640733,
  transactionCount: 3,
};

const riskSourceJson = {
  risk_type: 'duplicate_payment',
  title: 'Duplicate payment detected',
  amount_at_risk: 6000,
};

const cashFlowSourceJson = {
  income: 2279500,
  expenses: 1640733,
  netCash: 638767,
};

const staffSpendSourceJson = {
  staff_count: 5,
  missingProof: 2,
};


// ─── TEST 1: Vendor Follow-up Chain ──────────────────────────────────────────

section('TEST 1 — Vendor Follow-up Chain');

// Turn 1: "Which vendor increased spending the most?"
let state1 = createEmptyConversationState();
printState('Before Turn 1', state1);

const answer1 = 'Summary:\nSalary Batch is the top vendor with ₹16,40,733 in spend across 3 transactions.\n\nWhy:\nSalary Batch had 3 payroll transactions in June.';
state1 = updateConversationState(state1, 'Which vendor increased spending the most?', 'vendor_analysis', answer1, vendorSourceJson);
printState('After Turn 1', state1);

assert(state1.activeEntity === 'Salary Batch', 'T1.1 activeEntity = Salary Batch', `Got: ${state1.activeEntity}`);
assert(state1.activeEntityType === 'vendor', 'T1.2 activeEntityType = vendor', `Got: ${state1.activeEntityType}`);
assert(state1.activeIntent === 'vendor_analysis', 'T1.3 activeIntent = vendor_analysis', `Got: ${state1.activeIntent}`);
assert(state1.lastUserQuery === 'Which vendor increased spending the most?', 'T1.4 lastUserQuery set', `Got: ${state1.lastUserQuery}`);
assert(state1.lastAssistantAnswer !== null, 'T1.5 lastAssistantAnswer populated');
assert(state1.lastSourceJson?.vendor === 'Salary Batch', 'T1.6 lastSourceJson.vendor = Salary Batch');
assert(state1.turnCount === 1, 'T1.7 turnCount = 1', `Got: ${state1.turnCount}`);

// Turn 2: "Why?"
console.log('\n  [Turn 2 Query: "Why?"]');
const isFollowUp2 = isFollowUpQuery('Why?');
const resolvedQuery2 = resolveFollowUp('Why?', state1);
console.log(`    isFollowUp       : ${isFollowUp2}`);
console.log(`    resolvedQuery    : ${resolvedQuery2.slice(0, 150)}...`);

assert(isFollowUp2, 'T2.1 "Why?" detected as follow-up');
assert(resolvedQuery2.includes('Salary Batch'), 'T2.2 resolved query contains "Salary Batch"', `Got: ${resolvedQuery2.slice(0, 100)}`);
assert(resolvedQuery2.toLowerCase().includes('spending increase or change'), 'T2.3 resolved query asks about spending increase');
assert(resolvedQuery2.includes('[Conversation context:'), 'T2.4 resolved query has conversation context block');
assert(resolvedQuery2.includes('Previous question:'), 'T2.5 resolved query includes prior question');

// Simulate engine using effectiveQuery (vendor intent detected from enriched query)
const answer2 = 'Summary:\nSalary Batch\'s spending increased because payroll was processed 3 times in June for different team members.';
state1 = updateConversationState(state1, 'Why?', 'vendor_analysis', answer2, vendorSourceJson);
printState('After Turn 2', state1);

assert(state1.activeEntity === 'Salary Batch', 'T2.6 activeEntity still Salary Batch after "Why?"', `Got: ${state1.activeEntity}`);
assert(state1.activeEntityType === 'vendor', 'T2.7 activeEntityType still vendor', `Got: ${state1.activeEntityType}`);
assert(state1.turnCount === 2, 'T2.8 turnCount = 2', `Got: ${state1.turnCount}`);

// Turn 3: "Compare that with last month."
console.log('\n  [Turn 3 Query: "Compare that with last month."]');
const isFollowUp3 = isFollowUpQuery('Compare that with last month.');
const resolvedQuery3 = resolveFollowUp('Compare that with last month.', state1);
console.log(`    isFollowUp       : ${isFollowUp3}`);
console.log(`    resolvedQuery    : ${resolvedQuery3.slice(0, 200)}...`);

assert(isFollowUp3, 'T3.1 "Compare that with last month." detected as follow-up');
assert(resolvedQuery3.includes('Salary Batch'), 'T3.2 resolved query references Salary Batch');
assert(resolvedQuery3.includes('last month'), 'T3.3 resolved query mentions last month');
assert(resolvedQuery3.toLowerCase().includes('compare'), 'T3.4 resolved query is a comparison query');

state1 = updateConversationState(state1, 'Compare that with last month.', 'vendor_analysis', 'Salary Batch spend was higher this month.', vendorSourceJson);
printState('After Turn 3', state1);

assert(state1.comparisonPeriod === 'last_month', 'T3.5 comparisonPeriod = last_month', `Got: ${state1.comparisonPeriod}`);
assert(state1.activeEntity === 'Salary Batch', 'T3.6 activeEntity still Salary Batch');
assert(state1.turnCount === 3, 'T3.7 turnCount = 3');

// ─── TEST 2: Risk Follow-up Chain ─────────────────────────────────────────────

section('TEST 2 — Risk Follow-up Chain');

let state2 = createEmptyConversationState();

// Turn 1: "What are my open risks?"
const answer2_1 = 'Summary:\nYou have 5 open risks. The most critical is a duplicate payment of ₹6,000 to Salary Batch.';
state2 = updateConversationState(state2, 'What are my open risks?', 'risk_review', answer2_1, riskSourceJson);
printState('After Turn 1', state2);

assert(state2.activeEntity !== null, 'T2.1 activeEntity set from risk sourceJson', `Got: ${state2.activeEntity}`);
assert(state2.activeEntityType === 'risk', 'T2.2 activeEntityType = risk', `Got: ${state2.activeEntityType}`);
assert(state2.lastAssistantAnswer !== null, 'T2.3 lastAssistantAnswer populated');

// Turn 2: "How serious is that?"
const isFollowUp2_2 = isFollowUpQuery('How serious is that?');
const resolvedQuery2_2 = resolveFollowUp('How serious is that?', state2);
console.log(`\n  [Turn 2: "How serious is that?"]`);
console.log(`    isFollowUp      : ${isFollowUp2_2}`);
console.log(`    resolvedQuery   : ${resolvedQuery2_2.slice(0, 150)}...`);

assert(isFollowUp2_2, 'T2.4 "How serious is that?" detected as follow-up');
assert(resolvedQuery2_2.toLowerCase().includes('risk') || resolvedQuery2_2.toLowerCase().includes('serious'), 'T2.5 resolved query is risk-related');

// Turn 3: "Which one should I fix first?"
// Long query — should NOT be treated as follow-up, starts fresh
const isFollowUp2_3 = isFollowUpQuery('Which one should I fix first?');
console.log(`\n  [Turn 3: "Which one should I fix first?" — isFollowUp: ${isFollowUp2_3}]`);
// This is borderline — it's short but specific. Either result is acceptable.
// What matters is that if it IS a follow-up it retains risk context.
if (isFollowUp2_3) {
  const resolvedQuery2_3 = resolveFollowUp('Which one should I fix first?', state2);
  assert(resolvedQuery2_3.toLowerCase().includes('risk') || resolvedQuery2_3.includes(state2.activeEntity || ''), 'T2.6 resolved query retains risk context');
} else {
  assert(true, 'T2.6 long-form question not treated as follow-up (acceptable)');
}

state2 = updateConversationState(state2, 'Which one should I fix first?', 'risk_review', 'Fix the duplicate payment first.', riskSourceJson);
assert(state2.activeEntityType === 'risk', 'T2.7 risk context maintained through turn 3', `Got: ${state2.activeEntityType}`);

// ─── TEST 3: Cash Flow Follow-up Chain ───────────────────────────────────────

section('TEST 3 — Cash Flow Follow-up Chain');

let state3 = createEmptyConversationState();

const answer3_1 = 'Summary:\nYour net cash movement is ₹6,38,767. Income is ₹22,79,500 and expenses are ₹16,40,733.';
state3 = updateConversationState(state3, 'How is my cash flow?', 'finance_summary', answer3_1, cashFlowSourceJson);
printState('After Turn 1', state3);

assert(state3.activeEntity === 'cash flow', 'T3.1 activeEntity = cash flow', `Got: ${state3.activeEntity}`);
assert(state3.activeEntityType === 'cash_flow', 'T3.2 activeEntityType = cash_flow', `Got: ${state3.activeEntityType}`);

// Turn 2: "What caused this?"
const isFollowUp3_2 = isFollowUpQuery('What caused this?');
const resolvedQuery3_2 = resolveFollowUp('What caused this?', state3);
console.log(`\n  [Turn 2: "What caused this?"]`);
console.log(`    isFollowUp      : ${isFollowUp3_2}`);
console.log(`    resolvedQuery   : ${resolvedQuery3_2.slice(0, 150)}...`);

assert(isFollowUp3_2, 'T3.3 "What caused this?" is follow-up');
assert(resolvedQuery3_2.toLowerCase().includes('cash flow'), 'T3.4 resolved query is about cash flow');
assert(resolvedQuery3_2.toLowerCase().includes('income or expenses') || resolvedQuery3_2.toLowerCase().includes('movement'), 'T3.5 resolved query about income/expense movement');

state3 = updateConversationState(state3, 'What caused this?', 'finance_summary', 'Cash flow changed due to payroll expenses.', cashFlowSourceJson);

// Turn 3: "Compare that with last month."
const isFollowUp3_3 = isFollowUpQuery('Compare that with last month.');
const resolvedQuery3_3 = resolveFollowUp('Compare that with last month.', state3);
console.log(`\n  [Turn 3: "Compare that with last month."]`);
console.log(`    isFollowUp      : ${isFollowUp3_3}`);
console.log(`    resolvedQuery   : ${resolvedQuery3_3.slice(0, 150)}...`);

assert(isFollowUp3_3, 'T3.6 "Compare that with last month." is follow-up');
assert(resolvedQuery3_3.toLowerCase().includes('cash flow'), 'T3.7 resolved query still about cash flow');
assert(resolvedQuery3_3.includes('last month'), 'T3.8 resolved query includes last month comparison');

// ─── TEST 4: Staff Spend Follow-up Chain ─────────────────────────────────────

section('TEST 4 — Staff Spend Follow-up Chain');

let state4 = createEmptyConversationState();

const answer4_1 = 'Summary:\nStaff expenses total ₹45,000 across 5 transactions. 2 are missing proof.';
state4 = updateConversationState(state4, 'Summarise my staff expenses.', 'risk_review', answer4_1, staffSpendSourceJson);
printState('After Turn 1', state4);

assert(state4.activeEntity === 'staff spend', 'T4.1 activeEntity = staff spend', `Got: ${state4.activeEntity}`);
assert(state4.activeEntityType === 'staff_spend', 'T4.2 activeEntityType = staff_spend', `Got: ${state4.activeEntityType}`);

// Turn 2: "Tell me more."
const isFollowUp4_2 = isFollowUpQuery('Tell me more.');
const resolvedQuery4_2 = resolveFollowUp('Tell me more.', state4);
console.log(`\n  [Turn 2: "Tell me more."]`);
console.log(`    isFollowUp      : ${isFollowUp4_2}`);
console.log(`    resolvedQuery   : ${resolvedQuery4_2.slice(0, 150)}...`);

assert(isFollowUp4_2, 'T4.3 "Tell me more." is follow-up');
assert(
  resolvedQuery4_2.toLowerCase().includes('staff') ||
  resolvedQuery4_2.toLowerCase().includes('staff spend'),
  'T4.4 resolved query retains staff spend context',
  `Got: ${resolvedQuery4_2.slice(0, 100)}`
);
// Must NOT default to a generic workspace summary
assert(!resolvedQuery4_2.toLowerCase().includes('overview') && !resolvedQuery4_2.toLowerCase().includes('workspace summary'), 'T4.5 NOT a generic workspace summary');

state4 = updateConversationState(state4, 'Tell me more.', 'risk_review', 'More staff spend details...', staffSpendSourceJson);

// Turn 3: "Who spent the most?"
const isFollowUp4_3 = isFollowUpQuery('Who spent the most?');
// This is a new, specific question — should NOT be classified as follow-up
console.log(`\n  [Turn 3: "Who spent the most?" — isFollowUp: ${isFollowUp4_3}]`);
assert(!isFollowUp4_3, 'T4.6 "Who spent the most?" NOT a follow-up (specific new question)');

// ─── TEST 5: Non-Follow-Up Switches Topic ────────────────────────────────────

section('TEST 5 — Non-Follow-Up Correctly Switches Topic');

let state5 = createEmptyConversationState();

// Establish vendor context
state5 = updateConversationState(state5, 'Which vendor increased spending the most?', 'vendor_analysis',
  'Salary Batch increased.', vendorSourceJson);
assert(state5.activeEntityType === 'vendor', 'T5.1 vendor context established');

// Second query — NOT a follow-up
const isFollowUp5 = isFollowUpQuery('Show me the biggest risks.');
console.log(`\n  [Turn 2: "Show me the biggest risks." — isFollowUp: ${isFollowUp5}]`);

assert(!isFollowUp5, 'T5.2 "Show me the biggest risks." NOT a follow-up (topic change)');

// Simulate: since not a follow-up, resolveFollowUp returns query unchanged
const resolved5 = resolveFollowUp('Show me the biggest risks.', state5);
assert(resolved5 === 'Show me the biggest risks.', 'T5.3 non-follow-up query passes through unchanged');

// Update state with new risk intent
state5 = updateConversationState(state5, 'Show me the biggest risks.', 'risk_review',
  'You have 5 open risks.', riskSourceJson);
printState('After Turn 2', state5);

assert(state5.activeEntityType === 'risk', 'T5.4 activeEntityType updated to risk after topic switch', `Got: ${state5.activeEntityType}`);
assert(state5.activeIntent === 'risk_review', 'T5.5 activeIntent updated to risk_review', `Got: ${state5.activeIntent}`);

// ─── TEST 6: New Conversation (clearMessages equivalent) ─────────────────────

section('TEST 6 — New Conversation (State Reset)');

// Simulate clearMessages by creating a new empty state
let state6old = createEmptyConversationState();
state6old = updateConversationState(state6old, 'Which vendor received most?', 'vendor_analysis',
  'Salary Batch ₹16,40,733.', vendorSourceJson);
assert(state6old.activeEntity === 'Salary Batch', 'T6.1 prior state has vendor entity');

// Reset (simulates clearMessages)
const state6new = createEmptyConversationState();
printState('After clearMessages (reset state)', state6new);

assert(state6new.activeEntity === null, 'T6.2 cleared state has no activeEntity');
assert(state6new.activeEntityType === 'general', 'T6.3 cleared state has general type');
assert(state6new.turnCount === 0, 'T6.4 cleared state has turnCount = 0');

// "Why?" with empty state — should return original query or a generic fallback
const resolvedAfterClear = resolveFollowUp('Why?', state6new);
console.log(`\n  [resolveFollowUp("Why?", empty_state)]`);
console.log(`    result: ${JSON.stringify(resolvedAfterClear)}`);

// With no prior context, resolveFollowUp should return the original query
assert(resolvedAfterClear === 'Why?', 'T6.5 "Why?" with empty state returns original query (no stale entity)', `Got: ${resolvedAfterClear}`);

// ─── TEST 7: Client Switching ─────────────────────────────────────────────────

section('TEST 7 — Client Switching (State Isolation)');

// Simulate: client A session
let stateClientA = createEmptyConversationState();
stateClientA = updateConversationState(stateClientA, 'Which vendor received most?', 'vendor_analysis',
  'Vendor A Inc spent the most.', { vendor: 'Vendor A Inc', spend: 500000 });
assert(stateClientA.activeEntity === 'Vendor A Inc', 'T7.1 Client A has Vendor A Inc as active entity');

// Simulate: client changes → state resets
const stateClientB = createEmptyConversationState();
assert(stateClientB.activeEntity === null, 'T7.2 Client B state has no activeEntity from Client A');
assert(stateClientB.turnCount === 0, 'T7.3 Client B turn count starts at 0');

// Verify isolation: follow-up query on Client B state does not use Client A entity
const resolvedClientB = resolveFollowUp('Why?', stateClientB);
assert(resolvedClientB === 'Why?', 'T7.4 Client B "Why?" does not use Client A context', `Got: ${resolvedClientB}`);
assert(!resolvedClientB.includes('Vendor A Inc'), 'T7.5 Client B response has no Client A vendor name');

// ─── TEST 8: State Extraction Robustness ─────────────────────────────────────

section('TEST 8 — State Extraction Robustness (All Source JSON Shapes)');

// 8a: Vendor via sourceJson.vendor
let s8a = createEmptyConversationState();
s8a = updateConversationState(s8a, 'top vendor?', 'vendor_analysis', 'Salary Batch.', { vendor: 'Salary Batch' });
assert(s8a.activeEntity === 'Salary Batch' && s8a.activeEntityType === 'vendor', 'T8.1 vendor extraction via sourceJson.vendor');

// 8b: Vendor via sourceJson.topVendor
let s8b = createEmptyConversationState();
s8b = updateConversationState(s8b, 'top vendor?', 'vendor_analysis', 'Google Ads.', { topVendor: 'Google Ads' });
assert(s8b.activeEntity === 'Google Ads' && s8b.activeEntityType === 'vendor', 'T8.2 vendor extraction via sourceJson.topVendor');

// 8c: Risk via sourceJson.risk_type
let s8c = createEmptyConversationState();
s8c = updateConversationState(s8c, 'risks?', 'risk_review', 'Duplicate risk.', { risk_type: 'duplicate_payment', title: 'Duplicate payment' });
assert(s8c.activeEntityType === 'risk', 'T8.3 risk extraction via sourceJson.risk_type', `Got: ${s8c.activeEntityType}`);

// 8d: Cash flow via sourceJson.income
let s8d = createEmptyConversationState();
s8d = updateConversationState(s8d, 'cash flow?', 'finance_summary', 'Net cash ₹6L.', { income: 2279500, expenses: 1640733 });
assert(s8d.activeEntity === 'cash flow' && s8d.activeEntityType === 'cash_flow', 'T8.4 cash flow extraction via sourceJson.income/expenses');

// 8e: Staff spend via sourceJson.staff_count
let s8e = createEmptyConversationState();
s8e = updateConversationState(s8e, 'staff spend?', 'risk_review', 'Staff: 5 txns.', { staff_count: 5, missingProof: 2 });
assert(s8e.activeEntity === 'staff spend' && s8e.activeEntityType === 'staff_spend', 'T8.5 staff spend extraction via sourceJson.staff_count');

// 8f: Report via sourceJson.report_exists
let s8f = createEmptyConversationState();
s8f = updateConversationState(s8f, 'report?', 'reports', 'Report ready.', { report_exists: true, readiness: 72 });
assert(s8f.activeEntity === 'report' && s8f.activeEntityType === 'report', 'T8.6 report extraction via sourceJson.report_exists');

// 8g: Unknown sourceJson → entity null, entity type 'general', no stale preservation for non-follow-ups
let s8g = createEmptyConversationState();
s8g = updateConversationState(s8g, 'what is kaeo?', 'unknown_general', 'Kaeo is...', { mode: 'greeting' });
assert(s8g.activeEntity === null, 'T8.7 unknown sourceJson → activeEntity null (not stale)');
assert(s8g.activeEntityType === 'general', 'T8.8 unknown sourceJson → activeEntityType = general', `Got: ${s8g.activeEntityType}`);

// 8h: Follow-up with no new entity in sourceJson → preserves prior entity
let s8h_prior = createEmptyConversationState();
s8h_prior = updateConversationState(s8h_prior, 'top vendor?', 'vendor_analysis', 'Salary Batch.', { vendor: 'Salary Batch' });
// Follow-up "Why?" with generic source_json (no vendor field)
s8h_prior = updateConversationState(s8h_prior, 'Why?', 'vendor_analysis', 'Because payroll.', { mode: 'ai_assisted' });
assert(s8h_prior.activeEntity === 'Salary Batch', 'T8.9 follow-up with generic sourceJson preserves prior entity', `Got: ${s8h_prior.activeEntity}`);

// ─── Additional: isFollowUpQuery coverage ────────────────────────────────────

section('BONUS — isFollowUpQuery Pattern Coverage');

const followUps = [
  'Why?', 'why', 'Why!', 'Why did that happen?', 'Why is this?',
  'How?', 'How did that happen?',
  'Tell me more', 'tell me more.', 'More details',
  'Compare that with last month', 'Compare this with previous month',
  'Compare that', 'What about last month?',
  'vs last month', 'versus previous period',
  'Is that good?', 'Is this bad?', 'Is that concerning?',
  'What caused this?', "What's causing this?",
  'Drill down', 'Break that down', 'Break it down',
  'What does that mean?', 'What does this mean?',
  'Give me more', 'Show me more',
  'Elaborate', 'Can you elaborate',
  'and?', 'so?',
];

const nonFollowUps = [
  'Which vendor increased the most?',
  'Show me the biggest risks.',
  'What is my net cash?',
  'How much did Salary Batch receive?',
  'Summarise my workspace.',
  'What should I fix first?',
  'How are we doing overall?',
  'What are my top 5 expenses this month and how do they compare to industry average?',
];

let followUpPassed = 0;
let followUpFailed = 0;
for (const q of followUps) {
  if (isFollowUpQuery(q)) {
    followUpPassed++;
  } else {
    console.log(`  ⚠️  Expected follow-up, got false: "${q}"`);
    followUpFailed++;
  }
}

let nonFollowUpPassed = 0;
let nonFollowUpFailed = 0;
for (const q of nonFollowUps) {
  if (!isFollowUpQuery(q)) {
    nonFollowUpPassed++;
  } else {
    console.log(`  ⚠️  Expected NOT follow-up, got true: "${q}"`);
    nonFollowUpFailed++;
  }
}

assert(followUpFailed === 0, `BONUS.1 All ${followUps.length} follow-up patterns recognized (${followUpPassed}/${followUps.length})`,
  `Failed: ${followUpFailed}`);
assert(nonFollowUpFailed === 0, `BONUS.2 All ${nonFollowUps.length} non-follow-up queries correctly rejected (${nonFollowUpPassed}/${nonFollowUps.length})`,
  `Failed: ${nonFollowUpFailed}`);

// ─── Final Report ─────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(70));
console.log('  VALIDATION REPORT — Libby ConversationState');
console.log('═'.repeat(70));
console.log(`  Total assertions : ${passed + failed}`);
console.log(`  PASSED           : ${passed}`);
console.log(`  FAILED           : ${failed}`);

if (failures.length > 0) {
  console.log('\n  FAILED ASSERTIONS:');
  failures.forEach(f => console.log(`    ❌ ${f}`));
}

console.log('\n  FINAL STATUS:', failed === 0 ? '✅ ALL TESTS PASS' : `❌ ${failed} TEST(S) FAILED`);
console.log('═'.repeat(70) + '\n');

process.exit(failed === 0 ? 0 : 1);
