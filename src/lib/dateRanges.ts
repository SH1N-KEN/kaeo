// Helper functions for date ranges avoiding timezone issues

// Returns date as 'YYYY-MM-DD' in local timezone
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getThisMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of month
  return {
    from: toLocalDateString(from),
    to: toLocalDateString(to)
  };
}

export function getLastMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  return {
    from: toLocalDateString(from),
    to: toLocalDateString(to)
  };
}

export function getLast30DaysRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
  return {
    from: toLocalDateString(from),
    to: toLocalDateString(now)
  };
}

export function getCurrentFinancialYearRange(): { from: string; to: string } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed: 0 = Jan, 3 = Apr

  let startYear = currentYear;
  if (currentMonth < 3) { // Jan, Feb, Mar are in the previous calendar year's FY
    startYear = currentYear - 1;
  }
  
  const from = new Date(startYear, 3, 1); // Apr 1
  const to = new Date(startYear + 1, 2, 31); // Mar 31 of next year
  
  return {
    from: toLocalDateString(from),
    to: toLocalDateString(to)
  };
}

export function isWithinDateRange(dateVal: string | null | undefined, from: string | null, to: string | null): boolean {
  if (!dateVal) return false;
  // Extract YYYY-MM-DD if dateVal is timestamp (e.g. 2026-05-01T12:00:00Z)
  const dateStr = dateVal.split('T')[0];
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

export function formatDateRangeLabel(from: string | null, to: string | null): string {
  if (!from && !to) return 'All imported data';
  if (from && !to) return `From ${from}`;
  if (!from && to) return `Up to ${to}`;
  return `${from} to ${to}`;
}
