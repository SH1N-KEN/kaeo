/**
 * Normalizes a merchant name by converting to lowercase, removing common suffixes,
 * punctuation, and cleaning extra spaces.
 * 
 * @param name The raw merchant name
 * @returns The normalized merchant name
 */
export function normalizeMerchant(name: string): string {
  // Stub implementation
  return name.trim().toLowerCase();
}

/**
 * Computes a similarity score between two merchant names, returning a value between 0 and 100.
 * 
 * @param name1 First merchant name
 * @param name2 Second merchant name
 * @returns A similarity score from 0 to 100
 */
export function merchantSimilarity(name1: string, name2: string): number {
  // Stub implementation
  return 0;
}
