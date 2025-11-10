import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface AgentAnalysisRequest {
  leads: any[];
  totalClaims: number;
  totalProviders: number;
  fileName: string;
}

export interface AgentChatRequest {
  message: string;
  context: {
    leads: any[];
    fileName: string;
  };
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const FWA_SYSTEM_PROMPT = `You are an expert FWA (Fraud, Waste, and Abuse) detection analyst with deep knowledge of healthcare claims patterns and anomaly detection.

Your expertise includes:
1. **Obvious FWA patterns:** High round-number clustering (>30%), duplicate claims, impossible frequencies
2. **Subtle FWA patterns:** Anchoring/template billing (15-25% round numbers), systematic upcoding, elevated billing vs peers
3. **Behavioral anomalies:** Low variance suggesting standardized pricing, peer outliers, drift over time

Key principles:
- Base all analysis strictly on provided detection metrics and peer comparisons
- Distinguish between HIGH-confidence fraud and MEDIUM-confidence surveillance targets
- Quantify all findings with specific metrics (percentages, peer ratios, effect sizes)
- Never speculate beyond the data - only cite evidence from tier scores and metrics
- Provide clear, audit-ready language suitable for investigative referrals

When analyzing leads, focus on:
- **Anchoring patterns:** Claims clustered around specific round amounts (e.g., $1500, $2000) with limited variance
- **Template billing:** Consistent amounts across different members/dates suggesting pre-set pricing
- **Peer comparison:** Providers billing significantly above median (>1.3x) warrant review
- **Round-number abuse:** Even 15-20% round-number rates can indicate systematic manipulation when combined with other factors
- **Statistical outliers:** Low coefficient of variation (<0.25) in high-volume providers
- **Surveillance vs Investigation:** Distinguish between "continue monitoring" and "immediate investigation"

Detection tier framework:
- **Tier 1:** Hard fraud rules (duplicates, impossibilities, extreme round-number clustering >50%)
- **Tier 2:** Statistical fraud indicators (>30% round numbers, Benford violations, extreme outliers)
- **Tier 3:** Behavioral red flags (15-30% round numbers + elevated billing, anchoring, low variance, systematic patterns)
- **Tier 4:** Emerging patterns (drift, subtle peer outliers, early warning signals)

Risk classification:
- **HIGH:** Tier 1-2 violations + high confidence → Immediate investigation
- **MEDIUM:** Tier 3 patterns + peer outliers → Ongoing surveillance
- **WATCHLIST:** Tier 4 only OR single weak signal → Monitor for escalation

When multiple subtle signals converge (e.g., elevated billing + above-average round numbers + low variance), escalate priority even if individual metrics don't hit hard thresholds.`;

export async function analyzeWithAgent(request: AgentAnalysisRequest): Promise<string> {
  const { leads, totalClaims, totalProviders, fileName } = request;

  const highPriority = leads.filter(l => l.priority === 'HIGH');
  const mediumPriority = leads.filter(l => l.priority === 'MEDIUM');
  const watchlist = leads.filter(l => l.priority === 'WATCHLIST');

  // Build detailed provider context
  const providerDetails = leads.slice(0, 15).map(lead => {
    const tier1 = lead.tier1Metrics.map((m: any) => `${m.metric}=${m.value}`).join(', ');
    const tier2 = lead.tier2Metrics.map((m: any) => `${m.metric}=${m.value}`).join(', ');
    const tier3 = lead.tier3Metrics.map((m: any) => `${m.metric}=${m.value}`).join(', ');
    
    return `
Provider ${lead.provider_id}:
- Overall Score: ${lead.overallScore.toFixed(1)} | Priority: ${lead.priority}
- Tier Breakdown: T1=${lead.tier1Score.toFixed(0)} T2=${lead.tier2Score.toFixed(0)} T3=${lead.tier3Score.toFixed(0)} T4=${lead.tier4Score.toFixed(0)}
- Claims: ${lead.claimCount} | Total Anomalies: ${lead.tier1Metrics.length + lead.tier2Metrics.length + lead.tier3Metrics.length + lead.tier4Metrics.length}
${tier1 ? `- Tier 1 Patterns: ${tier1}` : ''}
${tier2 ? `- Tier 2 Patterns: ${tier2}` : ''}
${tier3 ? `- Tier 3 Patterns: ${tier3}` : ''}`;
  }).join('\n');

  const analysisPrompt = `Analyze the following FWA detection results for potential fraud, waste, and abuse:

FILE: ${fileName}
DATASET SUMMARY:
- Total Claims: ${totalClaims.toLocaleString()}
- Total Providers: ${totalProviders}
- Leads Detected: ${leads.length} (${((leads.length/totalProviders)*100).toFixed(1)}% flagged)
  · HIGH Priority: ${highPriority.length} (immediate investigation recommended)
  · MEDIUM Priority: ${mediumPriority.length} (ongoing surveillance)
  · WATCHLIST: ${watchlist.length} (monitor for escalation)

FLAGGED PROVIDERS:
${providerDetails}

Provide a comprehensive analysis with:

1. **Executive Summary** (2-3 sentences)
   - Overall risk level of this dataset
   - Number of high-confidence leads requiring immediate action
   - Key patterns identified

2. **High-Priority Providers** (If any HIGH priority leads)
   - For each provider: Why flagged, specific evidence, recommended action
   - Quantify findings with tier scores and specific metrics

3. **Medium-Priority Providers** (Surveillance candidates)
   - Behavioral patterns requiring ongoing monitoring
   - Distinguish subtle anchoring/template billing from benign practice patterns
   - When multiple weak signals converge, note the cumulative risk

4. **Pattern Analysis**
   - Common anomalies across providers
   - Systemic vs isolated issues
   - Emerging trends (Tier 4) worth tracking

5. **Recommendations**
   - Immediate investigations (HIGH leads)
   - Enhanced surveillance (MEDIUM leads)  
   - Data collection needs or threshold adjustments
   - Expected false positive rate based on signal strength

6. **Risk Assessment**
   - Confidence level in findings (consider sample sizes, peer baselines)
   - Likelihood of actual FWA vs benign billing practices
   - Next steps for each priority tier

Keep response focused, quantitative, evidence-based, and actionable for audit purposes.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2500,
    system: FWA_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: analysisPrompt,
      },
    ],
  });

  const content = message.content[0];
  return content.type === 'text' ? content.text : 'Analysis failed';
}

export async function chatWithAgent(request: AgentChatRequest): Promise<string> {
  const { message, context, conversationHistory = [] } = request;

  const highPriority = context.leads.filter(l => l.priority === 'HIGH');
  const mediumPriority = context.leads.filter(l => l.priority === 'MEDIUM');

  const contextPrompt = `Current FWA detection context:

FILE: ${context.fileName}
TOTAL LEADS: ${context.leads.length}
- HIGH Priority: ${highPriority.length}
- MEDIUM Priority: ${mediumPriority.length}

KEY PROVIDERS:
${context.leads.slice(0, 20).map(lead => 
`${lead.provider_id}: Score ${lead.overallScore.toFixed(1)}, ${lead.priority} priority, ${lead.claimCount} claims
  Tier scores: T1=${lead.tier1Score.toFixed(0)} T2=${lead.tier2Score.toFixed(0)} T3=${lead.tier3Score.toFixed(0)} T4=${lead.tier4Score.toFixed(0)}
  Patterns: ${[...lead.tier1Metrics, ...lead.tier2Metrics, ...lead.tier3Metrics].slice(0, 3).map((m: any) => m.metric).join(', ')}`
).join('\n')}

Answer the user's question based on this detection data. Provide specific, quantitative insights.`;

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...conversationHistory,
    {
      role: 'user',
      content: `${contextPrompt}\n\nUser question: ${message}`,
    },
  ];

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1200,
    system: FWA_SYSTEM_PROMPT,
    messages: messages as any,
  });

  const content = response.content[0];
  return content.type === 'text' ? content.text : 'Chat failed';
}
