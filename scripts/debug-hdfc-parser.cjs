const XLSX = require('xlsx');
const fs = require('fs');

const filePath = process.argv[2] || 'test-data/ingestion/statement.xlsx';
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const workbook = XLSX.readFile(filePath, { cellDates: true });
const sheetName = 'Table 1';
const sheet = workbook.Sheets[sheetName];
if (!sheet) {
  console.error(`Sheet "${sheetName}" not found in ${filePath}`);
  process.exit(1);
}

const displayGrid = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null });
const rawGrid = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

function detectHeaderRow(grid) {
  const DATE_KEYWORDS = ['date', 'txn date', 'txn_date', 'transaction date', 'value date', 'posted', 'tran date', 'val date'];
  const DESC_KEYWORDS = ['description', 'narration', 'particulars', 'remarks', 'payee', 'vendor', 'details', 'particular'];
  const AMT_KEYWORDS = ['amount', 'debit', 'credit', 'withdrawal', 'deposit', 'net amount', 'value', 'txn amount', 'balance'];

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
  const rawHeaderRow = grid[bestRowIndex] || [];
  const headers = rawHeaderRow.map((cell, idx) => {
    if (cell === null || cell === undefined || cell.toString().trim() === '') return `Column_${String.fromCharCode(65 + (idx % 26))}`;
    return cell.toString().trim();
  });
  return { headerRowIndex: bestRowIndex, headers };
}

const { headerRowIndex, headers } = detectHeaderRow(displayGrid);

const dateIdx = headers.indexOf('Date');
const narrationIdx = headers.indexOf('Narration');
const refIdx = headers.indexOf('Chq./Ref.No.');
const valueDtIdx = headers.indexOf('Value Dt');
const withdrawalIdx = headers.indexOf('Withdrawal Amt.');
const depositIdx = headers.indexOf('Deposit Amt.');
const balanceIdx = headers.indexOf('Closing Balance');

