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
  hideSummary?: boolean;
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
  hideSummary = false,
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
      return 'Showing all imported data';
    }
    const friendlyFrom = fromDate ? formatDateFriendly(fromDate) : '...';
    const friendlyTo = toDate ? formatDateFriendly(toDate) : '...';
    
    if (variant === 'transactions') {
      return `Showing transactions from ${friendlyFrom} to ${friendlyTo}`;
    } else {
      return `Report period: ${friendlyFrom} – ${friendlyTo}`;
    }
  }, [fromDate, toDate, variant]);

  return (
    <div className="w-full space-y-4">
      {/* Controls Container */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full">
        
        {/* Group A: Period Controls */}
        <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1 min-w-0">
          
          {/* Label + Inputs */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 w-full md:w-auto">
            {/* Label */}
            <div className="flex items-center gap-2 shrink-0 select-none">
              <Calendar className="w-4 h-4 text-primary shrink-0" />
              <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Period</span>
            </div>

            {/* Date Inputs */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
              <div className="relative flex items-center bg-muted/40 hover:bg-muted/70 border border-border/30 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 rounded-xl px-3 py-1.5 transition-all w-full sm:w-[140px]">
                <span className="text-[10px] text-muted-foreground mr-2 sm:hidden uppercase font-bold shrink-0">From</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => onFromDateChange(e.target.value)}
                  className="bg-transparent border-none text-[12px] font-bold text-foreground focus:outline-none focus:ring-0 p-0 cursor-pointer w-full"
                />
              </div>
              
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 self-center hidden sm:block" />
              
              <div className="relative flex items-center bg-muted/40 hover:bg-muted/70 border border-border/30 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 rounded-xl px-3 py-1.5 transition-all w-full sm:w-[140px]">
                <span className="text-[10px] text-muted-foreground mr-2 sm:hidden uppercase font-bold shrink-0">To</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => onToDateChange(e.target.value)}
                  className="bg-transparent border-none text-[12px] font-bold text-foreground focus:outline-none focus:ring-0 p-0 cursor-pointer w-full"
                />
              </div>
            </div>
          </div>

          {/* Quick Range Chips */}
          <div className="flex flex-wrap items-center gap-1.5 bg-muted/50 border border-border/20 rounded-xl p-1 shrink-0 w-fit">
            <button
              type="button"
              onClick={() => onQuickRangeSelect('this_month')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer select-none whitespace-nowrap ${
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
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer select-none whitespace-nowrap ${
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
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer select-none whitespace-nowrap ${
                isLast30Active 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              Last 30 Days
            </button>
            {showFinancialYear && (
              <button
                type="button"
                onClick={() => onQuickRangeSelect('fy')}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer select-none whitespace-nowrap ${
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

        {/* Group B: Action buttons */}
        {actions && (
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto shrink-0 justify-start lg:justify-end">
            {actions}
          </div>
        )}
      </div>

      {/* Info / Warnings / Summary Text */}
      {!hideSummary && (
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
      )}
    </div>
  );
};
