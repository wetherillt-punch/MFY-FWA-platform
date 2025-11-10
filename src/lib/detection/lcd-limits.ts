import { Claim } from '@/types';

// LCD Frequency Limits - Maximum allowed frequency for procedures
interface LCDLimit {
  code: string;
  maxPerPeriod: number;
  periodDays: number;
  description: string;
  requiresDistinctSite?: boolean;
}

const LCD_LIMITS: LCDLimit[] = [
  // Wound care
  {
    code: '15275',
    maxPerPeriod: 3,
    periodDays: 7,
    description: 'Skin application - max 3x/week',
    requiresDistinctSite: true
  },
  {
    code: 'Q4101',
    maxPerPeriod: 1,
    periodDays: 14,
    description: 'Apligraf - every 14 days minimum',
  },
  {
    code: 'Q4110',
    maxPerPeriod: 1,
    periodDays: 14,
    description: 'PriMatrix - every 14 days minimum',
  },
  
  // Pain management
  {
    code: '64483',
    maxPerPeriod: 3,
    periodDays: 180,
    description: 'Cervical/thoracic injection - max 3 per 6 months',
  },
  {
    code: '64484',
    maxPerPeriod: 3,
    periodDays: 180,
    description: 'Lumbar injection - max 3 per 6 months',
  },
  
  // Telehealth
  {
    code: '99443',
    maxPerPeriod: 2,
    periodDays: 7,
    description: 'Telephone E/M - max 2x/week',
  },
  {
    code: '99444',
    maxPerPeriod: 2,
    periodDays: 7,
    description: 'Online E/M - max 2x/week',
  },
  
  // Preventive
  {
    code: 'G0438',
    maxPerPeriod: 1,
    periodDays: 365,
    description: 'Annual wellness visit - once per year',
  },
  {
    code: 'G0439',
    maxPerPeriod: 1,
    periodDays: 365,
    description: 'Subsequent annual wellness - once per year',
  },
];

export interface LCDViolation {
  code: string;
  description: string;
  frequency: number;
  maxAllowed: number;
  periodDays: number;
  dates: string[];
  severity: 'critical' | 'high';
}

export function checkLCDLimits(claims: Claim[], providerId: string): {
  violations: LCDViolation[];
  totalViolations: number;
} {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  const violations: LCDViolation[] = [];

  LCD_LIMITS.forEach(limit => {
    const codeClaims = providerClaims
      .filter(c => c.cpt_hcpcs === limit.code)
      .sort((a, b) => new Date(a.service_date).getTime() - new Date(b.service_date).getTime());

    if (codeClaims.length === 0) return;

    // Check rolling windows
    for (let i = 0; i < codeClaims.length; i++) {
      const startDate = new Date(codeClaims[i].service_date);
      const endDate = new Date(startDate.getTime() + limit.periodDays * 24 * 60 * 60 * 1000);
      
      const claimsInWindow = codeClaims.filter(c => {
        const claimDate = new Date(c.service_date);
        return claimDate >= startDate && claimDate <= endDate;
      });

      if (claimsInWindow.length > limit.maxPerPeriod) {
        violations.push({
          code: limit.code,
          description: limit.description,
          frequency: claimsInWindow.length,
          maxAllowed: limit.maxPerPeriod,
          periodDays: limit.periodDays,
          dates: claimsInWindow.map(c => c.service_date.toISOString().split('T')[0]),
          severity: claimsInWindow.length > limit.maxPerPeriod * 2 ? 'critical' : 'high'
        });
        break; // Found violation for this code
      }
    }
  });

  return {
    violations,
    totalViolations: violations.length
  };
}

// Check for medically impossible patterns (daily wound care, etc.)
export function checkMedicalNecessity(claims: Claim[], providerId: string): {
  impossiblePatterns: Array<{
    pattern: string;
    description: string;
    count: number;
    severity: 'critical';
  }>;
} {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  const impossiblePatterns: any[] = [];

  // Check for daily wound care (medically impossible - needs 21+ day healing)
  const woundCareCodes = ['15275', '15276', 'Q4101', 'Q4110', '11042', '11043', '11044'];
  const woundClaims = providerClaims.filter(c => c.cpt_hcpcs && woundCareCodes.includes(c.cpt_hcpcs));
  
  if (woundClaims.length > 0) {
    // Check for consecutive days
    const dates = woundClaims.map(c => new Date(c.service_date).getTime()).sort();
    let consecutiveDays = 1;
    let maxConsecutive = 1;
    
    for (let i = 1; i < dates.length; i++) {
      const daysDiff = (dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24);
      if (daysDiff === 1) {
        consecutiveDays++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveDays);
      } else {
        consecutiveDays = 1;
      }
    }

    if (maxConsecutive >= 5) {
      impossiblePatterns.push({
        pattern: 'Daily Wound Care',
        description: `${maxConsecutive} consecutive days of wound care billing (medically impossible - wounds require 21+ days healing)`,
        count: maxConsecutive,
        severity: 'critical' as const
      });
    }
  }

  // Check for >24 hours of time-based codes in single day
  const timeBasedCodes = ['99354', '99355', '99356', '99357']; // Prolonged service codes
  const byDate = new Map<string, Claim[]>();
  
  providerClaims.forEach(claim => {
    if (claim.cpt_hcpcs && timeBasedCodes.includes(claim.cpt_hcpcs)) {
      const date = claim.service_date.toISOString().split('T')[0];
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date)!.push(claim);
    }
  });

  byDate.forEach((dayClaims, date) => {
    // Each code = 30+ minutes
    const totalMinutes = dayClaims.length * 30;
    if (totalMinutes > 1440) { // >24 hours
      impossiblePatterns.push({
        pattern: 'Impossible Time',
        description: `${totalMinutes} minutes billed on ${date} (>24 hours in one day)`,
        count: dayClaims.length,
        severity: 'critical' as const
      });
    }
  });

  return { impossiblePatterns };
}
