import { Claim } from '@/types';
import { runDMEDetection } from './dme/dme-detection-engine';


export interface Phase3Result {
  score: number;
  patterns: Array<{
    pattern: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    evidence: any;
    weight: number;
  }>;
}

export function detectPhase3Patterns(
  claims: Claim[],
  providerId: string
): Phase3Result {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  const patterns: any[] = [];
  let score = 0;

  if (providerClaims.length === 0) {
    return { score: 0, patterns: [] };
  }

  // Pattern 1: Modifier 25 Misuse
  const mod25Result = detectModifier25Misuse(providerClaims);
  if (mod25Result) {
    patterns.push(mod25Result);
    score += mod25Result.weight * 100;
  }

  // Pattern 2: Place of Service Drift
  const posDriftResult = detectPOSDrift(providerClaims);
  if (posDriftResult) {
    patterns.push(posDriftResult);
    score += posDriftResult.weight * 100;
  }

  // Pattern 3: Psychotherapy Duration Creep
  const psychDurationResult = detectPsychotherapyCreep(providerClaims);
  if (psychDurationResult) {
    patterns.push(psychDurationResult);
    score += psychDurationResult.weight * 100;
  }

  // Pattern 4: Telehealth Volume Bursts
  const telehealthResult = detectTelehealthBursts(providerClaims);
  if (telehealthResult) {
    patterns.push(telehealthResult);
    score += telehealthResult.weight * 100;
  }

  // Pattern 5: Wound Care Frequency Spike
  const woundCareResult = detectWoundCareFrequency(providerClaims);
  if (woundCareResult) {
    patterns.push(woundCareResult);
    score += woundCareResult.weight * 100;
  }

  // Pattern 6: Temporal Billing Inflation
  const billingInflationResult = detectBillingInflation(providerClaims);
  if (billingInflationResult) {
    patterns.push(billingInflationResult);
    score += billingInflationResult.weight * 100;
  }

  // Run DME detection rules
  const dmeAnomalies = runDMEDetection(claims, providerId);
  
  // Add DME patterns to the patterns array
  dmeAnomalies.forEach(anomaly => {
    patterns.push({
      pattern: anomaly.rule_name,
      description: anomaly.description,
      severity: anomaly.severity === 'high' ? 'high' : anomaly.severity,
      evidence: anomaly.evidence,
      weight: anomaly.weight,
      tier: anomaly.tier  // Add tier to pattern for downstream use
    });
    
    // Add to score based on tier
    // Tier A rules are HIGH confidence and should contribute significantly
    if (anomaly.tier === 'A') {
      score += 50; // Boost score substantially for Tier A rules
    } else if (anomaly.tier === 'B') {
      score += 30; // Medium confidence rules
    } else {
      score += 15; // Watchlist
    }
  });

  return { score: Math.min(score, 100), patterns };
}

// Pattern 1: Modifier 25 Misuse Detection
function detectModifier25Misuse(claims: Claim[]) {
  // E&M codes that commonly get modifier 25
  const emCodes = claims.filter(c => c.cpt_hcpcs &&  c.cpt_hcpcs && /^9921[3-5]$/.test(c.cpt_hcpcs));
  
  if (emCodes.length < 5) return null;

  
  // DEBUG: Log sample E&M claims to see what modifiers look like
  if (emCodes.length > 0) {
    console.log('=== MODIFIER 25 DEBUG ===');
    console.log('Provider has', emCodes.length, 'E&M codes');
    console.log('Sample claims:', emCodes.slice(0, 5).map(c => ({
      cpt: c.cpt_hcpcs,
      modifiers: c.modifiers,
      modifiersType: typeof c.modifiers,
      stringCheck: String(c.modifiers),
      includesCheck: String(c.modifiers).includes("25")
    })));
  }

  const withMod25 = emCodes.filter(c => {
    if (!c.modifiers) return false;
    
    // Handle array of modifiers
    if (Array.isArray(c.modifiers)) {
      return c.modifiers.some((m: any) => 
        String(m) === '25'
      );
    }
    
    // Handle single modifier value
    return String(c.modifiers) === '25' || 
           c.modifiers === '25' || 
           String(c.modifiers) === '25';
  }).length;
  
  console.log(`Provider - Modifier 25: ${withMod25}/${emCodes.length} E&M claims (${((withMod25 / emCodes.length) * 100).toFixed(1)}%)`);

  const mod25Pct = (withMod25 / emCodes.length) * 100;

  // Flag if >10% of E&M visits use modifier 25 (expected: <5%)
  if (mod25Pct > 8) {
    return {
      pattern: 'Modifier 25 Overuse',
      description: `${mod25Pct.toFixed(0)}% of E&M visits use modifier 25 (expected <5%)`,
      severity: 'medium' as const,
      evidence: {
        em_visits: emCodes.length,
        mod25_count: withMod25,
        mod25_pct: `${mod25Pct.toFixed(0)}%`,
        expected: '<5%'
      },
      weight: 0.6
    };
  }
  return null;
}

