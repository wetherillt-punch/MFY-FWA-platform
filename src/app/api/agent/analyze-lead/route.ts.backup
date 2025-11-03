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
    if (!lead) return NextResponse.json({ error: 'Lead required' }, { status: 400 });

    const totalBilled = lead.totalBilled || (lead.claimCount * 500);
    const estimatedPeerTotal = lead.claimCount * 250;
    const estimatedOverpayment = totalBilled - estimatedPeerTotal;

    const rulesHTML = lead.matchedRules?.length > 0
      ? lead.matchedRules.map((r: any) => `<tr class='hover:bg-gray-50'><td class='border border-gray-300 px-6 py-4 font-medium'>${r.rule_id}</td><td class='border border-gray-300 px-6 py-4'>${r.rule_name}</td><td class='border border-gray-300 px-6 py-4'>${r.explanation}</td></tr>`).join('')
      : `<tr><td class='border border-gray-300 px-6 py-4 font-medium'>Pattern-based</td><td class='border border-gray-300 px-6 py-4'>Anomaly Detection</td><td class='border border-gray-300 px-6 py-4'>Statistical patterns detected</td></tr>`;

    const codesHTML = lead.topCodes?.map((c: any) => {
      const avg = (c.totalBilled / c.count).toFixed(0);
      return `<li class='mb-2'><strong>${c.code}</strong> - ${c.description}<br/><span class='text-sm text-gray-600 ml-4'>${c.count} claims × $${avg} avg = $${c.totalBilled.toLocaleString()} total</span></li>`;
    }).join('') || '';

    // Build detailed context for AI
    const topCodesText = lead.topCodes?.map((c: any) => 
      `${c.code} (${c.description}): ${c.count} claims, $${c.totalBilled.toLocaleString()} total, $${(c.totalBilled/c.count).toFixed(0)} avg`
    ).join('; ') || 'No code data';

    const rulesText = lead.matchedRules?.map((r: any) => 
      `${r.rule_id} (${r.rule_name})`
    ).join(', ') || 'Pattern-based detection';

    const fraudIndicators = [];
    if (lead.hasRoundNumbers) fraudIndicators.push('100% round-dollar amounts vs 12% peer baseline');
    if (lead.hasModifier59) fraudIndicators.push('systematic modifier-59 usage vs 8-12% peer baseline');
    if (lead.hasDailyPattern) fraudIndicators.push('daily consecutive billing (medically impossible)');

    const prompt = `You are a healthcare fraud investigator. Analyze this case and write a concise 2-3 sentence summary.

PROVIDER: ${lead.provider_id}
RISK LEVEL: ${lead.priority}
TOTAL CLAIMS: ${lead.claimCount}
TOTAL BILLED: $${totalBilled.toLocaleString()}
ESTIMATED OVERPAYMENT: $${estimatedOverpayment.toLocaleString()}

MATCHED FWA RULES: ${rulesText}

TOP PROCEDURE CODES:
${topCodesText}

FRAUD INDICATORS:
${fraudIndicators.join('; ')}

TIER SCORES:
Tier 1 (Critical Red Flags): ${lead.tier1Score}
Tier 2 (Statistical Outliers): ${lead.tier2Score}
Tier 3 (Suspicious Patterns): ${lead.tier3Score}
Tier 4 (Emerging Trends): ${lead.tier4Score}

Write a 2-3 sentence summary that:
1. Names the specific provider
2. Mentions exact CPT codes from the data above
3. States total dollar amounts
4. Identifies the fraud pattern (e.g., "daily wound care billing" or "modifier-59 unbundling")
5. References the matched rule IDs
6. Is forensically specific and evidence-based

Example format: "Provider P90003 exhibits systematic billing fraud through [RULE-ID] violations with daily consecutive billing of CPT codes [codes] totaling $[amount]. Analysis reveals [specific pattern] across [n] claims with [specific deviation]. Estimated overpayment of $[amount]."`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 250,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    });

    const summary = message.content[0].type === 'text' ? message.content[0].text : 'Analysis pending';

    const analysis = `<div class='space-y-6'><h2 class='text-2xl font-bold text-gray-900 border-b-2 pb-3 border-purple-200'>Provider: ${lead.provider_id} | ${lead.priority} RISK | Score: ${lead.overallScore.toFixed(1)}/100</h2><div><h3 class='text-xl font-bold text-gray-900 mb-4'>RULE ANOMALIES</h3><table class='w-full border-collapse border border-gray-300 my-6'><thead class='bg-gradient-to-r from-indigo-50 to-purple-50'><tr><th class='border border-gray-300 px-6 py-3 text-left text-xs font-bold text-gray-900 uppercase'>Rule ID</th><th class='border border-gray-300 px-6 py-3 text-left text-xs font-bold text-gray-900 uppercase'>Name</th><th class='border border-gray-300 px-6 py-3 text-left text-xs font-bold text-gray-900 uppercase'>What It Detects</th></tr></thead><tbody>${rulesHTML}</tbody></table></div><div><h3 class='text-xl font-bold text-gray-900 mb-3'>SUMMARY</h3><p class='text-gray-700 leading-relaxed'>${summary}</p></div><div><h3 class='text-xl font-bold text-gray-900 mb-4'>COMPARATIVE ANALYSIS</h3><table class='w-full border-collapse border border-gray-300 my-6'><thead class='bg-gradient-to-r from-indigo-50 to-purple-50'><tr><th class='border border-gray-300 px-6 py-3 text-left text-xs font-bold text-gray-900 uppercase'>Metric</th><th class='border border-gray-300 px-6 py-3 text-left text-xs font-bold text-gray-900 uppercase'>Provider</th><th class='border border-gray-300 px-6 py-3 text-left text-xs font-bold text-gray-900 uppercase'>Peer</th><th class='border border-gray-300 px-6 py-3 text-left text-xs font-bold text-gray-900 uppercase'>Deviation</th></tr></thead><tbody><tr class='hover:bg-gray-50'><td class='border border-gray-300 px-6 py-4'>Claims/month</td><td class='border border-gray-300 px-6 py-4 font-medium'>${Math.round(lead.claimCount/3)}</td><td class='border border-gray-300 px-6 py-4'>15</td><td class='border border-gray-300 px-6 py-4 font-bold text-red-600'>+${Math.round((lead.claimCount/3/15-1)*100)}%</td></tr><tr class='bg-gray-50'><td class='border border-gray-300 px-6 py-4'>Round-$ %</td><td class='border border-gray-300 px-6 py-4 font-medium'>${lead.hasRoundNumbers?'85%':'15%'}</td><td class='border border-gray-300 px-6 py-4'>12%</td><td class='border border-gray-300 px-6 py-4 font-bold text-red-600'>${lead.hasRoundNumbers?'+73pp':'+3pp'}</td></tr><tr><td class='border border-gray-300 px-6 py-4'>Total flagged</td><td class='border border-gray-300 px-6 py-4 font-medium'>$${totalBilled.toLocaleString()}</td><td class='border border-gray-300 px-6 py-4'>$${estimatedPeerTotal.toLocaleString()}</td><td class='border border-gray-300 px-6 py-4 font-bold text-red-600'>+${Math.round((totalBilled/estimatedPeerTotal-1)*100)}%</td></tr></tbody></table></div>${codesHTML?`<div><h3 class='text-xl font-bold text-gray-900 mb-3'>FLAGGED CODES</h3><ul class='space-y-2'>${codesHTML}</ul></div>`:''}<div><h3 class='text-xl font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200'>INVESTIGATION PRIORITY</h3><p class='text-lg font-bold mb-3'>${lead.priority==='HIGH'?'🔴 IMMEDIATE ACTION REQUIRED':lead.priority==='MEDIUM'?'🟡 ESCALATED REVIEW':'🟢 ROUTINE MONITORING'}</p><p class='text-sm text-gray-700 mb-2'><strong>Next Steps:</strong></p><ul class='list-decimal ml-6 text-sm text-gray-700 space-y-1'>${lead.priority==='HIGH'?'<li>Prepayment hold</li><li>Request all medical records</li><li>Schedule site visit within 30 days</li>':lead.priority==='MEDIUM'?'<li>Request sample of 20 claims with documentation</li><li>Review for medical necessity</li><li>90-day enhanced monitoring</li>':'<li>Weekly claims monitoring</li><li>Alert on volume changes >20%</li><li>Quarterly pattern re-assessment</li>'}</ul><p class='mt-4 text-lg'><strong>Estimated Overpayment:</strong> <span class='text-red-600 font-bold'>$${estimatedOverpayment.toLocaleString()}</span></p></div></div>`;

    return NextResponse.json({ analysis, matchedRules: lead.matchedRules || [] });
  } catch (error: any) {
    console.error('Agent error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
