#!/usr/bin/env node
/**
 * Kaeo Debug Script: Transaction Normalization Validator
 *
 * Connects to Supabase (reads .env), fetches all transactions for the first
 * active client, and prints a comprehensive normalization health report.
 *
 * Usage:
 *   node scripts/debug-transaction-normalization.cjs
 *
 * Acceptance criteria:
 *   - negative revenue rows count = 0
 *   - or any remaining are explicitly categorized as reversal/adjustment
 *     and NOT included as normal revenue
 */

const path = require('path');
const fs = require('fs');

// ── Load .env ────────────────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  console.error('❌  .env file not found at', envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
});

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
  process.exit(1);
}

// ── Supabase REST helper ─────────────────────────────────────────────────────
async function supaFetch(table, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${params}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    }
  });
  if (!res.ok) throw new Error(`Supabase error [${res.status}]: ${await res.text()}`);
  return res.json();
}

// ── Revenue-side categories ──────────────────────────────────────────────────
const REVENUE_CATEGORIES = new Set([
  'Customer Payment / Revenue',
  'Revenue / Sales',
  'Unknown Income',
  'Interest Income',
  'Capital / Owner Infusion',
  'Loan Received'
]);

const REFUND_CATEGORIES = new Set([
  'Refunds / Recoveries',
  'Transfer In',
  'Transfer Out'
]);

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔍  Kaeo Transaction Normalization Debugger');
  console.log('═'.repeat(60));

  // 1. Get first client
  const clients = await supaFetch('clients', '?limit=1&select=id,name');
  if (!clients || clients.length === 0) {
    console.error('❌  No clients found. Please create a client first.');
    process.exit(1);
  }
  const client = clients[0];
  console.log(`\n📊  Client: ${client.name} (${client.id})\n`);

  // 2. Fetch all transactions (excluding metadata rows by filtering on amount != 0)
  const allTxs = await supaFetch(
    'transactions',
    `?client_id=eq.${client.id}&select=id,description,amount,amount_in_base_currency,type,category,review_status,counterparty_name,raw_row_json&limit=5000`
  );

  if (!allTxs || allTxs.length === 0) {
    console.log('⚠️   No transactions found for this client.');
    process.exit(0);
  }

  // 3. Filter metadata rows (description that is header/summary)
  const METADATA_PATTERNS = [
    'opening balance', 'closing balance', 'total credit', 'total debit',
    'page total', 'statement summary', 'balance brought forward', 'subtotal',
    'totals', 'total', 'brought forward'
  ];
  const txs = allTxs.filter(tx => {
    if (!tx.description) return false;
    const d = tx.description.toLowerCase().trim();
    if (!d) return false;
    return !METADATA_PATTERNS.some(p => d === p || d.startsWith(p));
  });

  // 4. Gather stats
  let inflowCount = 0, inflowTotal = 0;
  let outflowCount = 0, outflowTotal = 0;
  let refundCount = 0, refundTotal = 0;
  let transferCount = 0, transferTotal = 0;
  let unknownCount = 0;
  let bankChargeCount = 0;

  // KEY METRICS
  let negativeRevenueRows = [];           // income type but amount < 0
  let directionCategoryConflicts = [];    // outflow direction but income category
  const uncategorizedNarrations = {};     // narration → count for Uncategorized

  txs.forEach(tx => {
    const amtVal = tx.amount_in_base_currency !== null && tx.amount_in_base_currency !== undefined
      ? Number(tx.amount_in_base_currency)
      : Number(tx.amount);
    const abs = Math.abs(amtVal);
    const type = tx.type || 'unknown';
    const category = tx.category || '';
    const dirDerived = tx.raw_row_json?.direction_derived;

    // Count by type
    if (type === 'income') {
      inflowCount++;
      inflowTotal += abs;
    } else if (['expense', 'vendor_payment', 'subscription', 'bank_charge'].includes(type)) {
      outflowCount++;
      outflowTotal += abs;
    } else if (type === 'refund') {
      refundCount++;
      refundTotal += abs;
    } else if (type === 'transfer') {
      transferCount++;
      transferTotal += abs;
    } else if (type === 'bank_charge') {
      bankChargeCount++;
      outflowCount++;
      outflowTotal += abs;
    } else {
      unknownCount++;
    }

    // NEGATIVE REVENUE CHECK
    // A row is "negative revenue" if it has type=income but signed amount is negative
    if (type === 'income' && amtVal < 0) {
      negativeRevenueRows.push({
        desc: tx.description?.substring(0, 60),
        amount: amtVal,
        category,
        dirDerived
      });
    }

    // DIRECTION/CATEGORY CONFLICT CHECK
    // A conflict is when direction=outflow but category is a revenue category
    const effectiveDir = dirDerived || (amtVal < 0 ? 'outflow' : amtVal > 0 ? 'inflow' : 'unknown');
    if (effectiveDir === 'outflow' && REVENUE_CATEGORIES.has(category)) {
      directionCategoryConflicts.push({
        desc: tx.description?.substring(0, 60),
        amount: amtVal,
        category,
        type,
        dirDerived
      });
    }

    // UNCATEGORIZED NARRATIONS
    if (!category || category === 'Uncategorized' || category === 'Uncategorized Expense' || category === 'Unknown') {
      const key = tx.description?.substring(0, 40) || '(empty)';
      uncategorizedNarrations[key] = (uncategorizedNarrations[key] || 0) + 1;
    }
  });

  // 5. Format INR helper
  const fmtINR = (n) => `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // 6. Print report
  console.log('─'.repeat(60));
  console.log('📈  TRANSACTION COUNTS & TOTALS');
  console.log('─'.repeat(60));
  console.log(`  Total transactions (after metadata filter):  ${txs.length}`);
  console.log(`  Raw fetched from DB:                         ${allTxs.length}`);
  console.log('');
  console.log(`  INFLOW   (income):     ${String(inflowCount).padStart(5)} rows   ${fmtINR(inflowTotal)}`);
  console.log(`  OUTFLOW  (expense):    ${String(outflowCount).padStart(5)} rows   ${fmtINR(outflowTotal)}`);
  console.log(`  REFUND   (refund):     ${String(refundCount).padStart(5)} rows   ${fmtINR(refundTotal)}`);
  console.log(`  TRANSFER (transfer):   ${String(transferCount).padStart(5)} rows   ${fmtINR(transferTotal)}`);
  console.log(`  UNKNOWN  (unknown):    ${String(unknownCount).padStart(5)} rows`);
  console.log('');

  // Net cash
  const netCash = inflowTotal + refundTotal - outflowTotal;
  console.log(`  Net Cash (inflows + refunds - outflows):     ${netCash >= 0 ? '+' : ''}${fmtINR(netCash)}`);

  console.log('\n' + '─'.repeat(60));
  console.log('🚨  NEGATIVE REVENUE ROWS (MUST BE ZERO)');
  console.log('─'.repeat(60));
  if (negativeRevenueRows.length === 0) {
    console.log('  ✅  PASS — 0 negative revenue rows');
  } else {
    console.log(`  ❌  FAIL — ${negativeRevenueRows.length} rows have type=income but negative amount:`);
    negativeRevenueRows.slice(0, 20).forEach(r => {
      console.log(`       ${r.amount.toFixed(2).padStart(12)}  dir=${r.dirDerived || 'n/a'}  cat=${r.category}  "${r.desc}"`);
    });
    if (negativeRevenueRows.length > 20) {
      console.log(`       ... and ${negativeRevenueRows.length - 20} more`);
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log('⚠️   DIRECTION / CATEGORY CONFLICTS');
  console.log('─'.repeat(60));
  if (directionCategoryConflicts.length === 0) {
    console.log('  ✅  PASS — No outflow rows classified as Revenue/Income');
  } else {
    console.log(`  ❌  ${directionCategoryConflicts.length} outflow rows with revenue category:`);
    directionCategoryConflicts.slice(0, 15).forEach(r => {
      console.log(`       ${String(r.amount).padStart(12)}  type=${r.type}  cat=${r.category}  "${r.desc}"`);
    });
    if (directionCategoryConflicts.length > 15) {
      console.log(`       ... and ${directionCategoryConflicts.length - 15} more`);
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log('📦  TOP UNCATEGORIZED NARRATIONS');
  console.log('─'.repeat(60));
  const topUncategorized = Object.entries(uncategorizedNarrations)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  if (topUncategorized.length === 0) {
    console.log('  ✅  No uncategorized transactions!');
  } else {
    topUncategorized.forEach(([narration, count]) => {
      console.log(`  ${String(count).padStart(4)}x  "${narration}"`);
    });
    const totalUncategorized = Object.values(uncategorizedNarrations).reduce((a, b) => a + b, 0);
    console.log(`\n  Total uncategorized: ${totalUncategorized} rows (${((totalUncategorized / txs.length) * 100).toFixed(1)}%)`);
  }

  console.log('\n' + '─'.repeat(60));
  console.log('🎯  ACCEPTANCE SUMMARY');
  console.log('─'.repeat(60));
  const pass = negativeRevenueRows.length === 0;
  console.log(`  Negative revenue rows:  ${negativeRevenueRows.length === 0 ? '✅ PASS (0)' : `❌ FAIL (${negativeRevenueRows.length})`}`);
  console.log(`  Direction conflicts:    ${directionCategoryConflicts.length === 0 ? '✅ PASS (0)' : `⚠️  (${directionCategoryConflicts.length})`}`);
  console.log(`  Unknown count:          ${unknownCount <= Math.ceil(txs.length * 0.1) ? '✅ PASS' : '⚠️  REVIEW'} (${unknownCount})`);
  console.log('');
  console.log(pass ? '🟢  OVERALL: PASS' : '🔴  OVERALL: FAIL — Fix negative revenue rows before committing.');
  console.log('═'.repeat(60));
  console.log('');

  process.exit(pass ? 0 : 1);
}

main().catch(err => {
  console.error('💥  Fatal error:', err.message);
  process.exit(1);
});
