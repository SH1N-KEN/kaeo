/**
 * AI Mapping Abstraction Layer
 * Handles communication with AI mapping services (e.g., Gemini, OpenAI).
 * 
 * IMPORTANT: AI keys must NEVER be exposed in the frontend.
 * Real AI mapping should be called through a server-side API route or Supabase Edge Function.
 */

export interface AIMappingInput {
  fileName: string;
  detectedProvider: string;
  rawColumns: string[];
  previewRows: any[];
  requiredFields: string[];
  optionalFields: string[];
}

export interface AIMappingResponse {
  detected_provider: string;
  confidence: number;
  column_mapping: Record<string, string>;
  reasoning: string;
  warnings: string[];
}

/**
 * Checks if the AI mapping service is currently configured and available.
 * In production, this would check for a configured server endpoint.
 */
export const isAIMappingConfigured = (): boolean => {
  // TODO: Check for VITE_AI_MAPPING_ENDPOINT or similar server-side configuration
  // For now, AI mapping is kept optional/placeholder to prioritize security.
  return false;
};

/**
 * Validates the structure and content of an AI mapping response.
 */
export const validateAIMappingResponse = (response: any): response is AIMappingResponse => {
  if (!response || typeof response !== 'object') return false;
  
  const requiredKeys = ['detected_provider', 'confidence', 'column_mapping'];
  const hasKeys = requiredKeys.every(k => k in response);
  
  if (!hasKeys) return false;
  
  // Ensure required mapping fields are present if confidence is high
  const mapping = response.column_mapping;
  const hasRequiredFields = mapping.transaction_date && mapping.description && mapping.amount;
  
  return !!hasRequiredFields;
};

/**
 * Requests a mapping suggestion from the AI service.
 * Currently returns null as real AI keys are not in the frontend.
 */
export const suggestMappingWithAI = async (_input: AIMappingInput): Promise<AIMappingResponse | null> => {
  if (!isAIMappingConfigured()) {
    console.info('[AI Mapping] Service not configured. Falling back to rule-based mapping.');
    return null;
  }

  try {
    // REAL AI PROMPT INSTRUCTION (FOR SERVER-SIDE IMPLEMENTATION):
    // "You are mapping messy finance file columns into Kaeo’s normalized transaction schema. 
    // Return only valid JSON. Do not calculate totals. Do not invent columns. 
    // Use only provided headers and preview rows."
    
    // Example: const response = await fetch('/api/ai/map-columns', { ... });
    
    return null; 
  } catch (err) {
    console.error('[AI Mapping] Request failed:', err);
    return null;
  }
};
