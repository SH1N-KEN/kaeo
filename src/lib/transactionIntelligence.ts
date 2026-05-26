
export interface ExtractedInfo {
  payment_rail: string;
  counterparty_name: string | null;
  counterparty_type: 'person' | 'business/vendor' | 'bank' | 'government/tax' | 'unknown';
  reference_number: string | null;
  upi_id: string | null;
  bank_ifsc_or_code: string | null;
  likely_category: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

export function parseIndianNarration(narration: string, amount: number): ExtractedInfo {
  const norm = narration.toUpperCase().trim();
  let rail = 'unknown';
  let counterparty: string | null = null;
  let upiId: string | null = null;
  let ifsc: string | null = null;
  let ref: string | null = null;

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
    // UPI-<Name>-<VPA>-<IFSC>-<UTR>-<Purpose>
    const parts = norm.split('-');
    if (parts.length >= 3) {
      counterparty = parts[1].trim();
      
      // Clean counterparty name
      counterparty = counterparty.replace(/^(MR|MRS|MS|DR|MISS|BY)\s+/i, '').trim();

      // Find VPA, IFSC, Ref in the parts
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
      // Fallback split by slash /
      const slashParts = norm.split('/');
      if (slashParts.length >= 3) {
        counterparty = slashParts[2].trim().replace(/^(MR|MRS|MS|DR|MISS)\s+/i, '').trim();
      }
    }
  } else if (rail === 'NEFT') {
    // NEFT CR-<IFSC>-<Sender>-<Receiver>-<Ref>
    const parts = norm.split('-');
    if (parts.length >= 3) {
      ifsc = parts[1].trim();
      let rawCp = parts[2].trim();
      rawCp = rawCp.replace(/\s+(PAYMENT AGGREGATOR|ESCR|PA).*$/i, '').trim();
      counterparty = rawCp;
    }
  } else if (rail === 'IMPS') {
    // IMPS-<UTR>-<Counterparty>-<IFSC>-...
    const parts = norm.split('-');
    if (parts.length >= 3) {
      ref = parts[1].trim();
      counterparty = parts[2].trim();
    }
  } else if (rail === 'POS' || norm.includes('POS')) {
    // POS 514834XXXXXX4085 ANTHROPIC or similar
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

  // Fallback for Bank Charges
  if (['AMB CHRG', 'SMS CHG', 'BANK CHARGES', 'BANK CHG', 'ALERT CHG', 'DC INTL POS TXN MARKUP'].some(k => norm.includes(k))) {
    counterparty = 'HDFC BANK';
  } else if (norm.includes('GST')) {
    counterparty = 'GST / Tax Department';
  }

  // Clean Counterparty further
  if (counterparty) {
    counterparty = counterparty.replace(/INV(?:OICE)?\s*#?\d+/i, '').trim();
    counterparty = counterparty.replace(/ORDER\s*\d+/i, '').trim();
    counterparty = counterparty.replace(/CNRB\d+|SBIN\d+|HDFC\d+|ICIC\d+|UTIB\d+/i, '').trim(); // Remove IFSC codes
    counterparty = counterparty.replace(/-\d+.*$/, '').trim(); // Remove trailing hyphens and numbers
    counterparty = counterparty.replace(/\s+/g, ' ').trim();
  }

  // 3. Classify Counterparty Type
  let type: ExtractedInfo['counterparty_type'] = 'unknown';
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

  // 4. Infer Category
  let category: string = 'Uncategorized';
  let confidence: ExtractedInfo['confidence'] = 'low';
  let reason = 'Generic narration pattern';

  const isCredit = amount > 0;
  const cpUpper = counterparty?.toUpperCase() ?? '';

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
    // Outflows
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

  // Contextual Medium Confidence guesses for remaining rows
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
