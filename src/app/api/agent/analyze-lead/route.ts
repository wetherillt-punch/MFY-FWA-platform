import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { LeadAnalysisSchema } from '@/lib/agent/schemas';
import { 
  formatDeviation, 
  formatCurrency, 
  formatComparativeMetric,
  formatPriority 
} from '@/lib/formatting/report-formatter';
import { formatDetectionRules } from '@/lib/formatting/detection-rules-formatter';
import { extractRelevantClaims } from '@/lib/formatting/claims-extractor';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { lead, allClaims = [] } = await request.json();

    const systemPrompt = `You are an expert healthcare fraud analyst. Analyze provider data and return ONLY valid JSON matching this schema:

{
  "summary": "string - Executive summary in 2-3 sentences",
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
  "detection_rules_triggered": [
    {
      "tier": "string (Tier 1, Tier 2, Tier 3, or Tier 4)",
      "rule_name": "string",
      "description": "string",
      "threshold": "string",
      "provider_value": "string",
      "benchmark": "string",
      "evidence": "string",
      "severity": "HIGH | MEDIUM | LOW"
    }
  ],
  "flagged_codes": [
    {
      "code": "string",
      "description": "string", 
      "count": number,
      "avg_amount": number,
      "total_amount": number
    }
  ],
  "priority_level": "IMMEDIATE_INVESTIGATION" | "HIGH_PRIORITY" | "ROUTINE_MONITORING" | "WATCHLIST",
  "next_steps": ["string", "string", ...],
  "estimated_overpayment": number (always positive)
}

CALCULATION INSTRUCTIONS:

avg_claim_amount:
- provider: Total billed amount ÷ claim count for this provider
- peer: Average claim amount across peer providers
- deviation_percent: ((provider - peer) / peer) × 100

claims_per_patient:
- provider: Total claims ÷ unique patient count for this provider
- peer: Average claims per patient across peer providers
- deviation_percent: ((provider - peer) / peer) × 100

CALCULATION INSTRUCTIONS FOR flagged_claims_amount:
The flagged_claims_amount represents the total dollar value of suspicious claims:
- provider: Sum the billed_amount of ALL claims that triggered any detection rule (from tier metrics)
- peer: Calculate expected billing for same number of flagged claims at peer average rates (peer_avg_per_claim × number_of_flagged_claims)
- deviation_percent: ((provider - peer) / peer) × 100

Example: If provider has 50 flagged claims totaling $25,000, and peers bill $400/claim on average:
- provider: 25000
- peer: 20000 (50 claims × $400)
- deviation_percent: 25.0 (25% above peer rate)

CRITICAL RULES:
1. Return ONLY valid JSON - no markdown, no explanations
2. Use raw numbers for all deviations (negative for below peer, positive for above)
3. estimated_overpayment must be positive (it's money to recover)
4. Be precise with numbers - calculate deviations accurately
5. priority_level must be one of the 4 exact enum values`;

    const userPrompt = `Analyze this provider and return structured JSON:

Provider: ${lead.provider_id}
Priority: ${lead.priority}
Overall Score: ${lead.overallScore}
Claim Count: ${lead.claimCount}
Total Billed: $${lead.totalBilled?.toLocaleString()}

Tier 1 Score: ${lead.tier1Score}
Tier 1 Metrics: ${JSON.stringify(lead.tier1Metrics)}

Tier 2 Score: ${lead.tier2Score}
Tier 2 Metrics: ${JSON.stringify(lead.tier2Metrics)}

Tier 3 Score: ${lead.tier3Score}
Advanced Patterns: ${JSON.stringify(lead.advancedPatterns)}

Top Codes: ${JSON.stringify(lead.topCodes?.slice(0, 5))}

Return structured JSON analysis.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const responseText = message.content[0].type === 'text' 
      ? message.content[0].text 
      : '';

    // Parse and validate structured output
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const rawAnalysis = JSON.parse(jsonMatch[0]);
    const validatedAnalysis = LeadAnalysisSchema.parse(rawAnalysis);

    // Format the data for presentation
    const formattedAnalysis = {
      summary: validatedAnalysis.summary,
      
    comparative_analysis: {
      claims_per_month: {
       ...validatedAnalysis.comparative_analysis.claims_per_month,
       formatted_deviation: formatDeviation(
        validatedAnalysis.comparative_analysis.claims_per_month.deviation_percent
       )
      },
      avg_claim_amount: {
       ...validatedAnalysis.comparative_analysis.avg_claim_amount,
       formatted_deviation: formatDeviation(
        validatedAnalysis.comparative_analysis.avg_claim_amount.deviation_percent
       )
     },
     claims_per_patient: {
       ...validatedAnalysis.comparative_analysis.claims_per_patient,
       formatted_deviation: formatDeviation(
        validatedAnalysis.comparative_analysis.claims_per_patient.deviation_percent
       )
     },
     flagged_claims_amount: {
      ...validatedAnalysis.comparative_analysis.flagged_claims_amount,
      formatted_deviation: formatDeviation(
       validatedAnalysis.comparative_analysis.flagged_claims_amount.deviation_percent
      )
     }
  },
      
      detection_rules_triggered: formatDetectionRules(lead).map(rule => ({
        ...rule,
        claims: extractRelevantClaims(lead, rule, allClaims)
      })),
      
      flagged_codes: validatedAnalysis.flagged_codes.map(code => ({
        ...code,
        formatted_avg: formatCurrency(code.avg_amount),
        formatted_total: formatCurrency(code.total_amount)
      })),
      
      priority: formatPriority(validatedAnalysis.priority_level),
      
      next_steps: validatedAnalysis.next_steps,
      
      estimated_overpayment: validatedAnalysis.estimated_overpayment,
      formatted_overpayment: formatCurrency(validatedAnalysis.estimated_overpayment)
    };

    return NextResponse.json({
      success: true,
      analysis: formattedAnalysis,
      raw: validatedAnalysis // For debugging
    });

  } catch (error: any) {
    console.error('Agent analysis error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
