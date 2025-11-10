import { Claim } from '@/types';

export interface ProviderWithClaims {
  providerId: string;
  claims: Claim[];
}

/**
 * Filter out providers with insufficient claims for reliable detection
 * 
 * @param providers - Array of providers with their claims
 * @param minClaims - Minimum number of claims required (default: 30)
 * @returns Filtered array of providers
 */
export function filterLowVolumeProviders(
  providers: ProviderWithClaims[],
  minClaims: number = 30
): ProviderWithClaims[] {
  const filtered = providers.filter(p => p.claims.length >= minClaims);
  
  const removed = providers.length - filtered.length;
  
  console.log(`[Filter] Low-Volume Provider Filter:`);
  console.log(`  - Total providers: ${providers.length}`);
  console.log(`  - Removed: ${removed} providers with <${minClaims} claims`);
  console.log(`  - Analyzing: ${filtered.length} providers`);
  
  return filtered;
}

/**
 * Suppress providers flagged only for Tier 4 (watchlist) patterns
 * These are considered too weak to be actionable on their own
 * 
 * @param leads - Array of detection leads
 * @returns Filtered leads without Tier 4-only cases
 */
export function suppressTier4OnlyLeads(leads: any[]): any[] {
  const filtered = leads.filter(lead => {
    const t1 = lead.tierScores?.T1 || 0;
    const t2 = lead.tierScores?.T2 || 0;
    const t3 = lead.tierScores?.T3 || 0;
    const t4 = lead.tierScores?.T4 || 0;
    
    // Has any tier higher than T4?
    const hasHigherTier = t1 > 0 || t2 > 0 || t3 > 0;
    
    // If ONLY T4 violations, suppress
    if (!hasHigherTier && t4 > 0) {
      console.log(`[Filter] Suppressed T4-only: ${lead.providerId} (T4:${t4})`);
      return false;
    }
    
    return true;
  });
  
  const suppressed = leads.length - filtered.length;
  
  console.log(`[Filter] Tier 4-Only Suppression:`);
  console.log(`  - Before: ${leads.length} leads`);
  console.log(`  - Suppressed: ${suppressed} T4-only cases`);
  console.log(`  - After: ${filtered.length} actionable leads`);
  
  return filtered;
}

/**
 * Apply minimum score threshold
 * Don't flag providers below the minimum actionable score
 * 
 * @param leads - Array of detection leads
 * @param minScore - Minimum overall score (default: 40)
 * @returns Filtered leads meeting minimum score
 */
export function applyMinimumScore(leads: any[], minScore: number = 40): any[] {
  const filtered = leads.filter(lead => lead.overallScore >= minScore);
  
  const removed = leads.length - filtered.length;
  
  if (removed > 0) {
    console.log(`[Filter] Minimum Score Filter:`);
    console.log(`  - Removed: ${removed} leads with score <${minScore}`);
  }
  
  return filtered;
}

/**
 * Comprehensive filtering pipeline
 * Applies all filters in sequence
 * 
 * @param providers - Array of providers with claims
 * @param leads - Array of detection leads
 * @param config - Detection configuration
 * @returns Filtered and validated leads
 */
export function applyAllFilters(
  providers: ProviderWithClaims[],
  leads: any[],
  config: {
    minClaimsForDetection?: number;
    suppressTier4Only?: boolean;
    minScore?: number;
  }
): any[] {
  console.log(`\n[Filtering Pipeline] Starting...`);
  console.log(`  Initial: ${leads.length} leads from ${providers.length} providers\n`);
  
  // Step 1: Apply minimum score
  let filtered = applyMinimumScore(leads, config.minScore);
  
  // Step 2: Suppress T4-only if enabled
  if (config.suppressTier4Only) {
    filtered = suppressTier4OnlyLeads(filtered);
  }
  
  console.log(`\n[Filtering Pipeline] Complete`);
  console.log(`  Final: ${filtered.length} actionable leads\n`);
  
  return filtered;
}
