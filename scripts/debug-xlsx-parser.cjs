const XLSX = require('xlsx');
const fs = require('fs');

const filePath = process.argv[2] || 'test-data/ingestion/kaeo_final_ingestion_test.xlsx';
if (!fs.existsSync(filePath)) { console.error(`File not found: ${filePath}`); process.exit(1); }

const workbook = XLSX.readFile(filePath, { cellDates: true });
console.log(`\n=== XLSX DEBUG SCRIPT ===`);
console.log(`File: ${filePath}`);
console.log(`Sheets: ${workbook.SheetNames.join(', ')}`);

const DATE_KEYWORDS = ['date', 'txn date', 'txn_date', 'transaction date', 'value date', 'posted', 'tran date', 'val date'];
const DESC_KEYWORDS = ['description', 'narration', 'particulars', 'remarks', 'payee', 'vendor', 'details', 'particular'];
const AMT_KEYWORDS = ['amount', 'debit', 'credit', 'withdrawal', 'deposit', 'net amount', 'value', 'txn amount', 'balance'];

function detectHeaderRow(grid) {
  let bestRowIndex = 0, maxScore = 0;
  for (let i = 0; i < Math.min(30, grid.length); i++) {
    const row = grid[i];
    if (!row || !Array.isArray(row) || row.length === 0) continue;
    let hasDate = false, hasDesc = false, hasAmt = false, matchCount = 0;
    row.forEach(cell => {
      if (cell === null || cell === undefined) return;
      const strVal = cell.toString().toLowerCase().trim();
      if (!hasDate && DATE_KEYWORDS.some(k => strVal === k || strVal.includes(k))) { hasDate = true; matchCount++; }
      if (!hasDesc && DESC_KEYWORDS.some(k => strVal === k || strVal.includes(k))) { hasDesc = true; matchCount++; }
      if (!hasAmt && AMT_KEYWORDS.some(k => strVal === k || strVal.includes(k))) { hasAmt = true; matchCount++; }
    });
    let score = (hasDate ? 2 : 0) + (hasDesc ? 2 : 0) + (hasAmt ? 2 : 0) + (matchCount >= 3 ? 1 : 0);
    if (score > maxScore) { maxScore = score; bestRowIndex = i; }
  }
  if (maxScore < 4) bestRowIndex = 0;
  const rawHeaderRow = grid[bestRowIndex] || [];
  const headers = rawHeaderRow.map((cell, idx) => {
    if (cell === null || cell === undefined || cell.toString().trim() === '') return `Column_${String.fromCharCode(65 + (idx % 26))}${idx >= 26 ? Math.floor(idx / 26) : ''}`;
    return cell.toString().trim();
  });
  return { headerRowIndex: bestRowIndex, headers };
}

function suggestMappingFromColumns(headers) {
  const mapping = {};
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
  const findHeader = (keywords) => headers.find((_, i) => keywords.some(k => {
    const nh = normalizedHeaders[i];
    const words = headers[i].toLowerCase().split(/[^a-z0-9]+/);
    if (k === 'in' || k === 'out' || k === 'dr' || k === 'cr') return words.includes(k) || nh === k;
    return nh.includes(k);
  })) || '';
  
  mapping['transaction_date'] = findHeader(['date', 'txndate', 'posteddate', 'transactiondate']);
  mapping['description'] = findHeader(['description', 'narration', 'particulars', 'remarks', 'payee', 'vendor']);
  const debitCol = findHeader(['debit', 'withdrawal', 'outflow', 'out', 'payment', 'dr']);
  const creditCol = findHeader(['credit', 'deposit', 'inflow', 'in', 'receipt', 'cr']);
  if (debitCol && creditCol) {
    mapping['debit'] = debitCol;
    mapping['credit'] = creditCol;
  } else {
    mapping['amount'] = findHeader(['amount', 'value', 'transactionamount', 'total']);
  }
  return mapping;
}

const cleanAmount = (val) => {
  if (val === null || val === undefined) return { amount: 0, isExpense: false, isIncome: false };
  let str = String(val).trim();
  if (str === '') return { amount: 0, isExpense: false, isIncome: false };
  let isExpense = false, isIncome = false;
  if (str.startsWith('(') && str.endsWith(')')) { isExpense = true; str = str.slice(1, -1); }
  
  const lowerStr = str.toLowerCase();
  if (lowerStr.endsWith('dr') || lowerStr.endsWith(' db') || lowerStr.endsWith('debit')) {
    isExpense = true;
    str = str.replace(/(dr|db|debit)$/i, '').trim();
  } else if (lowerStr.endsWith('cr') || lowerStr.endsWith('credit')) {
    isIncome = true;
    str = str.replace(/(cr|credit)$/i, '').trim();
  }
  
  str = str.replace(/,/g, '').replace(/\s+/g, '');
  str = str.replace(/[^\d.-]/g, '');
  let amount = parseFloat(str);
  
  if (isNaN(amount)) return { amount: 0, isExpense: false, isIncome: false };
  if (isExpense) amount = -Math.abs(amount);
  else if (isIncome) amount = Math.abs(amount);
  return { amount, isExpense, isIncome };
};

