import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Zap,
  FileText,
  UploadCloud,
  Clock,
  Trash2,
  Sparkles,
  Inbox,
  Filter
} from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import { useToast } from '../hooks/useToast';
import UploadZone from '../components/files/UploadZone';
import FilePreview from '../components/files/FilePreview';
import FileHistory from '../components/files/FileHistory';
import EmptyState from '../components/ui/EmptyState';
import StatusBadge from '../components/ui/StatusBadge';
import { parseFinancialFile } from '../lib/fileParser';
import type { IngestedParsedFile } from '../lib/ingestion/ingestionTypes';
import { generateBestMapping } from '../lib/mappingEngine';
import type { MappingSuggestion } from '../lib/mappingEngine';
import { supabase } from '../lib/supabase';
import { trackUsageEvent } from '../lib/billing';
import { checkUsageEventAllowed } from '../lib/billingGuards';
import { normalizeIngestedRows } from '../lib/ingestion/transactionNormalizer';
import { checkDuplicateTransactions } from '../lib/ingestion/duplicateEngine';
import { formatMoney } from '../lib/currency';

// Invoice imports
import { extractInvoiceFields, type InvoiceExtractedFields } from '../lib/invoice/invoiceExtractor';
import { analyzeRisksForClient } from '../lib/riskEngine';

type FilesTab = 'transactions' | 'invoices' | 'history';
type UploadType = 'bank_statement' | 'gateway_export' | 'vendor_invoice' | 'mixed' | 'detect';

interface ImportSummary {
  importedCount: number;
  skippedCount: number;
  unknownCount: number;
  newRisksCount: number;
}

