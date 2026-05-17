import { z } from 'zod';

export const AskKaeoAIResponseSchema = z.object({
  answer: z.string(),
  reasoning_summary: z.string(),
  recommended_actions: z.array(z.string()),
  caveats: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]),
  needs_external_research: z.boolean(),
  source_summary: z.object({
    transactions_used: z.number(),
    vendors_used: z.number(),
    risks_used: z.number(),
    reports_used: z.number(),
    notes_used: z.number()
  })
});

export type AskKaeoAIResponse = z.infer<typeof AskKaeoAIResponseSchema>;
