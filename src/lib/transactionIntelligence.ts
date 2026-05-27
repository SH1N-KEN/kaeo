
export interface ExtractedInfo {
  payment_rail: string;
  counterparty_name: string | null;
  counterparty_type: 'person' | 'business/vendor' | 'bank' | 'platform' | 'government/tax' | 'unknown';
  reference_number: string | null;
  upi_id: string | null;
  bank_ifsc_or_code: string | null;
  likely_category: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  is_internal_transfer: boolean;
  direction_hint: 'inflow' | 'outflow' | 'unknown';
}

// ── Transfer marker patterns ─────────────────────────────────────────────────
const TRANSFER_PATTERNS = [
  'SELF TRANSFER', 'OWN ACCOUNT', 'OWN A/C', 'SWEEP IN', 'SWEEP OUT',
  'FD BOOKING', 'FD MATURITY', 'FD PREMATURE', 'LOAN TRANSFER', 'LOAN DISBURS',
  'OPENING BAL', 'CLOSING BAL', 'BALANCE TRANSFER', 'INTER ACCOUNT',
  'INTERNAL TRANSFER', 'TRF TO SELF', 'TRANSFER TO SELF'
];

// ── Bank charge patterns ─────────────────────────────────────────────────────
const BANK_CHARGE_PATTERNS = [
  'AMB CHRG', 'AMB CHARGE', 'SMS CHG', 'SMS CHARGE', 'BANK CHARGE', 'BANK FEE',
  'ANNUAL FEE', 'LOCKER CHG', 'DEMAT CHRG', 'IMPS CHARGE', 'NEFT CHARGE',
  'RTGS CHARGE', 'ALERT CHG', 'DC INTL POS', 'FOREX MARKUP', 'INTL TXN FEE',
  'COMMISSION CHG', 'SERVICE CHARGE', 'ACCOUNT MAINTENANCE', 'PROCESSING FEE',
  'EMI BOUNCE', 'CHEQUE RETURN CHARGES', 'PENALTY'
];

// ── Interest patterns ────────────────────────────────────────────────────────
const INTEREST_CREDIT_PATTERNS = [
  'INT CREDIT', 'INT.CREDIT', 'INTEREST CREDIT', 'INTEREST EARNED',
  'INTEREST RECEIVED', 'INT REC', 'INT.REC', 'SAVINGS INTEREST', 'FD INTEREST',
  'INTEREST ON DEPOSIT', 'INTEREST INCOME'
];
const INTEREST_DEBIT_PATTERNS = [
  'INT PAID', 'INTEREST PAID', 'INT.PAID', 'INTEREST CHARGED', 'INTEREST DEBITED'
];

// ── Inbound credit narration markers ────────────────────────────────────────
const CREDIT_RAIL_MARKERS = ['NEFT CR', 'RTGS CR', 'IMPS CR', 'UPI CR', 'CREDIT BY'];
const DEBIT_RAIL_MARKERS  = ['NEFT DR', 'RTGS DR', 'IMPS DR', 'UPI DR', 'DEBIT BY'];

/**
 * Parse an Indian bank narration string into structured transaction intelligence.
 *
 * @param narration - Raw narration/description text
 * @param direction - Explicit direction derived from debit/credit columns ('inflow'|'outflow'|'unknown')
 */
