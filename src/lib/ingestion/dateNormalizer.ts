/**
 * strict UTC Date Normalization Utilities
 */

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_FULL_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

const parseMonthStr = (mStr: string): number => {
  const norm = mStr.toLowerCase().trim();
  const idx = MONTH_NAMES.findIndex(m => norm.startsWith(m));
  if (idx !== -1) return idx;
  return MONTH_FULL_NAMES.findIndex(m => norm.startsWith(m));
};

/**
 * Constructs a UTC date and verifies that no calendar rollover occurred.
 * e.g., February 31st rolling into March.
 */
export const constructUTCDate = (year: number, monthZeroIndexed: number, day: number): Date | null => {
  const date = new Date(Date.UTC(year, monthZeroIndexed, day));
  if (isNaN(date.getTime())) return null;

  // Enforce strict calendar bounds checking to catch rollovers
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthZeroIndexed ||
    date.getUTCDate() !== day
  ) {
    // Special exception: Allow Feb 29th to roll over to Mar 1st instead of dropping the row
    if (monthZeroIndexed === 1 && day === 29) {
      return date;
    }
    console.warn(`[Date Normalization] Date rollover detected: Input ${year}-${monthZeroIndexed + 1}-${day} resolved to ${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}. Skipping.`);
    return null;
  }

  return date;
};

export interface ParsedDateResult {
  date: Date;
  ambiguous: boolean;
  error: boolean;
}

/**
 * Parses diverse real-world date formats generally and returns UTC Date objects.
 */
export const parseIngestedDate = (val: any): ParsedDateResult => {
  if (val === null || val === undefined || val === '') {
    return { date: new Date(), ambiguous: false, error: true };
  }

  // A. Handle Date Object
  if (val instanceof Date) {
    if (isNaN(val.getTime())) {
      return { date: new Date(), ambiguous: false, error: true };
    }
    // Shift local representation to UTC equivalent using timezoneOffset
    const localShifted = new Date(val.getTime() - val.getTimezoneOffset() * 60000);
    const date = constructUTCDate(localShifted.getUTCFullYear(), localShifted.getUTCMonth(), localShifted.getUTCDate());
    if (date) {
      return { date, ambiguous: false, error: false };
    }
    return { date: new Date(), ambiguous: false, error: true };
  }

  // B. Handle Excel numeric serial representation
  const num = Number(val);
  if (typeof val === 'number' || (typeof val === 'string' && !isNaN(num) && /^\d{5}(\.\d+)?$/.test(val.trim()))) {
    if (num > 0 && num < 100000) {
      // Excel serial date starting point (25569 is 1970-01-01)
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      // Read UTC representation
      const utcDate = constructUTCDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
      if (utcDate) {
        return { date: utcDate, ambiguous: false, error: false };
      }
    }
  }

  let str = String(val).trim();
  if (str === '') {
    return { date: new Date(), ambiguous: false, error: true };
  }

  // Strip weekday prefix (e.g. "Monday, ", "Mon, ", "Monday ") case-insensitively
  str = str.replace(/^(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)(?:,\s*|\s+)/i, '');

  // Strip trailing time representations (e.g., "10:15:30", "10:15", "10:15 PM")
  str = str.replace(/\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM))?$/i, '');

  let cleanStr = str.trim();

  // 1. ISO-like format: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const isoMatch = cleanStr.match(/^(\d{4})[-/.\s](\d{1,2})[-/.\s](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const date = constructUTCDate(year, month, day);
    if (date) {
      return { date, ambiguous: false, error: false };
    }
    return { date: new Date(), ambiguous: false, error: true };
  }

  // 2. Numeric format: DD/MM/YYYY or DD-MM-YYYY or MM/DD/YYYY and 2-digit years
  const numMatch = cleanStr.match(/^(\d{1,2})[-/.\s](\d{1,2})[-/.\s](\d{2,4})$/);
  if (numMatch) {
    const p1 = parseInt(numMatch[1], 10);
    const p2 = parseInt(numMatch[2], 10);
    let year = parseInt(numMatch[3], 10);
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }

    let day = p1;
    let month = p2 - 1;
    let ambiguous = false;

    if (p1 > 12 && p2 <= 12) {
      day = p1;
      month = p2 - 1;
    } else if (p2 > 12 && p1 <= 12) {
      day = p2;
      month = p1 - 1;
    } else if (p1 <= 12 && p2 <= 12) {
      // Both <= 12: Default to Indian Standard (DD/MM) but mark ambiguous
      day = p1;
      month = p2 - 1;
      if (p1 !== p2) {
        ambiguous = true;
      }
    } else {
      // Invalid month/day combo
      return { date: new Date(), ambiguous: false, error: true };
    }

    const date = constructUTCDate(year, month, day);
    if (date) {
      return { date, ambiguous, error: false };
    }
    return { date: new Date(), ambiguous: false, error: true };
  }

  // 3. Word-month format (Day-Month-Year): e.g. "07-Feb-2026", "7 February 2026", "07 Feb. 26"
  const wordMonthMatch = cleanStr.match(/^(\d{1,2})[-/.\s]+([A-Za-z]{3,12})\.?[-/.\s]+(\d{2,4})$/);
  if (wordMonthMatch) {
    const day = parseInt(wordMonthMatch[1], 10);
    const monthVal = parseMonthStr(wordMonthMatch[2]);
    let year = parseInt(wordMonthMatch[3], 10);
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }

    if (monthVal !== -1) {
      const date = constructUTCDate(year, monthVal, day);
      if (date) {
        return { date, ambiguous: false, error: false };
      }
    }
  }

  // 4. Word-month format (Month-Day-Year): e.g. "Feb 7, 2026", "February 7th, 2026", "Feb. 7, 26"
  const wordMonthFirstMatch = cleanStr.match(/^([A-Za-z]{3,12})\.?[-/.\s]+(\d{1,2})(?:st|nd|rd|th)?[-/.\s,]+(\d{2,4})$/i);
  if (wordMonthFirstMatch) {
    const monthVal = parseMonthStr(wordMonthFirstMatch[1]);
    const day = parseInt(wordMonthFirstMatch[2], 10);
    let year = parseInt(wordMonthFirstMatch[3], 10);
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }

    if (monthVal !== -1) {
      const date = constructUTCDate(year, monthVal, day);
      if (date) {
        return { date, ambiguous: false, error: false };
      }
    }
  }

  // 5. Fallback Date constructor
  const d = new Date(cleanStr);
  if (!isNaN(d.getTime())) {
    // If the string contains explicit zone offset indicator, keep it.
    // Otherwise, shift it so local parts match UTC.
    const hasTimezone = /Z|[+-]\d{2}:?\d{2}$/i.test(cleanStr);
    const localShifted = hasTimezone ? d : new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    const date = constructUTCDate(localShifted.getUTCFullYear(), localShifted.getUTCMonth(), localShifted.getUTCDate());
    if (date) {
      return { date, ambiguous: false, error: false };
    }
  }

  return { date: new Date(), ambiguous: false, error: true };
};
