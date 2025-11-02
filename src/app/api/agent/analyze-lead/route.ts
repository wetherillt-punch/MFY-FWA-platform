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

    const rulesTableData: RuleTableData[] = lead.matchedRules && lead.matchedRules.length > 0
      ? lead.matchedRules.map((rule: any) => ({
          rule_id: rule.rule_id,
          name: rule.rule_name,
          detects: rule.explanation
        }))
      : [];

    let codeContext = '';
    if (lead.topCodes && lead.topCodes.length > 0) {
      codeContext = lead.topCodes.map((code: any) => {
        const avgAmount = code.totalBilled / code.count;
        return `${code.code} (${code.count} claims, $${code.totalBilled.toLocaleString()})`;
      }).join(', ');
    }

    const prompt = `Write a fraud investigation report with proper markdown tables.

Provider ${lead.provider_id}: ${lead.priority} RISK, Score ${lead.overallScore.toFixed(1)}
Claims: ${lead.claimCount}, Total: $${totalBilled.toLocaleString()}
Matched Rules: ${rulesTableData.map(r => r.rule_id).join(', ') || 'Pattern-based'}
Top Codes: ${codeContext}

Output this EXACT format with proper markdown tables:

## Provider: ${lead.provider_id} | ${lead.priority} RISK | Score: ${lead.overallScore.toFixed(1)}/100

### RULE ANOMALIES

| Rule ID | Name | What It Detects |
|---------|------|-----------------|
${rulesTableData.length > 0 
  ? rulesTableData.map((r: RuleTableData) => `| ${r.rule_id} | ${r.name} | ${r.detects} |`).join('\n')
  : '| Pattern-based | Anomaly Detection | Statistical patterns detected |'}

### SUMMARY

[Write 2-3 sentences about the fraud with specific codes and amounts]

### COMPARATIVE ANALYSIS

| Metric | Provider | Peer | Deviation |
|--------|----------|------|-----------|
| Claims/month | ${Math.round(lead.claimCount/3)} | 15 | +${Math.round((lead.claimCount/3/15-1)*100)}% |
| Round-$ % | ${lead.hasRoundNumbers ? '80%' : '15%'} | 12% | +68pp |
| Total flagged | $${totalBilled.toLocaleString()} | $${estimatedPeerTotal.toLocaleString()} | +${Math.round((totalBilled/estimatedPeerTotal-1)*100)}% |

### FLAGGED CODES

[List specific codes with bullet points]

### INVESTIGATION PRIORITY

${lead.priority === 'HIGH' ? '🔴 **IMMEDIATE ACTION REQUIRED**' : lead.priority === 'MEDIUM' ? '🟡 **ESCALATED REVIEW**' : '🟢 **ROUTINE MONITORING**'}

**Next Steps:** [List 2-3 action items]

**Estimated Overpayment:** $${estimatedOverpayment.toLocaleString()}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
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
