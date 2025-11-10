import { Claim } from '@/types';

export interface Tier4Result {
  score: number;
  metrics: Array<{
    metric: string;
    description: string;
    value: any;
    tier: number;
  }>;
}

export function detectTier4(claims: Claim[], providerId: string): Tier4Result {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  const metrics: any[] = [];
  let score = 0;

  if (providerClaims.length < 20) {
    return { score: 0, metrics: [] };
  }

  // 1. MEDIAN DRIFT
  const driftResult = detectMedianDrift(providerClaims);
  if (driftResult.detected) {
    score += 40;
    metrics.push({
      metric: 'Median Drift',
      description: `Median drifting from $${driftResult.initialMedian} to $${driftResult.finalMedian}`,
      value: `${driftResult.driftPercent}%`,
      tier: 4
    });
  }

  // 2. EMERGING ROUND PATTERN
  const emergingRound = detectEmergingRoundNumbers(providerClaims);
  if (emergingRound.detected) {
    score += 35;
    metrics.push({
      metric: 'Emerging Round Pattern',
      description: `Round-number % increasing from ${emergingRound.early}% to ${emergingRound.recent}%`,
      value: `${emergingRound.recent}%`,
      tier: 4
    });
  }

  return { score: Math.min(score, 100), metrics };
}

function detectMedianDrift(claims: Claim[]): any {
  const sorted = [...claims].sort((a, b) => 
    new Date(a.service_date).getTime() - new Date(b.service_date).getTime()
  );

  const third = Math.floor(sorted.length / 3);
  const early = sorted.slice(0, third);
  const late = sorted.slice(-third);

  const initialMedian = getMedian(early.map(c => parseFloat(c.billed_amount || '0')));
  const finalMedian = getMedian(late.map(c => parseFloat(c.billed_amount || '0')));

  const driftPercent = ((finalMedian - initialMedian) / initialMedian) * 100;

  return {
    detected: Math.abs(driftPercent) > 20,
    initialMedian: initialMedian.toFixed(0),
    finalMedian: finalMedian.toFixed(0),
    driftPercent: driftPercent.toFixed(0)
  };
}

function detectEmergingRoundNumbers(claims: Claim[]): any {
  const sorted = [...claims].sort((a, b) => 
    new Date(a.service_date).getTime() - new Date(b.service_date).getTime()
  );

  const half = Math.floor(sorted.length / 2);
  const early = sorted.slice(0, half);
  const recent = sorted.slice(half);

  const earlyRound = (early.filter(c => parseFloat(c.billed_amount || '0') % 100 === 0).length / early.length) * 100;
  const recentRound = (recent.filter(c => parseFloat(c.billed_amount || '0') % 100 === 0).length / recent.length) * 100;

  return {
    detected: recentRound > earlyRound + 15,
    early: earlyRound.toFixed(0),
    recent: recentRound.toFixed(0)
  };
}

function getMedian(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
