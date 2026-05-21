// No date-fns needed
import { inferCategory, normalizeVendorName } from './vendorEngine';

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
  const isNegative = amount < 0;
  const absVal = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(absVal);
  return isNegative ? `-${formatted}` : formatted;
}

export function calculateReportPeriod(transactions: any[]) {
  if (!transactions || transactions.length === 0) {
    return { periodStart: null, periodEnd: null };
  }

  const dates = transactions
    .map(t => {
      const d = t.transaction_date || t.date;
      return d ? new Date(d) : null;
    })
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
  let refunds = 0;
  let unknownCount = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  let refundCount = 0;

  for (const t of transactions) {
    const amount = Math.abs(Number(t.amount) || 0);
    if (t.type === 'income') {
      income += amount;
      incomeCount++;
    } else if (['expense', 'vendor_payment', 'subscription'].includes(t.type)) {
      expenses += amount;
      expenseCount++;
    } else if (t.type === 'refund') {
      refunds += amount;
      refundCount++;
    } else if (t.type === 'unknown') {
      unknownCount++;
    }
  }

  const missingDates = transactions.filter(t => !t.transaction_date && !t.date).length;
  const missingDescriptions = transactions.filter(t => !t.description).length;

  return {
    income,
    expenses,
    refunds,
    netCashMovement: income + refunds - expenses,
    transactionCount: transactions.length,
    incomeCount,
    expenseCount,
    refundCount,
    unknownCount,
    missingDates,
    missingDescriptions
  };
}

