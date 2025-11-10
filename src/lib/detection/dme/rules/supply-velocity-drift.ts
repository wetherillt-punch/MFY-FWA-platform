import { DMEAnomaly } from '../dme-types';

export function detectSupplyVelocityDrift(claims: any[], providerId: string): DMEAnomaly | null {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  
  // CPAP and Diabetes supply codes
  const supplyCodes = /^A7[0-9]{3}$|^A4253$/;
  const supplyClaims = providerClaims.filter(c => supplyCodes.test(c.cpt_hcpcs));
  
  if (supplyClaims.length < 20) return null;
  
  // Group by 3-month periods
  const periods = new Map<string, { claims: any[], members: Set<string> }>();
  
  supplyClaims.forEach(claim => {
    const date = new Date(claim.service_date);
    const quarter = `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
    
    if (!periods.has(quarter)) {
      periods.set(quarter, { claims: [], members: new Set() });
    }
    periods.get(quarter)!.claims.push(claim);
    periods.get(quarter)!.members.add(claim.member_id);
  });
  
  if (periods.size < 3) return null; // Need at least 3 quarters
  
  // Calculate units per member per period
  const sortedPeriods = Array.from(periods.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, data]) => ({
      period,
      unitsPerMember: data.claims.length / data.members.size
    }));
  
  // Check for 20% increase over 6 months (2 quarters)
  let hasSignificantDrift = false;
  let driftDetails = { from: '', to: '', increase: 0 };
  
  for (let i = 0; i < sortedPeriods.length - 2; i++) {
    const early = sortedPeriods[i].unitsPerMember;
    const late = sortedPeriods[i + 2].unitsPerMember;
    const increase = ((late - early) / early) * 100;
    
    if (increase >= 20) {
      hasSignificantDrift = true;
      driftDetails = {
        from: sortedPeriods[i].period,
        to: sortedPeriods[i + 2].period,
        increase: Math.round(increase)
      };
      break;
    }
  }
  
  if (!hasSignificantDrift) return null;
  
  console.log(`[Velocity-Drift] Provider ${providerId}: ${driftDetails.increase}% increase from ${driftDetails.from} to ${driftDetails.to}`);
  
  const avgAmount = supplyClaims.reduce((sum, c) => sum + parseFloat(c.billed_amount), 0) / supplyClaims.length;
  const exposure = (driftDetails.increase / 100) * avgAmount * supplyClaims.length * 0.3;
  
  return {
    rule_id: 'DME-C-001',
    rule_name: 'Supply Velocity Drift',
    tier: 'C',
    severity: 'low',
    description: `${driftDetails.increase}% increase in supply units/member over 6 months`,
    evidence: {
      affected_members: new Set(supplyClaims.map(c => c.member_id)).size,
      affected_claims: supplyClaims.length,
      total_exposure: Math.round(exposure),
      violation_rate: `+${driftDetails.increase}%`,
      expected_threshold: '<20% increase over 6 months',
      peer_percentile: 85,
      exemplar_claims: supplyClaims.slice(0, 20)
    },
    weight: 0.5
  };
}
