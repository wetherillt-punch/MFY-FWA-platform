import { DMEAnomaly } from '../dme-types';

export function detectRentalCapExceeded(claims: any[], providerId: string): DMEAnomaly | null {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  
  // Rental equipment codes: E0601 (CPAP), E1390 (Oxygen), K0001+ (Wheelchairs)
  const rentalCodes = /^E0601$|^E1390$|^K000[1-9]$|^K001[0-9]$/;
  const rentalClaims = providerClaims.filter(c => c.cpt_hcpcs && rentalCodes.test(c.cpt_hcpcs));
  
  if (rentalClaims.length < 10) return null;
  
  // Group by member and code to track rental periods
  const memberRentals = new Map<string, Map<string, any[]>>();
  
  rentalClaims.forEach(claim => {
    const key = claim.member_id;
    if (!memberRentals.has(key)) {
      memberRentals.set(key, new Map());
    }
    const codeMap = memberRentals.get(key)!;
    if (!codeMap.has(claim.cpt_hcpcs)) {
      codeMap.set(claim.cpt_hcpcs, []);
    }
    codeMap.get(claim.cpt_hcpcs)!.push(claim);
  });
  
  let violations = 0;
  const violatingMembers: string[] = [];
  const exemplarClaims: any[] = [];
  
  // Check each member's rental history
  memberRentals.forEach((codeMap, memberId) => {
    codeMap.forEach((memberClaims, code) => {
      // Check for RR (rental) modifier
      const rrClaims = memberClaims.filter(c => 
        String(c.modifiers || '').toUpperCase().includes('RR')
      ).sort((a, b) => 
        new Date(a.service_date).getTime() - new Date(b.service_date).getTime()
      );
      
      if (rrClaims.length >= 13) {
        // Check if there's a NU (purchase) conversion
        const lastRR = new Date(rrClaims[rrClaims.length - 1].service_date);
        const nuClaims = memberClaims.filter(c => 
          String(c.modifiers || '').toUpperCase().includes('NU')
        );
        
        // Violation: >13 RR without NU conversion
        if (nuClaims.length === 0) {
          violations++;
          violatingMembers.push(memberId);
          exemplarClaims.push(...rrClaims.slice(-5)); // Last 5 RR claims
        }
        
        // Also check for RR restart within 60 days after cap
        if (nuClaims.length > 0) {
          const firstNU = new Date(nuClaims[0].service_date);
          const daysBetween = Math.floor((firstNU.getTime() - lastRR.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysBetween < 60 && rrClaims.length > 13) {
            violations++;
            violatingMembers.push(memberId);
            exemplarClaims.push(...rrClaims.slice(-3));
            exemplarClaims.push(nuClaims[0]);
          }
        }
      }
    });
  });
  
  if (violations === 0) return null;
  
  console.log(`[Rental-Cap] Provider ${providerId}: ${violations} violations, ${violatingMembers.length} members`);
  
  const avgAmount = rentalClaims.reduce((sum, c) => sum + c.billed_amount, 0) / rentalClaims.length;
  const exposure = violations * avgAmount * 3; // Estimated 3 months over cap
  
  return {
    rule_id: 'DME-A-002',
    rule_name: 'Rental Cap Exceeded',
    tier: 'A',
    severity: 'high',
    description: `${violations} instances of rental equipment exceeding 13-month cap without conversion`,
    evidence: {
      affected_members: violatingMembers.length,
      affected_claims: violations,
      total_exposure: Math.round(exposure),
      violation_rate: `${violations} cap violations`,
      expected_threshold: '13 months max, then must convert to purchase (NU)',
      peer_percentile: 99,
      exemplar_claims: exemplarClaims.slice(0, 20)
    },
    weight: 0.9
  };
}
