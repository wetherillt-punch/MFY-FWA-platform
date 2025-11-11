import { DMEAnomaly } from '../dme-types';

export function detectCodeMixShift(claims: any[], providerId: string): DMEAnomaly | null {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  
  // Brace/Orthotic codes (L-codes)
  const braceCodes = /^L0650$|^L1902$|^L4361$/;
  const braceClaims = providerClaims.filter(c => braceCodes.test(c.cpt_hcpcs));
  
  if (braceClaims.length < 20) return null;
  
  // Define higher vs lower allowance codes (simplified)
  const higherAllowance = ['L1902', 'L4361']; // Example high-cost codes
  const lowerAllowance = ['L0650']; // Example low-cost code
  
  // Split into early and late periods
  const sortedClaims = braceClaims.sort((a, b) => 
    new Date(a.service_date).getTime() - new Date(b.service_date).getTime()
  );
  
  const midpoint = Math.floor(sortedClaims.length / 2);
  const earlyClaims = sortedClaims.slice(0, midpoint);
  const lateClaims = sortedClaims.slice(midpoint);
  
  // Calculate high-allowance percentage in each period
  const earlyHighPct = (earlyClaims.filter(c => 
    higherAllowance.includes(c.cpt_hcpcs)
  ).length / earlyClaims.length) * 100;
  
  const lateHighPct = (lateClaims.filter(c => 
    higherAllowance.includes(c.cpt_hcpcs)
  ).length / lateClaims.length) * 100;
  
  const shift = lateHighPct - earlyHighPct;
  
  // Trigger: ≥15 percentage point increase
  if (shift < 15) return null;
  
  console.log(`[Code-Mix-Shift] Provider ${providerId}: ${shift.toFixed(1)}pp shift to higher-cost codes`);
  
  const highCostClaims = lateClaims.filter(c => higherAllowance.includes(c.cpt_hcpcs));
  const avgAmount = highCostClaims.reduce((sum, c) => sum + c.billed_amount, 0) / highCostClaims.length;
  const exposure = shift * avgAmount * 0.15;
  
  return {
    rule_id: 'DME-C-002',
    rule_name: 'Code-Mix Shift',
    tier: 'C',
    severity: 'low',
    description: `${shift.toFixed(1)}pp shift toward higher-allowance orthotic codes`,
    evidence: {
      affected_members: new Set(braceClaims.map(c => c.member_id)).size,
      affected_claims: highCostClaims.length,
      total_exposure: Math.round(exposure),
      violation_rate: `+${shift.toFixed(1)}pp`,
      expected_threshold: '<15pp shift without severity change',
      peer_percentile: 90,
      exemplar_claims: highCostClaims.slice(0, 20)
    },
    weight: 0.4
  };
}
