import { z } from 'zod';

export const ComparativeMetricSchema = z.object({
  provider: z.number(),
  peer: z.number(),
  deviation_percent: z.number()
});

export const LeadAnalysisSchema = z.object({
  summary: z.string().describe('Executive summary of findings'),
  
  comparative_analysis: z.object({
    claims_per_month: z.object({
      provider: z.number(),
      peer: z.number(),
      deviation_percent: z.number()
    }),
    avg_claim_amount: z.object({
      provider: z.number(),
      peer: z.number(),
      deviation_percent: z.number()
    }),
    claims_per_patient: z.object({
      provider: z.number(),
      peer: z.number(),
      deviation_percent: z.number()
    }),
    flagged_claims_amount: z.object({
      provider: z.number(),
      peer: z.number(),
      deviation_percent: z.number()
    })
  }),
  
  detection_rules_triggered: z.array(z.object({
    tier: z.string(),
    rule_name: z.string(),
    description: z.string(),
    threshold: z.string(),
    provider_value: z.string(),
    benchmark: z.string(),
    evidence: z.string(),
    severity: z.enum(['HIGH', 'MEDIUM', 'LOW'])
  })).optional(),
  
  flagged_codes: z.array(z.object({
    code: z.string(),
    description: z.string(),
    count: z.number(),
    avg_amount: z.number(),
    total_amount: z.number()
  })),
  
  priority_level: z.enum([
    'IMMEDIATE_INVESTIGATION',
    'HIGH_PRIORITY', 
    'ROUTINE_MONITORING',
    'WATCHLIST'
  ]),
  
  next_steps: z.array(z.string()),
  
  estimated_overpayment: z.number().nonnegative()
});

export type LeadAnalysis = z.infer<typeof LeadAnalysisSchema>;
