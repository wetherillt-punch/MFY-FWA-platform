import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

interface RuleTableData {
  rule_id: string;
  name: string;
  detects: string;
}

export async function POST(request: NextRequest) {
  try {
    const { lead } = await request.json();

    if (!lead) {
      return NextResponse.json({ error: 'Lead required' }, { status: 400 });
    }

    const allMetrics = [
      ...lead.tier1Metrics,
      ...lead.tier2Metrics,
      ...lead.tier3Metrics,
      ...lead.tier4Metrics,
    ];

    const totalBilled = lead.totalBilled || (lead.claimCount * 500);
    const estimatedPeerTotal = lead.claimCount * 250;
    const estimatedOverpayment = totalBilled - estimatedPeerTotal;

    // Build matched rules context
    const matchedRulesContext = lead.matchedRules && lead.matchedRules.length > 0
      ? lead.matchedRules.map((rule: any) => `
**${rule.rule_id}**: ${rule.rule_name}
- Severity: ${rule.severity}
- Weight: ${rule.weight}
- Confidence: ${(rule.confidence * 100).toFixed(0)}%
- Explanation: ${rule.explanation}
- Evidence: ${JSON.stringify(rule.evidence)}
`).join('\n')
      : 'No specific rules matched - pattern-based detection';

    // Build rules table for prompt
    const rulesTableData: RuleTableData[] = lead.matchedRules && lead.matchedRules.length > 0
      ? lead.matchedRules.map((rule: any) => ({
          rule_id: rule.rule_id,
          name: rule.rule_name,
          detects: rule.explanation
        }))
      : [];

    // Build code context
    let codeContext = '';
    if (lead.topCodes && lead.topCodes.length > 0) {
      codeContext = lead.topCodes.map((code: any) => {
        const avgAmount = code.totalBilled / code.count;
        const roundPct = code.amounts ? 
          (code.amounts.filter((a: number) => a % 100 === 0).length / code.amounts.length * 100) : 0;
        const mod59Pct = code.modifiers ? 
          (code.modifiers.filter((m: any) => String(m) === '59').length / code.count * 100) : 0;
        
        return `
Code: ${code.code}
Description: ${code.description}
Billed: ${code.count} times
Total: $${code.totalBilled.toLocaleString()}
Avg/claim: $${avgAmount.toFixed(2)}
Round-$ %: ${roundPct.toFixed(0)}%
${mod59Pct > 0 ? `Modifier-59 %: ${mod59Pct.toFixed(0)}%` : ''}`;
      }).join('\n---');
    }

    const patternDetails = allMetrics.map((m: any, i: number) => 
      `${i + 1}. ${m.metric}: ${m.description || m.value || 'detected'}`
    ).join('\n');

    const prompt = `You are a healthcare fraud investigator. Write a concise, table-based report.

PROVIDER: ${lead.provider_id}
RISK: ${lead.priority}
SCORE: ${lead.overallScore.toFixed(1)}/100
CLAIMS: ${lead.claimCount}
TOTAL BILLED: $${totalBilled.toLocaleString()}
OVERPAYMENT: ~$${estimatedOverpayment.toLocaleString()}

TIER SCORES:
T1=${lead.tier1Score} T2=${lead.tier2Score} T3=${lead.tier3Score} T4=${lead.tier4Score}

FWA RULES MATCHED:
${matchedRulesContext}

ACTUAL CPT/HCPCS CODES:
${codeContext}

PATTERNS:
${patternDetails}

FRAUD INDICATORS:
${lead.hasRoundNumbers ? '⚠️ Round-number clustering' : ''}
${lead.hasModifier59 ? '⚠️ Modifier-59 overuse' : ''}
${lead.hasDailyPattern ? '⚠️ Daily consecutive billing' : ''}

CRITICAL INSTRUCTIONS:
1. START with a "Rule Anomalies" table showing matched rules
2. Use actual rule IDs, names, and what they detect
3. After the table, provide 2-3 sentence summary
4. Then show comparative analysis table
5. Reference rule IDs throughout
6. Be forensically specific with evidence

OUTPUT FORMAT (max 250 words):

## Provider: ${lead.provider_id} | ${lead.priority} RISK | Score: ${lead.overallScore.toFixed(1)}/100

### RULE ANOMALIES

${rulesTableData.length > 0 ? `
| Rule ID | Name | What It Detects |
|---------|------|-----------------|
${rulesTableData.map((r: RuleTableData) => `| ${r.rule_id} | ${r.name} | ${r.detects} |`).join('\n')}
` : `
| Rule ID | Name | What It Detects |
|---------|------|-----------------|
| Pattern-based | General Anomaly Detection | Unusual billing patterns detected through statistical analysis |
`}

### SUMMARY
[2-3 sentences explaining the fraud scheme. Reference rule IDs from table above. Include specific codes and dollar amounts.]

### COMPARATIVE ANALYSIS
| Metric | Provider | Peer Baseline | Deviation | Rule |
|--------|----------|---------------|-----------|------|
| [metric] | [value] | [baseline] | [+X%] | [Rule ID] |
| [metric] | [value] | [baseline] | [+X%] | [Rule ID] |
| Total flagged | $${totalBilled.toLocaleString()} | $${estimatedPeerTotal.toLocaleString()} | +${((totalBilled / estimatedPeerTotal - 1) * 100).toFixed(0)}% | Combined |

### FLAGGED CODES
[Use actual codes from data above]

- **[CODE]** - [Description]
  - [X] claims × $[Y] avg = $[Z] total
  - Issue: [specific problem tied to rule]
  - Baseline: [peer comparison]

### INVESTIGATION PRIORITY
${lead.priority === 'HIGH' ? '🔴 **IMMEDIATE ACTION REQUIRED**' : 
  lead.priority === 'MEDIUM' ? '🟡 **ESCALATED REVIEW**' :
  '🟢 **ROUTINE MONITORING**'}

**Next Steps:**
${lead.priority === 'HIGH' ? '1. Prepayment hold\n2. Request all medical records\n3. Site visit within 30 days' : 
  lead.priority === 'MEDIUM' ? '1. Request sample of 20 claims\n2. Review documentation\n3. 90-day monitoring' :
  '1. Weekly monitoring\n2. Alert on volume increase\n3. Quarterly re-assessment'}

**Estimated Overpayment:** $${estimatedOverpayment.toLocaleString()}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    const analysis = content.type === 'text' ? content.text : 'Analysis failed';

    return NextResponse.json({ 
      analysis,
      matchedRules: lead.matchedRules || []
    });
  } catch (error: any) {
    console.error('Agent error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
