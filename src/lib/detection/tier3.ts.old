/**
 * Tier 3 - Behavioral Anomaly Detection
 * 
 * - Claim-splitting patterns
 * - Anchoring (identical amounts repeated)
 * - Change-points (step-ups)
 */

import { ClaimWithHash, AnomalyMetric } from '@/types';

// ============================================================================
// CLAIM-SPLITTING DETECTION
// ============================================================================

export function detectClaimSplitting(
  claims: ClaimWithHash[],
  providerId: string,
  windowDays: number = 7
): AnomalyMetric | null {
  const providerClaims = claims.filter(c => c.provider_id === providerId)
    .sort((a, b) => a.service_date.getTime() - b.service_date.getTime());
  
  if (providerClaims.length < 10) return null;
  
  let splittingCount = 0;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  
  // Look for patterns: many small claims that sum to near a round number
  for (let i = 0; i < providerClaims.length - 2; i++) {
    const claim1 = providerClaims[i];
    const nearbywindow = [];
    
    // Find claims within window
    for (let j = i + 1; j < providerClaims.length; j++) {
      const timeDiff = providerClaims[j].service_date.getTime() - claim1.service_date.getTime();
      if (timeDiff > windowMs) break;
      nearbywindow.push(providerClaims[j]);
    }
    
    if (nearbywindow.length >= 2) {
      // Check if sum approximates a round number
      const sum = claim1.billed_amount + nearbywindow.reduce((s, c) => s + c.billed_amount, 0);
      const roundedSum = Math.round(sum / 100) * 100;
      const diff = Math.abs(sum - roundedSum);
      
      // If sum is within $5 of a round hundred
      if (diff < 5 && sum > 100) {
        splittingCount++;
      }
    }
  }
  
  const splittingRate = splittingCount / providerClaims.length;
  
  if (splittingRate > 0.1) { // More than 10% of claims appear to be splits
    return {
      metricName: 'Claim Splitting Pattern Rate',
      providerValue: splittingRate * 100,
      baseline: 2.0,
      peerPercentile: 96,
      sampleN: providerClaims.length,
      tier: 3,
      anomalyTag: 'claim_splitting',
    };
  }
  
  return null;
}

// ============================================================================
// ANCHORING DETECTION (Repeated Identical Amounts)
// ============================================================================

export function detectAnchoring(
  claims: ClaimWithHash[],
  providerId: string,
  minRepeats: number = 10
): AnomalyMetric | null {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  
  if (providerClaims.length < 20) return null;
  
  // Count frequency of each amount
  const amountCounts = new Map<number, number>();
  providerClaims.forEach(claim => {
    const amount = Math.round(claim.billed_amount * 100) / 100; // Round to cents
    amountCounts.set(amount, (amountCounts.get(amount) || 0) + 1);
  });
  
  // Find max repeat count
  const maxRepeat = Math.max(...Array.from(amountCounts.values()));
  const maxRepeatRate = maxRepeat / providerClaims.length;
  
  if (maxRepeat >= minRepeats && maxRepeatRate > 0.15) {
    const anchoredAmount = Array.from(amountCounts.entries())
      .find(([_, count]) => count === maxRepeat)?.[0] || 0;
    
    return {
      metricName: 'Anchoring (Identical Amount Repeats)',
      providerValue: maxRepeat,
      baseline: 3.0,
      peerPercentile: 94,
      sampleN: providerClaims.length,
      tier: 3,
      anomalyTag: 'anchoring',
      effectSize: anchoredAmount,
    };
  }
  
  return null;
}

// ============================================================================
// CHANGE-POINT DETECTION (Step-Ups)
// ============================================================================

function detectStepChange(values: number[], minMagnitude: number = 0.3): {
  detected: boolean;
  changePoint: number;
  beforeMean: number;
  afterMean: number;
  magnitude: number;
} | null {
  if (values.length < 20) return null;
  
  let maxMagnitude = 0;
  let bestChangePoint = -1;
  let bestBefore = 0;
  let bestAfter = 0;
  
  // Test each potential change point
  for (let i = 10; i < values.length - 10; i++) {
    const before = values.slice(0, i);
    const after = values.slice(i);
    
    const beforeMean = before.reduce((s, v) => s + v, 0) / before.length;
    const afterMean = after.reduce((s, v) => s + v, 0) / after.length;
    
    // Calculate relative magnitude of change
    const magnitude = (afterMean - beforeMean) / beforeMean;
    
    if (magnitude > maxMagnitude) {
      maxMagnitude = magnitude;
      bestChangePoint = i;
      bestBefore = beforeMean;
      bestAfter = afterMean;
    }
  }
  
  if (maxMagnitude > minMagnitude) {
    return {
      detected: true,
      changePoint: bestChangePoint,
      beforeMean: bestBefore,
      afterMean: bestAfter,
      magnitude: maxMagnitude,
    };
  }
  
  return null;
}

export function detectChangePoint(
  claims: ClaimWithHash[],
  providerId: string,
  minMagnitude: number = 0.3
): AnomalyMetric | null {
  const providerClaims = claims.filter(c => c.provider_id === providerId)
    .sort((a, b) => a.service_date.getTime() - b.service_date.getTime());
  
  if (providerClaims.length < 30) return null;
  
  const amounts = providerClaims.map(c => c.billed_amount);
  const result = detectStepChange(amounts, minMagnitude);
  
  if (result) {
    return {
      metricName: 'Change-Point (Step-Up)',
      providerValue: result.afterMean,
      baseline: result.beforeMean,
      peerPercentile: 93,
      effectSize: result.magnitude * 100,
      sampleN: providerClaims.length,
      tier: 3,
      anomalyTag: 'change_point_up',
    };
  }
  
  return null;
}

// ============================================================================
// TIER 3 AGGREGATOR
// ============================================================================

export function detectTier3Anomalies(
  claims: ClaimWithHash[],
  providerId: string,
  config: {
    claimSplittingWindowDays: number;
    anchoringMinRepeats: number;
    changePointMinMagnitude: number;
  }
): AnomalyMetric[] {
  const results: AnomalyMetric[] = [];
  
  const splitting = detectClaimSplitting(
    claims,
    providerId,
    config.claimSplittingWindowDays
  );
  if (splitting) results.push(splitting);
  
  const anchoring = detectAnchoring(
    claims,
    providerId,
    config.anchoringMinRepeats
  );
  if (anchoring) results.push(anchoring);
  
  const changePoint = detectChangePoint(
    claims,
    providerId,
    config.changePointMinMagnitude
  );
  if (changePoint) results.push(changePoint);
  
  return results;
}
