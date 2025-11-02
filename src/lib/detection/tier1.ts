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
  console.log(`[TIER1] Called for ${providerId}, total claims: ${claims.length}`);
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  const metrics: any[] = [];
  let score = 0;

  if (providerClaims.length === 0) {
    return { score: 0, metrics: [] };
  }

  // DUPLICATE DETECTION
  const dupeCheck = new Map();
  const duplicates: Claim[] = [];
  
  providerClaims.forEach(claim => {
    const memberId = (claim.member_id || 'UNKNOWN').trim().toUpperCase();
    const serviceDate = (claim.service_date || '').trim();
    const code = (claim.cpt_hcpcs || '').trim().toUpperCase();
    const amount = Math.round(parseFloat(claim.billed_amount || '0') * 100) / 100;
    
    const key = `${memberId}-${serviceDate}-${code}-${amount}`;
    
    if (dupeCheck.has(key)) {
      duplicates.push(claim);
    } else {
      dupeCheck.set(key, claim);
    }
  });
  
  console.log(`[TIER1] Duplicate check for ${providerId}: found ${duplicates.length} duplicates`);
  
  if (duplicates.length > 0) {
    score += 100;
    metrics.push({
      metric: 'Duplicate Claims',
      description: `${duplicates.length} exact duplicate claims detected`,
      value: duplicates.length,
      tier: 1
    });
  }

  // Round number detection
  const amounts = providerClaims.map(c => parseFloat(c.billed_amount || '0'));
  const roundCount = amounts.filter(a => Math.abs(a % 100) < 0.01).length;
  const roundPct = (roundCount / amounts.length) * 100;
  
  if (roundPct > 50) {
    score += 80;
    metrics.push({
      metric: 'Round Number Clustering',
      description: `${roundPct.toFixed(0)}% round-dollar amounts`,
      value: `${roundPct.toFixed(0)}%`,
      tier: 1
    });
  }

  return { score: Math.min(score, 100), metrics };
}

export { detectTier1 as default };