export function summarizeVendors(vendors: any[], transactions: any[]) {
  const vendorMap = new Map();

  for (const t of transactions) {
    if (['expense', 'vendor_payment', 'subscription'].includes(t.type)) {
      const amt = Math.abs(Number(t.amount) || 0);
      const { display: tempName, normalized: normName } = normalizeVendorName(t.description);

      const dbVendor = vendors.find(dv => 
        (t.vendor_id && dv.id === t.vendor_id) || 
        dv.normalized_name === normName ||
        t.description.toLowerCase().includes(dv.normalized_name)
      );

      let vendorName = '';
      let category = '';
      let isRecurring = false;
      let reviewStatus = 'ok';

      if (dbVendor) {
        vendorName = dbVendor.name || tempName;
        category = dbVendor.category;
        isRecurring = dbVendor.recurrence_pattern === 'monthly' || dbVendor.is_recurring;
        reviewStatus = dbVendor.recommendation === 'review' ? 'needs_review' : 'ok';
      } else {
        vendorName = tempName;
        category = inferCategory(vendorName);
        
        const excludeRecurring = ['Payroll', 'Vendor / Services', 'Marketing', 'Office'].includes(category);
        if (!excludeRecurring) {
          isRecurring = ['slack', 'zoho books', 'canva'].includes(normName) || 
                        t.description.toLowerCase().includes('subscription') || 
                        t.description.toLowerCase().includes('software');
        }
      }

      if (!vendorMap.has(vendorName)) {
        vendorMap.set(vendorName, {
          normalized_name: vendorName,
          category: category,
          totalSpend: 0,
          is_recurring: isRecurring,
          review_status: reviewStatus,
          id: t.vendor_id || dbVendor?.id,
          monthly_average: dbVendor ? dbVendor.monthly_average : 0
        });
      }

      const existing = vendorMap.get(vendorName);
      existing.totalSpend += amt;
      existing.is_recurring = existing.is_recurring || isRecurring;
      if (reviewStatus !== 'ok') existing.review_status = reviewStatus;
    }
  }

  const vendorSpend = Array.from(vendorMap.values());
  const sortedVendors = vendorSpend.filter(v => v.totalSpend > 0).sort((a, b) => b.totalSpend - a.totalSpend);
  const topVendors = sortedVendors.length <= 6 ? sortedVendors : sortedVendors.slice(0, 5);
  
  const recurringVendors = vendorSpend.filter(v => v.is_recurring);
  const flaggedVendors = vendorSpend.filter(v => v.review_status === 'needs_review');
  
  const totalVendorSpend = vendorSpend.reduce((sum, v) => sum + v.totalSpend, 0);

  const recurringCommitment = recurringVendors.reduce((sum, v) => {
    if (v.monthly_average) {
      return sum + Number(v.monthly_average);
    }
    const vendorTxs = transactions.filter(t => 
      (t.vendor_id && t.vendor_id === v.id) || 
      normalizeVendorName(t.description).normalized === v.normalized_name
    );
    const amounts = vendorTxs.map(t => Math.abs(Number(t.amount) || 0));
    const sortedAmts = [...amounts].sort((a, b) => a - b);
    const medianSpend = sortedAmts[Math.floor(sortedAmts.length / 2)] || 0;
    return sum + medianSpend;
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
  const reviewExposure = openRisks.reduce((sum, r) => sum + (Number(r.amount_at_risk) || 0), 0);

  return {
    openRisks,
    confirmedRisks,
    falsePositives,
    ignoredRisks,
    reviewedRisksCount,
    openRisksCount: openRisks.length,
    reviewExposure,
    totalRisksCount: riskEvents.length,
    allRisks: [...riskEvents].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  };
}

export function summarizeNotes(notes: any[], riskEvents: any[]) {
  const noteSummary = notes.map(note => {
    const risk = riskEvents.find(r => r.id === note.entity_id);
    return {
      id: note.id,
      text: note.note,
      relatedRiskTitle: risk?.title || 'Unknown Risk',
      created_at: note.created_at,
      author: 'Accountant' // Placeholder if no user info is joined
    };
  });

  return noteSummary;
}

export function summarizeSourceFiles(imports: any[], uploadedFiles: any[], transactions: any[]) {
  const activeFileIds = new Set(transactions.map(t => t.file_id).filter(Boolean));
  const uniqueFiles = new Map();
  
  for (const file of uploadedFiles) {
    if (activeFileIds.has(file.id)) {
      uniqueFiles.set(file.file_name, {
        id: file.id,
        fileName: file.file_name,
        rowCount: file.row_count,
        status: file.status,
        generatedTimestamp: file.created_at,
        importsCount: imports.filter(i => i.file_id === file.id).length
      });
    }
  }

  // Fallback if no transactions have file_id
  if (uniqueFiles.size === 0) {
    const activeImportIds = new Set(transactions.map(t => t.import_id).filter(Boolean));
    for (const file of uploadedFiles) {
      if (!uniqueFiles.has(file.file_name)) {
        const fileImports = imports.filter(i => i.file_id === file.id);
        const hasActiveImport = fileImports.some(i => activeImportIds.has(i.id));
        if (hasActiveImport) {
          uniqueFiles.set(file.file_name, {
            id: file.id,
            fileName: file.file_name,
            rowCount: file.row_count,
            status: file.status,
            generatedTimestamp: file.created_at,
            importsCount: fileImports.length
          });
        }
      }
    }
  }

  return Array.from(uniqueFiles.values());
}

export function buildReportSections(data: any) {
  const { transactionSummary, vendorSummary, riskSummary, noteSummary, sourceSummary, client } = data;

  const executiveSummary = {
    clientName: client?.name || 'Unknown Client',
    period: `${data.periodStart || 'Unknown'} to ${data.periodEnd || 'Unknown'}`,
    transactionCount: transactionSummary.transactionCount,
    totalIncome: transactionSummary.income,
    totalRefunds: transactionSummary.refunds || 0,
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
    deterministicText += `The client recorded ${formatReportCurrency(transactionSummary.income)} income`;
    if (transactionSummary.refunds > 0) {
      deterministicText += ` and ${formatReportCurrency(transactionSummary.refunds)} refunds/recoveries`;
    }
    deterministicText += ` and ${formatReportCurrency(transactionSummary.expenses)} expenses, resulting in net cash movement of ${formatReportCurrency(transactionSummary.netCashMovement)}. `;
  }

  if (riskSummary.openRisksCount > 0) {
    deterministicText += `There are ${riskSummary.openRisksCount} open risks requiring review. `;
  }

  if (noteSummary.length > 0) {
    deterministicText += `Review notes are included for risks with accountant/client comments.`;
  }

  const caveats = {
    unknownCount: transactionSummary.unknownCount,
    missingDates: transactionSummary.missingDates,
    missingDescriptions: transactionSummary.missingDescriptions,
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
  
  const sourceSummary = summarizeSourceFiles(imports, uploadedFiles, transactions);

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

  const sourceFileIds = sourceSummary.map(s => s.id).filter(Boolean);
  const sourceFileNames = sourceSummary.map(s => s.fileName);
  const importIds = Array.from(new Set(transactions.map(t => t.import_id).filter(Boolean)));

  const report = {
    title,
    report_type: 'monthly_cfo',
    period_start: periodStart,
    period_end: periodEnd,
    summary_json: sections.executiveSummary,
    sections_json: sections,
    source_json: { 
      sourceSummary,
      source_file_ids: sourceFileIds,
      source_file_names: sourceFileNames,
      import_ids: importIds,
      generated_at: new Date().toISOString()
    }
  };

  return report;
}
