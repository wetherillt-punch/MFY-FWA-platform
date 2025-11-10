import { DMEAnomaly, RefillAnalysis, DME_FAMILIES } from '../dme-types';

export function detectRefillTooSoon(claims: any[], providerId: string): DMEAnomaly | null {
  // Filter CPAP and Diabetes supply claims
  const supplyCodes = DME_FAMILIES
    .filter(f => f.expected_days_supply > 0)
    .flatMap(f => f.codes);
  
  const supplyClaims = claims
    .filter(c => c.provider_id === providerId)
    .filter(c => supplyCodes.includes(c.cpt_hcpcs))
    .sort((a, b) => new Date(a.service_date).getTime() - new Date(b.service_date).getTime());

  if (supplyClaims.length < 10) return null; // Minimum volume

  // Group by member and analyze refill patterns
  const memberRefills = new Map<string, any[]>();
  
  supplyClaims.forEach(claim => {
    if (!memberRefills.has(claim.member_id)) {
      memberRefills.set(claim.member_id, []);
    }
    memberRefills.get(claim.member_id)!.push(claim);
  });

  const analyses: RefillAnalysis[] = [];
  let totalViolations = 0;
  let totalRefills = 0;

  // Analyze each member's refill pattern
  memberRefills.forEach((refills, memberId) => {
    if (refills.length < 2) return; // Need at least 2 refills to check gap

    const memberAnalysis: RefillAnalysis = {
      member_id: memberId,
      refills: []
    };

    for (let i = 1; i < refills.length; i++) {
      const prevDate = new Date(refills[i - 1].service_date);
      const currDate = new Date(refills[i].service_date);
      const daysGap = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      
      const family = DME_FAMILIES.find(f => f.codes.includes(refills[i].cpt_hcpcs));
      const expectedDays = family?.expected_days_supply || 30;
      const minExpectedGap = Math.floor(expectedDays * 0.8); // 80% threshold

      const isViolation = daysGap < minExpectedGap;
      
      memberAnalysis.refills.push({
        service_date: refills[i].service_date,
        cpt_hcpcs: refills[i].cpt_hcpcs,
        days_gap: daysGap,
        expected_days: expectedDays,
        violation: isViolation
      });

      totalRefills++;
      if (isViolation) totalViolations++;
    }

    if (memberAnalysis.refills.some(r => r.violation)) {
      analyses.push(memberAnalysis);
    }
  });

  // Check if violation rate meets threshold
  const violationRate = totalRefills > 0 ? (totalViolations / totalRefills) * 100 : 0;
  const affectedMembers = analyses.length;

  // Trigger criteria: ≥25% of refills are too soon OR ≥8 members affected
  if (violationRate < 25 && affectedMembers < 8) return null;

  // Calculate financial exposure (estimated)
  const avgClaimAmount = supplyClaims.reduce((sum, c) => sum + parseFloat(c.billed_amount), 0) / supplyClaims.length;
  const totalExposure = totalViolations * avgClaimAmount;

  // Get exemplar claims (first 10 violations)
  const exemplarClaims: any[] = [];
  for (const analysis of analyses) {
    for (const refill of analysis.refills) {
      if (refill.violation && exemplarClaims.length < 10) {
        const claim = supplyClaims.find(c => 
          c.member_id === analysis.member_id && 
          c.service_date === refill.service_date
        );
        if (claim) exemplarClaims.push(claim);
      }
    }
  }

  return {
    rule_id: 'DME-A-001',
    rule_name: 'Refill-Too-Soon Pattern',
    tier: 'A',
    severity: 'high',
    description: 'CPAP/Diabetes supplies refilled before 80% of expected timeline',
    evidence: {
      affected_members: affectedMembers,
      affected_claims: totalViolations,
      total_exposure: Math.round(totalExposure),
      violation_rate: `${violationRate.toFixed(1)}%`,
      expected_threshold: '≥25% of refills or ≥8 members',
      exemplar_claims: exemplarClaims
    },
    weight: 0.9
  };
}
