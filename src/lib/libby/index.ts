/**
 * Libby v2 — Public Module Index
 *
 * Clean re-export surface for the Libby intelligence layer.
 * Consumers import from 'src/lib/libby' rather than individual files.
 *
 * No logic here — only re-exports.
 */

// Types
export type {
  LibbyIntent,
  LibbyResponseMode,
  WorkspaceContext,
  WorkspaceSettings,
  FinancialSummary,
  RiskEvent,
  VendorIntelligence,
  VendorSummaryItem,
  StaffSpendSummary,
  InvoiceSummary,
  BillingInfo,
  ReportSummary,
  RelevantData,
} from './types';

// Context Engine
export {
  buildWorkspaceContext,
  checkOnboardingGate,
  checkEmptyWorkspace,
  calculateMonthEndReadiness,
} from './contextEngine';

// Intent Engine
export { detectIntent, determineResponseMode } from './intentEngine';

// Data Retriever
export { retrieveRelevantData } from './dataRetriever';

// Response Formatter
export {
  formatINR,
  formatCurrency,
  formatSignedCurrency,
  formatSignedINR,
  formatHeading,
  formatBullet,
  formatBulletList,
  formatPercent,
  formatSection,
  joinParagraphs,
  sanitizeMarkdown,
} from './responseFormatter';

// Workspace Brief Engine
export { buildWorkspaceBrief } from './workspaceBriefEngine';
export type { WorkspaceBriefData } from './workspaceBriefEngine';
