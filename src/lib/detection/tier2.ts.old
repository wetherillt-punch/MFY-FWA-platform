/**
 * Tier 2 - Statistical Anomaly Detection
 * 
 * - Burstiness and spikes (rolling z-scores)
 * - Benford's Law deviation
 * - Gini/HHI concentration
 * - Peer-relative outliers
 */

import { ClaimWithHash, AnomalyMetric } from '@/types';

// ============================================================================
// STATISTICAL UTILITIES
// ============================================================================

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squareDiffs = values.map(v => Math.pow(v - avg, 2));
  const avgSquareDiff = mean(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// ============================================================================
// BURSTINESS DETECTION (Rolling Z-Scores)
// ============================================================================

export function detectBurstiness(
  claims: ClaimWithHash[],
  providerId: string,
  zScoreThreshold: number = 3.0
): AnomalyMetric | null {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  
  if (providerClaims.length < 30) return null; // Need meaningful window
  
  // Group by day
  const dailyCounts = new Map<string, number>();
  providerClaims.forEach(claim => {
    const day = claim.service_date.toISOString().split('T')[0];
    dailyCounts.set(day, (dailyCounts.get(day) || 0) + 1);
  });
  
  const counts = Array.from(dailyCounts.values());
  const avg = mean(counts);
  const sd = stdDev(counts);
  
  if (sd === 0) return null; // No variance
  
  // Find max z-score
  const maxZScore = Math.max(...counts.map(c => Math.abs((c - avg) / sd)));
  
  // Overdispersion ratio (variance / mean)
  const overdispersion = sd * sd / avg;
  
  if (maxZScore > zScoreThreshold && overdispersion > 2.0) {
    return {
      metricName: 'Burstiness (Max Z-Score)',
      providerValue: maxZScore,
      baseline: 1.5,
      peerPercentile: 95,
      sampleN: providerClaims.length,
      tier: 2,
      anomalyTag: 'burstiness_spike',
    };
  }
  
  return null;
}

// ============================================================================
// BENFORD'S LAW DETECTION
// ============================================================================

const BENFORD_EXPECTED = [
  0.301, // Leading digit 1
  0.176, // Leading digit 2
  0.125, // Leading digit 3
  0.097, // Leading digit 4
  0.079, // Leading digit 5
  0.067, // Leading digit 6
  0.058, // Leading digit 7
  0.051, // Leading digit 8
  0.046, // Leading digit 9
];

function getLeadingDigit(amount: number): number {
  const str = Math.abs(amount).toString();
  const firstNonZero = str.replace(/^0+/, '')[0];
  return parseInt(firstNonZero) || 0;
}

function chiSquareTest(observed: number[], expected: number[]): number {
  let chiSquare = 0;
  for (let i = 0; i < observed.length; i++) {
    if (expected[i] > 0) {
      chiSquare += Math.pow(observed[i] - expected[i], 2) / expected[i];
    }
  }
  return chiSquare;
}

export function detectBenfordDeviation(
  claims: ClaimWithHash[],
  providerId: string,
  minSampleSize: number = 300,
  pValueThreshold: number = 0.01
): AnomalyMetric | null {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  
  if (providerClaims.length < minSampleSize) return null;
  
  // Count leading digits
  const digitCounts = new Array(9).fill(0);
  providerClaims.forEach(claim => {
    const digit = getLeadingDigit(claim.billed_amount);
    if (digit >= 1 && digit <= 9) {
      digitCounts[digit - 1]++;
    }
  });
  
  // Convert to proportions
  const total = digitCounts.reduce((sum, c) => sum + c, 0);
  if (total === 0) return null;
  
  const observed = digitCounts.map(c => c / total);
  
  // Chi-square test
  const chiSquare = chiSquareTest(
    observed.map(o => o * total),
    BENFORD_EXPECTED.map(e => e * total)
  );
  
  // Degrees of freedom = 8 (9 digits - 1)
  // Critical value at p=0.01, df=8 is ~20.09
  const criticalValue = 20.09;
  
  if (chiSquare > criticalValue) {
    return {
      metricName: 'Benford Deviation (Chi-Square)',
      providerValue: chiSquare,
      baseline: 8.0, // Expected chi-square
      peerPercentile: 97,
      pValue: pValueThreshold,
      sampleN: total,
      tier: 2,
      anomalyTag: 'benford_deviation',
    };
  }
  
  return null;
}

// ============================================================================
// GINI/HHI CONCENTRATION
// ============================================================================

function calculateGini(values: number[]): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  let sum = 0;
  
  for (let i = 0; i < n; i++) {
    sum += (2 * (i + 1) - n - 1) * sorted[i];
  }
  
  const totalSum = sorted.reduce((a, b) => a + b, 0);
  return sum / (n * totalSum);
}