// inferTransactionType from normalizationEngine.ts
function inferTransactionType(desc, amount, rawType) {
  const d = (desc || '').toLowerCase();
  const rType = (rawType || '').toLowerCase();
  const isCreditDirection = amount > 0 || ['credit', 'income', 'received', 'deposit', 'cr', 'amount cr', 'inflow'].some(k => rType === k || rType.includes(k));
  
  if (['failed', 'declined', 'rejected', 'cancelled', 'bounced'].some(k => d.includes(k))) return 'failed_payment';
  
  if (isCreditDirection && ['refund', 'refunded', 'reversal', 'cashback', 'reimbursement', 'recovery', 'returned', 'chargeback'].some(k => d.includes(k))) {
    return 'refund';
  }
  
  if (['credit', 'income', 'received', 'deposit', 'cr', 'amount cr', 'inflow'].some(k => rType === k || rType.includes(k))) return 'income';
  if (['debit', 'expense', 'paid', 'withdrawal', 'dr', 'amount dr', 'withdrawal dr', 'debit amount', 'outflow'].some(k => rType === k || rType.includes(k))) return 'expense';
  
  if (['client payment', 'customer payment', 'payment received', 'received from', 'received payment', 'sales', 'revenue', 'payout', 'settlement received', 'invoice paid by client', 'credit', 'deposit', 'inflow', 'received', 'cr', 'amount cr'].some(k => d.includes(k))) return 'income';
  if (['vendor payment', 'payment to', 'paid to'].some(k => d.includes(k))) return 'vendor_payment';
  if (['google ads', 'meta ads', 'facebook ads', 'salary', 'payroll', 'rent', 'office supplies', 'subscription', 'software', 'aws', 'cloud', 'bill', 'purchase', 'expense', 'debit', 'invoice', 'withdrawal', 'paid', 'payment', 'dr', 'amount dr', 'withdrawal dr', 'debit amount', 'outflow', 'charges', 'fee', 'rtgs debit', 'neft debit', 'upi payment', 'imps payment'].some(k => d.includes(k))) return 'expense';
  
  if (amount < 0) return 'expense';
  return 'unknown';
}

workbook.SheetNames.forEach(sheetName => {
  console.log(`\n--- Sheet: ${sheetName} ---`);
  const sheet = workbook.Sheets[sheetName];
  // use the frontend logic: { header: 1, defval: null }
  const rawGrid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  if (!rawGrid || rawGrid.length === 0) return;
  const { headerRowIndex, headers } = detectHeaderRow(rawGrid);
  const mapping = suggestMappingFromColumns(headers);

  let income = 0, expenses = 0, refunds = 0, txCount = 0, unknownCount = 0;

  const dataGrid = rawGrid.slice(headerRowIndex + 1);
  dataGrid.forEach((row, i) => {
    const obj = {};
    headers.forEach((h, idx) => obj[h] = row[idx]);

    // Skip messy rows (simplified filter)
    const hasValues = Object.values(obj).some(v => v !== null && v !== undefined && v.toString().trim() !== '');
    if (!hasValues) return;
    const isSummary = Object.values(obj).some(v => v && ['total', 'totals', 'opening balance', 'closing balance'].some(k => v.toString().toLowerCase().trim().startsWith(k)));
    if (isSummary) return;

    // Normalizer logic
    let amount = 0, explicitExpense = false, explicitIncome = false;
    let debitCol = mapping.debit, creditCol = mapping.credit;

    if (debitCol || creditCol) {
      let parsedDebit = 0, parsedCredit = 0, hasDebit = false, hasCredit = false;
      if (debitCol && obj[debitCol] != null) {
        let str = obj[debitCol].toString().trim();
        if (str && str !== '-' && str !== '0' && str !== '0.00') {
          const { amount: rawAmt } = cleanAmount(obj[debitCol]);
          if (Math.abs(rawAmt) > 0) { parsedDebit = Math.abs(rawAmt); hasDebit = true; }
        }
      }
      if (creditCol && obj[creditCol] != null) {
        let str = obj[creditCol].toString().trim();
        if (str && str !== '-' && str !== '0' && str !== '0.00') {
          const { amount: rawAmt } = cleanAmount(obj[creditCol]);
          if (Math.abs(rawAmt) > 0) { parsedCredit = Math.abs(rawAmt); hasCredit = true; }
        }
      }
      if (hasDebit && hasCredit) {
        amount = parsedCredit - parsedDebit;
        if (amount < 0) { explicitExpense = true; amount = -Math.abs(amount); }
        else if (amount > 0) { explicitIncome = true; amount = Math.abs(amount); }
      } else if (hasDebit) { amount = -parsedDebit; explicitExpense = true; }
      else if (hasCredit) { amount = parsedCredit; explicitIncome = true; }
    } else {
      const { amount: parsedAmt, isExpense, isIncome } = cleanAmount(obj[mapping.amount]);
      amount = parsedAmt; explicitExpense = isExpense; explicitIncome = isIncome;
    }

    const desc = obj[mapping.description] || '';
    let rawType = mapping.type ? obj[mapping.type] : undefined;
    if (explicitExpense) rawType = 'debit';
    if (explicitIncome) rawType = 'credit';

    const type = inferTransactionType(desc, amount, rawType);
    
    if (type === 'income') income += amount;
    else if (type === 'expense') expenses += Math.abs(amount);
    else if (type === 'refund') refunds += amount;
    else unknownCount++;
    
    txCount++;

    if (i < 5 || amount === 96 || amount === 43) {
      console.log(`[row ${i}] desc: ${desc.substring(0,20)} | amt: ${amount} | type: ${type} | debitColRaw: ${obj[debitCol]} | creditColRaw: ${obj[creditCol]}`);
    }
  });

  console.log(`Totals for ${sheetName}:`);
  console.log(`  Revenue: ₹${income}`);
  console.log(`  Refunds: ₹${refunds}`);
  console.log(`  Expenses: ₹${expenses}`);
  console.log(`  Net cash: ₹${income + refunds - expenses}`);
  console.log(`  Transactions: ${txCount}`);
  console.log(`  Unknown rows: ${unknownCount}`);
});
