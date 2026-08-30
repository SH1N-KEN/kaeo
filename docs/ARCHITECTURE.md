# Kaeo Architecture

## Overview
Kaeo transforms messy financial data into trusted, verified transactions.

## Pipeline

Upload → Parse → Detect Headers → Extract Rows → Merge Continuations
↓
Normalize Dates (UTC-strict) → Normalize Amounts → Validate References
↓
Duplicate Detection → Categorize & Vendors → Risk Detection
↓
Dashboard / Reports / Review


## Key Modules

**dateNormalizer.ts**
- Handles DD/MM/YYYY, DD-MM-YYYY, DD Mon YYYY, ISO formats
- UTC-only construction and reading (never local getters)
- Validates calendar bounds (rejects Feb 31, doesn't roll over)
- Strips weekday prefixes

**amountNormalizer.ts**
- Trailing minus: `1000.00-` → `-1000`
- Parentheses: `(1000)` → `-1000`
- European decimals: `12.500,75` → `12500.75`
- DR/CR/Db suffixes

**referenceValidator.ts**
- Validates real, unique reference numbers
- Rejects: null, empty, all-zeros, purely alphabetic (bank codes)
- Accepts: alphanumeric with digits

**continuationMerger.ts**
- Handles wrapped narrations (rows with text but no date/amount)
- Merges into previous transaction
- Prevents false orphan drops

**duplicateEngine.ts**
- Valid references: dedupe globally (file + DB)
- Missing references: dedupe intra-file only (narration + date + amount)
- All missing-ref txns flagged for review

**riskEngine.ts**
- Flags high-value (>₹1,00,000)
- Duplicate suspected
- Balance mismatch
- Low confidence categorization
- Unknown vendor

## Philosophy
Financial software cannot guess. Every decision is:
- Deterministic (same input → same output)
- Logged (every drop is tracked)
- Reversible (nothing deleted permanently)

Built to be bulletproof.

## Reconciliation Agent

### Matching Strategy
Two modes based on data source:

**Merchant Mode** (bank vs bank):
- Merchant similarity >80% required (Levenshtein distance)
- Amount within ±₹1
- Date within 2 days

**Processor Mode** (bank vs Razorpay/Stripe):
- Amount match is primary key (exact, ±₹1)
- Date within 2 days
- Merchant similarity is bonus only (not required)
- Reason: processor exports describe settlements, not merchants

### AI Exception Pipeline

```
Exception detected (UNRESOLVED/REVIEW/DISCREPANCY)
↓
Structured evidence package (type, amounts, dates, discrepancy)
↓
Supabase Edge Function (reconciliation-ai)
↓
Claude API (or OpenRouter fallback)
↓
Schema validation + retry once
↓
Deterministic verification gate (hard business rules)
↓
VERIFIED_REVIEW → enable action buttons
VERIFICATION_FAILED → disable approve, alert user
↓
Human approval
↓
Supabase audit record
```

### AI Batch Review
Priority score = financial_impact × confidence × urgency

Exceptions sorted highest score first.
One LLM call processes all exceptions simultaneously.
Results grouped by recommended action:
- APPROVE (probable fee adjustments, low risk)
- INVESTIGATE (needs human review, medium risk)
- REJECT (likely errors, high risk)
- REQUEST_DOCUMENTATION (missing evidence)

### Benchmark Results
200 bank rows + 150 processor rows
100% match accuracy, 0 false positives, 0 false negatives