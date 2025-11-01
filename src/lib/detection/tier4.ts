/**
 * Tier 4 - Watchlist / Soft Anomaly Detection
 * 
 * - Gradual drift in median or variance
 * - Emerging patterns below thresholds
 */

import { ClaimWithHash, AnomalyMetric } from '@/types';

// ============================================================================
// DRIFT DETECTION
// ============================================================================

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function calculateVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const squareDiffs = values.map(v => Math.pow(v - mean, 2));
  return squareDiffs.reduce((s, v) => s + v, 0) / (values.length - 1);
}

export function detectGradualDrift(
  claims: ClaimWithHash[],
  providerId: string,
  driftThreshold: number = 0.15
): AnomalyMetric | null {
  const providerClaims = claims.filter(c => c.provider_id === providerId)
    .sort((a, b) => a.service_date.getTime() - b.service_date.getTime());
  
  if (providerClaims.length < 50) return null; // Need long time series
  
  // Split into early and late periods
  const midpoint = Math.floor(providerClaims.length / 2);
  const early = providerClaims.slice(0, midpoint);
  const late = providerClaims.slice(midpoint);
  
  // Calculate medians
  const earlyMedian = calculateMedian(early.map(c => c.billed_amount));
  const lateMedian = calculateMedian(late.map(c => c.billed_amount));
  
  // Calculate relative change
  const medianDrift = (lateMedian - earlyMedian) / earlyMedian;
  
  // Calculate variance drift
  const earlyVar = calculateVariance(early.map(c => c.billed_amount));
  const lateVar = calculateVariance(late.map(c => c.billed_amount));
  const varianceDrift = lateVar > 0 ? (lateVar - earlyVar) / earlyVar : 0;
  
  // Flag if median drifted > threshold
  if (Math.abs(medianDrift) > driftThreshold) {
    return {
      metricName: 'Gradual Drift (Median Change)',
      providerValue: lateMedian,
      baseline: earlyMedian,
      peerPercentile: 85,
      effectSize: medianDrift * 100,
      sampleN: providerClaims.length,
      tier: 4,
      anomalyTag: 'gradual_drift_median',
    };
  }
  
  // Flag if variance increased significantly
  if (varianceDrift > driftThreshold * 2) {
    return {
      metricName: 'Gradual Drift (Variance Increase)',
      providerValue: Math.sqrt(lateVar),
      baseline: Math.sqrt(earlyVar),
      peerPercentile: 83,
      effectSize: varianceDrift * 100,
      sampleN: providerClaims.length,
      tier: 4,
      anomalyTag: 'gradual_drift_variance',
    };
  }
  
  return null;
}

// ============================================================================
// EMERGING ROUND-NUMBER PATTERN
// ============================================================================

export function detectEmergingRoundNumber(
  claims: ClaimWithHash[],
  providerId: string
): AnomalyMetric | null {
  const providerClaims = claims.filter(c => c.provider_id === providerId)
    .sort((a, b) => a.service_date.getTime() - b.service_date.getTime());
  
  if (providerClaims.length < 50) return null;
  
  // Split into early and late periods
  const midpoint = Math.floor(providerClaims.length / 2);
  const early = providerClaims.slice(0, midpoint);
  const late = providerClaims.slice(midpoint);
  
  // Count round numbers
  const countRound = (claims: ClaimWithHash[]) => {
    return claims.filter(c => {
      const cents = Math.round((c.billed_amount % 1) * 100);
      return cents === 0;
    }).length;
  };
  
  const earlyRoundRate = countRound(early) / early.length;
  const lateRoundRate = countRound(late) / late.length;
  
  const increase = lateRoundRate - earlyRoundRate;
  
  // Flag if increasing but not yet at Tier 1 threshold (0.5)
  if (increase > 0.1 && lateRoundRate > 0.3 && lateRoundRate < 0.5) {
    return {
      metricName: 'Emerging Round-Number Pattern',
      providerValue: lateRoundRate * 100,
      baseline: earlyRoundRate * 100,
      peerPercentile: 80,
      sampleN: providerClaims.length,
      tier: 4,
      anomalyTag: 'emerging_round_number',
    };
  }
  
  return null;
}

// ============================================================================
// EMERGING DISPERSION INCREASE
// ============================================================================

export function detectEmergingDispersion(
  claims: ClaimWithHash[],
  providerId: string
): AnomalyMetric | null {
  const providerClaims = claims.filter(c => c.provider_id === providerId)
    .sort((a, b) => a.service_date.getTime() - b.service_date.getTime());
  
  if (providerClaims.length < 40) return null;
  
  // Split into early and late periods
  const midpoint = Math.floor(providerClaims.length / 2);
  const early = providerClaims.slice(0, midpoint);
  const late = providerClaims.slice(midpoint);
  
  // Calculate coefficient of variation (CV = std / mean)
  const calcCV = (claims: ClaimWithHash[]) => {
    const amounts = claims.map(c => c.billed_amount);
    const mean = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    const variance = calculateVariance(amounts);
    return Math.sqrt(variance) / mean;
  };
  
  const earlyCV = calcCV(early);
  const lateCV = calcCV(late);
  
  const increase = (lateCV - earlyCV) / earlyCV;
  
  // Flag if dispersion increasing moderately
  if (increase > 0.2 && lateCV < 1.0) { // Not yet extreme
    return {
      metricName: 'Emerging Dispersion Increase',
      providerValue: lateCV,
      baseline: earlyCV,
      peerPercentile: 82,
      sampleN: providerClaims.length,
      tier: 4,
      anomalyTag: 'emerging_dispersion',
    };
  }
  
  return null;
}

// ============================================================================
// TIER 4 AGGREGATOR
// ============================================================================

export function detectTier4Anomalies(
  claims: ClaimWithHash[],
  providerId: string,
  config: {
    driftThreshold: number;
  }
): AnomalyMetric[] {
  const results: AnomalyMetric[] = [];
  
  const drift = detectGradualDrift(claims, providerId, config.driftThreshold);
  if (drift) results.push(drift);
  
  const emergingRound = detectEmergingRoundNumber(claims, providerId);
  if (emergingRound) results.push(emergingRound);
  
  const emergingDispersion = detectEmergingDispersion(claims, providerId);
  if (emergingDispersion) results.push(emergingDispersion);
  
  return results;
}
