// No date-fns needed

export interface ReportInput {
  organization: any;
  client: any;
  transactions: any[];
  vendors: any[];
  riskEvents: any[];
  notes: any[];
  uploadedFiles: any[];
  imports: any[];
  periodStart?: string;
  periodEnd?: string;
  generatedBy?: string;
}

export function formatReportCurrency(amount: number, currency: string = "INR") {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

export function calculateReportPeriod(transactions: any[]) {
  if (!transactions || transactions.length === 0) {
    return { periodStart: null, periodEnd: null };
  }

  const dates = transactions
    .map(t => t.date ? new Date(t.date) : null)
    .filter(d => d !== null) as Date[];

  if (dates.length === 0) return { periodStart: null, periodEnd: null };

  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

  const periodStart = minDate.toISOString().split('T')[0];
  const periodEnd = maxDate.toISOString().split('T')[0];

  return { periodStart, periodEnd };
}

export function summarizeTransactions(transactions: any[]) {
  let income = 0;
  let expenses = 0;
  let unknownCount = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  for (const t of transactions) {
    const amount = Number(t.amount) || 0;
    if (t.normalized_type === 'income') {
      income += amount;
      incomeCount++;
    } else if (t.normalized_type === 'expense') {
      expenses += amount;
      expenseCount++;
    } else {
      unknownCount++;
    }
  }

  return {
    income,
    expenses,
    netCashMovement: income - expenses,
    transactionCount: transactions.length,
    incomeCount,
    expenseCount,
    unknownCount
  };
}

export function summarizeVendors(vendors: any[], transactions: any[]) {
  const vendorSpend = vendors.map(v => {
    const vendorTxs = transactions.filter(t => t.vendor_id === v.id && t.normalized_type === 'expense');
    const totalSpend = vendorTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    return {
      ...v,
      totalSpend
    };
  });

  const sortedVendors = [...vendorSpend].sort((a, b) => b.totalSpend - a.totalSpend);
  const topVendors = sortedVendors.slice(0, 5);
  
  const recurringVendors = vendors.filter(v => v.is_recurring);
  const flaggedVendors = vendors.filter(v => v.review_status === 'needs_review');
  
  const totalVendorSpend = vendorSpend.reduce((sum, v) => sum + v.totalSpend, 0);

  const recurringCommitment = recurringVendors.reduce((sum, v) => {
    const vendorTxs = transactions.filter(t => t.vendor_id === v.id && t.normalized_type === 'expense');
    if (vendorTxs.length > 0) {
      // rough average per month or just use the latest transaction as commitment
      // For deterministic simplicity, just take max amount for recurring commitment
      const maxSpend = Math.max(...vendorTxs.map(t => Number(t.amount) || 0), 0);
      return sum + maxSpend;
    }
    return sum;
  }, 0);

  return {
    topVendors,
    recurringVendors,
    flaggedVendors,
    totalVendorSpend,
    recurringCommitment
  };
}

export function summarizeRisks(riskEvents: any[]) {
  const openRisks = riskEvents.filter(r => r.status === 'open');
  const confirmedRisks = riskEvents.filter(r => r.status === 'confirmed');
  const falsePositives = riskEvents.filter(r => r.status === 'false_positive');
  const ignoredRisks = riskEvents.filter(r => r.status === 'ignored');

  const reviewedRisksCount = confirmedRisks.length + falsePositives.length + ignoredRisks.length;
  const reviewExposure = openRisks.reduce((sum, r) => sum + (Number(r.amount_involved) || 0), 0);

  return {
    openRisks,
    confirmedRisks,
    falsePositives,
    ignoredRisks,
    reviewedRisksCount,
    openRisksCount: openRisks.length,
    reviewExposure,
    allRisks: [...riskEvents].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  };
}

export function summarizeNotes(notes: any[], riskEvents: any[]) {
  const noteSummary = notes.map(note => {
    const risk = riskEvents.find(r => r.id === note.entity_id);
    return {
      id: note.id,
      text: note.content,
      relatedRiskTitle: risk?.title || 'Unknown Risk',
      created_at: note.created_at,
      author: 'Accountant' // Placeholder if no user info is joined
    };
  });

  return noteSummary;
}

export function summarizeSourceFiles(imports: any[], uploadedFiles: any[]) {
  return uploadedFiles.map(file => {
    const fileImports = imports.filter(i => i.file_id === file.id);
    return {
      fileName: file.file_name,
      rowCount: file.row_count,
      status: file.status,
      generatedTimestamp: file.created_at,
      importsCount: fileImports.length
    };
  });
}

export function buildReportSections(data: any) {
  const { transactionSummary, vendorSummary, riskSummary, noteSummary, sourceSummary, client } = data;

  const executiveSummary = {
    clientName: client?.name || 'Unknown Client',
    period: `${data.periodStart || 'Unknown'} to ${data.periodEnd || 'Unknown'}`,
    transactionCount: transactionSummary.transactionCount,
    totalIncome: transactionSummary.income,
    totalExpenses: transactionSummary.expenses,
    netCashMovement: transactionSummary.netCashMovement,
    openRisksCount: riskSummary.openRisksCount,
    reviewedRisksCount: riskSummary.reviewedRisksCount,
    topExpenseSource: vendorSummary.topVendors[0]?.normalized_name || 'None',
    recurringCommitment: vendorSummary.recurringCommitment,
  };

  const isExpenseOnly = transactionSummary.incomeCount === 0 && transactionSummary.expenseCount > 0;
  
  let deterministicText = `Kaeo analyzed ${transactionSummary.transactionCount} transactions for this client. `;
  if (isExpenseOnly) {
    deterministicText += `This appears to be an expense-only import. Revenue cannot be assessed from the current data. `;
  } else {
    deterministicText += `The client recorded ${formatReportCurrency(transactionSummary.income)} income and ${formatReportCurrency(transactionSummary.expenses)} expenses, resulting in net cash movement of ${formatReportCurrency(transactionSummary.netCashMovement)}. `;
  }

  if (riskSummary.openRisksCount > 0) {
    deterministicText += `There are ${riskSummary.openRisksCount} open risks requiring review. `;
  }

  if (noteSummary.length > 0) {
    deterministicText += `Review notes are included for risks with accountant/client comments.`;
  }

  const caveats = {
    unknownCount: transactionSummary.unknownCount,
    warnings: [],
    expenseOnly: isExpenseOnly,
    importedDataCaveat: "This report is based only on uploaded/imported files for this client."
  };

  return {
    executiveSummary,
    deterministicText,
    financialSummary: transactionSummary,
    vendorSummary,
    riskSummary,
    noteSummary,
    caveats,
    sourceFiles: sourceSummary
  };
}

export async function generateCFOReport(input: ReportInput) {
  const {
    client,
    transactions,
    vendors,
    riskEvents,
    notes,
    uploadedFiles,
    imports,
    periodStart: explicitStart,
    periodEnd: explicitEnd
  } = input;

  const { periodStart: calcStart, periodEnd: calcEnd } = calculateReportPeriod(transactions);
  
  const periodStart = explicitStart || calcStart;
  const periodEnd = explicitEnd || calcEnd;

  const transactionSummary = summarizeTransactions(transactions);
  const vendorSummary = summarizeVendors(vendors, transactions);
  const riskSummary = summarizeRisks(riskEvents);
  
  // Filter notes to only those attached to risk_events (entity_type = 'risk_event')
  const riskNotes = notes.filter(n => n.entity_type === 'risk_event');
  const noteSummary = summarizeNotes(riskNotes, riskEvents);
  
  const sourceSummary = summarizeSourceFiles(imports, uploadedFiles);

  const sections = buildReportSections({
    client,
    periodStart,
    periodEnd,
    transactionSummary,
    vendorSummary,
    riskSummary,
    noteSummary,
    sourceSummary
  });

  const title = `CFO Report - ${client?.name || 'Client'} - ${new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date())}`;

  const report = {
    title,
    report_type: 'monthly_cfo',
    period_start: periodStart,
    period_end: periodEnd,
    summary_json: sections.executiveSummary,
    sections_json: sections,
    source_json: { sourceSummary }
  };

  return report;
}
