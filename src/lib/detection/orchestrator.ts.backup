import { Claim } from '@/types/detection';
import { detectTier1, Tier1Result } from './tier1';
import { detectTier2, Tier2Result } from './tier2';
import { detectTier3, Tier3Result } from './tier3';
import { detectTier4, Tier4Result } from './tier4';
import { checkCCIEdits } from './cci-edits';
import { checkLCDLimits, checkMedicalNecessity } from './lcd-limits';
import { calculatePeerBaselines } from './peer-baselines';
import { detectAdvancedPatterns } from './advanced-patterns';
import { detectPhase3Patterns } from './phase3-patterns';

export interface DetectionResult {
  provider_id: string;
  claimCount: number;
  totalBilled: number;
  
  // Tier scores
  tier1Score: number;
  tier2Score: number;
  tier3Score: number;
  tier4Score: number;
  overallScore: number;
  
  // Priority
  priority: 'HIGH' | 'MEDIUM' | 'WATCHLIST';
  
  // Metrics from all tiers
  tier1Metrics: any[];
  tier2Metrics: any[];
  tier3Metrics: any[];
  tier4Metrics: any[];
  
  // Advanced patterns
  advancedPatterns: any[];
  phase3Patterns: any[];
  
  // Advanced features
  cciViolations: any[];
  lcdViolations: any[];
  impossiblePatterns: any[];
  peerBaselines: any[];
  
  // Flags
  hasRoundNumbers: boolean;
  hasModifier59: boolean;
  hasDailyPattern: boolean;
  
  // Top codes
  topCodes?: Array<{
    code: string;
    description: string;
    count: number;
    totalBilled: number;
    amounts?: number[];
    modifiers?: string[];
  }>;
  
  // Matched rules
  matchedRules: Array<{
    rule_id: string;
    rule_name: string;
    explanation: string;
    evidence: any;
    confidence: number;
    weight: number;
    severity: string;
  }>;
}

export function runComprehensiveDetection(
  claims: Claim[],
  providerId: string,
  allProviders: string[]
): DetectionResult {
  const providerClaims = claims.filter(c => c.provider_id === providerId);
  
  if (providerClaims.length === 0) {
    return createEmptyResult(providerId);
  }

  // Run all tier detections
  const tier1 = detectTier1(claims, providerId);
  const tier2 = detectTier2(claims, providerId, allProviders);
  const tier3 = detectTier3(claims, providerId);
  const tier4 = detectTier4(claims, providerId);
  const advancedPatterns = detectAdvancedPatterns(claims, providerId);
  const phase3Patterns = detectPhase3Patterns(claims, providerId);

  // Run advanced checks
  const cciResult = checkCCIEdits(claims, providerId);
  const lcdResult = checkLCDLimits(claims, providerId);
  const medicalNecessity = checkMedicalNecessity(claims, providerId);
  const peerBaselines = calculatePeerBaselines(providerId, claims, allProviders);

  // Calculate overall score (weighted)
  const overallScore = 
    (advancedPatterns.score * 0.10) +
    (phase3Patterns.score * 0.10) + 
    (tier1.score * 0.30) +
    (tier2.score * 0.25) +
    (tier3.score * 0.15) +
    (tier4.score * 0.05);

  // Determine priority
  let priority: 'HIGH' | 'MEDIUM' | 'WATCHLIST' = 'WATCHLIST';
  if ((tier1.score > 70 || tier2.score > 70) && overallScore >= 60) {
    priority = 'HIGH';
  } else if (overallScore >= 45 || tier3.score > 60) {
    priority = 'MEDIUM';
  }

  // Boost priority for critical violations
  if (cciResult.violations.length > 0 || 
      lcdResult.violations.length > 0 || 
      medicalNecessity.impossiblePatterns.length > 0) {
    if (priority === 'WATCHLIST') priority = 'MEDIUM';
    if (priority === 'MEDIUM') priority = 'HIGH';
  }

  // Calculate totals
  const totalBilled = providerClaims.reduce((sum, c) => 
    sum + parseFloat(c.billed_amount || '0'), 0
  );

  // Analyze top codes
  const topCodes = analyzeTopCodes(providerClaims);

  // Build matched rules
  const matchedRules = buildMatchedRules(
    tier1, tier2, tier3, tier4,
    cciResult, lcdResult, medicalNecessity,
    peerBaselines
  );

  // Detect patterns
  const amounts = providerClaims.map(c => parseFloat(c.billed_amount || '0'));
  const roundCount = amounts.filter(a => a % 100 === 0).length;
  const hasRoundNumbers = (roundCount / amounts.length) > 0.5;
  const hasModifier59 = cciResult.modifier59Rate > 0.4;
  const hasDailyPattern = medicalNecessity.impossiblePatterns.some(p => 
    p.pattern === 'Daily Wound Care'
  );

  return {
    provider_id: providerId,
    claimCount: providerClaims.length,
    totalBilled,
    
    tier1Score: tier1.score,
    tier2Score: tier2.score,
    tier3Score: tier3.score,
    tier4Score: tier4.score,
    overallScore: Math.round(overallScore),
    
    priority,
    
    tier1Metrics: tier1.metrics,
    tier2Metrics: tier2.metrics,
    tier3Metrics: tier3.metrics,
    tier4Metrics: tier4.metrics,
    advancedPatterns: advancedPatterns.patterns,
    phase3Patterns: phase3Patterns.patterns,
    
    cciViolations: cciResult.violations,
    lcdViolations: lcdResult.violations,
    impossiblePatterns: medicalNecessity.impossiblePatterns,
    peerBaselines,
    
    hasRoundNumbers,
    hasModifier59,
    hasDailyPattern,
    
    topCodes,
    matchedRules
  };
}

