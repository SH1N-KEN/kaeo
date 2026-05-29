import React, { useMemo } from 'react';
import { Calendar, ArrowRight } from 'lucide-react';
import { 
  getThisMonthRange, 
  getLastMonthRange, 
  getLast30DaysRange, 
  getCurrentFinancialYearRange,
  formatDateFriendly
} from '../../lib/dateRanges';

interface DateRangeFilterProps {
  fromDate: string;
  toDate: string;
  onFromDateChange: (val: string) => void;
  onToDateChange: (val: string) => void;
  onQuickRangeSelect: (rangeType: 'this_month' | 'last_month' | 'last_30' | 'fy') => void;
  onClear: () => void;
  variant?: 'transactions' | 'reports';
  showFinancialYear?: boolean;
  actions?: React.ReactNode;
  error?: string | null;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onQuickRangeSelect,
  onClear,
  variant = 'transactions',
  showFinancialYear = false,
  actions,
  error,
}) => {
  const thisMonth = useMemo(() => getThisMonthRange(), []);
  const lastMonth = useMemo(() => getLastMonthRange(), []);
  const last30 = useMemo(() => getLast30DaysRange(), []);
  const fy = useMemo(() => getCurrentFinancialYearRange(), []);

  const isThisMonthActive = fromDate === thisMonth.from && toDate === thisMonth.to;
  const isLastMonthActive = fromDate === lastMonth.from && toDate === lastMonth.to;
  const isLast30Active = fromDate === last30.from && toDate === last30.to;
  const isFyActive = showFinancialYear && fromDate === fy.from && toDate === fy.to;

  const isInvalidRange = fromDate && toDate && fromDate > toDate;

  const summaryText = useMemo(() => {
    if (!fromDate && !toDate) {
      return variant === 'transactions' ? 'Showing all imported data' : 'All imported data';
    }
    const friendlyFrom = fromDate ? formatDateFriendly(fromDate) : '...';
    const friendlyTo = toDate ? formatDateFriendly(toDate) : '...';
    
    if (variant === 'transactions') {
      return `Showing transactions from ${friendlyFrom} to ${friendlyTo}`;
    } else {
      return `Report period: ${friendlyFrom} to ${friendlyTo}`;
    }
  }, [fromDate, toDate, variant]);

  const containerClasses = variant === 'reports'
    ? 'bg-card border border-border/40 rounded-2xl p-5 shadow-sm backdrop-blur-md flex flex-col lg:flex-row lg:items-center justify-between gap-4'
    : 'flex flex-col lg:flex-row lg:items-center justify-between gap-4';

  return (
    <div className="space-y-2 w-full">
      <div className={containerClasses}>
        
        {/* Left side / Date controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 flex-1 min-w-0">
          {/* Label */}
          <div className="flex items-center gap-2 shrink-0">
            <Calendar className="w-4 h-4 text-primary shrink-0" />
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Period</span>
          </div>

          {/* Inputs */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <div className="relative flex items-center bg-muted/40 hover:bg-muted/70 border border-border/30 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 rounded-xl px-3 py-1.5 transition-all">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => onFromDateChange(e.target.value)}
                className="bg-transparent border-none text-[12px] font-bold text-foreground focus:outline-none focus:ring-0 p-0 cursor-pointer w-[120px]"
              />
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
            <div className="relative flex items-center bg-muted/40 hover:bg-muted/70 border border-border/30 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 rounded-xl px-3 py-1.5 transition-all">
              <input
                type="date"
                value={toDate}
                onChange={(e) => onToDateChange(e.target.value)}
                className="bg-transparent border-none text-[12px] font-bold text-foreground focus:outline-none focus:ring-0 p-0 cursor-pointer w-[120px]"
              />
            </div>
          </div>

          {/* Segmented pills */}
          <div className="flex items-center gap-1 flex-wrap bg-muted/50 border border-border/20 rounded-xl p-1 shrink-0">
            <button
              type="button"
              onClick={() => onQuickRangeSelect('this_month')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer select-none ${
                isThisMonthActive 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => onQuickRangeSelect('last_month')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer select-none ${
                isLastMonthActive 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              Last Month
            </button>
            <button
              type="button"
              onClick={() => onQuickRangeSelect('last_30')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer select-none ${
                isLast30Active 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              Last 30d
            </button>
            {showFinancialYear && (
              <button
                type="button"
                onClick={() => onQuickRangeSelect('fy')}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer select-none ${
                  isFyActive 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                }`}
              >
                FY
              </button>
            )}
            
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={onClear}
                className="px-2.5 py-1 text-[11px] font-bold text-danger hover:bg-risk/10 rounded-lg transition-all cursor-pointer select-none"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Actions section */}
        {actions && (
          <div className="flex items-center gap-2 self-start lg:self-auto shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* Info / Warnings */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 text-[11px]">
        {isInvalidRange ? (
          <span className="text-danger font-semibold animate-kaeo-fade">
            Start date must be before end date.
          </span>
        ) : error ? (
          <span className="text-danger font-semibold animate-kaeo-fade">
            {error}
          </span>
        ) : (
          <span className="text-muted-foreground/80 font-medium animate-kaeo-fade">
            {summaryText}
          </span>
        )}
      </div>
    </div>
  );
};
