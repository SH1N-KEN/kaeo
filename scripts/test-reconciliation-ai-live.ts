import * as fs from 'fs';
import * as path from 'path';

// Polyfill globals for Request, Response and Headers which are available in Node 18+ and Deno
const globalAny: any = globalThis;

// Define environment variables
const projectDir = 'c:/Users/sreev/kaeo';
const functionsDir = path.join(projectDir, 'supabase/functions/reconciliation-ai');
const scratchDir = path.join(projectDir, 'scratch');

if (!fs.existsSync(scratchDir)) {
  fs.mkdirSync(scratchDir);
}

// 1. Transpile Deno Edge Function to Node-compatible TypeScript
function transpileDenoFunction() {
  const indexTsPath = path.join(functionsDir, 'index.ts');
  if (!fs.existsSync(indexTsPath)) {
    throw new Error(`Edge Function not found at ${indexTsPath}`);
  }

  let code = fs.readFileSync(indexTsPath, 'utf8');

  // Replace Deno-specific imports with Node modules / inline mocks
  code = code.replace(/import\s+"https:\/\/deno\.land\/x\/xhr@0.1.0\/mod\.ts";/g, '// import xhr');
  code = code.replace(/import\s+\{\s*serve\s*\}\s+from\s+"https:\/\/deno\.land\/std@0.168.0\/http\/server\.ts";/g, '// import serve');
  code = code.replace(/import\s+\{\s*z\s*\}\s+from\s+"https:\/\/deno\.land\/x\/zod@v3.22.4\/mod\.ts";/g, "import { z } from 'zod';");
  
  // Replace createClient from ESM with a clean inline mock function
  code = code.replace(
    /import\s+\{\s*createClient\s*\}\s+from\s+"https:\/\/esm\.sh\/@supabase\/supabase-js@2\.39\.8";/g, 
    `const createClient = (url: string, key: string, options: any) => ({
      auth: {
        getUser: async () => {
          return { data: { user: { id: 'test-user-uuid', email: 'test@kaeo.ai' } }, error: null };
        }
      }
    });`
  );

  // Convert serve(async (req) => { ... }) to an exportable function
  code = code.replace(/serve\(async\s*\(req\)\s*=>\s*\{/g, 'export async function handleRequest(req: Request) {');
  code = code.replace(/\}\);\s*$/g, '}');

  const transpiledPath = path.join(scratchDir, 'transpiled-reconciliation-ai.ts');
  fs.writeFileSync(transpiledPath, code, 'utf8');
  console.log(`⚡ Transpiled Deno function to ${transpiledPath}`);
}

transpileDenoFunction();

// 2. Mock Deno environment global variable
globalAny.Deno = {
  env: {
    get(key: string) {
      if (key === 'ANTHROPIC_API_KEY') return process.env.ANTHROPIC_API_KEY || 'mock-anthropic-key';
      if (key === 'OPENROUTER_API_KEY') return process.env.OPENROUTER_API_KEY || 'mock-openrouter-key';
      if (key === 'SUPABASE_URL') return 'https://mock-supabase.supabase.co';
      if (key === 'SUPABASE_ANON_KEY') return 'mock-anon-key';
      return undefined;
    }
  }
};

// 3. Test exceptions data (5 scenarios)
const exceptionCases = [
  {
    name: 'Small variance (Processor Fee)',
    exceptionType: 'UNRESOLVED',
    evidence: {
      processorTxn: { id: 'tx-1', amount: 1500, transaction_date: '2026-03-01', description: 'Acme Corp Payout' },
      bankTxn: { id: 'tx-1-bank', amount: 1470, transaction_date: '2026-03-02', description: 'HDFC Bank Payout' },
      discrepancy: 'Amount difference ₹30',
      amount: 30,
      dateGap: 1
    },
    mockLLMResponse: JSON.stringify({
      assessment: "Amount difference is likely a processing fee",
      likelihood: "high",
      recommendedAction: "APPROVE",
      confidence: 95,
      reasoning: "Amount difference ₹30 is 2% of ₹1500 which is within normal gateway fee tolerances"
    })
  },
  {
    name: 'Missing Bank Record',
    exceptionType: 'UNRESOLVED',
    evidence: {
      processorTxn: { id: 'tx-2', amount: 10000, transaction_date: '2026-03-01', description: 'Acme Corp Payout' },
      bankTxn: null,
      discrepancy: 'Missing bank statement entry',
      amount: 10000,
      dateGap: 0
    },
    mockLLMResponse: JSON.stringify({
      assessment: "Settlement payout has not cleared in bank account",
      likelihood: "low",
      recommendedAction: "REQUEST_DOCUMENTATION",
      confidence: 90,
      reasoning: "No statement line matches amount ₹10000 on or after 2026-03-01"
    })
  },
  {
    name: 'Possible Duplicate Record',
    exceptionType: 'UNUSUAL_PATTERN',
    evidence: {
      processorTxn: { id: 'tx-3', amount: 2500, transaction_date: '2026-03-01', description: 'Acme Corp Payout' },
      bankTxn: { id: 'tx-3-bank-dup', amount: 2500, transaction_date: '2026-03-01', description: 'Acme Corp Payout' },
      discrepancy: 'Identical bank transaction already matched',
      amount: 0,
      dateGap: 0
    },
    mockLLMResponse: JSON.stringify({
      assessment: "Duplicate transaction detection trigger",
      likelihood: "medium",
      recommendedAction: "INVESTIGATE",
      confidence: 85,
      reasoning: "Double bank credits for single settlement indicate duplication error"
    })
  },
  {
    name: 'Chargeback Exception',
    exceptionType: 'DISCREPANCY',
    evidence: {
      processorTxn: { id: 'tx-4', amount: -5000, transaction_date: '2026-03-01', description: 'Disputed transaction CB-12' },
      bankTxn: { id: 'tx-4-bank', amount: -5000, transaction_date: '2026-03-01', description: 'Reversal chargeback' },
      discrepancy: 'Chargeback reversal matching',
      amount: 0,
      dateGap: 0
    },
    mockLLMResponse: JSON.stringify({
      assessment: "Disputed customer chargeback",
      likelihood: "high",
      recommendedAction: "REJECT",
      confidence: 95,
      reasoning: "Reversed processor transaction matches bank chargeback outflow exactly"
    })
  },
  {
    name: 'Pending Settlement',
    exceptionType: 'REVIEW',
    evidence: {
      processorTxn: { id: 'tx-5', amount: 3500, transaction_date: '2026-03-01', description: 'Stripe Payout Pending' },
      bankTxn: null,
      discrepancy: 'Pending settlement timeline',
      amount: 3500,
      dateGap: 0
    },
    mockLLMResponse: JSON.stringify({
      assessment: "Gateway settlement is pending processing",
      likelihood: "medium",
      recommendedAction: "REQUEST_DOCUMENTATION",
      confidence: 80,
      reasoning: "Processing/pending timeline indicates temporal delay"
    })
  }
];

