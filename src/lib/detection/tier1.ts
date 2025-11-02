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

  // 1. DUPLICATE DETECTION (exact matches)
  const duplicates = findDuplicates(providerClaims);
  if (duplicates.length > 0) {
    score += 100;
    metrics.push({
      metric: 'Duplicate Claims',
      description: `${duplicates.length} exact duplicate claims detected (same member, date, code, amount)`,
      value: duplicates.length,
      tier: 1
    });
  }

  // 2. ROUND NUMBER CLUSTERING (>50%)
  const amounts = providerClaims.map(c => parseFloat(c.billed_amount || '0'));
  const roundCount = amounts.filter(a => a % 100 === 0).length;
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

  // 3. WEEKEND/HOLIDAY CONCENTRATION
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
      description: `${maxPerDay} claims in single day (physically impossible for most providers)`,
      value: maxPerDay,
      tier: 1
    });
  }

  return {
    score: Math.min(score, 100),
    metrics
  };
}

function findDuplicates(claims: Claim[]): Claim[] {
  const seen = new Map<string, Claim>();
  const duplicates: Claim[] = [];

  claims.forEach(claim => {
    const key = `${claim.member_id}-${claim.service_date}-${claim.cpt_hcpcs}-${claim.billed_amount}`;
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
