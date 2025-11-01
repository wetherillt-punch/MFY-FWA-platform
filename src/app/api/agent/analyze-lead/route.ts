import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

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

    // Use actual total billed if available, otherwise estimate
    const totalBilled = lead.totalBilled || (lead.claimCount * 500);
    const estimatedPeerTotal = lead.claimCount * 250;
    const estimatedOverpayment = totalBilled - estimatedPeerTotal;

    // Build code context from actual data
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
    } else {
      codeContext = 'Code-level data not available';
    }

    const patternDetails = allMetrics.map((m: any, i: number) => 
      `${i + 1}. ${m.metric}: ${m.description || m.value || 'detected'}`
    ).join('\n');

    const prompt = `Write a fraud investigation report using TABLES and BULLETS.

PROVIDER: ${lead.provider_id}
RISK: ${lead.priority}
SCORE: ${lead.overallScore.toFixed(1)}/100
CLAIMS: ${lead.claimCount}
TOTAL BILLED: $${totalBilled.toLocaleString()}
OVERPAYMENT: ~$${estimatedOverpayment.toLocaleString()}

TIER SCORES:
T1=${lead.tier1Score} (${lead.tier1Metrics.length} violations)
T2=${lead.tier2Score} (${lead.tier2Metrics.length} violations)
T3=${lead.tier3Score} (${lead.tier3Metrics.length} patterns)
T4=${lead.tier4Score} (${lead.tier4Metrics.length} trends)

ACTUAL CPT/HCPCS CODES FROM DATA:
${codeContext}

PATTERNS DETECTED:
${patternDetails}

FRAUD INDICATORS:
${lead.hasRoundNumbers ? '⚠️ Round-number clustering detected' : ''}
${lead.hasModifier59 ? '⚠️ Modifier-59 overuse detected' : ''}
${lead.hasDailyPattern ? '⚠️ Daily consecutive billing detected' : ''}

OUTPUT FORMAT (max 180 words):

## Provider: ${lead.provider_id} | ${lead.priority} RISK | Score: ${lead.overallScore.toFixed(1)}/100

### SUMMARY
[2-3 sentences using ACTUAL codes from above. Include specific code numbers, exact amounts, and overpayment.]

### COMPARATIVE ANALYSIS
| Metric | Provider | Peer | Deviation |
|--------|----------|------|-----------|
| Claims/month | ${(lead.claimCount / 3).toFixed(0)} | 15 | +${((lead.claimCount / 3 / 15 - 1) * 100).toFixed(0)}% |
| ${lead.hasRoundNumbers ? 'Round-$ %' : 'Avg billed'} | ${lead.hasRoundNumbers ? '85%' : '$' + (totalBilled / lead.claimCount).toFixed(0)} | ${lead.hasRoundNumbers ? '12%' : '$250'} | ${lead.hasRoundNumbers ? '+73pp' : '+' + ((totalBilled / lead.claimCount / 250 - 1) * 100).toFixed(0) + '%'} |
| Total flagged | $${totalBilled.toLocaleString()} | $${estimatedPeerTotal.toLocaleString()} | +${((totalBilled / estimatedPeerTotal - 1) * 100).toFixed(0)}% |

### FLAGGED CODES
${lead.topCodes && lead.topCodes.length > 0 ? 
  '[Use the ACTUAL codes from data above]' : 
  '[Codes unavailable - pattern-based analysis]'}

${lead.topCodes ? lead.topCodes.slice(0, 3).map((c: any) => `
- **${c.code}** - ${c.description}
  - ${c.count} claims × $${(c.totalBilled / c.count).toFixed(0)} = $${c.totalBilled.toLocaleString()}
  - Pattern: [describe based on metrics]
  - Normal: [peer baseline]`).join('\n') : 
`
- **Pattern 1**: ${allMetrics[0]?.metric || 'Unknown'}
  - ${lead.claimCount} claims total
  - Pattern: ${allMetrics[0]?.description || 'Detected anomaly'}
`}

### RED FLAGS
${allMetrics.slice(0, 4).map((m: any) => `• ${m.metric}: ${m.description || m.value}`).join('\n')}

### ACTION
${lead.priority === 'HIGH' ? '🔴 Prepayment hold + request all records' : 
  lead.priority === 'MEDIUM' ? '🟡 Request records for top 20 claims' :
  '🟢 Monitor weekly for 60 days'}
**Priority ${lead.priority === 'HIGH' ? '1' : lead.priority === 'MEDIUM' ? '2' : '3'}**`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 650,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    const analysis = content.type === 'text' ? content.text : 'Analysis failed';

    return NextResponse.json({ analysis });
  } catch (error: any) {
    console.error('Agent error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
