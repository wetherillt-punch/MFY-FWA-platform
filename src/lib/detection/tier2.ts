import { Claim } from '@/types/detection';

export interface Tier2Result {
  score: number;
  metrics: Array<{
    metric: string;
    description: string;
    value: any;
    tier: number;
  }>;
}

export function detectTier2(claims: Claim[], providerId: string, allProviders: string[]): Tier2Result {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  const metrics: any[] = [];
  let score = 0;

  if (providerClaims.length < 20) {
    return { score: 0, metrics: [] };
  }

  // 1. BENFORD'S LAW ANALYSIS
  const benfordResult = checkBenfordLaw(providerClaims);
  if (benfordResult.violation && providerClaims.length >= 100) {
    score += 70;
    metrics.push({
      metric: "Benford's Law Violation",
      description: `First digit distribution deviates from expected (chi-square: ${benfordResult.chiSquare.toFixed(2)})`,
      value: benfordResult.chiSquare.toFixed(2),
      tier: 2
    });
  }

  // 2. PEER OUTLIER ANALYSIS
  const peerResult = compareToPeers(providerId, claims, allProviders);
  if (peerResult.isOutlier) {
    score += 80;
    metrics.push({
      metric: 'Peer Outlier',
      description: `${peerResult.percentile}th percentile for ${peerResult.metric}`,
      value: `${peerResult.percentile}th percentile`,
      tier: 2
    });
  }

  // 3. Z-SCORE SPIKE DETECTION
  const spikeResult = detectSpikes(providerClaims);
  if (spikeResult.hasSpike) {
    score += 75;
    metrics.push({
      metric: 'Billing Spike',
      description: `Unusual spike on ${spikeResult.spikeDate} (z-score: ${spikeResult.zScore.toFixed(2)})`,
      value: `Z=${spikeResult.zScore.toFixed(2)}`,
      tier: 2
    });
  }

  // 4. CONCENTRATION INDEX
  const gini = calculateGini(providerClaims);
  if (gini > 0.7) {
    score += 60;
    metrics.push({
      metric: 'High Concentration',
      description: `Gini index ${gini.toFixed(2)} indicates repetitive billing`,
      value: gini.toFixed(2),
      tier: 2
    });
  }

  return { score: Math.min(score, 100), metrics };
}

function checkBenfordLaw(claims: Claim[]): { violation: boolean; chiSquare: number; pValue: number } {
  if (claims.length < 100) return { violation: false, chiSquare: 0, pValue: 1 };

  const firstDigits = claims.map(c => {
    const amount = parseFloat(c.billed_amount || '0');
    return parseInt(amount.toString()[0]);
  }).filter(d => d > 0 && d <= 9);

  const observed = Array(9).fill(0);
  firstDigits.forEach(d => observed[d - 1]++);

  const expected = [30.1, 17.6, 12.5, 9.7, 7.9, 6.7, 5.8, 5.1, 4.6];
  
  let chiSquare = 0;
  for (let i = 0; i < 9; i++) {
    const exp = (expected[i] / 100) * firstDigits.length;
    if (exp > 0) {
      chiSquare += Math.pow(observed[i] - exp, 2) / exp;
    }
  }

  return {
    violation: chiSquare > 15.507,
    chiSquare,
    pValue: chiSquare > 15.507 ? 0.01 : 0.5
  };
}

function compareToPeers(providerId: string, allClaims: Claim[], allProviders: string[]): any {
  const providerClaims = allClaims.filter(c => c.provider_id === providerId);
  
  const providerMetrics = allProviders.map(pid => {
    const claims = allClaims.filter(c => c.provider_id === pid);
    if (claims.length === 0) return { providerId: pid, claimsPerMonth: 0 };
    return {
      providerId: pid,
      claimsPerMonth: claims.length / 3
    };
  });

  const targetMetric = providerMetrics.find(m => m.providerId === providerId);
  if (!targetMetric) return { isOutlier: false };

  const sorted = providerMetrics.map(m => m.claimsPerMonth).sort((a, b) => a - b);
  const percentile = (sorted.filter(v => v < targetMetric.claimsPerMonth).length / sorted.length) * 100;

  return {
    isOutlier: percentile > 95,
    percentile: Math.round(percentile),
    metric: 'Claims/month'
  };
}

function detectSpikes(claims: Claim[]): any {
  const dailyTotals = new Map<string, number>();
  
  claims.forEach(claim => {
    const date = claim.service_date.split('T')[0];
    const amount = parseFloat(claim.billed_amount || '0');
    dailyTotals.set(date, (dailyTotals.get(date) || 0) + amount);
  });

  const amounts = Array.from(dailyTotals.values());
  if (amounts.length < 5) return { hasSpike: false };

  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const stdDev = Math.sqrt(amounts.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / amounts.length);

  const spikes = Array.from(dailyTotals.entries())
    .map(([date, amount]) => ({
      date,
      amount,
      zScore: stdDev > 0 ? (amount - mean) / stdDev : 0
    }))
    .filter(s => s.zScore > 3);

  if (spikes.length > 0) {
    const maxSpike = spikes[0];
    return {
      hasSpike: true,
      spikeDate: maxSpike.date,
      spikeAmount: maxSpike.amount.toFixed(0),
      zScore: maxSpike.zScore
    };
  }

  return { hasSpike: false };
}

function calculateGini(claims: Claim[]): number {
  const amounts = claims.map(c => parseFloat(c.billed_amount || '0')).sort((a, b) => a - b);
  const n = amounts.length;
  const sum = amounts.reduce((a, b) => a + b, 0);
  
  if (sum === 0) return 0;
  
  let numerator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (2 * (i + 1) - n - 1) * amounts[i];
  }
  
  return numerator / (n * sum);
}
