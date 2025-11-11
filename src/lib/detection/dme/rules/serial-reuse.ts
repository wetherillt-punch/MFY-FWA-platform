import { DMEAnomaly } from '../dme-types';

export function detectSerialReuse(claims: any[], providerId: string): DMEAnomaly | null {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  
  // DME equipment with serial numbers
  const equipmentCodes = /^K000[1-9]$|^K001[0-9]$|^E0260$|^E0261$|^E1390$|^E0601$/;
  const equipmentClaims = providerClaims.filter(c => 
    equipmentCodes.test(c.cpt_hcpcs) && c.serial_number
  );
  
  if (equipmentClaims.length < 5) return null;
  
  // Group by serial number
  const serialMap = new Map<string, any[]>();
  equipmentClaims.forEach(claim => {
    const serial = String(claim.serial_number).trim();
    if (!serial || serial === '' || serial === 'null') return;
    
    if (!serialMap.has(serial)) {
      serialMap.set(serial, []);
    }
    serialMap.get(serial)!.push(claim);
  });
  
  const violations: any[] = [];
  const violatingSerials: string[] = [];
  
  // Check each serial number
  serialMap.forEach((claims, serial) => {
    if (claims.length < 2) return;
    
    // Get unique members
    const members = [...new Set(claims.map(c => c.member_id))];
    
    if (members.length >= 2) {
      // Serial used for multiple members
      const sortedClaims = claims.sort((a, b) => 
        new Date(a.service_date).getTime() - new Date(b.service_date).getTime()
      );
      
      // Check time between uses
      for (let i = 1; i < sortedClaims.length; i++) {
        const prev = new Date(sortedClaims[i - 1].service_date);
        const curr = new Date(sortedClaims[i].service_date);
        const daysBetween = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        
        // Reuse within 60 days across different members
        if (daysBetween <= 60 && sortedClaims[i].member_id !== sortedClaims[i - 1].member_id) {
          violations.push({
            serial,
            days: daysBetween,
            members: [sortedClaims[i - 1].member_id, sortedClaims[i].member_id],
            claims: [sortedClaims[i - 1], sortedClaims[i]]
          });
          violatingSerials.push(serial);
        }
      }
    }
  });
  
  if (violations.length === 0) return null;
  
  console.log(`[Serial-Reuse] Provider ${providerId}: ${violations.length} violations, ${violatingSerials.length} serials`);
  
  const exemplarClaims = violations.flatMap(v => v.claims).slice(0, 20);
  const avgAmount = exemplarClaims.reduce((sum, c) => sum + c.billed_amount, 0) / exemplarClaims.length;
  const exposure = violations.length * avgAmount;
  
  return {
    rule_id: 'DME-A-003',
    rule_name: 'Serial Number Reuse',
    tier: 'A',
    severity: 'high',
    description: `${violations.length} instances of same serial number used for multiple members within 60 days`,
    evidence: {
      affected_members: [...new Set(violations.flatMap(v => v.members))].length,
      affected_claims: violations.length,
      total_exposure: Math.round(exposure),
      violation_rate: `${violatingSerials.length} reused serial numbers`,
      expected_threshold: 'Serial numbers should be unique per member',
      peer_percentile: 99,
      exemplar_claims: exemplarClaims
    },
    weight: 0.9
  };
}
