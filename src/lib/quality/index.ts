/**
 * Data Quality Validation
 * 
 * Validates claims data before detection runs
 */

import { ClaimData, DataQualityReport } from '@/types';
import { createHash } from 'crypto';

// ============================================================================
// DATA VALIDATION
// ============================================================================

export function validateClaims(claims: ClaimData[]): DataQualityReport {
  const totalRows = claims.length;
  const issues = {
    nullClaimIds: 0,
    nullProviderIds: 0,
    nullServiceDates: 0,
    nullBilledAmounts: 0,
    impossibleDates: 0,
    negativeAmounts: 0,
    zeroAmounts: 0,
    duplicateClaimIds: 0,
  };
  
  const claimIdsSeen = new Set<string>();
  let validRows = 0;
  
  const now = new Date();
  const minDate = new Date('1900-01-01');
  const maxDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  
  claims.forEach(claim => {
    let isValid = true;
    
    // Check nulls
    if (!claim.claim_id || claim.claim_id.trim() === '') {
      issues.nullClaimIds++;
      isValid = false;
    } else {
      // Check duplicates
      if (claimIdsSeen.has(claim.claim_id)) {
        issues.duplicateClaimIds++;
        isValid = false;
      }
      claimIdsSeen.add(claim.claim_id);
    }
    
    if (!claim.provider_id || claim.provider_id.trim() === '') {
      issues.nullProviderIds++;
      isValid = false;
    }
    
    if (!claim.service_date) {
      issues.nullServiceDates++;
      isValid = false;
    } else {
      // Check date validity
      const date = new Date(claim.service_date);
      if (isNaN(date.getTime()) || date < minDate || date > maxDate) {
        issues.impossibleDates++;
        isValid = false;
      }
    }
    
    if (claim.billed_amount === null || claim.billed_amount === undefined) {
      issues.nullBilledAmounts++;
      isValid = false;
    } else {
      if (claim.billed_amount < 0) {
        issues.negativeAmounts++;
        isValid = false;
      }
      if (claim.billed_amount === 0) {
        issues.zeroAmounts++;
        isValid = false;
      }
    }
    
    if (isValid) validRows++;
  });
  
  // Calculate rates
  const nullRate = totalRows > 0 ? 
    (issues.nullClaimIds + issues.nullProviderIds + issues.nullServiceDates + issues.nullBilledAmounts) / (totalRows * 4) 
    : 0;
  
  const duplicateRate = totalRows > 0 ? issues.duplicateClaimIds / totalRows : 0;
  const invalidDateRate = totalRows > 0 ? issues.impossibleDates / totalRows : 0;
  
  // Quality score (0-100)
  const qualityScore = totalRows > 0 ? (validRows / totalRows) * 100 : 0;
  
  // Determine if passed
  const criticalErrors = [
    issues.nullClaimIds > totalRows * 0.01,
    issues.nullProviderIds > totalRows * 0.01,
    issues.impossibleDates > totalRows * 0.01,
    invalidDateRate > 0.01,
  ];
  
  const passed = !criticalErrors.some(e => e) && qualityScore >= 95;
  
  // Generate error and warning messages
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (issues.nullClaimIds > totalRows * 0.01) {
    errors.push(`Too many null claim_ids: ${issues.nullClaimIds} (${(issues.nullClaimIds / totalRows * 100).toFixed(1)}%)`);
  }
  
  if (issues.nullProviderIds > totalRows * 0.01) {
    errors.push(`Too many null provider_ids: ${issues.nullProviderIds} (${(issues.nullProviderIds / totalRows * 100).toFixed(1)}%)`);
  }
  
  if (issues.impossibleDates > totalRows * 0.01) {
    errors.push(`Too many impossible dates: ${issues.impossibleDates} (${(issues.impossibleDates / totalRows * 100).toFixed(1)}%)`);
  }
  
  if (issues.duplicateClaimIds > 0) {
    warnings.push(`Duplicate claim_ids found: ${issues.duplicateClaimIds}`);
  }
  
  if (issues.negativeAmounts > 0) {
    warnings.push(`Negative billed amounts found: ${issues.negativeAmounts}`);
  }
  
  if (issues.zeroAmounts > totalRows * 0.05) {
    warnings.push(`High number of zero amounts: ${issues.zeroAmounts}`);
  }
  
  return {
    totalRows,
    validRows,
    issues,
    rates: {
      nullRate,
      duplicateRate,
      invalidDateRate,
      qualityScore,
    },
    passed,
    errors,
    warnings,
  };
}

// ============================================================================
// DATASET HASH GENERATION
// ============================================================================

export function generateDatasetHash(claims: ClaimData[]): string {
  // Create a fingerprint of the dataset
  const sorted = [...claims].sort((a, b) => {
    if (a.claim_id !== b.claim_id) return a.claim_id.localeCompare(b.claim_id);
    return 0;
  });
  
  const fingerprint = sorted.map(c => 
    `${c.claim_id}|${c.provider_id}|${c.service_date}|${c.billed_amount}`
  ).join('\n');
  
  return createHash('sha256').update(fingerprint).digest('hex');
}

// ============================================================================
// DATA NORMALIZATION
// ============================================================================

export function normalizeClaims(claims: ClaimData[]): ClaimData[] {
  return claims.map(claim => ({
    ...claim,
    claim_id: claim.claim_id.trim(),
    provider_id: claim.provider_id.trim(),
    service_date: typeof claim.service_date === 'string' 
      ? new Date(claim.service_date) 
      : claim.service_date,
  }));
}
