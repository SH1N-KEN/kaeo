# Kaeo — AI Finance Controller for Indian SMEs

## The Problem
Indian businesses waste 2–4 hours per week manually:
- Parsing messy bank statements (multiple formats, encoding issues)
- Finding duplicates and errors
- Reconciling bank records against payment processor settlements
- Flagging suspicious transactions

## The Solution
Kaeo automates the financial review and reconciliation layer.

## What Kaeo Does

### Phase 1: Financial Review
Upload any bank statement → Kaeo:
- Parses XLSX and CSV (handles 6+ date formats, European decimals, DR/CR suffixes, trailing minus signs)
- Detects duplicates (reference-based + intra-file fuzzy matching)
- Identifies merchants vs payment processors vs payment rails
- Flags risks (high-value, suspicious, balance mismatches)
- Exports accountant-ready reports

### Phase 2: Multi-Source Reconciliation
Upload bank statement + Razorpay/Stripe export → Kaeo:
- Matches settlements using amount + date (processor mode)
- Catches bank fee discrepancies (e.g. ₹1,00,000 settled vs ₹99,850 received — ₹150 fee flagged automatically)
- Detects pending settlements, failed settlements, duplicates
- AI Exception Resolver (Claude via Supabase Edge Function) investigates unresolved discrepancies
- AI Batch Review prioritizes all exceptions by: financial impact × confidence × urgency
- Deterministic verification gate validates AI recommendations before enabling human actions

## Verified Accuracy

### Parsing Pipeline (4 real bank statements):
| File | Format | Transactions | Accuracy |
|------|--------|--------------|----------|
| HDFC Statement | XLSX | 112 | 100% |
| Messy Statement | XLSX | 180 | 100% |
| Stress Test | XLSX | 33 | 100% |
| SaaS Statement | CSV | 34 | 100% |

Run: `npm run regression-test`

### Reconciliation Benchmark (200-record synthetic dataset):
| Metric | Result |
|--------|--------|
| Bank rows | 200 |
| Processor rows | 150 |
| Matched | 115 / 115 |
| Match accuracy | 100% |
| False positives | 0 |
| False negatives | 0 |
| Overall score | 100% |

Run: `npm run benchmark`

## AI Architecture
Kaeo uses AI only where deterministic rules are insufficient:

Deterministic (always runs first):
Amount + date matching → MATCHED (no AI needed)
Duplicate detection → DUPLICATE FLAG (no AI needed)
Missing records → UNRESOLVED FLAG (queued for AI)

AI (only for ambiguous cases):
REVIEW + UNRESOLVED + DISCREPANCY
→ Claude API via Supabase Edge Function
→ Schema validation + retry policy
→ Deterministic verification gate
→ Human approval required

> [!NOTE]
> Kaeo doesn't use AI where rules are sufficient. AI is invoked only when deterministic controls cannot confidently resolve the exception.

## Stack
- React + TypeScript (frontend)
- Supabase (database + Edge Functions)
- Claude API via Anthropic (AI exception resolver)
- Razorpay (payments)

## Getting Started
```bash
npm install
npm run dev
npm run regression-test
npm run benchmark
```

## Architecture
See `/docs/ARCHITECTURE.md` for the full pipeline.

## Vision
- Phase 1 ✅ Financial review
- Phase 2 ✅ Multi-source reconciliation + AI exceptions
- Phase 3 → AI batch prioritization at scale
- Phase 4 → Financial control (spend policies, approvals)
- Phase 5 → Financial infrastructure (UPI, cards, payments)

Built for the Razorpay AI Buildathon 2026 by Vatsav Puppala.