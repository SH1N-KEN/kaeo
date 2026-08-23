import { createClient } from '@supabase/supabase-js';

const getEnvVar = (key: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key];
  }
  return process.env[key];
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('https://') && 
  supabaseUrl.includes('.supabase.co') &&
  !supabaseUrl.includes('placeholder')
);

const isProd = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.PROD : false;

if (!isSupabaseConfigured && isProd) {
  console.warn('Supabase is not properly configured in production.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
}

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
