# Kaeo Launch QA Checklist

This checklist tracks manual verification and system sanity checks of the Kaeo AI CFO and spend-control platform before release.

## 1. Auth & Onboarding Flow
- [x] **Fresh Signup**: Verify registration page fields, validation, and email confirmation simulation.
- [x] **Google OAuth Button**: Verify Continue with Google redirects or falls back with a clean toast ("Google sign-in is not configured yet.").
- [x] **Onboarding survey**:
  - [x] Tailored flows for "For my business" (`business_owner`) and "For my clients" (`accountant`).
  - [x] Captures business/firm name, industry, tools, team sizes, spend ranges, and primary bottlenecks.
  - [x] Correctly initializes workspace organization, members, default client (for owners), profile entries, and handles redirection.

## 2. Ingestion & Mappings
- [x] **CSV Ingestion**: Verify upload of bank statements and gateway exports, auto-mapping suggestions, and successful importing.
- [x] **XLSX Ingestion**: Verify Excel file uploads and worksheet selection sheets.
- [x] **Non-Financial Sheets Ignored**: Ensure non-transaction worksheets trigger alerts or warnings instead of inserting corrupt ledger rows.

## 3. Financial Core UI
- [x] **Dashboard Metrics**:
  - [x] KPI Row (Revenue, Refunds, Transactions, Uncategorized, Duplicate Exposure).
  - [x] Primary controls (Open Risks, Needs Review, Month-End Readiness, Accountant Pack).
  - [x] Priority Review action card.
  - [x] Detailed readiness score deduction list and descriptive explanations.
- [x] **Transactions Ledger**:
  - [x] Absolute INR formatting with sign (e.g. -₹77,827 or +₹1,50,000).
  - [x] Sort columns (Date, Description, Category, Amount, Type, Source, Review Status).
  - [x] Filters (Search, Type, Review status, Category, Source, Date range, Amount range).
  - [x] Context row actions (Mark Reviewed, Mark Needs Review, Resolve, Ignore, Copy description).
  - [x] Query parameters support (`?review=pending`, `?category=uncategorized`, `?type=unknown`).

## 4. Spend Control & Risk Inbox
- [x] **Risk Detection Engine**:
  - [x] Suspicious duplicate vendor payments checks.
  - [x] High-value outflows against spend limits.
  - [x] Unknown/unclassified entries monitoring.
  - [x] SaaS subscription growth detection.
- [x] **Risk Inbox**:
  - [x] Severity categorization (critical, high, medium, low).
  - [x] Add/view audit trail comments and action logs.
  - [x] Manual status adjustments (Resolve, Ignore, Review).

## 5. Invoice Matching & OCR Foundation
- [x] **Invoice Reviews tab**:
  - [x] PDF/PNG/JPG vendor bill uploads.
  - [x] OCR extraction simulation (vendor name, invoice number, amounts, taxes, dates, GSTIN).
  - [x] Auto-marking `needs_review` on low-confidence outputs.
  - [x] Reconcile matches against transaction ledger candidates.
  - [x] Handle mismatch, unpaid overdue, duplicate invoices, and missing invoice risk rules.

## 6. AI CFO Companion
- [x] **Ask Kaeo AI Contextual Grounding**:
  - [x] Grounds chat prompts with active client demographics, tools, and pain points.
  - [x] Limits responses strictly to imported transactional/billing aggregates.
  - [x] Clean Markdown formats and currency sign sanitization.
- [x] **AI Review Suggestions queue**:
  - [x] Verification, approval, and rejection workflow for suggestions.
  - [x] Safe auto-categorization list.
  - [x] Records audit trails upon approval.

## 7. Reports & Payments
- [x] **Billing / Plans page**: Verify plan cards, pricing layouts, and Razorpay links.
- [x] **Month-End Accountant Pack**: Export options for ledger compliance and Zoho/Tally sync.
