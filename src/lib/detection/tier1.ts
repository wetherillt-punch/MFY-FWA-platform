import { Claim } from '@/types/detection';

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

  // 1. DUPLICATE DETECTION - normalize amounts to avoid .00 vs .0 issues
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

  // 2. ROUND NUMBER CLUSTERING
  const amounts = providerClaims.map(c => parseFloat(c.billed_amount || '0'));
  const roundCount = amounts.filter(a => Math.abs(a % 100) < 0.01).length; // Handle floating point
  const roundPct = (roundCount / amounts.length) * 100;
  
  if (roundPct > 50) {
    score += 80;
    metrics.push({
      metric: 'Round Number Clustering',
      description: `${roundPct.toFixed(0)}% of claims are round-dollar amounts (peer baseline: 12%)`,
      value: `${roundPct.toFixed(0)}%`,
      tier: 1
    });
  }

  // 3. WEEKEND CONCENTRATION
  const weekendCount = providerClaims.filter(c => {
    const date = new Date(c.service_date);
    const day = date.getDay();
    return day === 0 || day === 6;
  }).length;
  const weekendPct = (weekendCount / providerClaims.length) * 100;
  
  if (weekendPct > 35) {
    score += 60;
    metrics.push({
      metric: 'Weekend Concentration',
      description: `${weekendPct.toFixed(0)}% of claims on weekends (peer baseline: 25%)`,
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
      description: `${maxPerDay} claims in single day`,
      value: maxPerDay,
      tier: 1
    });
  }

  return { score: Math.min(score, 100), metrics };
}

function findDuplicates(claims: Claim[]): Claim[] {
  const seen = new Map<string, Claim>();
  const duplicates: Claim[] = [];

  claims.forEach(claim => {
    // Normalize amount to avoid 300.0 vs 300.00 issues
    const normalizedAmount = Math.round(parseFloat(claim.billed_amount || '0') * 100) / 100;
    const key = `${claim.member_id}-${claim.service_date}-${claim.cpt_hcpcs}-${normalizedAmount}`;
    
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
    const date = claim.service_date.split('T')[0];
    byDate.set(date, (byDate.get(date) || 0) + 1);
  });

  return Math.max(...Array.from(byDate.values()), 0);
}

export { detectTier1 as default };
