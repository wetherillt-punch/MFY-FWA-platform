import { Claim } from '@/types/detection';

export interface Tier2Result {
  score: number;
  metrics: Array<{
    metric: string;
    description: string;
    value: any;
    tier: number;
    flaggedClaimIds?: string[];
  }>;
}

export function detectTier2(claims: Claim[], providerId: string, allProviders: string[]): Tier2Result {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  const metrics: any[] = [];
  let score = 0;

  if (providerClaims.length < 30) {
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
      tier: 2,
      flaggedClaimIds: benfordResult.suspiciousClaimIds
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
      tier: 2,
      flaggedClaimIds: providerClaims.map(c => c.claim_id) // All claims contribute
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
      tier: 2,
      flaggedClaimIds: spikeResult.spikeClaimIds
    });
  }

  // 4. CONCENTRATION INDEX
  const giniResult = calculateGini(providerClaims);
  if (giniResult.gini > 0.85) {
    score += 60;
    metrics.push({
      metric: 'High Concentration',
      description: `Gini index ${giniResult.gini.toFixed(2)} indicates repetitive billing`,
      value: giniResult.gini.toFixed(2),
      tier: 2,
      flaggedClaimIds: giniResult.repeatedClaimIds
    });
  }

  return { score: Math.min(score, 100), metrics };
}

function checkBenfordLaw(claims: Claim[]): { 
  violation: boolean; 
  chiSquare: number; 
  pValue: number;
  suspiciousClaimIds: string[];
} {
  if (claims.length < 100) return { violation: false, chiSquare: 0, pValue: 1, suspiciousClaimIds: [] };

  const expected = [30.1, 17.6, 12.5, 9.7, 7.9, 6.7, 5.8, 5.1, 4.6];
  const suspiciousClaimIds: string[] = [];
  
  const firstDigitData = claims.map(c => {
    const amount = parseFloat(c.billed_amount || '0');
    const firstDigit = parseInt(amount.toString()[0]);
    return { claimId: c.claim_id, firstDigit, amount };
  }).filter(d => d.firstDigit > 0 && d.firstDigit <= 9);

  const observed = Array(9).fill(0);
  firstDigitData.forEach(d => observed[d.firstDigit - 1]++);
  
  let chiSquare = 0;
  for (let i = 0; i < 9; i++) {
    const exp = (expected[i] / 100) * firstDigitData.length;
    if (exp > 0) {
      chiSquare += Math.pow(observed[i] - exp, 2) / exp;
    }
  }

  // Flag claims with digits that are most over-represented
  if (chiSquare > 20) {
    const overrepresented: number[] = [];
    for (let i = 0; i < 9; i++) {
      const exp = (expected[i] / 100) * firstDigitData.length;
      if (observed[i] > exp * 1.5) {
        overrepresented.push(i + 1);
      }
    }
    
    firstDigitData.forEach(d => {
      if (overrepresented.includes(d.firstDigit)) {
        suspiciousClaimIds.push(d.claimId);
      }
    });
  }

  return {
    violation: chiSquare > 20,
    chiSquare,
    pValue: chiSquare > 15.507 ? 0.01 : 0.5,
    suspiciousClaimIds: suspiciousClaimIds.slice(0, 100) // Limit to 100 for performance
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
  
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const variance = sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / sorted.length;
  const stdDev = Math.sqrt(variance);
  const zScore = stdDev > 0 ? (targetMetric.claimsPerMonth - mean) / stdDev : 0;

  return {
    isOutlier: percentile > 99 && zScore > 3,
    percentile: Math.round(percentile),
    metric: 'Claims/month'
  };
}

function detectSpikes(claims: Claim[]): any {
  const dailyData = new Map<string, { total: number; claimIds: string[] }>();
  
  claims.forEach(claim => {
    const date = claim.service_date.split('T')[0];
    const amount = parseFloat(claim.billed_amount || '0');
    const existing = dailyData.get(date) || { total: 0, claimIds: [] };
    existing.total += amount;
    existing.claimIds.push(claim.claim_id);
    dailyData.set(date, existing);
  });

  const amounts = Array.from(dailyData.values()).map(d => d.total);
  if (amounts.length < 5) return { hasSpike: false, spikeClaimIds: [] };

  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const stdDev = Math.sqrt(amounts.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / amounts.length);

  const spikes = Array.from(dailyData.entries())
    .map(([date, data]) => ({
      date,
      amount: data.total,
      claimIds: data.claimIds,
      zScore: stdDev > 0 ? (data.total - mean) / stdDev : 0
    }))
    .filter(s => s.zScore > 4)
    .sort((a, b) => b.zScore - a.zScore);

  if (spikes.length > 0) {
    const maxSpike = spikes[0];
    return {
      hasSpike: true,
      spikeDate: maxSpike.date,
      spikeAmount: maxSpike.amount.toFixed(0),
      zScore: maxSpike.zScore,
      spikeClaimIds: maxSpike.claimIds
    };
  }

  return { hasSpike: false, spikeClaimIds: [] };
}

function calculateGini(claims: Claim[]): { gini: number; repeatedClaimIds: string[] } {
  const amountMap = new Map<number, string[]>();
  
  claims.forEach(c => {
    const amount = parseFloat(c.billed_amount || '0');
    const existing = amountMap.get(amount) || [];
    existing.push(c.claim_id);
    amountMap.set(amount, existing);
  });

  const amounts = claims.map(c => parseFloat(c.billed_amount || '0')).sort((a, b) => a - b);
  const n = amounts.length;
  const sum = amounts.reduce((a, b) => a + b, 0);
  
  if (sum === 0) return { gini: 0, repeatedClaimIds: [] };
  
  let numerator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (2 * (i + 1) - n - 1) * amounts[i];
  }
  
  const gini = numerator / (n * sum);

  // Find most repeated amounts
  const repeatedClaimIds: string[] = [];
  const sortedByFrequency = Array.from(amountMap.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5); // Top 5 most repeated amounts

  sortedByFrequency.forEach(([amount, claimIds]) => {
    if (claimIds.length > 3) {
      repeatedClaimIds.push(...claimIds);
    }
  });
  
  return { 
    gini, 
    repeatedClaimIds: repeatedClaimIds.slice(0, 100) // Limit to 100
  };
}