const Files: React.FC = () => {
  const { activeClient, activeOrg } = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Tab control
  const [activeTab, setActiveTab] = useState<FilesTab>('transactions');
  const [selectedUploadType, setSelectedUploadType] = useState<UploadType>('detect');
  
  // Statement uploads states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; subtext?: string; showUpgrade?: boolean } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<IngestedParsedFile | null>(null);
  const [autoMapping, setAutoMapping] = useState<MappingSuggestion | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  
  // Invoices states
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [matchingCandidates, setMatchingCandidates] = useState<any[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [manualMatchId, setManualMatchId] = useState<string>('');

  useEffect(() => {
    if (activeClient) {
      fetchHistory();
      fetchInvoices();
    }
    if (location.state?.success) setSuccess(location.state.success);
  }, [activeClient, location.state]);

  const fetchHistory = async () => {
    if (!activeClient) return;
    const { data } = await supabase
      .from('uploaded_files')
      .select('*')
      .eq('client_id', activeClient.id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    setHistory(data || []);
  };

  const fetchInvoices = async () => {
    if (!activeClient) return;
    setLoadingInvoices(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          invoice_matches (
            transaction_id,
            match_status,
            confidence,
            reason,
            transactions (
              description,
              amount,
              transaction_date
            )
          )
        `)
        .eq('client_id', activeClient.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      console.error('Error loading invoices:', err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  // Switch tab triggers
  const handleTabChange = (tab: FilesTab) => {
    setActiveTab(tab);
    setError(null);
    setSuccess(null);
    setImportSummary(null);
    setParseResult(null);
    setPendingFile(null);
  };

  // Upload Type selection modifier
  const handleUploadTypeChange = (type: UploadType) => {
    setSelectedUploadType(type);
    if (type === 'vendor_invoice') {
      setActiveTab('invoices');
      setSelectedUploadType('detect'); // reset transactions upload selection
    }
  };

  // Statement Ingestion
  const handleSheetChange = async (sheetId: string) => {
    if (!parseResult || !parseResult.sheets || !pendingFile) return;
    const sheet = parseResult.sheets.find(s => s.id === sheetId);
    if (!sheet) return;
    
    setLoading(true);
    try {
      const mappingResult = await generateBestMapping(
        sheet.detectedColumns,
        sheet.rawRows.slice(0, 10),
        pendingFile.name,
        parseResult.provider
      );

      const updatedResult: IngestedParsedFile = {
        ...parseResult!,
        selectedSheetId: sheetId,
        headers: sheet.detectedColumns,
        detectedColumns: sheet.detectedColumns,
        rows: sheet.rawRows.slice(0, 10),
        previewRows: sheet.rawRows.slice(0, 10),
        allRows: sheet.rawRows,
        rawRows: sheet.rawRows,
        rowCount: sheet.rowCount,
        confidence: sheet.confidence,
        warnings: sheet.warnings,
        isNonFinancial: sheet.isNonFinancial,
        metadata: {
          ...parseResult!.metadata,
          totalRows: sheet.rowCount,
          previewRowCount: Math.min(10, sheet.rowCount),
          detectedHeaderRow: sheet.detectedHeaderRow,
          skippedRows: sheet.skippedRows
        },
        provider: parseResult!.provider,
        sourceType: parseResult!.sourceType
      };

      setParseResult(updatedResult);
      setAutoMapping(mappingResult);

      if (activeClient) {
        const { data: importData } = await supabase
          .from('imports')
          .select('id')
          .eq('client_id', activeClient.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (importData) {
          await supabase
            .from('imports')
            .update({
              selected_sheet_name: sheetId,
              row_count: sheet.rowCount,
              raw_columns_json: sheet.detectedColumns,
              preview_rows_json: sheet.rawRows.slice(0, 10),
              parsed_rows_json: sheet.rawRows,
              detected_header_row: sheet.detectedHeaderRow || 0,
              ingestion_confidence: sheet.confidence,
              ingestion_warnings_json: sheet.warnings,
              status: mappingResult.status === 'ready_to_import' ? 'ready_to_import' : 'mapping_required'
            })
            .eq('id', importData.id);

          await supabase
            .from('import_mappings')
            .update({
              confirmed_mapping_json: mappingResult.mapping
            })
            .eq('import_id', importData.id);
        }
      }
    } catch (err: any) {
      setError({ message: 'Worksheet switch failed', subtext: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (file: File) => {
    setError(null);
    setSuccess(null);
    setImportSummary(null);
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    const supportedTypes = ['csv', 'xlsx', 'xls', 'pdf'];
    if (!ext || !supportedTypes.includes(ext)) {
      setError({ message: `Format .${ext} is not supported.`, subtext: 'Kaeo supports CSV, XLSX, and PDF statement files.' });
      return;
    }

    if (!activeOrg) {
      setError({ message: 'No active workspace', subtext: 'Please select a workspace before uploading.' });
      return;
    }

    setLoading(true);
    try {
      const limitCheck = await checkUsageEventAllowed(activeOrg.id, 'file_uploaded', 1);
      if (!limitCheck.allowed) {
        setError({
          message: limitCheck.message || 'File upload limit reached for this billing cycle.',
          subtext: 'Please upgrade your plan to upload additional files.',
          showUpgrade: true
        });
        setLoading(false);
        return;
      }
      
      const result = await parseFinancialFile(file);

      if (result.errors && result.errors.length > 0) {
        setError({ message: 'Parsing failed', subtext: result.errors[0] });
        setLoading(false);
        return;
      }

      const mappingResult = await generateBestMapping(
        result.headers, 
        result.rows, 
        file.name, 
        result.provider
      );
      
      setPendingFile(file);
      setParseResult(result);
      setAutoMapping(mappingResult);

      const user = (await supabase.auth.getUser()).data.user;

      const { data: fileData, error: fileErr } = await supabase
        .from('uploaded_files')
        .insert({
          organization_id: activeOrg.id,
          client_id: activeClient!.id,
          file_name: file.name,
          file_type: ext,
          file_size: file.size,
          storage_path: `simulated/${file.name}`,
          status: mappingResult.status,
          parser_version: '12A',
          metadata: {
            row_count: result.rowCount,
            provider_detected: result.provider,
            confidence: result.confidence,
            mapping_confidence: mappingResult.confidence,
            mapping_source: mappingResult.source,
            warnings: result.warnings,
            sheets: result.sheets ? result.sheets.map(s => ({ name: s.name, rows: s.rowCount })) : []
          }
        })
        .select()
        .single();

      if (fileErr) throw fileErr;

      trackUsageEvent({
        organizationId: activeOrg.id,
        clientId: activeClient!.id,
        eventType: 'file_uploaded',
        quantity: 1,
        userId: user?.id
      });

      const { data: importData, error: importErr } = await supabase
        .from('imports')
        .insert({
          organization_id: activeOrg.id,
          client_id: activeClient!.id,
          file_id: fileData.id,
          provider_detected: result.provider,
          source_type: result.sourceType,
          row_count: result.rowCount,
          raw_columns_json: result.headers,
          preview_rows_json: result.rows,
          parsed_rows_json: result.allRows,
          selected_sheet_name: result.selectedSheetId || null,
          detected_header_row: result.metadata.detectedHeaderRow || 0,
          ingestion_confidence: result.confidence,
          ingestion_warnings_json: result.warnings,
          status: mappingResult.status === 'ready_to_import' ? 'ready_to_import' : 'mapping_required'
        })
        .select()
        .single();

      if (importErr) throw importErr;

      await supabase
        .from('import_mappings')
        .insert({
          organization_id: activeOrg.id,
          client_id: activeClient!.id,
          import_id: importData.id,
          confirmed_mapping_json: mappingResult.mapping,
          confirmed_by: user?.id,
          confirmed_at: mappingResult.status === 'ready_to_import' ? new Date().toISOString() : null
        });

      fetchHistory();
    } catch (err: any) {
      console.error('[Files] Statement Ingestion error:', err);
      setError({ message: 'Ingestion sync failed', subtext: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!autoMapping || !activeClient || !activeOrg || !parseResult) return;
    if (parseResult.isNonFinancial) {
      setError({
        message: 'Import blocked',
        subtext: 'This sheet looks informational, not a transaction ledger.'
      });
      return;
    }

    setLoading(true);
    try {
      const { data: importData, error: fetchErr } = await supabase
        .from('imports')
        .select('*, file_id(id)')
        .eq('client_id', activeClient.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchErr || !importData) throw new Error('Import session not found');
      
      if (importData.status === 'imported') {
        throw new Error('This file has already been imported.');
      }

      if (autoMapping.status === 'ready_to_import') {
        const rowsToImport = parseResult.allRows;
          
        const normalizedResult = normalizeIngestedRows(rowsToImport, autoMapping.mapping, {
          provider: parseResult.provider,
          currency: activeClient.base_currency || 'INR'
        });

        if (normalizedResult.transactions.length === 0) {
          setError({
            message: 'Import rejected: No transactions could be normalized.',
            subtext: 'Please review your column mappings to ensure required fields have data.'
          });
          setLoading(false);
          return;
        }

        const dupReport = await checkDuplicateTransactions(activeClient.id, normalizedResult.transactions);

        if (dupReport.importableCount === 0) {
          setError({
            message: 'Import blocked: Duplicate rows detected.',
            subtext: `Kaeo matched all ${dupReport.totalIncoming} rows in this upload against your existing transactions ledger. Row double-entry blocked.`
          });
          setLoading(false);
          return;
        }

        const txCheck = await checkUsageEventAllowed(activeOrg.id, 'transaction_imported', dupReport.importableCount);
        if (!txCheck.allowed) {
          setError({
            message: txCheck.message || 'Transaction import row limit reached for this billing cycle.',
            subtext: 'Please upgrade your plan to ingest additional transaction rows.',
            showUpgrade: true
          });
          setLoading(false);
          return;
        }
        
        const transactionsToInsert = dupReport.cleanTransactions.map(tx => ({
          organization_id: activeOrg.id,
          client_id: activeClient.id,
          import_id: importData.id,
          file_id: importData.file_id?.id,
          source_sheet_name: parseResult.selectedSheetId || null,
          ...tx
        }));

        const { error: insertErr } = await supabase
          .from('transactions')
          .insert(transactionsToInsert);

        if (insertErr) throw insertErr;

        const { data: userData } = await supabase.auth.getUser();
        trackUsageEvent({
          organizationId: activeOrg.id,
          clientId: activeClient.id,
          eventType: 'transaction_imported',
          quantity: transactionsToInsert.length,
          userId: userData?.user?.id
        });

        await supabase.from('imports').update({ status: 'imported' }).eq('id', importData.id);
        await supabase.from('uploaded_files').update({ status: 'imported' }).eq('id', importData.file_id?.id);

        // Run matching and risk calculations
        const risks = await analyzeRisksForClient(activeOrg.id, activeClient.id);

        setImportSummary({
          importedCount: transactionsToInsert.length,
          skippedCount: dupReport.dbDuplicates + dupReport.intraFileDuplicates,
          unknownCount: transactionsToInsert.filter(tx => tx.type === 'unknown').length,
          newRisksCount: risks.length
        });

        setPendingFile(null);
        setParseResult(null);
        setAutoMapping(null);
        fetchHistory();
      } else {
        navigate(`/files/${importData.id}/mapping`);
      }
    } catch (err: any) {
      console.error('[Files] Import action failed:', err);
      setError({ message: 'Import failed', subtext: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Invoice Ingestion MVP
  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !activeClient || !activeOrg) return;
    const file = e.target.files[0];
    
    setError(null);
    setUploadingInvoice(true);
    
    try {
      // 1. Simulate OCR fields extraction
      const fields = await extractInvoiceFields(file);
      
      const { data: { user } } = await supabase.auth.getUser();

      // 2. Save invoice to Supabase invoices table
      const { data: invData, error: dbErr } = await supabase
        .from('invoices')
        .insert({
          organization_id: activeOrg.id,
          client_id: activeClient.id,
          uploaded_by: user?.id,
          file_name: file.name,
          file_path: `invoices/${file.name}`,
          vendor_name: fields.vendorName,
          invoice_number: fields.invoiceNumber,
          invoice_date: fields.invoiceDate,
          due_date: fields.dueDate,
          subtotal: fields.subtotal,
          tax_amount: fields.taxAmount,
          total_amount: fields.totalAmount,
          currency: fields.currency,
          gstin: fields.gstin,
          status: fields.confidence < 0.6 ? 'needs_review' : 'uploaded',
          confidence: fields.confidence,
          extracted_data: {
            warnings: fields.warnings,
            rawTextSnippet: fields.rawTextSnippet
          }
        })
        .select()
        .single();

      if (dbErr) throw dbErr;

      // 3. Re-run risk/invoice matching engine
      await analyzeRisksForClient(activeOrg.id, activeClient.id);
      
      toast(`Invoice "${file.name}" scanned and uploaded.`, 'success');
      
      fetchInvoices();
      
      // Auto-open detail modal for verification
      const fetchedDetail = {
        ...invData,
        invoice_matches: []
      };
      setSelectedInvoice(fetchedDetail);
      fetchMatchingSuggestions(invData.total_amount);
      
    } catch (err: any) {
      console.error('Invoice scanning error:', err);
      setError({ message: 'Invoice scan failed', subtext: err.message });
    } finally {
      setUploadingInvoice(false);
    }
  };

  const fetchMatchingSuggestions = async (totalAmount: number) => {
    if (!activeClient) return;
    setCandidatesLoading(true);
    try {
      const minVal = Math.abs(totalAmount) * 0.9;
      const maxVal = Math.abs(totalAmount) * 1.1;
      
      // Load payment transactions close to amount
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('client_id', activeClient.id)
        .order('transaction_date', { ascending: false });

      if (error) throw error;

      const filtered = (data || []).filter(tx => {
        const amt = Math.abs(tx.amount);
        return tx.amount < 0 && amt >= minVal && amt <= maxVal;
      });

      setMatchingCandidates(filtered);
    } catch (err) {
      console.error('Error fetching matching transactions:', err);
    } finally {
      setCandidatesLoading(false);
    }
  };

  const handleOpenInvoiceDetail = (invoice: any) => {
    setSelectedInvoice(invoice);
    fetchMatchingSuggestions(invoice.total_amount);
    setManualMatchId(invoice.invoice_matches?.[0]?.transaction_id || '');
  };

  const handleUpdateInvoice = async (updatedFields: Partial<InvoiceExtractedFields> & { status: string }) => {
    if (!selectedInvoice) return;
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          vendor_name: updatedFields.vendorName,
          invoice_number: updatedFields.invoiceNumber,
          invoice_date: updatedFields.invoiceDate,
          due_date: updatedFields.dueDate,
          subtotal: updatedFields.subtotal,
          tax_amount: updatedFields.taxAmount,
          total_amount: updatedFields.totalAmount,
          gstin: updatedFields.gstin,
          status: updatedFields.status
        })
        .eq('id', selectedInvoice.id);

      if (error) throw error;

      // Update invoice_matches table if manual transaction link selected
      if (manualMatchId && manualMatchId !== selectedInvoice.invoice_matches?.[0]?.transaction_id) {
        // 1. Clear old match
        await supabase.from('invoice_matches').delete().eq('invoice_id', selectedInvoice.id);
        
        // 2. Insert manual match
        const selectedTx = matchingCandidates.find(t => t.id === manualMatchId);
        const amtDiff = Math.abs(Math.abs(selectedTx?.amount || 0) - (updatedFields.totalAmount || 0));
        
        await supabase
          .from('invoice_matches')
          .insert({
            invoice_id: selectedInvoice.id,
            transaction_id: manualMatchId,
            match_status: amtDiff < 0.05 ? 'matched' : 'mismatch',
            confidence: 1.0,
            reason: 'Manually verified and matched by user.'
          });

        // Update status in invoices
        await supabase
          .from('invoices')
          .update({ status: amtDiff < 0.05 ? 'matched' : 'mismatch' })
          .eq('id', selectedInvoice.id);
      }

      toast('Invoice verified and saved', 'success');
      setSelectedInvoice(null);
      fetchInvoices();
      await analyzeRisksForClient(activeOrg!.id, activeClient!.id);
    } catch (err: any) {
      toast('Failed to save invoice: ' + err.message, 'error');
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;
      toast('Invoice deleted successfully', 'success');
      fetchInvoices();
      await analyzeRisksForClient(activeOrg!.id, activeClient!.id);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleMarkPaid = async (invoiceId: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'paid' })
        .eq('id', invoiceId);

      if (error) throw error;
      toast('Invoice marked as Paid', 'success');
      fetchInvoices();
      await analyzeRisksForClient(activeOrg!.id, activeClient!.id);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'matched':
      case 'paid':
        return 'success';
      case 'overdue':
      case 'mismatch':
        return 'high';
      case 'needs_review':
      case 'unpaid':
      case 'uploaded':
      case 'extracted':
        return 'medium';
      case 'ignored':
      default:
        return 'success';
    }
  };

  if (!activeClient) {
    return (
      <div className="h-[70vh] flex items-center justify-center">
        <EmptyState 
          title="No client workspace selected"
          description="Select a client workspace before uploading finance files."
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2 tracking-tight">Finance Ingestion</h1>
          <p className="text-sm text-muted-foreground">Reconcile transaction ledgers and vendor invoices for <span className="text-foreground font-semibold">{activeClient.name}</span>.</p>
        </div>
      </div>

      {/* Tabs list selector */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-xl border border-border/50 w-fit">
        <button
          onClick={() => handleTabChange('transactions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
            activeTab === 'transactions'
              ? 'bg-card text-foreground shadow-sm border border-border/60'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5" />
          Transactions Ingestion
        </button>
        <button
          onClick={() => handleTabChange('invoices')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
            activeTab === 'invoices'
              ? 'bg-card text-foreground shadow-sm border border-border/60'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Invoices Scanning
        </button>
        <button
          onClick={() => handleTabChange('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
            activeTab === 'history'
              ? 'bg-card text-foreground shadow-sm border border-border/60'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Upload History
        </button>
      </div>

      {error && (
        <div className="p-4 bg-risk/5 border border-risk/10 rounded-xl flex gap-3 items-start animate-in shake-in">
          <AlertCircle className="w-5 h-5 text-risk/70 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm text-risk/80 font-bold">{error.message}</h4>
            {error.subtext && <p className="text-xs text-risk/60 mt-1">{error.subtext}</p>}
            {error.showUpgrade && (
              <button
                onClick={() => navigate('/billing')}
                className="mt-3 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold rounded-lg transition-all shadow-md shadow-primary/10 inline-flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-warning fill-warning" />
                Upgrade Subscription
              </button>
            )}
          </div>
          <button onClick={() => setError(null)} className="text-[10px] font-black text-risk/60 hover:text-risk uppercase">Dismiss</button>
        </div>
      )}

      {success && !importSummary && (
        <div className="p-4 bg-success/5 border border-success/10 rounded-xl flex gap-3 items-center animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
          <p className="text-sm text-success font-bold flex-1">{success}</p>
          <button onClick={() => setSuccess(null)}><X className="w-4 h-4 text-success" /></button>
        </div>
      )}

      {/* ─── TAB: Transactions ─── */}
      {activeTab === 'transactions' && (
        <>
          {loading && !parseResult && (
            <div className="h-64 bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <Zap className="w-4 h-4 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="text-xs text-muted-foreground font-black uppercase tracking-widest">Applying intelligence mapping...</p>
            </div>
          )}

          {importSummary && (
            <div className="premium-glass border border-success/30 rounded-2xl p-6 space-y-5 animate-in zoom-in-95">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-success/10 rounded-full flex items-center justify-center text-success">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Import Completed Successfully</h3>
                  <p className="text-xs text-muted-foreground">Ledger updated with parsed transactions.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
                <div className="p-4 bg-white/5 border border-border/20 rounded-xl">
                  <span className="text-[10px] text-muted-foreground font-black uppercase block">Imported</span>
                  <span className="text-xl font-black text-foreground">{importSummary.importedCount} rows</span>
                </div>
                <div className="p-4 bg-white/5 border border-border/20 rounded-xl">
                  <span className="text-[10px] text-muted-foreground font-black uppercase block">Duplicates Skipped</span>
                  <span className="text-xl font-black text-success">{importSummary.skippedCount} rows</span>
                </div>
                <div className="p-4 bg-white/5 border border-border/20 rounded-xl">
                  <span className="text-[10px] text-muted-foreground font-black uppercase block">Unknown Rows</span>
                  <span className="text-xl font-black text-amber-500">{importSummary.unknownCount} rows</span>
                </div>
                <div className="p-4 bg-white/5 border border-border/20 rounded-xl">
                  <span className="text-[10px] text-muted-foreground font-black uppercase block">Active Risks</span>
                  <span className="text-xl font-black text-risk">{importSummary.newRisksCount} items</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-3 border-t border-border/25">
                <button
                  onClick={() => navigate('/risk-inbox')}
                  className="px-4 py-2.5 bg-risk/10 hover:bg-risk/20 text-risk rounded-xl text-xs font-bold border border-risk/25 flex items-center gap-1.5 transition-colors"
                >
                  <Inbox className="w-4 h-4" /> Review Risks
                </button>
                <button
                  onClick={() => navigate('/transactions?category=uncategorized')}
                  className="px-4 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold border border-primary/25 flex items-center gap-1.5 transition-colors"
                >
                  <Filter className="w-4 h-4" /> Categorize Transactions
                </button>
                <button
                  onClick={() => navigate('/ask-kaeo')}
                  className="px-4 py-2.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 rounded-xl text-xs font-bold border border-teal-500/25 flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-4 h-4" /> Ask Kaeo advisor
                </button>
                <button
                  onClick={() => setImportSummary(null)}
                  className="px-4 py-2.5 bg-muted hover:bg-muted-foreground/10 text-foreground rounded-xl text-xs font-semibold border border-border/40 transition-colors ml-auto"
                >
                  Upload another statement
                </button>
              </div>
            </div>
          )}

          {!loading && !parseResult && !importSummary && (
            <div className="space-y-8">
              {/* Type selector */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select File Upload Intent</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <button 
                    onClick={() => handleUploadTypeChange('detect')}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                      selectedUploadType === 'detect' 
                        ? 'bg-primary/10 text-primary border-primary/30 shadow-sm shadow-primary/5' 
                        : 'bg-muted/15 border-border/30 hover:border-border text-muted-foreground'
                    }`}
                  >
                    Auto Detect
                  </button>
                  <button 
                    onClick={() => handleUploadTypeChange('bank_statement')}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                      selectedUploadType === 'bank_statement' 
                        ? 'bg-primary/10 text-primary border-primary/30 shadow-sm' 
                        : 'bg-muted/15 border-border/30 hover:border-border text-muted-foreground'
                    }`}
                  >
                    Bank Statement
                  </button>
                  <button 
                    onClick={() => handleUploadTypeChange('gateway_export')}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                      selectedUploadType === 'gateway_export' 
                        ? 'bg-primary/10 text-primary border-primary/30 shadow-sm' 
                        : 'bg-muted/15 border-border/30 hover:border-border text-muted-foreground'
                    }`}
                  >
                    Razorpay Export
                  </button>
                  <button 
                    onClick={() => handleUploadTypeChange('vendor_invoice')}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold text-center transition-all bg-muted/15 border-border/30 hover:border-border text-muted-foreground`}
                  >
                    Vendor Invoice
                  </button>
                  <button 
                    onClick={() => handleUploadTypeChange('mixed')}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                      selectedUploadType === 'mixed' 
                        ? 'bg-primary/10 text-primary border-primary/30 shadow-sm' 
                        : 'bg-muted/15 border-border/30 hover:border-border text-muted-foreground'
                    }`}
                  >
                    Mixed Ledger
                  </button>
                </div>
              </div>

              {/* Upload Zone */}
              <div className="space-y-4">
                <UploadZone onFileSelect={handleFileSelect} loading={loading} />
                <div className="flex items-start gap-2.5 px-3 text-[11px] text-muted-foreground">
                  <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Smart upload guidance:</strong> Upload your bank statement or payment export. Kaeo will detect income, expenses, refunds, risks, and unknown rows.
                  </span>
                </div>
              </div>

              {/* Quick Upload templates */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div 
                  onClick={() => handleUploadTypeChange('bank_statement')}
                  className="p-5 premium-glass premium-glass-hover border border-border/40 rounded-2xl cursor-pointer"
                >
                  <h4 className="font-bold text-xs text-foreground mb-1">Bank Statement</h4>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">Import transactional ledger logs from HDFC, ICICI, etc.</p>
                </div>
                <div 
                  onClick={() => handleUploadTypeChange('gateway_export')}
                  className="p-5 premium-glass premium-glass-hover border border-border/40 rounded-2xl cursor-pointer"
                >
                  <h4 className="font-bold text-xs text-foreground mb-1">Razorpay Payouts</h4>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">Import gateway exports directly to verify fees and charges.</p>
                </div>
                <div 
                  onClick={() => handleTabChange('invoices')}
                  className="p-5 premium-glass premium-glass-hover border border-border/40 rounded-2xl cursor-pointer"
                >
                  <h4 className="font-bold text-xs text-foreground mb-1">Invoices Folder</h4>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">Reconcile scans against ledger outflow events.</p>
                </div>
                <div 
                  onClick={() => toast('Tally Prime XML integrations are planned for Phase 16', 'info')}
                  className="p-5 premium-glass premium-glass-hover border border-border/40 rounded-2xl cursor-pointer opacity-70"
                >
                  <h4 className="font-bold text-xs text-muted-foreground mb-1">Accountant Pack</h4>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">Export XML sheets from Tally for offline ingestion.</p>
                </div>
              </div>
            </div>
          )}

          {parseResult && (
            <FilePreview 
              fileName={pendingFile?.name || ''} 
              result={parseResult} 
              autoMapping={autoMapping}
              onAction={handleAction}
              onSheetChange={handleSheetChange}
              onCancel={() => {
                setPendingFile(null);
                setParseResult(null);
                setAutoMapping(null);
              }}
            />
          )}
        </>
      )}

      {/* ─── TAB: Invoices ─── */}
      {activeTab === 'invoices' && (
        <div className="space-y-6">
          {/* Upload and OCR trigger */}
          <div className="premium-glass border border-dashed border-border/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-4 relative">
            <input 
              type="file"
              id="invoice-file-upload"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={handleInvoiceUpload}
              disabled={uploadingInvoice}
            />
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              {uploadingInvoice ? <Loader2 className="w-6 h-6 animate-spin" /> : <FileText className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">Upload Vendor Invoice</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">
                Scan PDF or image invoices. Kaeo will extract fields and suggest transaction matching links.
              </p>
            </div>
            <label
              htmlFor="invoice-file-upload"
              className={`px-5 py-2 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:bg-primary/95 transition-all cursor-pointer shadow-md ${
                uploadingInvoice ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              {uploadingInvoice ? 'Processing Extraction...' : 'Select Invoice File'}
            </label>
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Supports PDF, PNG, JPG (Max 5MB)</span>
          </div>

          {/* List of scanned invoices */}
          <div className="premium-glass border border-border/30 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-border/15 bg-white/[0.01] flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Scanned Bills Directory
              </h3>
              <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground">
                {invoices.length} Documents
              </span>
            </div>

            {loadingInvoices ? (
              <div className="p-12 text-center text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-xs font-semibold">Loading document files...</span>
              </div>
            ) : invoices.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <EmptyState 
                  title="No Invoices Uploaded"
                  description="Upload vendor invoices to match them against payments and catch missing or duplicate invoices."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border/15 text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted/20">
                      <th className="px-6 py-3">Vendor / Number</th>
                      <th className="px-6 py-3">Invoice Date</th>
                      <th className="px-6 py-3">Due Date</th>
                      <th className="px-6 py-3">Amount</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Matched Transaction</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10">
                    {invoices.map((inv) => {
                      const match = inv.invoice_matches?.[0];
                      const tx = match?.transactions;
                      return (
                        <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="px-6 py-4">
                            <div className="font-bold text-foreground">{inv.vendor_name}</div>
                            <div className="text-[9px] text-muted-foreground font-mono mt-0.5">#{inv.invoice_number}</div>
                          </td>
                          <td className="px-6 py-4 font-semibold text-muted-foreground">
                            {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-IN') : '—'}
                          </td>
                          <td className="px-6 py-4 font-semibold text-muted-foreground">
                            {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN') : '—'}
                          </td>
                          <td className="px-6 py-4 font-extrabold text-foreground">
                            {formatMoney(inv.total_amount || 0, inv.currency || 'INR')}
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge 
                              status={getStatusBadgeVariant(inv.status)} 
                              label={inv.status.toUpperCase()} 
                            />
                          </td>
                          <td className="px-6 py-4 max-w-[200px] truncate">
                            {tx ? (
                              <div className="text-[11px] font-semibold text-teal-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                                <span className="truncate">{tx.description}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[10px]">Unmatched</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2.5 opacity-80 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleMarkPaid(inv.id)}
                                disabled={inv.status === 'paid'}
                                className="px-2.5 py-1 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/25 text-teal-400 font-bold rounded-lg text-[10px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Mark Paid
                              </button>
                              <button 
                                onClick={() => handleOpenInvoiceDetail(inv)}
                                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-border/40 text-foreground font-bold rounded-lg text-[10px] transition-all"
                              >
                                Review
                              </button>
                              <button 
                                onClick={() => handleDeleteInvoice(inv.id)}
                                className="p-1 hover:bg-risk/10 hover:text-risk border border-transparent hover:border-risk/20 text-muted-foreground rounded-lg transition-all"
                                title="Delete Bill"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB: History ─── */}
      {activeTab === 'history' && (
        <FileHistory history={history} />
      )}

      {/* Invoice Details Edit/Verification Modal */}
      {selectedInvoice && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setSelectedInvoice(null)}
        >
          <div 
            className="w-full max-w-4xl premium-floating-panel rounded-3xl p-6 shadow-2xl relative my-8 animate-in zoom-in-95 duration-200 grid grid-cols-1 md:grid-cols-2 gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setSelectedInvoice(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Left Column - OCR Extracted metadata fields form */}
            <div className="space-y-4">
              <div>
                <span className="text-[9px] font-black uppercase text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded">OCR Verification</span>
                <h3 className="text-base font-bold text-foreground mt-2">Verify Extracted Fields</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                  Confirm the fields detected by Kaeo's extraction simulator. Adjust values manually if needed.
                </p>
              </div>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const target = e.currentTarget;
                  handleUpdateInvoice({
                    vendorName: target.vendorName.value,
                    invoiceNumber: target.invoiceNumber.value,
                    invoiceDate: target.invoiceDate.value || null,
                    dueDate: target.dueDate.value || null,
                    subtotal: parseFloat(target.subtotal.value) || null,
                    taxAmount: parseFloat(target.taxAmount.value) || null,
                    totalAmount: parseFloat(target.totalAmount.value) || null,
                    gstin: target.gstin.value || null,
                    currency: target.currency.value,
                    status: target.status.value
                  });
                }}
                className="space-y-3.5"
              >
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Vendor Name</label>
                    <input 
                      type="text" 
                      name="vendorName"
                      required
                      defaultValue={selectedInvoice.vendor_name}
                      className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Invoice Number</label>
                    <input 
                      type="text" 
                      name="invoiceNumber"
                      required
                      defaultValue={selectedInvoice.invoice_number}
                      className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Invoice Date</label>
                    <input 
                      type="date" 
                      name="invoiceDate"
                      defaultValue={selectedInvoice.invoice_date || ''}
                      className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Due Date</label>
                    <input 
                      type="date" 
                      name="dueDate"
                      defaultValue={selectedInvoice.due_date || ''}
                      className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Subtotal (₹)</label>
                    <input 
                      type="number" 
                      name="subtotal"
                      step="0.01"
                      defaultValue={selectedInvoice.subtotal || ''}
                      className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Tax / GST (₹)</label>
                    <input 
                      type="number" 
                      name="taxAmount"
                      step="0.01"
                      defaultValue={selectedInvoice.tax_amount || ''}
                      className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total (₹)</label>
                    <input 
                      type="number" 
                      name="totalAmount"
                      step="0.01"
                      required
                      defaultValue={selectedInvoice.total_amount || ''}
                      className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">GSTIN</label>
                    <input 
                      type="text" 
                      name="gstin"
                      defaultValue={selectedInvoice.gstin || ''}
                      className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
                    />
                  </div>
                  <input 
                    type="hidden" 
                    name="currency"
                    value="INR"
                  />
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Status</label>
                    <select
                      name="status"
                      defaultValue={selectedInvoice.status}
                      className="w-full px-3 py-2 bg-[#161a18] border border-border rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="uploaded">Uploaded</option>
                      <option value="needs_review">Needs Review</option>
                      <option value="matched">Matched</option>
                      <option value="mismatch">Mismatch</option>
                      <option value="paid">Paid</option>
                      <option value="ignored">Ignored</option>
                    </select>
                  </div>
                </div>

                {selectedInvoice.extracted_data?.warnings && selectedInvoice.extracted_data.warnings.length > 0 && (
                  <div className="p-3 bg-risk/5 border border-risk/15 rounded-xl text-[10px] text-risk/80 font-semibold space-y-1 leading-relaxed">
                    <span className="font-bold flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 shrink-0" /> Extraction Warnings:</span>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {selectedInvoice.extracted_data.warnings.map((w: string, idx: number) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex gap-3 pt-3 border-t border-border/15 mt-5">
                  <button 
                    type="button" 
                    onClick={() => setSelectedInvoice(null)}
                    className="flex-1 py-2.5 bg-card hover:bg-muted text-foreground font-semibold rounded-xl text-xs transition-colors border border-border/40"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:opacity-90 transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Save Verification
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column - OCR Text Preview & Matcher suggestions */}
            <div className="space-y-4 border-l border-border/20 pl-6 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-primary" /> Match Suggested Payment
                </h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                  Fuzzy analysis of the transactions ledger suggests these outflow events could represent the payment for this bill.
                </p>

                {/* Match candidates */}
                <div className="mt-3 space-y-2">
                  {candidatesLoading ? (
                    <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" /> Searching ledger...
                    </div>
                  ) : matchingCandidates.length === 0 ? (
                    <div className="p-4 bg-muted/10 border border-border/20 rounded-xl text-[10px] text-muted-foreground italic leading-relaxed text-center">
                      No matching payments found in the ledger. Manual transaction will need to be added or statement uploaded.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {matchingCandidates.map(cand => {
                        const isChecked = manualMatchId === cand.id;
                        return (
                          <div 
                            key={cand.id}
                            onClick={() => setManualMatchId(isChecked ? '' : cand.id)}
                            className={`p-3 border rounded-xl cursor-pointer transition-all flex items-center justify-between text-left ${
                              isChecked 
                                ? 'bg-primary/5 border-primary/45 text-foreground' 
                                : 'bg-white/5 border-border/30 hover:border-border/55'
                            }`}
                          >
                            <div className="min-w-0">
                              <span className="text-[9px] font-bold uppercase text-muted-foreground">{cand.transaction_date}</span>
                              <h5 className="font-bold text-xs truncate mt-0.5">{cand.description}</h5>
                            </div>
                            <span className="font-black text-xs text-foreground shrink-0 pl-2">
                              {formatMoney(Math.abs(cand.amount), cand.currency || 'INR')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Raw text preview OCR pane */}
              <div className="flex-1 mt-4 flex flex-col justify-end min-h-[140px]">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Raw Document OCR Snippet</h4>
                <div className="p-3 bg-muted/40 border border-border rounded-xl font-mono text-[9px] text-muted-foreground/80 overflow-y-auto max-h-36 leading-relaxed whitespace-pre-wrap">
                  {selectedInvoice.extracted_data?.rawTextSnippet || 'No OCR text preview was generated for this file.'}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Files;
