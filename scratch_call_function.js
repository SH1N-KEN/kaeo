import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL || 'https://pbptkhdhefphxsyghvjk.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const email = `testuser_${Date.now()}@kaeo.com`;
const password = 'Password123!';

async function testWithSignup() {
  console.log(`Signing up user ${email}...`);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password
  });

  if (signUpError) {
    console.error('Sign up failed:', signUpError);
    return;
  }

  const session = signUpData.session;
  if (!session) {
    console.log('SignUp succeeded but needs email confirmation. Trying to sign in...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (signInError) {
      console.error('Sign in failed:', signInError);
      return;
    }
    runFunctionCall(signInData.session);
  } else {
    runFunctionCall(session);
  }
}

async function runFunctionCall(session) {
  console.log('Logged in successfully. User ID:', session.user.id);
  console.log('JWT:', session.access_token.substring(0, 10) + '...');

  console.log('Calling Edge Function...');
  const { data, error } = await supabase.functions.invoke('ask-kaeo-ai', {
    headers: {
      Authorization: `Bearer ${session.access_token}`
    },
    body: {
      context: {
        question: "Summarise my workspace",
        intent: "finance_summary",
        response_mode: "priority_advice",
        needs_web_research: false,
        active_client_name: "Test Client",
        counts: { transactions: 0, vendors: 0, risks: 0 },
        relevant_notes: [],
        caveats: []
      },
      workspace_id: "77a8dfbf-e47a-4b9a-bb81-9b2ee323bc01",
      message: "Summarise my workspace",
      intent: "finance_summary"
    }
  });

  if (error) {
    console.error('Edge Function failed:', error);
  } else {
    console.log('Edge Function success! Response:', data);
  }
}

testWithSignup();
