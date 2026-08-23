/**
 * General Reference Validation Utilities
 */

/**
 * Validates if a reference is a real, non-placeholder value.
 * Rejecting null, undefined, empty string, all zeros, and repeated placeholder terms.
 */
export const isValidReference = (ref: any): boolean => {
  if (ref === null || ref === undefined) return false;
  const str = String(ref).trim();
  if (str === '') return false;

  const lower = str.toLowerCase();

  // 1. Reject all-zeros (e.g., "0", "0000", "0.00")
  if (/^0+(\.0+)?$/.test(lower)) return false;

  // 2. Reject common text placeholders
  const placeholders = ['n/a', 'na', 'null', 'undefined', 'nil', 'none', '-', '--', 'untitled', 'placeholder'];
  if (placeholders.includes(lower)) return false;

  // 3. Reject pure symbol patterns (e.g., "---", "***", "/ /")
  if (/^--+$/.test(str) || /^[^a-zA-Z0-9]+$/.test(str)) return false;

  // 4. Reject purely alphabetic strings (e.g., "HDFC", "ICIC", "UTIB", "CHRISTUNIVERSITY", "RAZORPAYPAYMENTSPVTLTD")
  // Real banking transaction references (UTRs, check numbers, seq IDs) must contain at least one digit.
  if (/^[a-zA-Z\s]+$/.test(str)) return false;

  return true;
};
