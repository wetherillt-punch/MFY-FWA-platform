import { Claim } from '@/types/detection';

export interface AdvancedPatternsResult {
  score: number;
  patterns: Array<{
    pattern: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    evidence: any;
    weight: number;
  }>;
}

export function detectAdvancedPatterns(
  claims: Claim[],
  providerId: string
): AdvancedPatternsResult {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  const patterns: any[] = [];
  let score = 0;

  if (providerClaims.length === 0) {
    return { score: 0, patterns: [] };
  }

  // PHASE 1: Upcoding Detection
  const upcodingResult = detectUpcoding(providerClaims);
  if (upcodingResult) {
    patterns.push(upcodingResult);
    score += upcodingResult.weight * 100;
  }

  // PHASE 1: Modifier 59 Abuse
  const modifier59Result = detectModifier59Abuse(providerClaims);
  if (modifier59Result) {
    patterns.push(modifier59Result);
    score += modifier59Result.weight * 100;
  }

  // PHASE 1: Time-Based Impossibilities
  const timeImpossibleResult = detectTimeImpossibilities(providerClaims);
  if (timeImpossibleResult) {
    patterns.push(timeImpossibleResult);
    score += timeImpossibleResult.weight * 100;
  }

  // PHASE 2: Unbundling Detection
  const unbundlingResult = detectUnbundling(providerClaims);
  if (unbundlingResult) {
    patterns.push(unbundlingResult);
    score += unbundlingResult.weight * 100;
  }

  // PHASE 2: Temporal Patterns (End-of-Month Spikes)
  const temporalResult = detectTemporalSpikes(providerClaims);
  if (temporalResult) {
    patterns.push(temporalResult);
    score += temporalResult.weight * 100;
  }

  //   }

  return { score: Math.min(score, 100), patterns };
}

// PHASE 1.1: Upcoding Detection (E&M Level Distribution)
function detectUpcoding(claims: Claim[]) {
  // E&M codes: 99211-99215 (office visits)
  const emCodes = claims.filter(c => /^9921[1-5]$/.test(c.cpt_hcpcs));
  
  if (emCodes.length < 10) return null; // Need sample size

  const level4_5 = emCodes.filter(c => /^9921[45]$/.test(c.cpt_hcpcs)).length;
  const highLevelPct = (level4_5 / emCodes.length) * 100;

  // Flag if >75% are level 4/5 (normal is ~40-50%)
  if (highLevelPct > 75) {
    return {
      pattern: 'Upcoding - E&M Distribution',
      description: `${highLevelPct.toFixed(0)}% of E&M visits are level 4/5 (expected ~40-50%)`,
      severity: 'high' as const,
      evidence: {
        total_em: emCodes.length,
        high_level_count: level4_5,
        high_level_pct: `${highLevelPct.toFixed(0)}%`,
        expected: '40-50%'
      },
      weight: 0.8
    };
  }
  return null;
}

// PHASE 1.2: Modifier 59 Abuse Detection
function detectModifier59Abuse(claims: Claim[]) {
  const withModifiers = claims.filter(c => c.modifiers && c.modifiers.trim().length > 0);
  
  if (withModifiers.length < 10) return null;

  const mod59Count = withModifiers.filter(c => 
    /59|XE|XS|XP|XU/.test(c.modifiers || '')
  ).length;
  
  const mod59Pct = (mod59Count / withModifiers.length) * 100;

  // Flag if >40% of modified claims use 59/X modifiers (normal <20%)
  if (mod59Pct > 40) {
    return {
      pattern: 'Modifier 59 Overuse',
      description: `${mod59Pct.toFixed(0)}% of claims use modifier 59/X-modifiers (expected <20%)`,
      severity: 'high' as const,
      evidence: {
        total_modified: withModifiers.length,
        mod59_count: mod59Count,
        mod59_pct: `${mod59Pct.toFixed(0)}%`,
        expected: '<20%'
      },
      weight: 0.7
    };
  }
  return null;
}

