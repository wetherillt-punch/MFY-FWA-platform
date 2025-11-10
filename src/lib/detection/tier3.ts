import { Claim } from '@/types';

export interface Tier3Result {
  score: number;
  metrics: Array<{
    metric: string;
    description: string;
    value: any;
    tier: number;
  }>;
}

export function detectTier3(claims: Claim[], providerId: string): Tier3Result {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  const metrics: any[] = [];
  let score = 0;

  if (providerClaims.length < 20) {
    return { score: 0, metrics: [] };
  }

  // 1. ANCHORING
  const anchoringResult = detectAnchoring(providerClaims);
  if (anchoringResult.isAnchored) {
    score += 70;
    metrics.push({
      metric: 'Anchoring Bias',
      description: `Amount $${anchoringResult.amount} repeated ${anchoringResult.count} times (${anchoringResult.percentage}%)`,
      value: `${anchoringResult.percentage}%`,
      tier: 3
    });
  }

  // 2. CLAIM SPLITTING
  const splittingResult = detectSplitting(providerClaims);
  if (splittingResult.detected) {
    score += 75;
    metrics.push({
      metric: 'Claim Splitting',
      description: `${splittingResult.smallCount} small claims with round-number pattern`,
      value: splittingResult.smallCount,
      tier: 3
    });
  }

  // 3. STEP-UP CODING
  const stepUpResult = detectStepUp(providerClaims);
  if (stepUpResult.detected) {
    score += 65;
    metrics.push({
      metric: 'Step-Up Pattern',
      description: `Average increased from $${stepUpResult.before} to $${stepUpResult.after}`,
      value: `+${stepUpResult.increasePercent}%`,
      tier: 3
    });
  }

  return { score: Math.min(score, 100), metrics };
}

function detectAnchoring(claims: Claim[]): any {
  const amountCounts = new Map<number, number>();
  
  claims.forEach(claim => {
    const amount = Math.round(parseFloat(claim.billed_amount || '0'));
    amountCounts.set(amount, (amountCounts.get(amount) || 0) + 1);
  });

  const maxEntry = Array.from(amountCounts.entries())
    .reduce((max, entry) => entry[1] > max[1] ? entry : max, [0, 0]);

  const percentage = (maxEntry[1] / claims.length) * 100;

  return {
    isAnchored: percentage > 40 && maxEntry[1] > 10,
    amount: maxEntry[0],
    count: maxEntry[1],
    percentage: percentage.toFixed(0)
  };
}

function detectSplitting(claims: Claim[]): any {
  const amounts = claims.map(c => parseFloat(c.billed_amount || '0'));
  const smallCount = amounts.filter(a => a < 50).length;
  const roundCount = amounts.filter(a => a % 100 === 0).length;

  return {
    detected: smallCount > 10 && roundCount > 5,
    smallCount,
    roundCount
  };
}

function detectStepUp(claims: Claim[]): any {
  const sorted = [...claims].sort((a, b) => 
    new Date(a.service_date).getTime() - new Date(b.service_date).getTime()
  );

  if (sorted.length < 20) return { detected: false };

  const midpoint = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);

  const avgBefore = firstHalf.reduce((sum, c) => sum + parseFloat(c.billed_amount || '0'), 0) / firstHalf.length;
  const avgAfter = secondHalf.reduce((sum, c) => sum + parseFloat(c.billed_amount || '0'), 0) / secondHalf.length;

  const increasePercent = ((avgAfter - avgBefore) / avgBefore) * 100;

  return {
    detected: increasePercent > 30,
    before: avgBefore.toFixed(0),
    after: avgAfter.toFixed(0),
    increasePercent: increasePercent.toFixed(0)
  };
}