async function runTests() {
  // Import the transpiled handleRequest function
  const { handleRequest } = await import('../scratch/transpiled-reconciliation-ai');

  console.log('\n🧪 Starting Live Edge Function Local Integration Tests...');
  console.log('===========================================================');

  let passed = 0;

  for (let i = 0; i < exceptionCases.length; i++) {
    const testCase = exceptionCases[i];
    console.log(`\nRunning scenario [${i + 1}/5]: ${testCase.name}`);

    // Stub fetch to return the mock LLM response
    globalAny.fetch = async (url: string, init: any) => {
      return new Response(JSON.stringify({
        choices: [
          { message: { content: testCase.mockLLMResponse } }
        ],
        content: [
          { text: testCase.mockLLMResponse }
        ]
      }), { status: 200 });
    };

    // Prepare Request object
    const req = new Request('https://pbptkhdhefphxsyghvjk.supabase.co/functions/v1/reconciliation-ai', {
      method: 'POST',
      headers: new Headers({
        'Authorization': 'Bearer mock-user-token',
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify({
        exceptionType: testCase.exceptionType,
        evidence: testCase.evidence
      })
    });

    try {
      const response = await handleRequest(req);
      const data = await response.json();

      console.log('Response status:', response.status);
      console.log('Response JSON:', JSON.stringify(data, null, 2));

      // Assertions
      const hasCorrectKeys = 'assessment' in data && 'likelihood' in data && 'recommendedAction' in data && 'confidence' in data && 'reasoning' in data;
      if (response.status === 200 && hasCorrectKeys) {
        console.log(`✅ Success: ${testCase.name} returned valid JSON structure.`);
        passed++;
      } else {
        console.error(`❌ Fail: ${testCase.name} failed schema constraints.`);
      }
    } catch (err: any) {
      console.error(`❌ Fail: Exception thrown:`, err.message);
    }
  }

  // Scenario 6: Fallback Test (When LLM fails)
  console.log(`\nRunning scenario [6/6]: Fallback check (LLM unavailable)`);
  globalAny.fetch = async (url: string, init: any) => {
    return new Response('Internal Server Error', { status: 500 });
  };

  const reqFallback = new Request('https://pbptkhdhefphxsyghvjk.supabase.co/functions/v1/reconciliation-ai', {
    method: 'POST',
    headers: new Headers({
      'Authorization': 'Bearer mock-user-token',
      'Content-Type': 'application/json'
    }),
    body: JSON.stringify({
      exceptionType: 'UNRESOLVED',
      evidence: exceptionCases[0].evidence
    })
  });

  try {
    const response = await handleRequest(reqFallback);
    const data = await response.json();
    console.log('Fallback Response JSON:', JSON.stringify(data, null, 2));
    
    if (response.status === 200 && data.assessment === 'LLM unavailable' && data.confidence === 0) {
      console.log('✅ Success: Fallback handled correctly.');
      passed++;
    } else {
      console.error('❌ Fail: Fallback not handled.');
    }
  } catch (err: any) {
    console.error('❌ Fail: Fallback threw exception:', err.message);
  }

  console.log('===========================================================');
  console.log(`📊 LIVE EDGE FUNCTION TEST SUMMARY: ${passed} / 6 Passed.`);
  if (passed === 6) {
    console.log('🎉 ALL EDGE FUNCTION INTEGRATION TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME EDGE FUNCTION INTEGRATION TESTS FAILED.');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error running Edge Function integration tests:', err);
  process.exit(1);
});
