import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('https://') && 
  supabaseUrl.includes('.supabase.co') &&
  !supabaseUrl.includes('placeholder')
);

if (!isSupabaseConfigured && import.meta.env.PROD) {
  console.warn('Supabase is not properly configured in production.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

export type SupabaseConfigError = {
  missing: string[];
  malformed: string[];
};

export const getSupabaseConfigError = (): SupabaseConfigError | null => {
  const missing: string[] = [];
  const malformed: string[] = [];

  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');

  if (supabaseUrl && (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co'))) {
    malformed.push('VITE_SUPABASE_URL');
  }

  if (missing.length > 0 || malformed.length > 0) {
    return { missing, malformed };
  }

  return null;
};