function parseExcelSerialDate(serial) {
  if (serial === null || serial === undefined || serial === '') return null;
  if (serial instanceof Date) return serial.toISOString().split('T')[0];
  const num = Number(serial);
  if (!isNaN(num) && num > 0) {
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return String(serial).trim();
}

function cleanHdfcAmount(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val;
  const cleanStr = String(val).replace(/,/g, '').trim();
  if (cleanStr === '' || cleanStr === '-') return null;
  const num = parseFloat(cleanStr);
  return isNaN(num) ? null : num;
}

// ── Replication of parseIndianNarration ──
function parseIndianNarration(narration, amount) {
  const norm = narration.toUpperCase().trim();
  let rail = 'unknown';
  let counterparty = null;
  let upiId = null;
  let ifsc = null;
  let ref = null;

  // 1. Detect Rail
  if (norm.startsWith('UPI-') || norm.startsWith('UPI/')) {
    rail = 'UPI';
  } else if (norm.startsWith('NEFT-') || norm.startsWith('NEFT ')) {
    rail = 'NEFT';
  } else if (norm.startsWith('IMPS-') || norm.startsWith('IMPS ')) {
    rail = 'IMPS';
  } else if (norm.startsWith('RTGS-') || norm.startsWith('RTGS ')) {
    rail = 'RTGS';
  } else if (norm.startsWith('POS ') || norm.includes('POS-') || norm.includes(' POS ')) {
    rail = 'POS';
  } else if (norm.startsWith('ACH-') || norm.startsWith('ACH ')) {
    rail = 'ACH';
  } else if (norm.startsWith('NACH-') || norm.startsWith('NACH ')) {
    rail = 'NACH';
  } else if (norm.startsWith('ECS-') || norm.startsWith('ECS ')) {
    rail = 'ECS';
  } else if (norm.includes('CHQ') || norm.includes('CHEQUE')) {
    rail = 'CHEQUE';
  } else if (norm.includes('CASH DEP') || norm.includes('CASH WDL')) {
    rail = 'CASH';
  } else if (['AMB CHRG', 'SMS CHG', 'BANK CHARGES', 'BANK CHG', 'COMMISSION', 'ALERT CHG'].some(k => norm.includes(k))) {
    rail = 'BANK_CHARGE';
  } else if (['INT.PAID', 'INTEREST PAID', 'INT.REC', 'INTEREST RECEIVE'].some(k => norm.includes(k))) {
    rail = 'INTEREST';
  } else if (['GST', 'TDS', 'TAX'].some(k => norm.includes(k))) {
    rail = 'GST/TAX';
  }

  // 2. Extract Fields based on Rail
  if (rail === 'UPI') {
    const parts = norm.split('-');
    if (parts.length >= 3) {
      counterparty = parts[1].trim();
      counterparty = counterparty.replace(/^(MR|MRS|MS|DR|MISS|BY)\s+/i, '').trim();

      parts.forEach(part => {
        const p = part.trim();
        if (p.includes('@')) {
          upiId = p.toLowerCase();
        } else if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(p)) {
          ifsc = p;
        } else if (/^\d{12}$/.test(p)) {
          ref = p;
        }
      });
    } else {
      const slashParts = norm.split('/');
      if (slashParts.length >= 3) {
        counterparty = slashParts[2].trim().replace(/^(MR|MRS|MS|DR|MISS)\s+/i, '').trim();
      }
    }
  } else if (rail === 'NEFT') {
    const parts = norm.split('-');
    if (parts.length >= 3) {
      ifsc = parts[1].trim();
      let rawCp = parts[2].trim();
      rawCp = rawCp.replace(/\s+(PAYMENT AGGREGATOR|ESCR|PA).*$/i, '').trim();
      counterparty = rawCp;
    }
  } else if (rail === 'IMPS') {
    const parts = norm.split('-');
    if (parts.length >= 3) {
      ref = parts[1].trim();
      counterparty = parts[2].trim();
    }
  } else if (rail === 'POS' || norm.includes('POS')) {
    const cardRegex = /(?:514834[X*]{6}\d{4})|(?:\d{4}\*+\d{4})/;
    const match = norm.match(cardRegex);
    if (match) {
      const idx = norm.indexOf(match[0]);
      let after = norm.substring(idx + match[0].length).trim();
      after = after.replace(/^-\d{4}-/g, '').replace(/^\d{4}-/g, '').replace(/^-/g, '').trim();
      after = after.replace(/^(EPR|FT|TXN)\d+.*$/i, '').trim();
      counterparty = after;
    }
  }

  if (['AMB CHRG', 'SMS CHG', 'BANK CHARGES', 'BANK CHG', 'ALERT CHG', 'DC INTL POS TXN MARKUP'].some(k => norm.includes(k))) {
    counterparty = 'HDFC BANK';
  } else if (norm.includes('GST')) {
    counterparty = 'GST / Tax Department';
  }

  if (counterparty) {
    counterparty = counterparty.replace(/INV(?:OICE)?\s*#?\d+/i, '').trim();
    counterparty = counterparty.replace(/ORDER\s*\d+/i, '').trim();
    counterparty = counterparty.replace(/CNRB\d+|SBIN\d+|HDFC\d+|ICIC\d+|UTIB\d+/i, '').trim();
    counterparty = counterparty.replace(/-\d+.*$/, '').trim();
    counterparty = counterparty.replace(/\s+/g, ' ').trim();
  }

  let type = 'unknown';
  if (counterparty) {
    const cpUpper = counterparty.toUpperCase();
    const govKeywords = ['GST', 'TAX', 'TDS', 'PF', 'ESI', 'GOVERNMENT', 'INCOME TAX'];
    const bankKeywords = ['BANK', 'HDFC', 'ICICI', 'SBI', 'AXIS', 'KOTAK', 'MUTUAL'];
    const bizKeywords = [
      'PVT', 'LTD', 'LLP', 'SERVICES', 'ENTERPRISES', 'TRADERS', 'SOLUTIONS',
      'TECHNOLOGIES', 'AGENCY', 'STORE', 'MART', 'FOODS', 'HOTEL', 'LOGISTICS',
      'CONSULTING', 'INDUSTRIES', 'CORPORATION', 'BROKING', 'BROKERS', 'LIMITED',
      'PRIVATE', 'SYSTEMS', 'NETWORKS', 'PUBLISHING', 'CLAW', 'PERRO', 'TECHNOCARE'
    ];
    const platforms = [
      'RAZORPAY', 'GOOGLE', 'META', 'FACEBOOK', 'AMAZON', 'AWS', 'SWIGGY',
      'ZOMATO', 'UBER', 'OLA', 'PHONEPE', 'PAYTM', 'ZOHO', 'MICROSOFT', 'SLACK',
      'NOTION', 'GITHUB', 'VERCEL', 'SHOPIFY', 'CLAUDE', 'ANTHROPIC', 'X CORP',
      'GODADDY', 'EATSURE', 'BLINKIT', 'NAMMAYATRI', 'FUDR', 'AIRTEL'
    ];

    if (govKeywords.some(k => cpUpper.includes(k))) {
      type = 'government/tax';
    } else if (bankKeywords.some(k => cpUpper.includes(k))) {
      type = 'bank';
    } else if (bizKeywords.some(k => cpUpper.includes(k)) || platforms.some(k => cpUpper.includes(k))) {
      type = 'business/vendor';
    } else {
      const hasSalutation = ['MR', 'MRS', 'MS', 'DR', 'MISS'].some(k => norm.includes(k + ' '));
      const looksLikePerson = hasSalutation || (upiId && !cpUpper.includes('RZP') && !cpUpper.includes('CASHFREE') && !cpUpper.includes('MERUPI'));
      if (looksLikePerson) {
        type = 'person';
      } else {
        const tokens = counterparty.split(' ');
        if (tokens.length >= 2 && tokens.length <= 4) {
          type = 'person';
        } else {
          type = 'business/vendor';
        }
      }
    }
  }

  let category = 'Uncategorized';
  let confidence = 'low';
  let reason = 'Generic narration pattern';

  const isCredit = amount > 0;
  const cpUpper = counterparty ? counterparty.toUpperCase() : '';

  if (isCredit) {
    category = 'Revenue / Sales';
    confidence = 'high';
    reason = 'Credit transaction (inflow)';

    if (norm.includes('REFUND') || norm.includes('REVERSAL') || norm.includes('UPIRET')) {
      category = 'Refunds / Recoveries';
      confidence = 'high';
      reason = 'Refund / Reversal keyword detected';
    }
  } else {
    const haystack = `${norm} ${cpUpper}`;
    
    if (['SALARY', 'PAYROLL', 'WAGES', 'STIPEND', 'BONUS'].some(k => haystack.includes(k))) {
      category = 'Payroll';
      confidence = 'high';
      reason = 'Salary / payroll keyword detected';
    } else if (['RENT'].some(k => haystack.includes(k))) {
      category = 'Rent / Utilities';
      confidence = 'high';
      reason = 'Rent keyword detected';
    } else if (['ELECTRICITY', 'WATER BILL', 'INTERNET', 'BROADBAND', 'UTILITY', 'UTILITIES', 'WIFI'].some(k => haystack.includes(k))) {
      category = 'Rent / Utilities';
      confidence = 'high';
      reason = 'Utility payment keyword detected';
    } else if (['GOOGLE *PLAY', 'GOOGLE WORKSPACE', 'MICROSOFT', 'GITHUB', 'VERCEL', 'NOTION', 'SLACK', 'ZOOM', 'FIGMA', 'CANVA', 'ADOBE', 'POSTMAN', 'CLAUDE', 'ANTHROPIC', 'GODADDY'].some(k => haystack.includes(k))) {
      category = 'Software / SaaS';
      confidence = 'high';
      reason = 'Known Software / SaaS vendor';
    } else if (['AWS', 'AMAZON WEB SERVICES', 'AZURE', 'GCP', 'CLOUDFLARE', 'DIGITALOCEAN', 'SUPABASE', 'RENDER', 'RAILWAY', 'NETLIFY'].some(k => haystack.includes(k))) {
      category = 'Cloud / Hosting';
      confidence = 'high';
      reason = 'Known Cloud / Hosting provider';
    } else if (['GOOGLE ADS', 'META ADS', 'FACEBOOK ADS', 'MARKETING', 'ADWORDS', 'AD CAMPAIGN', 'SPONSORED'].some(k => haystack.includes(k))) {
      category = 'Marketing';
      confidence = 'high';
      reason = 'Known Marketing / Advertising service';
    } else if (['RAZORPAY', 'STRIPE', 'PAYPAL', 'PAYU', 'CASHFREE', 'PAYTM GATEWAY', 'INSTAMOJO'].some(k => haystack.includes(k))) {
      category = 'Payments / Gateway';
      confidence = 'high';
      reason = 'Known Payment Processor / Gateway';
    } else if (['BANK CHARGE', 'SMS CHG', 'AMB CHRG', 'BANK FEES', 'IMPS CHARGE', 'NEFT CHARGE', 'RTGS CHARGE', 'ANNUAL FEE', 'COMMISSION', 'MARKUP', 'INSURANCE', 'PREMIUM', 'LIC'].some(k => haystack.includes(k)) || type === 'bank') {
      category = 'Banking / Charges';
      confidence = 'high';
      reason = 'Bank charges / fees / insurance detected';
    } else if (['GST', 'TDS', 'INCOME TAX', 'TAX PAYMENT', 'COMPLIANCE', 'ROC', 'MCA'].some(k => haystack.includes(k)) || type === 'government/tax') {
      category = 'Taxes / Compliance';
      confidence = 'high';
      reason = 'Government tax / compliance payment';
    } else if (['TRAVEL', 'HOTEL', 'FLIGHT', 'AIRLINE', 'UBER', 'OLA', 'CAB', 'PETROL', 'FUEL', 'SWIGGY', 'ZOMATO', 'RESTAURANT', 'FOOD', 'MEALS', 'EATSURE', 'BLINKIT', 'NAMMAYATRI', 'FUDR'].some(k => haystack.includes(k))) {
      category = 'Travel';
      confidence = 'high';
      reason = 'Known Travel / Food / Logistics vendor';
    } else if (['STATIONERY', 'STATIONARY', 'OFFICE SUPPLIES', 'PRINTER', 'PAPER', 'AMAZON'].some(k => haystack.includes(k))) {
      category = 'Office Supplies';
      confidence = 'high';
      reason = 'Known Office Supplies vendor';
    } else if (['CONSULTING', 'RETAINER', 'PROFESSIONAL FEE', 'SERVICES', 'FREELANCER', 'CONTRACTOR', 'AGENCY', 'BLUEPINE', 'ACME'].some(k => haystack.includes(k))) {
      category = 'Consulting / Services';
      confidence = 'high';
      reason = 'Known Consulting / Professional Services keyword';
    }
  }

  if (category === 'Uncategorized' && counterparty) {
    if (type === 'person') {
      category = 'Consulting / Services';
      confidence = 'medium';
      reason = 'UPI transfer to individual (assumed contractor/freelancer)';
    } else if (type === 'business/vendor') {
      category = 'Consulting / Services';
      confidence = 'medium';
      reason = 'Payment to business (assumed vendor services)';
    }
  }

  return {
    payment_rail: rail,
    counterparty_name: counterparty || 'No counterparty',
    counterparty_type: type,
    reference_number: ref,
    upi_id: upiId,
    bank_ifsc_or_code: ifsc,
    likely_category: category,
    confidence,
    reason
  };
}

const cleanRows = [];
let skippedCount = 0;
let continuationRowsMerged = 0;
let orphanRowsSkipped = 0;
let blankRowsSkipped = 0;
let currentTx = null;
let orphanSkipped = false;

const dataGrid = rawGrid.slice(headerRowIndex + 1);
const displayDataGrid = displayGrid.slice(headerRowIndex + 1);

for (let r = 0; r < dataGrid.length; r++) {
  const rawRow = dataGrid[r];
  const displayRow = displayDataGrid[r];

  if (!rawRow || rawRow.length === 0) {
    blankRowsSkipped++;
    skippedCount++;
    continue;
  }

  const isBlank = rawRow.every(val => val === null || val === undefined || String(val).trim() === '');
  if (isBlank) {
    blankRowsSkipped++;
    skippedCount++;
    continue;
  }

  const rawDate = rawRow[dateIdx];
  const rawNarration = rawRow[narrationIdx];
  const rawRef = displayRow[refIdx];
  const rawValueDt = rawRow[valueDtIdx];
  const rawWithdrawal = rawRow[withdrawalIdx];
  const rawDeposit = rawRow[depositIdx];
  const rawBalance = rawRow[balanceIdx];

  const hasDate = rawDate !== null && rawDate !== undefined && String(rawDate).trim() !== '';
  const hasNarration = rawNarration !== null && rawNarration !== undefined && String(rawNarration).trim() !== '';
  const hasWithdrawal = rawWithdrawal !== null && rawWithdrawal !== undefined && String(rawWithdrawal).trim() !== '' && cleanHdfcAmount(rawWithdrawal) !== null;
  const hasDeposit = rawDeposit !== null && rawDeposit !== undefined && String(rawDeposit).trim() !== '' && cleanHdfcAmount(rawDeposit) !== null;
  const hasBalance = rawBalance !== null && rawBalance !== undefined && String(rawBalance).trim() !== '' && cleanHdfcAmount(rawBalance) !== null;

  const isTransactionStart = hasDate && hasNarration && (hasWithdrawal || hasDeposit || hasBalance);

  if (isTransactionStart) {
    const txDate = parseExcelSerialDate(rawDate);
    const valDate = parseExcelSerialDate(rawValueDt);
    const withdrawal = cleanHdfcAmount(rawWithdrawal) || 0;
    const deposit = cleanHdfcAmount(rawDeposit) || 0;
    const balance = cleanHdfcAmount(rawBalance) || 0;

    currentTx = {
      date: txDate,
      narration: String(rawNarration).trim(),
      reference: rawRef ? String(rawRef).trim() : '',
      valueDate: valDate,
      withdrawal,
      deposit,
      balance
    };
    cleanRows.push(currentTx);
  } else {
    const isContinuation = !hasDate && !hasWithdrawal && !hasDeposit && !hasBalance && hasNarration;
    if (isContinuation) {
      if (currentTx) {
        const prev = currentTx.narration;
        const next = String(rawNarration).trim();
        const lastChar = prev.charAt(prev.length - 1);
        const firstChar = next.charAt(0);
        const isAlphanumeric = (ch) => /[a-zA-Z0-9]/.test(ch);
        if (isAlphanumeric(lastChar) && isAlphanumeric(firstChar)) {
          currentTx.narration = prev + next;
        } else {
          currentTx.narration = prev + ' ' + next;
        }
        continuationRowsMerged++;
      } else {
        if (!orphanSkipped) {
          orphanSkipped = true;
        }
        orphanRowsSkipped++;
        skippedCount++;
      }
    } else {
      skippedCount++;
    }
  }
}

let balanceWarnings = 0;
let prevBalance = null;
let totalDeposits = 0;
let totalWithdrawals = 0;

cleanRows.forEach((tx, idx) => {
  totalDeposits += tx.deposit;
  totalWithdrawals += tx.withdrawal;

  if (idx === 0) {
    prevBalance = tx.balance;
    return;
  }
  
  const expectedDelta = tx.deposit - tx.withdrawal;
  const actualDelta = tx.balance - prevBalance;
  const diff = Math.abs(expectedDelta - actualDelta);
  if (diff > 0.02) {
    balanceWarnings++;
  }
  prevBalance = tx.balance;
});

// Run categorization intelligence metrics
let highConfidenceCount = 0;
let mediumConfidenceCount = 0;
let needsReviewCount = 0;
let unknownUncategorizedCount = 0;

cleanRows.forEach(tx => {
  const amt = tx.deposit - tx.withdrawal;
  const intel = parseIndianNarration(tx.narration, amt);
  
  if (intel.confidence === 'high') {
    highConfidenceCount++;
  } else if (intel.confidence === 'medium') {
    mediumConfidenceCount++;
  } else {
    needsReviewCount++;
  }
  
  if (intel.likely_category === 'Uncategorized' || intel.likely_category === 'Unknown') {
    unknownUncategorizedCount++;
  }
});

console.log(`Sheet: ${sheetName}`);
console.log(`Transactions: ${cleanRows.length}`);
console.log(`Deposits: ${totalDeposits.toFixed(2)}`);
console.log(`Withdrawals: ${totalWithdrawals.toFixed(2)}`);
console.log(`Net: ${(totalDeposits - totalWithdrawals).toFixed(2)}`);
console.log(`Continuation rows merged: ${continuationRowsMerged}`);
console.log(`Orphan rows skipped: ${orphanRowsSkipped}`);
console.log(`Blank rows skipped: ${blankRowsSkipped}`);
console.log(`Balance mismatches: ${balanceWarnings}`);
console.log(`Categorized high confidence: ${highConfidenceCount}`);
console.log(`Categorized medium confidence: ${mediumConfidenceCount}`);
console.log(`Needs review: ${needsReviewCount}`);
console.log(`Unknown/Uncategorized: ${unknownUncategorizedCount}`);
