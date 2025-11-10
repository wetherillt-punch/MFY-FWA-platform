import { Claim } from '@/types';

// CCI Edits - Codes that should NOT be billed together (unbundling)
const CCI_EDITS: Record<string, string[]> = {
  // Pain management
  '64483': ['64484'], // Cervical/thoracic injection shouldn't be with lumbar on same day
  '64484': ['64483'],
  
  // E/M with procedures
  '99213': ['99214', '99215'], // Can't bill multiple E/M same day
  '99214': ['99213', '99215'],
  
  // Wound care
  '15275': ['15276'], // Skin graft shouldn't duplicate
  'Q4101': ['Q4110', 'Q4111'], // Skin substitute products
  
  // Surgery codes
  '11042': ['11043', '11044'], // Debridement - only one level per session
  '11043': ['11042', '11044'],
  '11044': ['11042', '11043'],
};

// Modifier-59 bypass rate (when high = likely unbundling fraud)
const MODIFIER_59_THRESHOLD = 0.40; // 40% is suspicious, 60%+ is critical

export interface CCIViolation {
  primaryCode: string;
  conflictCode: string;
  date: string;
  hasModifier59: boolean;
  severity: 'critical' | 'high' | 'medium';
}

export function checkCCIEdits(claims: Claim[], providerId: string): {
  violations: CCIViolation[];
  modifier59Abuse: boolean;
  modifier59Rate: number;
} {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  const violations: CCIViolation[] = [];
  
  // Group by date
  const byDate = new Map<string, Claim[]>();
  providerClaims.forEach(claim => {
    const date = claim.service_date.toISOString().split('T')[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(claim);
  });

  // Check each day for CCI violations
  byDate.forEach((dayClaims, date) => {
    const codes = dayClaims.map(c => c.cpt_hcpcs);
    const modifiers = dayClaims.map(c => c.modifiers || '');
    
    codes.forEach((code, i) => {
      if (code && CCI_EDITS[code]) {
        codes.forEach((otherCode, j) => {
          if (i !== j && otherCode && CCI_EDITS[code].includes(otherCode)) {
            const hasModifier59 = modifiers[i].includes('59') || modifiers[j].includes('59');
            violations.push({
              primaryCode: code,
              conflictCode: otherCode,
              date,
              hasModifier59,
              severity: hasModifier59 ? 'high' : 'critical'
            });
          }
        });
      }
    });
  });

  // Check modifier-59 abuse rate
  const modifier59Count = providerClaims.filter(c => 
    c.modifiers?.includes('59')
  ).length;
  const modifier59Rate = modifier59Count / providerClaims.length;

  return {
    violations,
    modifier59Abuse: modifier59Rate > MODIFIER_59_THRESHOLD,
    modifier59Rate
  };
}