export function parseIndianNarration(
  narration: string,
  direction: 'inflow' | 'outflow' | 'unknown' = 'unknown'
): ExtractedInfo {
  const norm = narration.toUpperCase().trim();
  let rail = 'unknown';
  let counterparty: string | null = null;
  let upiId: string | null = null;
  let ifsc: string | null = null;
  let ref: string | null = null;
  let isInternalTransfer = false;
  let directionHint: 'inflow' | 'outflow' | 'unknown' = direction;

  // ── 0. Transfer detection (before everything else) ───────────────────────
  if (TRANSFER_PATTERNS.some(p => norm.includes(p))) {
    isInternalTransfer = true;
  }

  // ── 1. Detect direction from narration markers if not already known ───────
  if (directionHint === 'unknown') {
    if (CREDIT_RAIL_MARKERS.some(m => norm.includes(m))) directionHint = 'inflow';
    else if (DEBIT_RAIL_MARKERS.some(m => norm.includes(m))) directionHint = 'outflow';
  }

  // ── 2. Detect Rail ───────────────────────────────────────────────────────
  if (norm.startsWith('UPI-') || norm.startsWith('UPI/') || norm.startsWith('UPI CR') || norm.startsWith('UPI DR')) {
    rail = 'UPI';
  } else if (/^NEFT[\s\-\/]/.test(norm) || norm.includes('NEFT CR') || norm.includes('NEFT DR')) {
    rail = 'NEFT';
  } else if (/^IMPS[\s\-\/]/.test(norm) || norm.includes('IMPS CR') || norm.includes('IMPS DR')) {
    rail = 'IMPS';
  } else if (/^RTGS[\s\-\/]/.test(norm) || norm.includes('RTGS CR') || norm.includes('RTGS DR')) {
    rail = 'RTGS';
  } else if (norm.startsWith('POS ') || norm.includes('POS-') || norm.includes(' POS ')) {
    rail = 'POS';
  } else if (norm.startsWith('ACH-') || norm.startsWith('ACH ') || norm.includes('ACH CR') || norm.includes('ACH DR')) {
    rail = 'ACH';
  } else if (norm.startsWith('NACH-') || norm.startsWith('NACH ')) {
    rail = 'NACH';
  } else if (norm.startsWith('ECS-') || norm.startsWith('ECS ')) {
    rail = 'ECS';
  } else if (norm.includes('CHQ') || norm.includes('CHEQUE')) {
    rail = 'CHEQUE';
  } else if (norm.includes('CASH DEP') || norm.includes('CASH WDL') || norm.includes('CASH DEP') || norm.includes('CDM')) {
    rail = 'CASH';
  } else if (BANK_CHARGE_PATTERNS.some(k => norm.includes(k))) {
    rail = 'BANK_CHARGE';
  } else if (INTEREST_CREDIT_PATTERNS.some(k => norm.includes(k)) || INTEREST_DEBIT_PATTERNS.some(k => norm.includes(k))) {
    rail = 'INTEREST';
  } else if (['GST', 'TDS', 'INCOME TAX', 'ADVANCE TAX', 'PROFESSIONAL TAX'].some(k => norm.includes(k))) {
    rail = 'GST/TAX';
  }

  // ── 3. Extract Fields based on Rail ─────────────────────────────────────
  if (rail === 'UPI') {
    // UPI-<Name>-<VPA>-<IFSC>-<UTR>-<Purpose> OR UPI/<App>/<Name>/<VPA>
    const dashParts = norm.split('-');
    const slashParts = norm.split('/');

    if (dashParts.length >= 3) {
      // Strip "UPI CR" or "UPI DR" prefix if present
      const startIdx = dashParts[0].endsWith('CR') || dashParts[0].endsWith('DR') ? 1 : 1;
      let rawCp = dashParts[startIdx]?.trim() || '';
      rawCp = rawCp.replace(/^(MR|MRS|MS|DR|MISS|BY)\s+/i, '').trim();
      if (rawCp && rawCp.length > 1) counterparty = rawCp;

      // Find VPA (@), IFSC, and 12-digit UTR ref
      dashParts.forEach(part => {
        const p = part.trim();
        if (p.includes('@')) {
          upiId = p.toLowerCase();
          // If we didn't get counterparty from name, derive from UPI ID
          if (!counterparty || counterparty.length <= 2) {
            const handle = p.split('@')[0].replace(/[_\-\.]/g, ' ').toLowerCase();
            counterparty = handle.length > 2 ? handle.toUpperCase() : null;
          }
        } else if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(p)) {
          ifsc = p;
        } else if (/^\d{12}$/.test(p)) {
          ref = p;
        }
      });
    } else if (slashParts.length >= 3) {
      // UPI/PHONEPE/MERCHANT_NAME or UPI/CR/000123456789/Name/...
      // Skip UPI, skip app-name or CR/DR, take name
      let candidateIdx = 2;
      // If slashParts[1] looks like CR/DR/UTR skip it
      if (/^(CR|DR|\d+)$/.test(slashParts[1])) candidateIdx = 2;
      else if (/^(PHONEPE|GPAY|PAYTM|BHIM|AMAZONPAY|WHATSAPP)$/.test(slashParts[1])) candidateIdx = 2;

      const rawCp = slashParts[candidateIdx]?.trim() || '';
      counterparty = rawCp.replace(/^(MR|MRS|MS|DR|MISS)\s+/i, '').trim() || null;

      // Look for VPA in remaining parts
      slashParts.forEach(p => {
        if (p.includes('@')) upiId = p.toLowerCase();
        if (/^\d{12}$/.test(p)) ref = p;
      });
    }
  } else if (rail === 'NEFT' || rail === 'RTGS') {
    // NEFT CR-<IFSC>-<Sender>-<Receiver>-<Ref> or NEFT/<UTR>/<Name>/<IFSC>
    const parts = norm.split('-');
    if (parts.length >= 3) {
      // parts[0] = "NEFT CR" or "NEFT", parts[1] = IFSC or name
      const ifscCandidate = parts[1]?.trim() || '';
      if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCandidate)) {
        ifsc = ifscCandidate;
        let rawCp = parts[2]?.trim() || '';
        rawCp = rawCp.replace(/\s+(PAYMENT AGGREGATOR|ESCR|PA).*$/i, '').trim();
        counterparty = rawCp || null;
      } else {
        // Name might be directly after
        let rawCp = parts[1]?.trim() || '';
        rawCp = rawCp.replace(/^(NEFT CR|NEFT DR|RTGS CR|RTGS DR)\s*/i, '').trim();
        counterparty = rawCp || null;
      }

      // Find UTR ref (22-char alphanumeric or 12-digit)
      parts.forEach(p => {
        if (/^[A-Z0-9]{16,22}$/.test(p.trim())) ref = p.trim();
        else if (/^\d{12}$/.test(p.trim())) ref = p.trim();
      });
    }
  } else if (rail === 'IMPS' || rail === 'ACH') {
    // IMPS-<UTR>-<Counterparty>-<IFSC>-...
    const parts = norm.split('-');
    if (parts.length >= 3) {
      ref = parts[1]?.trim() || null;
      counterparty = parts[2]?.trim() || null;
      if (parts[3] && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(parts[3].trim())) {
        ifsc = parts[3].trim();
      }
    }
  } else if (rail === 'POS') {
    // POS 514834XXXXXX4085 MERCHANT_NAME or POS/<card>/<MERCHANT>
    const cardRegex = /(?:[0-9X*]{4}[X*]{4,8}[0-9X*]{4})|(?:\d{4}\*+\d{4})/;
    const match = norm.match(cardRegex);
    if (match) {
      const idx = norm.indexOf(match[0]);
      let after = norm.substring(idx + match[0].length).trim();
      after = after.replace(/^-\d{4}-/g, '').replace(/^\d{4}-/g, '').replace(/^-/g, '').trim();
      after = after.replace(/^(EPR|FT|TXN)\d+.*$/i, '').trim();
      counterparty = after || null;
    } else {
      // POS <terminal_id> <merchant>
      const posParts = norm.replace(/^POS[\s-]+/, '').trim().split(/\s+/);
      if (posParts.length >= 2) {
        // Skip first token if it looks like a terminal ID (all digits or alphanumeric)
        const start = /^[A-Z0-9]{6,}$/.test(posParts[0]) ? 1 : 0;
        counterparty = posParts.slice(start, start + 3).join(' ') || null;
      }
    }
  } else if (rail === 'CHEQUE') {
    // Cheque no. or CHQ <number>
    const chqMatch = norm.match(/CH(?:Q|EQUE)[\s#-]*(\d{6})/);
    if (chqMatch) ref = chqMatch[1];
  } else if (rail === 'NACH' || rail === 'ECS') {
    // NACH/ECS often has company name
    const parts = norm.replace(/^(NACH|ECS)[\s-]+/, '').split(/[-\/]/);
    counterparty = parts[0]?.trim() || null;
    if (counterparty && /^\d+$/.test(counterparty)) counterparty = parts[1]?.trim() || null;
  }

  // ── 4. Fallback counterparty for bank charges / interest ────────────────
  if (!counterparty) {
    if (BANK_CHARGE_PATTERNS.some(k => norm.includes(k))) {
      counterparty = 'BANK';
    } else if (INTEREST_CREDIT_PATTERNS.some(k => norm.includes(k)) || INTEREST_DEBIT_PATTERNS.some(k => norm.includes(k))) {
      counterparty = 'BANK';
    } else if (norm.includes('GST')) {
      counterparty = 'GST / TAX AUTHORITY';
    } else if (norm.includes('TDS') || norm.includes('INCOME TAX')) {
      counterparty = 'INCOME TAX DEPT';
    }
  }

  // ── 5. Clean counterparty ────────────────────────────────────────────────
  if (counterparty) {
    counterparty = counterparty
      .replace(/INV(?:OICE)?\s*#?\d+/i, '')
      .replace(/ORDER\s*\d+/i, '')
      .replace(/\b[A-Z]{4}0[A-Z0-9]{6}\b/, '')   // IFSC codes
      .replace(/\b\d{10,12}\b/g, '')               // phone/UTR numbers
      .replace(/-\d+.*$/, '')                       // trailing ref numbers
      .replace(/\s+/g, ' ')
      .trim();

    if (counterparty.length <= 1 || /^\d+$/.test(counterparty)) {
      counterparty = null;
    }
  }

  // ── 6. Classify Counterparty Type ───────────────────────────────────────
  type CPType = ExtractedInfo['counterparty_type'];
  let cpType: CPType = 'unknown';

  if (counterparty) {
    const cpUpper = counterparty.toUpperCase();
    const govKeywords  = ['GST', 'TAX', 'TDS', 'PF ', 'ESI', 'GOVERNMENT', 'INCOME TAX', 'CUSTOMS', 'MCA', 'ROC'];
    const bankKeywords = ['BANK', 'HDFC', 'ICICI', 'SBI', 'AXIS', 'KOTAK', 'MUTUAL', 'RBI', 'NBFC', 'FINTECH'];
    const bizKeywords  = [
      'PVT', 'LTD', 'LLP', 'SERVICES', 'ENTERPRISES', 'TRADERS', 'SOLUTIONS',
      'TECHNOLOGIES', 'AGENCY', 'STORE', 'MART', 'FOODS', 'HOTEL', 'LOGISTICS',
      'CONSULTING', 'INDUSTRIES', 'CORPORATION', 'BROKING', 'BROKERS', 'LIMITED',
      'PRIVATE', 'SYSTEMS', 'NETWORKS', 'PUBLISHING', 'TECHNOCARE', 'INFRA',
      'CAPITAL', 'FINANCE', 'INVESTMENTS', 'HOLDINGS'
    ];
    const platforms = [
      'RAZORPAY', 'CASHFREE', 'PAYU', 'INSTAMOJO', 'PHONEPE', 'PAYTM',
      'GOOGLE', 'META', 'FACEBOOK', 'AMAZON', 'AWS', 'SWIGGY', 'ZOMATO',
      'UBER', 'OLA', 'ZOHO', 'MICROSOFT', 'SLACK', 'NOTION', 'GITHUB',
      'VERCEL', 'SHOPIFY', 'ANTHROPIC', 'OPENAI', 'CLAUDE', 'X CORP',
      'GODADDY', 'EATSURE', 'BLINKIT', 'NAMMAYATRI', 'FUDR', 'AIRTEL',
      'JUSPAY', 'BILLDESK', 'CCAVENUE', 'RZP', 'MERUPI'
    ];

    if (govKeywords.some(k => cpUpper.includes(k))) {
      cpType = 'government/tax';
    } else if (bankKeywords.some(k => cpUpper.includes(k))) {
      cpType = 'bank';
    } else if (platforms.some(k => cpUpper.includes(k))) {
      cpType = 'platform';
    } else if (bizKeywords.some(k => cpUpper.includes(k))) {
      cpType = 'business/vendor';
    } else {
      const hasSalutation = ['MR ', 'MRS ', 'MS ', 'DR ', 'MISS '].some(k => cpUpper.startsWith(k) || norm.includes(k));
      const looksLikePerson = hasSalutation || (
        upiId && !cpUpper.includes('RZP') && !cpUpper.includes('CASHFREE') && !cpUpper.includes('MERUPI')
      );
      if (looksLikePerson) {
        cpType = 'person';
      } else {
        const tokens = counterparty.split(' ');
        cpType = (tokens.length >= 2 && tokens.length <= 4) ? 'person' : 'business/vendor';
      }
    }
  }

  // ── 7. Infer Category using direction (NOT amount sign) ──────────────────
  let category = 'Uncategorized';
  let confidence: ExtractedInfo['confidence'] = 'low';
  let reason = 'Generic narration pattern';

  const cpUpper = counterparty?.toUpperCase() ?? '';
  const haystack = `${norm} ${cpUpper}`;

  // --- Internal transfer → skip revenue/expense categorization
  if (isInternalTransfer) {
    category = directionHint === 'inflow' ? 'Transfer In' : 'Transfer Out';
    confidence = 'high';
    reason = 'Internal transfer pattern detected';
  }
  // --- Bank charges
  else if (BANK_CHARGE_PATTERNS.some(k => norm.includes(k)) || rail === 'BANK_CHARGE') {
    category = 'Banking / Charges';
    confidence = 'high';
    reason = 'Bank charge pattern detected';
  }
  // --- Interest
  else if (INTEREST_CREDIT_PATTERNS.some(k => norm.includes(k))) {
    category = 'Interest Income';
    confidence = 'high';
    reason = 'Interest credit detected';
  }
  else if (INTEREST_DEBIT_PATTERNS.some(k => norm.includes(k))) {
    category = 'Banking / Charges';
    confidence = 'high';
    reason = 'Interest debit (bank charges)';
  }
  // --- Government / Tax
  else if (['GST', 'TDS', 'INCOME TAX', 'TAX PAYMENT', 'COMPLIANCE', 'ROC', 'MCA', 'ADVANCE TAX', 'PROFESSIONAL TAX'].some(k => haystack.includes(k)) || cpType === 'government/tax') {
    category = 'Taxes / Compliance';
    confidence = 'high';
    reason = 'Government/tax payment detected';
  }
  // --- Direction = INFLOW
  else if (directionHint === 'inflow') {
    // Refund/reversal on inflow
    if (['REFUND', 'REVERSAL', 'UPIRET', 'UPI RET', 'TRF RET', 'CASHBACK', 'REIMBURS', 'RECOVERY'].some(k => norm.includes(k))) {
      category = 'Refunds / Recoveries';
      confidence = 'high';
      reason = 'Refund/reversal keyword on inflow';
    }
    // Capital infusion patterns
    else if (['CAPITAL INFUS', 'OWNER CAPITAL', 'DIRECTOR LOAN', 'PROMOTER', 'EQUITY', 'SHARE CAPITAL'].some(k => norm.includes(k))) {
      category = 'Capital / Owner Infusion';
      confidence = 'high';
      reason = 'Capital infusion pattern';
    }
    // Loan received
    else if (['LOAN RECEIV', 'LOAN CREDIT', 'DISBURS'].some(k => norm.includes(k))) {
      category = 'Loan Received';
      confidence = 'high';
      reason = 'Loan received pattern';
    }
    else {
      category = 'Customer Payment / Revenue';
      confidence = 'high';
      reason = 'Credit/inflow transaction';
    }
  }
  // --- Direction = OUTFLOW
  else if (directionHint === 'outflow') {
    if (['SALARY', 'PAYROLL', 'WAGES', 'STIPEND', 'BONUS', 'EMPLOYEE PAY'].some(k => haystack.includes(k))) {
      category = 'Payroll / Salary';
      confidence = 'high';
      reason = 'Salary/payroll keyword';
    } else if (['RENT', 'OFFICE RENT', 'LEASE'].some(k => haystack.includes(k))) {
      category = 'Rent';
      confidence = 'high';
      reason = 'Rent keyword';
    } else if (['ELECTRICITY', 'WATER BILL', 'INTERNET', 'BROADBAND', 'UTILITY', 'WIFI', 'MOBILE RECHARGE'].some(k => haystack.includes(k))) {
      category = 'Utilities';
      confidence = 'high';
      reason = 'Utility payment';
    } else if (['GOOGLE *PLAY', 'GOOGLE WORKSPACE', 'MICROSOFT', 'GITHUB', 'VERCEL', 'NOTION', 'SLACK', 'ZOOM', 'FIGMA', 'CANVA', 'ADOBE', 'POSTMAN', 'CLAUDE', 'ANTHROPIC', 'GODADDY', 'DROPBOX', 'ASANA', 'HUBSPOT', 'LOOM', 'GRAMMARLY', 'AIRTABLE', 'MIRO', 'WEBFLOW'].some(k => haystack.includes(k))) {
      category = 'Software / SaaS';
      confidence = 'high';
      reason = 'Known SaaS vendor';
    } else if (['AWS', 'AMAZON WEB SERVICES', 'AZURE', 'GCP', 'GOOGLE CLOUD', 'CLOUDFLARE', 'DIGITALOCEAN', 'SUPABASE', 'RENDER', 'RAILWAY', 'NETLIFY', 'HETZNER', 'LINODE', 'VULTR'].some(k => haystack.includes(k))) {
      category = 'Cloud / Hosting';
      confidence = 'high';
      reason = 'Known cloud/hosting provider';
    } else if (['GOOGLE ADS', 'META ADS', 'FACEBOOK ADS', 'INSTAGRAM ADS', 'LINKEDIN ADS', 'ADWORDS', 'MARKETING', 'AD CAMPAIGN', 'SPONSORED'].some(k => haystack.includes(k))) {
      category = 'Marketing / Ads';
      confidence = 'high';
      reason = 'Marketing/advertising spend';
    } else if (['RAZORPAY', 'CASHFREE', 'PAYU', 'INSTAMOJO', 'STRIPE', 'PAYPAL', 'PAYTM GATEWAY', 'BILLDESK', 'JUSPAY', 'CCAVENUE', 'RZP'].some(k => haystack.includes(k))) {
      category = 'Payment Gateway';
      confidence = 'high';
      reason = 'Known payment gateway';
    } else if (['TRAVEL', 'HOTEL', 'FLIGHT', 'AIRLINE', 'UBER', 'OLA', 'CAB', 'IRCTC', 'MAKEMYTRIP', 'CLEARTRIP', 'INDIGO', 'AIRBNB', 'NAMMAYATRI'].some(k => haystack.includes(k))) {
      category = 'Travel / Fuel';
      confidence = 'high';
      reason = 'Travel/transport vendor';
    } else if (['SWIGGY', 'ZOMATO', 'RESTAURANT', 'FOOD', 'MEALS', 'EATSURE', 'BLINKIT', 'FUDR', 'CAFE', 'CANTEEN'].some(k => haystack.includes(k))) {
      category = 'Food / Meals';
      confidence = 'high';
      reason = 'Food/meals vendor';
    } else if (['PETROL', 'FUEL', 'DIESEL', 'HP PETROL', 'BHARAT PETROLEUM', 'INDIAN OIL', 'IOCL'].some(k => haystack.includes(k))) {
      category = 'Travel / Fuel';
      confidence = 'high';
      reason = 'Fuel purchase';
    } else if (['STATIONERY', 'STATIONARY', 'OFFICE SUPPLIES', 'PRINTER', 'AMAZON'].some(k => haystack.includes(k))) {
      category = 'Office Supplies';
      confidence = 'high';
      reason = 'Office supplies vendor';
    } else if (['CONSULTING', 'RETAINER', 'PROFESSIONAL FEE', 'FREELANCER', 'CONTRACTOR', 'ADVISORY', 'AGENCY FEE', 'AUDIT FEE', 'LEGAL FEE'].some(k => haystack.includes(k))) {
      category = 'Contractor / Professional Services';
      confidence = 'high';
      reason = 'Professional services';
    } else if (['INSURANCE', 'LIC PREMIUM', 'LIC ', 'HDFC LIFE', 'MAX LIFE', 'ICICI PRUDENTIAL', 'SBI LIFE', 'STAR HEALTH'].some(k => haystack.includes(k))) {
      category = 'Insurance';
      confidence = 'high';
      reason = 'Insurance premium';
    } else if (['CASH WDL', 'CASH WITHDRAWAL', 'ATM', 'CDM'].some(k => norm.includes(k))) {
      category = 'Cash Withdrawal';
      confidence = 'high';
      reason = 'ATM/cash withdrawal';
    } else if ((cpType as string) === 'government/tax') {
      category = 'Taxes / Compliance';
      confidence = 'high';
      reason = 'Government/tax payment';
    } else if ((cpType as string) === 'bank') {
      category = 'Banking / Charges';
      confidence = 'high';
      reason = 'Bank counterparty';
    }
    // Medium-confidence contextual guesses
    else if (cpType === 'person' && counterparty) {
      category = 'Contractor / Professional Services';
      confidence = 'medium';
      reason = 'UPI payment to individual (assumed contractor/freelancer)';
    } else if (cpType === 'business/vendor' && counterparty) {
      category = 'Vendor Payment';
      confidence = 'medium';
      reason = 'Payment to business entity';
    } else {
      category = 'Uncategorized Expense';
      confidence = 'low';
      reason = 'No matching category pattern';
    }
  }
  // --- Unknown direction → minimal inference
  else {
    if (counterparty && cpType === 'person') {
      category = 'Contractor / Professional Services';
      confidence = 'medium';
      reason = 'UPI transfer to individual';
    } else if (counterparty && cpType === 'business/vendor') {
      category = 'Vendor Payment';
      confidence = 'medium';
      reason = 'Transfer to business';
    }
  }

  return {
    payment_rail: rail,
    counterparty_name: counterparty,
    counterparty_type: cpType,
    reference_number: ref,
    upi_id: upiId,
    bank_ifsc_or_code: ifsc,
    likely_category: category,
    confidence,
    reason,
    is_internal_transfer: isInternalTransfer,
    direction_hint: directionHint
  };
}
