# Kaeo — AI Financial Review for Indian SMEs

## The Problem
Indian businesses waste 2–4 hours per week manually parsing bank statements, finding duplicates, and reconciling balances.

## The Solution
Kaeo automates the financial review layer.

Upload statement → Parse → Normalize → Detect risks → Review exceptions → Export report

## Features
- **Multi-format parsing:** XLSX, CSV
- **Smart normalization:** Handles European decimals, trailing minus, DR/CR suffixes, multiple date formats
- **Duplicate detection:** Reference-based + intra-file fuzzy matching with fallback signatures
- **Risk engine:** Flags high-value, suspicious, and unmatched transactions
- **Dashboard:** Real-time financial KPIs and cash flow visualization
- **AI assistant:** Ask Libby questions about your financial data
- **Reports:** Export accountant-ready summaries

## Verified Accuracy
Tested against real bank statements with known ground truth:

| File | Format | Transactions | Accuracy |
|------|--------|--------------|----------|
| HDFC Statement | XLSX | 112 | 100% |
| Messy Statement | XLSX | 180 | 100% |
| Stress Test | XLSX | 33 | 100% |
| SaaS Statement | CSV | 34 | 100% |

Run the regression suite: `npm run regression-test`

## Stack
- React + TypeScript (frontend)
- Node.js (backend)
- Supabase (database)
- Razorpay (payments)

## Getting Started
```bash
npm install
npm run dev
npm run regression-test
```

## Architecture
See `/docs/ARCHITECTURE.md` for the full parsing pipeline.

## Vision
**Phase 1 (current):** Financial review — understand what's happening  
**Phase 2 (next):** Multi-source reconciliation — match transactions across Stripe, bank, credit card  
**Phase 3 (future):** Financial control — govern how money is spent  

Built for the Razorpay AI Buildathon 2026.