// Pattern 2: Place of Service Drift Detection
function detectPOSDrift(claims: Claim[]) {
  // Office visit codes that should be POS 11 (office)
  const officeVisits = claims.filter(c => 
    c.cpt_hcpcs && c.cpt_hcpcs && /^9921[3-5]$/.test(c.cpt_hcpcs)
  );

  if (officeVisits.length < 10) return null;

  // Check for POS 21 (inpatient hospital) on office codes
  const inpatientPOS = officeVisits.filter(c => 
    ['21', 21].includes(c.place_of_service as any)
  ).length;

  const posDriftPct = (inpatientPOS / officeVisits.length) * 100;

  // Flag if >5% of office visits billed as inpatient (expected: 0%)
  if (posDriftPct > 5) {
    return {
      pattern: 'Place of Service Drift',
      description: `${posDriftPct.toFixed(0)}% of office visits billed as inpatient POS 21`,
      severity: 'medium' as const,
      evidence: {
        office_visits: officeVisits.length,
        inpatient_pos_count: inpatientPOS,
        drift_pct: `${posDriftPct.toFixed(0)}%`,
        expected: '0%'
      },
      weight: 0.5
    };
  }
  return null;
}

// Pattern 3: Psychotherapy Duration Creep
function detectPsychotherapyCreep(claims: Claim[]) {
  const psychCodes = claims.filter(c => 
    c.cpt_hcpcs && /^9083[2347]$/.test(c.cpt_hcpcs)
  );

  if (psychCodes.length < 10) return null;

  // Count 60-min sessions (90837)
  const longSessions = psychCodes.filter(c => c.cpt_hcpcs === '90837').length;
  const longSessionPct = (longSessions / psychCodes.length) * 100;

  // Flag if >70% are 60-min sessions (expected: 40-50%)
  if (longSessionPct > 70) {
    return {
      pattern: 'Psychotherapy Duration Creep',
      description: `${longSessionPct.toFixed(0)}% of sessions are 60-min (90837) (expected 40-50%)`,
      severity: 'low' as const,
      evidence: {
        total_sessions: psychCodes.length,
        long_sessions: longSessions,
        long_session_pct: `${longSessionPct.toFixed(0)}%`,
        expected: '40-50%'
      },
      weight: 0.4
    };
  }
  return null;
}

// Pattern 4: Telehealth Volume Bursts
function detectTelehealthBursts(claims: Claim[]) {
  // POS 02 = Telehealth
  const telehealthClaims = claims.filter(c => ['02', '2', 2].includes(c.place_of_service as any));

  if (telehealthClaims.length < 5) return null;

  // Group by date
  const byDate = new Map<string, number>();
  telehealthClaims.forEach(claim => {
    const date = claim.service_date;
    byDate.set(date, (byDate.get(date) || 0) + 1);
  });

  let maxDaily = 0;
  let maxDate = '';
  byDate.forEach((count, date) => {
    if (count > maxDaily) {
      maxDaily = count;
      maxDate = date;
    }
  });

  // Flag if >10 telehealth claims in one day (expected: <5)
  if (maxDaily > 10) {
    return {
      pattern: 'Telehealth Volume Burst',
      description: `${maxDaily} telehealth claims on ${maxDate} (expected <5/day)`,
      severity: 'medium' as const,
      evidence: {
        max_daily: maxDaily,
        date: maxDate,
        total_telehealth: telehealthClaims.length,
        expected: '<5 per day'
      },
      weight: 0.6
    };
  }
  return null;
}

