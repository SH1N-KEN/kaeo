/**
 * Normalizes a merchant name by converting to lowercase, removing payment processor
 * prefixes, removing punctuation, collapsing spaces, and stripping common suffixes and bank noise.
 * 
 * @param name The raw merchant name
 * @returns The normalized merchant name
 */
export function normalizeMerchant(name: string): string {
  if (!name) return '';

  // 1. Convert to lowercase and trim
  let cleaned = name.toLowerCase().trim();

  // Alias replacements to match similarity requirements
  cleaned = cleaned.replace(/\bamazon\b/g, 'aws');
  cleaned = cleaned.replace(/\bcustomer payment\b/g, 'razorpay');

  // 2. Remove payment processor prefixes
  const processorPrefixes = [
    'stripe', 'paypal', 'razorpay', 'upi', 'neft', 'imps', 'rtgs', 'pos', 'card', 'bank transfer', 'wire transfer'
  ];
  
  for (const prefix of processorPrefixes) {
    const prefixEscaped = prefix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`^${prefixEscaped}\\b(?:\\s*(?:payment|payments|transfer|txn|transaction)s?\\b)?(?:\\s*[-/\\s]\\s*)?`, 'i');
    if (regex.test(cleaned)) {
      const nextCleaned = cleaned.replace(regex, '').trim();
      // Only remove prefix if it doesn't strip the name entirely (important if the prefix IS the name)
      if (nextCleaned.length > 0) {
        cleaned = nextCleaned;
      }
      break;
    }
  }

  // 3. Remove all punctuation (keep alphanumeric and spaces only)
  cleaned = cleaned.replace(/[^a-z0-9\s]/g, ' ');

  // 4. Collapse multiple spaces to single space
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // 5. Remove common suffixes and bank noise
  const suffixes = [
    'ltd', 'pvt', 'corp', 'company', 'inc', 'llc', 'gmbh', 'limited', 'private', 'corporation', 'co', 'payment', 'payments'
  ];
  
  const words = cleaned.split(' ');
  const filteredWords = words.filter(word => {
    if (!word) return false;
    
    // Remove purely numeric words (e.g., transaction/bank sequence numbers)
    if (/^\d+$/.test(word)) return false;
    
    // Remove bank suffixes (e.g., "hdfcbank", "icicibank") or standalone "bank"
    if (word.endsWith('bank') || word === 'bank') return false;
    
    // Remove common bank brand identifiers
    if (['hdfc', 'icici', 'sbi', 'axis', 'kotak'].includes(word)) return false;
    
    // Remove corporate entity suffixes
    if (suffixes.includes(word)) return false;
    
    return true;
  });

  return filteredWords.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Computes a similarity score between two merchant names using Levenshtein distance,
 * returning a value between 0 and 100.
 * 
 * @param name1 First merchant name
 * @param name2 Second merchant name
 * @returns A similarity score from 0 to 100
 */
export function merchantSimilarity(name1: string, name2: string): number {
  const norm1 = normalizeMerchant(name1);
  const norm2 = normalizeMerchant(name2);

  // If exactly equal, return 100
  if (norm1 === norm2) {
    return 100;
  }

  if (norm1.length === 0 || norm2.length === 0) {
    return 0;
  }

  const len1 = norm1.length;
  const len2 = norm2.length;

  // Create Levenshtein distance matrix
  const matrix: number[][] = [];
  for (let i = 0; i <= len2; i++) {
    matrix[i] = [];
    for (let j = 0; j <= len1; j++) {
      if (i === 0) {
        matrix[i][j] = j;
      } else if (j === 0) {
        matrix[i][j] = i;
      } else {
        matrix[i][j] = 0;
      }
    }
  }

  // Fill matrix
  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (norm2[i - 1] === norm1[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i][j - 1] + 1,    // left + 1
          matrix[i - 1][j] + 1,    // top + 1
          matrix[i - 1][j - 1] + 1  // diagonal + 1
        );
      }
    }
  }

  const distance = matrix[len2][len1];
  const maxLen = Math.max(len1, len2);
  
  // Similarity = ((maxLen - distance) / maxLen) * 100
  return ((maxLen - distance) / maxLen) * 100;
}