function analyzeTopCodes(claims: Claim[]) {
  const codeMap = new Map<string, {
    code: string;
    description: string;
    count: number;
    totalBilled: number;
    amounts: number[];
    modifiers: string[];
  }>();

  claims.forEach(claim => {
    const code = claim.cpt_hcpcs;
    const amount = parseFloat(claim.billed_amount || '0');
    
    if (!codeMap.has(code)) {
      codeMap.set(code, {
        code,
        description: claim.cpt_description || code,
        count: 0,
        totalBilled: 0,
        amounts: [],
        modifiers: []
      });
    }

    const entry = codeMap.get(code)!;
    entry.count++;
    entry.totalBilled += amount;
    entry.amounts.push(amount);
    if (claim.modifiers) {
      entry.modifiers.push(claim.modifiers);
    }
  });

  return Array.from(codeMap.values())
    .sort((a, b) => b.totalBilled - a.totalBilled)
    .slice(0, 5);
}

function buildMatchedRules(
  tier1: Tier1Result,
  tier2: Tier2Result,
  tier3: Tier3Result,
  tier4: Tier4Result,
  cciResult: any,
  lcdResult: any,
  medicalNecessity: any,
  peerBaselines: any[]
): any[] {
  const rules: any[] = [];

  // Add CCI violations
  if (cciResult.violations.length > 0) {
    rules.push({
      rule_id: 'R-CCI-001',
      rule_name: 'CCI Edit Violation',
      explanation: `${cciResult.violations.length} unbundling violations detected`,
      evidence: {
        violations: cciResult.violations.slice(0, 3),
        modifier59Rate: `${(cciResult.modifier59Rate * 100).toFixed(0)}%`
      },
      confidence: 0.95,
      weight: 0.9,
      severity: 'critical'
    });
  }

  // Add LCD violations
  if (lcdResult.violations.length > 0) {
    const topViolation = lcdResult.violations[0];
    rules.push({
      rule_id: 'R-LCD-001',
      rule_name: 'LCD Frequency Violation',
      explanation: `${topViolation.code}: ${topViolation.frequency} times in ${topViolation.periodDays} days (max: ${topViolation.maxAllowed})`,
      evidence: {
        code: topViolation.code,
        frequency: topViolation.frequency,
        maxAllowed: topViolation.maxAllowed
      },
      confidence: 0.9,
      weight: 0.85,
      severity: 'high'
    });
  }

  // Add medical impossibility
  if (medicalNecessity.impossiblePatterns.length > 0) {
    const pattern = medicalNecessity.impossiblePatterns[0];
    rules.push({
      rule_id: 'R-MED-001',
      rule_name: 'Medically Impossible Pattern',
      explanation: pattern.description,
      evidence: {
        pattern: pattern.pattern,
        count: pattern.count
      },
      confidence: 1.0,
      weight: 1.0,
      severity: 'critical'
    });
  }

  // Add round number clustering
  const roundMetric = tier1.metrics.find(m => m.metric === 'Round Number Clustering');
  if (roundMetric) {
    rules.push({
      rule_id: 'R-ROUND-001',
      rule_name: 'Round-Number Anchoring',
      explanation: `${roundMetric.value} of claims are round-dollar amounts`,
      evidence: {
        percentage: roundMetric.value,
        baseline: '12%'
      },
      confidence: 0.85,
      weight: 0.75,
      severity: 'high'
    });
  }

  // Add Benford violation
  const benfordMetric = tier2.metrics.find(m => m.metric === "Benford's Law Violation");
  if (benfordMetric) {
    rules.push({
      rule_id: 'R-BENF-001',
      rule_name: "Benford's Law Deviation",
      explanation: benfordMetric.description,
      evidence: {
        chiSquare: benfordMetric.value
      },
      confidence: 0.8,
      weight: 0.7,
      severity: 'medium'
    });
  }

  // Add peer outliers
  const outlierBaselines = peerBaselines.filter(b => b.isOutlier);
  outlierBaselines.forEach(baseline => {
    rules.push({
      rule_id: 'R-PEER-001',
      rule_name: 'Peer Group Outlier',
      explanation: `${baseline.metric}: ${baseline.percentile}th percentile (${baseline.providerValue} vs peer median ${baseline.peerMedian})`,
      evidence: {
        metric: baseline.metric,
        providerValue: baseline.providerValue,
        peerMedian: baseline.peerMedian,
        percentile: baseline.percentile
      },
      confidence: 0.75,
      weight: 0.65,
      severity: 'medium'
    });
  });

  return rules;
}

function createEmptyResult(providerId: string): DetectionResult {
  return {
    provider_id: providerId,
    claimCount: 0,
    totalBilled: 0,
    tier1Score: 0,
    tier2Score: 0,
    tier3Score: 0,
    tier4Score: 0,
    overallScore: 0,
    priority: 'WATCHLIST',
    tier1Metrics: [],
    tier2Metrics: [],
    tier3Metrics: [],
    tier4Metrics: [],
    cciViolations: [],
    lcdViolations: [],
    impossiblePatterns: [],
    peerBaselines: [],
    hasRoundNumbers: false,
    hasModifier59: false,
    hasDailyPattern: false,
    matchedRules: [],
    advancedPatterns: [],
    phase3Patterns: [],  };
}

// Legacy export for backwards compatibility
export const runDetection = runComprehensiveDetection;