// Pattern 5: Wound Care Frequency Spike
function detectWoundCareFrequency(claims: Claim[]) {
  // Skin substitute codes: 15271, 15275
  const woundClaims = claims.filter(c => 
    c.cpt_hcpcs && /^1527[15]$/.test(c.cpt_hcpcs)
  );

  if (woundClaims.length < 3) return null;

  // Group by member
  const byMember = new Map<string, Claim[]>();
  woundClaims.forEach(claim => {
    const member = claim.member_id || "UNKNOWN";
    if (!byMember.has(member)) byMember.set(member, []);
    byMember.get(member)!.push(claim);
  });

  let violations = 0;
  byMember.forEach((memberClaims, memberId) => {
    if (memberClaims.length < 2) return;

    // Sort by date
    const sorted = memberClaims.sort((a, b) => 
      new Date(a.service_date).getTime() - new Date(b.service_date).getTime()
    );

    // Check for claims <14 days apart
    for (let i = 1; i < sorted.length; i++) {
      const date1 = new Date(sorted[i-1].service_date);
      const date2 = new Date(sorted[i].service_date);
      const daysDiff = (date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff < 14) {
        violations++;
      }
    }
  });

  if (violations > 0) {
    return {
      pattern: 'Wound Care Frequency Spike',
      description: `${violations} instances of skin substitute procedures <14 days apart`,
      severity: 'medium' as const,
      evidence: {
        total_wound_claims: woundClaims.length,
        frequency_violations: violations,
        expected: '≥14 days between treatments'
      },
      weight: 0.7
    };
  }
  return null;
}

// Pattern 6: Temporal Billing Inflation
function detectBillingInflation(claims: Claim[]) {
  console.log('[Billing Inflation Debug] Claims count:', claims.length);
  if (claims.length < 30) {
    console.log('[Billing Inflation Debug] Not enough claims (<30)');
    return null;
  }

  // Group claims by month
  const byMonth = new Map<string, number[]>();
  
  claims.forEach(claim => {
    const date = new Date(claim.service_date);
    const year = date.getFullYear();
    
    // Only analyze 2025 data for consistency
    if (year < 2025) return;
    
    const monthKey = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const amount = claim.billed_amount || 0;
    
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
    byMonth.get(monthKey)!.push(amount);
  });

  console.log('[Billing Inflation Debug] Months found:', byMonth.size, Array.from(byMonth.keys()));
  if (byMonth.size < 3) {
    console.log('[Billing Inflation Debug] Not enough months (<3)');
    return null;
  }

  // Calculate monthly averages
  const monthlyAvgs: Array<{month: string, avg: number}> = [];
  byMonth.forEach((amounts, month) => {
    const avg = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    monthlyAvgs.push({ month, avg });
  });

  // Sort by month
  monthlyAvgs.sort((a, b) => a.month.localeCompare(b.month));

  // Check for upward trend
  if (monthlyAvgs.length >= 2) {
    const firstAvg = monthlyAvgs[0].avg;
    const lastAvg = monthlyAvgs[monthlyAvgs.length - 1].avg;
    const inflationPct = ((lastAvg - firstAvg) / firstAvg) * 100;
    console.log('[Billing Inflation Debug] First avg:', firstAvg, 'Last avg:', lastAvg, 'Inflation %:', inflationPct);

    // Flag if >10% increase over time period
    if (inflationPct > 25) {
      console.log('[Billing Inflation Debug] TRIGGERED - Inflation exceeds 25%');
      return {
        pattern: 'Billing Inflation Drift',
        description: `${inflationPct.toFixed(0)}% increase in avg claim amount over ${monthlyAvgs.length} months`,
        severity: 'low' as const,
        evidence: {
          first_month: monthlyAvgs[0].month,
          first_avg: `$${firstAvg.toFixed(2)}`,
          last_month: monthlyAvgs[monthlyAvgs.length - 1].month,
          last_avg: `$${lastAvg.toFixed(2)}`,
          inflation_pct: `${inflationPct.toFixed(0)}%`,
          expected: '<10% over 6 months'
        },
        weight: 0.4
      };
    } else {
      console.log('[Billing Inflation Debug] Below threshold - not flagging');
    }
  }

  return null;
}

export default detectPhase3Patterns;