export function detectConcentration(
  claims: ClaimWithHash[],
  providerId: string
): AnomalyMetric | null {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  
  if (providerClaims.length < 20) return null;
  
  const amounts = providerClaims.map(c => c.billed_amount);
  const gini = calculateGini(amounts);
  
  // High Gini (> 0.6) indicates concentration
  if (gini > 0.6) {
    return {
      metricName: 'Gini Concentration Index',
      providerValue: gini,
      baseline: 0.35,
      peerPercentile: 92,
      sampleN: providerClaims.length,
      tier: 2,
      anomalyTag: 'high_concentration',
    };
  }
  
  return null;
}

// ============================================================================
// PEER-RELATIVE OUTLIERS
// ============================================================================

export function detectPeerOutlier(
  claims: ClaimWithHash[],
  providerId: string,
  allProviderIds: string[],
  percentileThreshold: number = 2.5
): AnomalyMetric | null {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  
  if (providerClaims.length < 10) return null;
  
  // Calculate this provider's avg billed amount
  const providerAvg = mean(providerClaims.map(c => c.billed_amount));
  
  // Calculate all providers' averages
  const allAvgs = allProviderIds.map(pid => {
    const pClaims = claims.filter(c => c.provider_id === pid);
    if (pClaims.length === 0) return 0;
    return mean(pClaims.map(c => c.billed_amount));
  }).filter(a => a > 0);
  
  if (allAvgs.length < 20) return null; // Need peer group
  
  // Calculate percentile
  const sorted = [...allAvgs].sort((a, b) => a - b);
  const rank = sorted.filter(a => a <= providerAvg).length;
  const peerPercentile = (rank / sorted.length) * 100;
  
  // Flag if in top percentileThreshold%
  if (peerPercentile > (100 - percentileThreshold)) {
    return {
      metricName: 'Average Billed Amount (Peer Comparison)',
      providerValue: providerAvg,
      baseline: median(allAvgs),
      peerPercentile: peerPercentile,
      sampleN: providerClaims.length,
      tier: 2,
      anomalyTag: 'peer_outlier_high',
    };
  }
  
  return null;
}

// ============================================================================
// TIER 2 AGGREGATOR
// ============================================================================

export function detectTier2Anomalies(
  claims: ClaimWithHash[],
  providerId: string,
  allProviderIds: string[],
  config: {
    zScoreThreshold: number;
    benfordMinSampleSize: number;
    benfordPValueThreshold: number;
    peerOutlierPercentile: number;
  }
): AnomalyMetric[] {
  const results: AnomalyMetric[] = [];
  
  const burstiness = detectBurstiness(claims, providerId, config.zScoreThreshold);
  if (burstiness) results.push(burstiness);
  
  const benford = detectBenfordDeviation(
    claims,
    providerId,
    config.benfordMinSampleSize,
    config.benfordPValueThreshold
  );
  if (benford) results.push(benford);
  
  const concentration = detectConcentration(claims, providerId);
  if (concentration) results.push(concentration);
  
  const peerOutlier = detectPeerOutlier(
    claims,
    providerId,
    allProviderIds,
    config.peerOutlierPercentile
  );
  if (peerOutlier) results.push(peerOutlier);
  
  return results;
}
