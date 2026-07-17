/**
 * Libby v2 — Response Formatter
 *
 * Formatting utilities for Libby's financial responses.
 * Ensures consistent output across all response types.
 *
 * No business logic — pure formatting helpers only.
 * All INR formatting uses the canonical formatters from ../formatters.
 */

// Re-export canonical INR formatters so callers import from one place
export { formatINR, formatCurrency, formatSignedCurrency, formatSignedINR } from '../formatters';

// ─── Heading Formatter ────────────────────────────────────────────────────────

/**
 * Formats a section heading in Libby's clean label style.
 * E.g., "My take:", "What I'd check:", "The move:"
 *
 * @param text - Heading label without trailing colon
 * @returns Formatted heading string
 */
export function formatHeading(text: string): string {
  const trimmed = text.trim();
  if (trimmed.endsWith(':')) return trimmed;
  return `${trimmed}:`;
}

// ─── Bullet Formatter ─────────────────────────────────────────────────────────

/**
 * Formats a single bullet point using Libby's bullet style (•).
 *
 * @param text - The bullet point text
 * @returns Formatted bullet string
 */
export function formatBullet(text: string): string {
  return `• ${text.trim()}`;
}

/**
 * Formats a list of items as bullet points joined by newlines.
 *
 * @param items - Array of strings to bullet-ize
 * @returns Multi-line bullet list string
 */
export function formatBulletList(items: string[]): string {
  return items.map(formatBullet).join('\n');
}

// ─── Percent Formatter ────────────────────────────────────────────────────────

/**
 * Formats a number as a percentage string.
 * E.g., 94.5 → "95%", 0.4 → "0%"
 *
 * @param value   - Number 0–100
 * @param decimals - Decimal places (default 0)
 * @returns Formatted percent string
 */
export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

// ─── Section Builder ──────────────────────────────────────────────────────────

/**
 * Builds a named section block: heading + content.
 *
 * @param heading - Section label
 * @param content - Section body text
 * @returns Formatted section block
 */
export function formatSection(heading: string, content: string): string {
  return `${formatHeading(heading)}\n${content}`;
}

// ─── Response Builder ─────────────────────────────────────────────────────────

/**
 * Joins multiple non-empty paragraphs with double newlines.
 * Automatically filters out empty strings.
 *
 * @param paragraphs - Array of paragraph strings
 * @returns Clean joined response text
 */
export function joinParagraphs(...paragraphs: string[]): string {
  return paragraphs.filter(p => p && p.trim()).join('\n\n');
}

/**
 * Sanitizes any stray markdown from AI-generated text.
 * Removes bold (**), italic (*), headings (#), tables (|),
 * code fences (```), and replaces em-dashes.
 *
 * @param text - Raw text possibly containing markdown
 * @returns Clean plain text
 */
export function sanitizeMarkdown(text: string): string {
  if (!text) return text;
  return text
    .replace(/\$/g, '₹')
    .replace(/--/g, ', ')
    .replace(/—/g, ', ')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#{1,6}\s?/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\|/g, '');
}