// PHASE 1.3: Time-Based Impossibilities
function detectTimeImpossibilities(claims: Claim[]) {
  // Group claims by date
  const byDate = new Map<string, Claim[]>();
  claims.forEach(claim => {
    const date = claim.service_date;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(claim);
  });

  // Define procedure time estimates (minutes)
  const procedureTimes: Record<string, number> = {
    '45378': 45, // Colonoscopy
    '45380': 60, // Colonoscopy with biopsy
    '43239': 30, // Upper endoscopy
    '64483': 30, // Nerve injection
    '64484': 30, // Nerve injection
    '15275': 45, // Skin graft
    '99213': 15, // Office visit level 3
    '99214': 25, // Office visit level 4
    '99215': 40, // Office visit level 5
  };

  let maxDailyMinutes = 0;
  let impossibleDate = '';
  let impossibleCount = 0;

  byDate.forEach((dayClaims, date) => {
    const totalMinutes = dayClaims.reduce((sum, claim) => {
      return sum + (procedureTimes[claim.cpt_hcpcs] || 10);
    }, 0);

    if (totalMinutes > maxDailyMinutes) {
      maxDailyMinutes = totalMinutes;
      impossibleDate = date;
      impossibleCount = dayClaims.length;
    }
  });

  const maxDailyHours = maxDailyMinutes / 60;

  // Flag if >16 hours of procedures in one day
  if (maxDailyHours > 16) {
    return {
      pattern: 'Time Impossibility',
      description: `${maxDailyHours.toFixed(1)} hours of procedures on ${impossibleDate} (${impossibleCount} procedures)`,
      severity: 'critical' as const,
      evidence: {
        date: impossibleDate,
        procedure_count: impossibleCount,
        estimated_hours: maxDailyHours.toFixed(1),
        maximum_feasible: '16 hours'
      },
      weight: 0.9
    };
  }
  return null;
}

// PHASE 2.1: Unbundling Detection
function detectUnbundling(claims: Claim[]) {
  // Common bundling violations (same date, same patient)
  const bundlingRules = [
    { base: '99213', addon: '99354', name: 'E&M + Prolonged Service' },
    { base: '43239', addon: '43240', name: 'Endoscopy procedures' },
    { base: '45378', addon: '45380', name: 'Colonoscopy procedures' },
  ];

  const violations: any[] = [];

  // Group by patient and date
  const patientDays = new Map<string, Claim[]>();
  claims.forEach(claim => {
    const key = `${claim.member_id}-${claim.service_date}`;
    if (!patientDays.has(key)) patientDays.set(key, []);
    patientDays.get(key)!.push(claim);
  });

  patientDays.forEach((dayClaims, key) => {
    bundlingRules.forEach(rule => {
      const hasAddon = dayClaims.some(c => c.cpt_hcpcs === rule.addon);
      const hasBase = dayClaims.some(c => c.cpt_hcpcs === rule.base);
      
      if (hasAddon && !hasBase) {
        violations.push({
          date: key.split('-')[1],
          rule: rule.name,
          codes: [rule.addon, rule.base]
        });
      }
    });
  });

  if (violations.length > 0) {
    return {
      pattern: 'Unbundling Violations',
      description: `${violations.length} instances of unbundled procedures`,
      severity: 'high' as const,
      evidence: {
        violation_count: violations.length,
        examples: violations.slice(0, 3)
      },
      weight: 0.8
    };
  }
  return null;
}

// PHASE 2.2: Temporal Spikes (End-of-Month Billing)
function detectTemporalSpikes(claims: Claim[]) {
  if (claims.length < 30) return null;

  // Group claims by day of month
  const byDayOfMonth = new Map<number, number>();
  claims.forEach(claim => {
    const date = new Date(claim.service_date);
    const day = date.getDate();
    byDayOfMonth.set(day, (byDayOfMonth.get(day) || 0) + 1);
  });

  // Calculate claims in last week (days 25-31)
  const lastWeekClaims = Array.from(byDayOfMonth.entries())
    .filter(([day]) => day >= 25)
    .reduce((sum, [, count]) => sum + count, 0);

  const lastWeekPct = (lastWeekClaims / claims.length) * 100;

  // Flag if >50% of claims in last week of month
  if (lastWeekPct > 50) {
    return {
      pattern: 'End-of-Month Spike',
      description: `${lastWeekPct.toFixed(0)}% of monthly volume occurs in last week (expected ~25%)`,
      severity: 'medium' as const,
      evidence: {
        last_week_claims: lastWeekClaims,
        total_claims: claims.length,
        last_week_pct: `${lastWeekPct.toFixed(0)}%`,
        expected: '~25%'
      },
      weight: 0.6
    };
  }
  return null;
}

// PHASE 2.3: Age/Gender Demographic Mismatches
function detectDemographicMismatches(claims: Claim[]) {
  // Gender-specific procedure codes
  const maleOnlyCodes = ['54150', '54160', '55700', '55866']; // Prostate procedures
  const femaleOnlyCodes = ['57452', '58100', '58150', '59400']; // GYN/OB procedures
  
  // This would require member demographic data which we don't have in current schema
  // Placeholder for when member data is added
  
  return null; // Will implement when member demographics available
}

export default detectAdvancedPatterns;
