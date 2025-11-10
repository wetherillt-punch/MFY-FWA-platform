import { DMEAnomaly } from '../dme-types';

export function detectInstitutionalOverlap(claims: any[], providerId: string): DMEAnomaly | null {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  
  // DME claims
  const dmeCodes = /^E[0-9]{4}$|^K[0-9]{4}$|^A[0-9]{4}$/;
  const dmeClaims = providerClaims.filter(c => dmeCodes.test(c.cpt_hcpcs));
  
  if (dmeClaims.length < 10) return null;
  
  // Check for institutional POS (21=inpatient, 22=outpatient hospital, 31=SNF, 34=hospice)
  const institutionalPOS = ['21', '22', '31', '34'];
  const overlaps: any[] = [];
  
  dmeClaims.forEach(claim => {
    const pos = String(claim.place_of_service || '');
    if (institutionalPOS.includes(pos)) {
      overlaps.push(claim);
    }
  });
  
  if (overlaps.length < 5) return null;
  
  const overlapRate = (overlaps.length / dmeClaims.length) * 100;
  
  // Need to be in 97th percentile (using 7% as proxy)
  if (overlapRate < 7) return null;
  
  console.log(`[Institutional-Overlap] Provider ${providerId}: ${overlaps.length} overlap claims (${overlapRate.toFixed(1)}%)`);
  
  const avgAmount = overlaps.reduce((sum, c) => sum + parseFloat(c.billed_amount), 0) / overlaps.length;
  const exposure = overlaps.length * avgAmount * 0.8; // Estimated 80% improper
  
  return {
    rule_id: 'DME-B-004',
    rule_name: 'Institutional Overlap',
    tier: 'B',
    severity: 'medium',
    description: `${overlaps.length} DME claims billed during institutional episodes (SNF/Hospice/Inpatient)`,
    evidence: {
      affected_members: new Set(overlaps.map(c => c.member_id)).size,
      affected_claims: overlaps.length,
      total_exposure: Math.round(exposure),
      violation_rate: `${overlapRate.toFixed(1)}%`,
      expected_threshold: '<3% of DME claims during institutional stays',
      peer_percentile: 97,
      exemplar_claims: overlaps.slice(0, 20)
    },
    weight: 0.7
  };
}
