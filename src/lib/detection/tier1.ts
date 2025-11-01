/**
 * Tier 1 - Hard/Deterministic Anomaly Detection
 * 
 * - Duplicate or near-duplicate claims
 * - Round-number clustering
 * - Holiday/weekend concentration
 */

import { ClaimWithHash } from '@/types';
import { AnomalyMetric } from '@/types';
import { createHash } from 'crypto';

// ============================================================================
// HASH GENERATION
// ============================================================================

export function generateClaimHash(claim: ClaimWithHash): string {
  const hashInput = [
    claim.provider_id,
    claim.service_date.toISOString().split('T')[0],
    claim.billed_amount.toFixed(2),
    claim.member_id || '',
  ].join('|');
  
  return createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
}

// ============================================================================
// DUPLICATE DETECTION
// ============================================================================

export function detectDuplicates(
  claims: ClaimWithHash[],
  providerId: string
): AnomalyMetric | null {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  
  if (providerClaims.length === 0) return null;
  
  // Group by hash
  const hashCounts = new Map<string, number>();
  providerClaims.forEach(claim => {
    const count = hashCounts.get(claim.claim_hash) || 0;
    hashCounts.set(claim.claim_hash, count + 1);
  });
  
  // Find duplicates (hash appears > 1 time)
  const duplicates = Array.from(hashCounts.values()).filter(count => count > 1);
  const duplicateRate = duplicates.length / providerClaims.length;
  
  // Flag if > 1% are duplicates
  if (duplicateRate > 0.01) {
    return {
      metricName: 'Duplicate Claim Rate',
      providerValue: duplicateRate * 100,
      baseline: 0.5, // Expected baseline
      peerPercentile: 99.5,
      sampleN: providerClaims.length,
      tier: 1,
      anomalyTag: 'duplicate_hash_cluster',
    };
  }
  
  return null;
}

// ============================================================================
// ROUND NUMBER DETECTION
// ============================================================================

export function detectRoundNumbers(
  claims: ClaimWithHash[],
  providerId: string,
  threshold: number = 0.5
): AnomalyMetric | null {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  
  if (providerClaims.length < 10) return null; // Minimum sample size
  
  // Count amounts ending in .00
  const roundNumbers = providerClaims.filter(claim => {
    const cents = Math.round((claim.billed_amount % 1) * 100);
    return cents === 0;
  }).length;
  
  const roundNumberRate = roundNumbers / providerClaims.length;
  
  // Flag if > threshold (e.g., 50% are round numbers)
  if (roundNumberRate > threshold) {
    return {
      metricName: 'Round Number Rate',
      providerValue: roundNumberRate * 100,
      baseline: 15, // Expected baseline
      peerPercentile: 95,
      sampleN: providerClaims.length,
      tier: 1,
      anomalyTag: 'round_number_cluster',
    };
  }
  
  return null;
}

// ============================================================================
// HOLIDAY/WEEKEND CONCENTRATION
// ============================================================================

const US_HOLIDAYS = [
  '01-01', // New Year's Day
  '07-04', // Independence Day
  '11-11', // Veterans Day
  '12-25', // Christmas
  // Add more as needed
];

function isHoliday(date: Date): boolean {
  const monthDay = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return US_HOLIDAYS.includes(monthDay);
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

export function detectHolidayWeekendConcentration(
  claims: ClaimWithHash[],
  providerId: string,
  threshold: number = 2.0
): AnomalyMetric | null {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  
  if (providerClaims.length < 20) return null; // Minimum sample size
  
  // Count holiday/weekend claims
  const holidayWeekendClaims = providerClaims.filter(claim => {
    const date = new Date(claim.service_date);
    return isHoliday(date) || isWeekend(date);
  }).length;
  
  const rate = holidayWeekendClaims / providerClaims.length;
  
  // Calculate all providers' rate for baseline
  const allClaims = claims.length;
  const allHolidayWeekend = claims.filter(c => {
    const date = new Date(c.service_date);
    return isHoliday(date) || isWeekend(date);
  }).length;
  
  const baselineRate = allHolidayWeekend / allClaims;
  const relativeRate = rate / baselineRate;
  
  // Flag if > threshold times baseline (e.g., 2x normal)
  if (relativeRate > threshold) {
    return {
      metricName: 'Holiday/Weekend Concentration',
      providerValue: rate * 100,
      baseline: baselineRate * 100,
      peerPercentile: 98,
      sampleN: providerClaims.length,
      tier: 1,
      anomalyTag: 'holiday_weekend_concentration',
    };
  }
  
  return null;
}

// ============================================================================
// TIER 1 AGGREGATOR
// ============================================================================

export function detectTier1Anomalies(
  claims: ClaimWithHash[],
  providerId: string,
  config: { roundNumberThreshold: number; holidayConcentrationThreshold: number }
): AnomalyMetric[] {
  const results: AnomalyMetric[] = [];
  
  const duplicate = detectDuplicates(claims, providerId);
  if (duplicate) results.push(duplicate);
  
  const roundNumber = detectRoundNumbers(claims, providerId, config.roundNumberThreshold);
  if (roundNumber) results.push(roundNumber);
  
  const holiday = detectHolidayWeekendConcentration(claims, providerId, config.holidayConcentrationThreshold);
  if (holiday) results.push(holiday);
  
  return results;
}
