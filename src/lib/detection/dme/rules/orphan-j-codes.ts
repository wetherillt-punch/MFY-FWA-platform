import { DMEAnomaly } from '../dme-types';

export function detectOrphanJCodes(claims: any[], providerId: string): DMEAnomaly | null {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  
  // Infusion drug codes
  const jCodes = /^J1745$|^J1569$/;
  const jCodeClaims = providerClaims.filter(c => jCodes.test(c.cpt_hcpcs));
  
  if (jCodeClaims.length < 5) return null;
  
  // Administration codes
  const adminCodes = /^96365$|^96366$/;
  const adminClaims = providerClaims.filter(c => adminCodes.test(c.cpt_hcpcs));
  
  const orphans: any[] = [];
  
  // Check each J-code claim for matching admin code
  jCodeClaims.forEach(jClaim => {
    const jDate = new Date(jClaim.service_date);
    
    // Look for admin code within ±7 days for same member
    const hasAdmin = adminClaims.some(aClaim => {
      if (aClaim.member_id !== jClaim.member_id) return false;
      
      const aDate = new Date(aClaim.service_date);
      const daysDiff = Math.abs((aDate.getTime() - jDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff <= 7;
    });
    
    if (!hasAdmin) {
      orphans.push(jClaim);
    }
  });
  
  if (orphans.length < 15) return null; // Threshold: ≥15 orphan drugs (reduced noise)
  
  console.log(`[Orphan-JCodes] Provider ${providerId}: ${orphans.length} orphan drug claims`);
  
  const avgAmount = orphans.reduce((sum, c) => sum + c.billed_amount, 0) / orphans.length;
  const exposure = orphans.length * avgAmount * 0.5; // Estimated 50% improper
  
  return {
    rule_id: 'DME-B-002',
    rule_name: 'Orphan J-Codes (Infusion Drugs)',
    tier: 'B',
    severity: 'medium',
    description: `${orphans.length} infusion drug claims without matching administration codes`,
    evidence: {
      affected_members: new Set(orphans.map(c => c.member_id)).size,
      affected_claims: orphans.length,
      total_exposure: Math.round(exposure),
      violation_rate: `${orphans.length} orphan J-codes`,
      expected_threshold: 'J-codes should have matching 96365/96366 within ±7 days',
      peer_percentile: 95,
      exemplar_claims: orphans.slice(0, 20)
    },
    weight: 0.7
  };
}
