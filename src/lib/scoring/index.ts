/**
 * Scoring Engine
 * 
 * Combines all tier scores into overall score and determines priority
 */

import { AnomalyMetric, ProviderAnomalyResult, DetectionConfig } from '@/types';

// ============================================================================
// ROBUST SCALING
// ============================================================================

function robustScale(value: number, baseline: number, peerPercentile: number): number {
  // Scale to 0-100 based on how far from baseline and peer position
  const deviationFromBaseline = Math.abs(value - baseline) / (baseline + 1);
  const percentileScore = peerPercentile;
  
  // Combine deviation and percentile
  const rawScore = (deviationFromBaseline * 50) + (percentileScore * 0.5);
  
  // Clamp to 0-100
  return Math.max(0, Math.min(100, rawScore));
}

// ============================================================================
// TIER SCORING
// ============================================================================

function calculateTierScore(metrics: AnomalyMetric[]): number {
  if (metrics.length === 0) return 0;
  
  // Score each metric and take the max (most severe)
  const scores = metrics.map(m => 
    robustScale(m.providerValue, m.baseline, m.peerPercentile)
  );
  
  return Math.max(...scores);
}

// ============================================================================
// OVERALL SCORING
// ============================================================================

export function calculateOverallScore(
  tier1Metrics: AnomalyMetric[],
  tier2Metrics: AnomalyMetric[],
  tier3Metrics: AnomalyMetric[],
  tier4Metrics: AnomalyMetric[]
): {
  tier1Score: number;
  tier2Score: number;
  tier3Score: number;
  tier4Score: number;
  overallScore: number;
} {
  const tier1Score = calculateTierScore(tier1Metrics);
  const tier2Score = calculateTierScore(tier2Metrics);
  const tier3Score = calculateTierScore(tier3Metrics);
  const tier4Score = calculateTierScore(tier4Metrics);
  
  // Weighted combination (Tier 1 and 2 weighted higher)
  const weights = {
    tier1: 0.40,
    tier2: 0.35,
    tier3: 0.20,
    tier4: 0.05,
  };
  
  const overallScore = 
    tier1Score * weights.tier1 +
    tier2Score * weights.tier2 +
    tier3Score * weights.tier3 +
    tier4Score * weights.tier4;
  
  return {
    tier1Score,
    tier2Score,
    tier3Score,
    tier4Score,
    overallScore: Math.round(overallScore * 10) / 10, // Round to 1 decimal
  };
}

// ============================================================================
// PRIORITY CLASSIFICATION
// ============================================================================

export function determinePriority(
  overallScore: number,
  hasTier1: boolean,
  hasTier2: boolean,
  config: DetectionConfig
): 'HIGH' | 'MEDIUM' | 'WATCHLIST' {
  // High Priority: Has Tier 1 or 2 AND score >= threshold_high
  if ((hasTier1 || hasTier2) && overallScore >= config.threshold_high) {
    return 'HIGH';
  }
  
  // Medium Priority: Score >= threshold_medium but no Tier 1/2
  if (overallScore >= config.threshold_medium && !hasTier1 && !hasTier2) {
    return 'MEDIUM';
  }
  
  // Watchlist: Everything else (Tier 4 only or below medium threshold)
  return 'WATCHLIST';
}

// ============================================================================
// TOP DRIVERS EXTRACTION
// ============================================================================

export function extractTopDrivers(
  allMetrics: AnomalyMetric[],
  limit: number = 5
): AnomalyMetric[] {
  // Sort by tier (lower tier = higher priority) then by percentile
  const sorted = [...allMetrics].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return b.peerPercentile - a.peerPercentile;
  });
  
  return sorted.slice(0, limit);
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

export function scoreProvider(
  providerId: string,
  tier1Metrics: AnomalyMetric[],
  tier2Metrics: AnomalyMetric[],
  tier3Metrics: AnomalyMetric[],
  tier4Metrics: AnomalyMetric[],
  claimCount: number,
  flaggedClaimIds: string[],
  config: DetectionConfig
): Partial<ProviderAnomalyResult> {
  const scores = calculateOverallScore(tier1Metrics, tier2Metrics, tier3Metrics, tier4Metrics);
  
  const hasTier1 = tier1Metrics.length > 0;
  const hasTier2 = tier2Metrics.length > 0;
  const hasTier3 = tier3Metrics.length > 0;
  const hasTier4 = tier4Metrics.length > 0;
  
  const priority = determinePriority(scores.overallScore, hasTier1, hasTier2, config);
  
  const allMetrics = [
    ...tier1Metrics,
    ...tier2Metrics,
    ...tier3Metrics,
    ...tier4Metrics,
  ];
  
  return {
    provider_id: providerId,
    tier1Metrics,
    tier2Metrics,
    tier3Metrics,
    tier4Metrics,
    tier1Score: scores.tier1Score,
    tier2Score: scores.tier2Score,
    tier3Score: scores.tier3Score,
    tier4Score: scores.tier4Score,
    overallScore: scores.overallScore,
    priority,
    claimCount,
    flaggedClaimIds,
  };
}
