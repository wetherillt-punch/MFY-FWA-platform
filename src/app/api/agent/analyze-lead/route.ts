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
  "comparative_analysis": {
    "claims_per_month": {
      "provider": number,
      "peer": number,
      "deviation_percent": number (negative if below peer, positive if above)
    },
    "round_dollar_percent": {
      "provider": number,
      "peer": number, 
      "deviation_pp": number (percentage point difference)
    },
    "total_flagged": {
      "provider": number,
      "peer": number,
      "deviation_percent": number
    }
  },
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
        round_dollar_percent: {
          ...validatedAnalysis.comparative_analysis.round_dollar_percent,
          formatted_deviation: formatDeviation(
            validatedAnalysis.comparative_analysis.round_dollar_percent.deviation_pp
          )
        },
        total_flagged: {
          ...validatedAnalysis.comparative_analysis.total_flagged,
          formatted_deviation: formatDeviation(
            validatedAnalysis.comparative_analysis.total_flagged.deviation_percent
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
