import { Claim } from '@/types/detection';
import { normalizeDateToYYYYMMDD, normalizeAmount } from './date-utils';

export interface Tier1Result {
  score: number;
  metrics: Array<{
    metric: string;
    description: string;
    value: any;
    tier: number;
  }>;
}

export function detectTier1(claims: Claim[], providerId: string): Tier1Result {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  const metrics: any[] = [];
  let score = 0;

  if (providerClaims.length === 0) {
    return { score: 0, metrics: [] };
  }

  // 1. DUPLICATE DETECTION - with robust date/amount handling
  const duplicates = findDuplicates(providerClaims);
  
  if (duplicates.length > 0) {
    score += 100;
    metrics.push({
      metric: 'Duplicate Claims',
      description: `${duplicates.length} exact duplicate claims detected`,
      value: duplicates.length,
      tier: 1
    });
  }

  // 2. ROUND NUMBERS
  const amounts = providerClaims.map(c => normalizeAmount(c.billed_amount));
  const roundCount = amounts.filter(a => Math.abs(a % 100) < 0.01).length;
  const roundPct = (roundCount / amounts.length) * 100;
  
  if (roundPct > 50) {
    score += 80;
    metrics.push({
      metric: 'Round Number Clustering',
      description: `${roundPct.toFixed(0)}% round-dollar amounts (peer: 12%)`,
      value: `${roundPct.toFixed(0)}%`,
      tier: 1
    });
  }

  // 3. WEEKEND CONCENTRATION
  const weekendCount = providerClaims.filter(c => {
    const dateStr = normalizeDateToYYYYMMDD(c.service_date);
    const date = new Date(dateStr + 'T12:00:00'); // Add time to avoid timezone issues
    const day = date.getDay();
    return day === 0 || day === 6;
  }).length;
  const weekendPct = (weekendCount / providerClaims.length) * 100;
  
  if (weekendPct > 35) {
    score += 60;
    metrics.push({
      metric: 'Weekend Concentration',
      description: `${weekendPct.toFixed(0)}% weekend claims (peer: 25%)`,
      value: `${weekendPct.toFixed(0)}%`,
      tier: 1
    });
  }

  // 4. IMPOSSIBLE VOLUME
  const maxPerDay = getMaxClaimsPerDay(providerClaims);
  if (maxPerDay > 50) {
    score += 90;
    metrics.push({
      metric: 'Impossible Daily Volume',
      description: `${maxPerDay} claims in one day`,
      value: maxPerDay,
      tier: 1
    });
  }

  return { score: Math.min(score, 100), metrics };
}

function findDuplicates(claims: Claim[]): Claim[] {
  const seen = new Map<string, Claim>();
  const duplicates: Claim[] = [];

  claims.forEach((claim) => {
    // Use robust normalizers
    const normalizedDate = normalizeDateToYYYYMMDD(claim.service_date);
    const normalizedAmount = normalizeAmount(claim.billed_amount);
    
    // Create key
    const key = `${claim.member_id || 'UNKNOWN'}-${normalizedDate}-${claim.cpt_hcpcs}-${normalizedAmount}`;
    
    if (seen.has(key)) {
      duplicates.push(claim);
    } else {
      seen.set(key, claim);
    }
  });

  return duplicates;
}

function getMaxClaimsPerDay(claims: Claim[]): number {
  const byDate = new Map<string, number>();
  
  claims.forEach(claim => {
    const date = normalizeDateToYYYYMMDD(claim.service_date);
    byDate.set(date, (byDate.get(date) || 0) + 1);
  });

  return Math.max(...Array.from(byDate.values()), 0);
}

export { detectTier1 as default };
