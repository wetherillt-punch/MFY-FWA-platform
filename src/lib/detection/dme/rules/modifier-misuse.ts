import { DMEAnomaly } from '../dme-types';

export function detectModifierMisuse(claims: any[], providerId: string): DMEAnomaly | null {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  console.log(`[Modifier-Misuse] Provider ${providerId}: ${providerClaims.length} claims`);
  
  if (providerClaims.length < 30) {
    console.log(`[Modifier-Misuse] Provider ${providerId}: Below volume floor (${providerClaims.length} < 30)`);
    return null;
  }
  
  // Count KX and NU modifier usage
  let kxCount = 0;
  let nuCount = 0;
  let totalDME = 0;
  
  providerClaims.forEach(claim => {
    const isDME = /^E[0-9]{4}$|^K[0-9]{4}$|^A7[0-9]{3}$/.test(claim.cpt_hcpcs);
    if (!isDME) return;
    
    totalDME++;
    
    const mods = String(claim.modifiers || '').toUpperCase();
    if (mods.includes('KX')) kxCount++;
    if (mods.includes('NU')) nuCount++;
  });
  
  if (totalDME === 0) return null;
  
  const kxRate = (kxCount / totalDME) * 100;
  const nuRate = (nuCount / totalDME) * 100;
  
  console.log(`[Modifier-Misuse] Provider ${providerId}: KX=${kxRate.toFixed(1)}%, NU=${nuRate.toFixed(1)}%, DME claims=${totalDME}`);
  
  // Trigger: KX ≥30% OR NU ≥30%
  if (kxRate < 30 && nuRate < 30) {
    console.log(`[Modifier-Misuse] Provider ${providerId}: Below threshold`);
    return null;
  }
  
  const violationType = kxRate >= 30 ? 'KX' : 'NU';
  const rate = kxRate >= 30 ? kxRate : nuRate;
  
  console.log(`[Modifier-Misuse] Provider ${providerId}: TRIGGERED! ${violationType} rate exceeded`);
  
  // Get exemplar claims with the modifier
  const exemplarClaims = providerClaims
    .filter(c => String(c.modifiers || '').toUpperCase().includes(violationType))
    .slice(0, 20);
  
  const avgAmount = providerClaims.reduce((sum, c) => sum + c.billed_amount, 0) / providerClaims.length;
  const exposure = (violationType === 'KX' ? kxCount : nuCount) * avgAmount * 0.3;
  
  return {
    rule_id: 'DME-B-001',
    rule_name: 'Modifier Misuse Pattern',
    tier: 'B',
    severity: 'medium',
    description: `Excessive ${violationType} modifier use (${rate.toFixed(1)}% of DME claims)`,
    evidence: {
      affected_members: new Set(exemplarClaims.map(c => c.member_id)).size,
      affected_claims: violationType === 'KX' ? kxCount : nuCount,
      total_exposure: Math.round(exposure),
      violation_rate: `${rate.toFixed(1)}%`,
      expected_threshold: 'Typical usage <10%, flagging >30%',
      peer_percentile: 97,
      exemplar_claims: exemplarClaims
    },
    weight: 0.7
  };
}
