import React, { useState, useEffect } from 'react';
import { 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft,
  Calendar,
  Tag,
  MoreHorizontal,
  Loader2,
  AlertCircle,
  FileText,
  ShieldAlert,
  Trash2,
  CheckCircle2,
  X
} from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import { supabase } from '../lib/supabase';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import ClearTransactionsModal from '../components/ui/ClearTransactionsModal';

const Transactions: React.FC = () => {
  const { activeClient, activeOrg } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  useEffect(() => {
    if (activeClient) fetchTransactions();
  }, [activeClient, filterType]);

  const fetchTransactions = async () => {
    if (!activeClient) return;
    setLoading(true);
    try {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('client_id', activeClient.id)
        .order('transaction_date', { ascending: false });

      if (filterType !== 'all') {
        query = query.eq('type', filterType);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTransactions(data || []);
    } catch (err: any) {
      console.error('[Phase 4] Fetch transactions error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(tx => 
    tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (tx.counterparty_name && tx.counterparty_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!activeClient || !activeOrg) {
    return (
      <div className="h-[70vh] flex items-center justify-center">
        <EmptyState 
          title="No client workspace selected"
          description="Select a client workspace to view transaction history."
        />
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Transactions</h1>
            <p className="text-muted-foreground">Detailed ledger for <span className="text-foreground font-semibold">{activeClient.name}</span>.</p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-risk/5 border border-risk/20 rounded-xl flex gap-3 items-center text-risk">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-4 bg-success/5 border border-success/20 rounded-xl flex gap-3 items-center animate-in slide-in-from-top-2">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
            <p className="text-sm text-success font-bold flex-1">{success}</p>
            <button onClick={() => setSuccess(null)}><X className="w-4 h-4 text-success" /></button>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Search by description or counterparty..." 
              className="w-full bg-card border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            {['all', 'income', 'expense', 'transfer', 'refund'].map((type) => (
              <button 
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all border ${
                  filterType === type 
                  ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20' 
                  : 'bg-card text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {loading && transactions.length === 0 ? (
          <div className="h-[40vh] flex flex-col items-center justify-center space-y-4 bg-card border rounded-2xl">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground animate-pulse font-medium">Loading ledger...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="bg-card border rounded-2xl p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-2">
              <FileText className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-bold">No transactions found</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Try adjusting your search or filter, or upload a new finance file to ingest data.
            </p>
          </div>
        ) : (
          <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-b">Date</th>
                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-b">Description</th>
                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-b">Category</th>
                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-b text-right">Amount</th>
                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-b text-center">Type</th>
                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-b">Source</th>
                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-b"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          {new Date(tx.transaction_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                            {tx.description}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
                            {tx.counterparty_name || 'No counterparty'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 px-2.5 py-1 bg-muted/50 rounded-lg w-fit border border-border/50">
                          <Tag className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{tx.category || 'Uncategorized'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <span className={`text-sm font-black flex items-center gap-1.5 ${tx.amount < 0 ? 'text-risk' : 'text-success'}`}>
                            {tx.amount < 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                            {tx.amount < 0 ? '-' : '+'}{tx.currency} {Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <StatusBadge 
                          status={tx.type === 'income' ? 'success' : tx.type === 'expense' ? 'medium' : 'low'} 
                          label={tx.type.toUpperCase()} 
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded-md">
                          {tx.source_provider || 'Manual'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="pt-12 border-t border-risk/10">
        <div className="bg-risk/5 border border-risk/20 rounded-3xl overflow-hidden">
          <div className="p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 bg-risk/10 rounded-2xl flex items-center justify-center text-risk shrink-0 mt-1">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-risk uppercase tracking-tighter">Danger Zone</h3>
                <p className="text-sm text-risk/70 max-w-lg leading-relaxed">
                  Clear imported transactions for this client. This is useful when testing imports or replacing a bad upload.
                </p>
              </div>
            </div>
            <button 
              onClick={() => setIsClearModalOpen(true)}
              disabled={transactions.length === 0}
              className={`px-8 py-4 rounded-2xl font-black text-sm flex items-center gap-2 transition-all shadow-lg ${
                transactions.length > 0
                ? 'bg-risk text-white shadow-risk/20 hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-muted text-muted-foreground cursor-not-allowed grayscale opacity-50'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              Clear Transactions for {activeClient.name}
            </button>
          </div>
        </div>
      </div>

      <ClearTransactionsModal 
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onSuccess={() => {
          setSuccess(`Transactions cleared for ${activeClient.name}.`);
          fetchTransactions();
        }}
        clientName={activeClient.name}
        clientId={activeClient.id}
        orgId={activeOrg.id}
        transactionCount={transactions.length}
      />
    </div>
  );
};

export default Transactions;
