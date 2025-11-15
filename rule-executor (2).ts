/**
 * Rule Executor - Loads and executes database-backed detection rules
 */

import { Claim } from '@/types';
import { prisma } from '@/lib/prisma';

export interface DatabaseRule {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: string;
  tier: string;
  isActive: boolean;
  
  cptCodes: string[];
  modifiers: string[];
  thresholds: any;
  generatedCode?: string;
  
  weight?: number;
}

export interface Evidence {
  metric_name: string;
  provider_value: number;
  baseline_value: number;
  deviation: number;
  description: string;
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface DatabaseRuleResult {
  rule_id: string;
  rule_name: string;
  triggered: boolean;
  score: number;
  confidence: number;
  evidence: Evidence[];
  flagged_claim_ids: string[];
  dollar_impact: number;
  execution_time_ms: number;
}

/**
 * Load active rules from database
 */
export async function loadActiveRules(): Promise<DatabaseRule[]> {
  try {
    const rules = await prisma.detectionRule.findMany({
      where: {
        isActive: true,
        status: 'APPROVED'
      },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        severity: true,
        tier: true,
        isActive: true,
        cptCodes: true,
        modifiers: true,
        thresholds: true,
        generatedCode: true,
      }
    });
    
    return rules.map(rule => ({
      ...rule,
      weight: calculateRuleWeight(rule.severity, rule.tier)
    }));
  } catch (error) {
    console.error('Failed to load rules from database:', error);
    return [];
  }
}

function calculateRuleWeight(severity: string, tier: string): number {
  const severityWeights: Record<string, number> = {
    'CRITICAL': 1.0,
    'HIGH': 0.8,
    'MEDIUM': 0.6,
    'LOW': 0.4
  };
  
  const tierWeights: Record<string, number> = {
    'tier1': 1.0,
    'tier2': 0.85,
    'tier3': 0.7,
    'tier4': 0.5,
    'custom': 0.6
  };
  
  const severityWeight = severityWeights[severity.toUpperCase()] || 0.5;
  const tierWeight = tierWeights[tier.toLowerCase()] || 0.5;
  
  return (severityWeight + tierWeight) / 2;
}

export async function executeDatabaseRule(
  rule: DatabaseRule,
  providerId: string,
  claims: Claim[]
): Promise<DatabaseRuleResult> {
  const startTime = Date.now();
  
  try {
    const providerClaims = claims.filter(c => c.provider_id === providerId);
    
    let result: DatabaseRuleResult;
    
    switch (rule.category.toLowerCase()) {
      case 'frequency':
        result = executeFrequencyRule(rule, providerClaims);
        break;
      case 'billing':
        result = executeBillingRule(rule, providerClaims);
        break;
      case 'temporal':
        result = executeTemporalRule(rule, providerClaims);
        break;
      case 'dme':
        result = executeDMERule(rule, providerClaims);
        break;
      case 'modifier':
        result = executeModifierRule(rule, providerClaims);
        break;
      default:
        result = createEmptyResult(rule);
    }
    
    const executionTime = Date.now() - startTime;
    
    await logRuleExecution(rule, providerId, result, executionTime, true);
    
    return {
      ...result,
      execution_time_ms: executionTime
    };
    
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    console.error(`Rule execution failed for ${rule.id}:`, error);
    
    await logRuleExecution(
      rule,
      providerId,
      {
        rule_id: rule.id,
        rule_name: rule.name,
        triggered: false,
        score: 0,
        confidence: 0,
        evidence: [],
        flagged_claim_ids: [],
        dollar_impact: 0,
        execution_time_ms: executionTime
      },
      executionTime,
      false,
      error.message
    );
    
    return createEmptyResult(rule);
  }
}

function executeFrequencyRule(rule: DatabaseRule, claims: Claim[]): DatabaseRuleResult {
  const thresholds = rule.thresholds as any;
  const targetCodes = rule.cptCodes || [];
  
  if (targetCodes.length === 0) {
    return createEmptyResult(rule);
  }
  
  const relevantClaims = claims.filter(c => 
    targetCodes.includes(c.cpt_hcpcs)
  );
  
  const frequency = relevantClaims.length;
  const threshold = thresholds.max_frequency || 10;
  
  if (frequency <= threshold) {
    return createEmptyResult(rule);
  }
  
  const deviation = ((frequency - threshold) / threshold) * 100;
  const score = Math.min(100, deviation);
  
  return {
    rule_id: rule.id,
    rule_name: rule.name,
    triggered: true,
    score: Math.round(score),
    confidence: 0.85,
    evidence: [{
      metric_name: 'Code Frequency',
      provider_value: frequency,
      baseline_value: threshold,
      deviation: deviation,
      description: `CPT ${targetCodes.join(', ')}: ${frequency} instances (threshold: ${threshold})`,
      severity: score > 70 ? 'HIGH' : score > 40 ? 'MEDIUM' : 'LOW'
    }],
    flagged_claim_ids: relevantClaims.map(c => c.claim_id),
    dollar_impact: relevantClaims.reduce((sum, c) => sum + (c.billed_amount || 0), 0),
    execution_time_ms: 0
  };
}

function executeBillingRule(rule: DatabaseRule, claims: Claim[]): DatabaseRuleResult {
  const amounts = claims.map(c => c.billed_amount || 0);
  const thresholds = rule.thresholds as any;
  
  const roundCount = amounts.filter(a => a % 100 === 0).length;
  const roundPct = (roundCount / amounts.length) * 100;
  const threshold = thresholds.round_number_threshold || 50;
  
  if (roundPct <= threshold) {
    return createEmptyResult(rule);
  }
  
  const deviation = roundPct - threshold;
  const score = Math.min(100, (deviation / threshold) * 100);
  
  return {
    rule_id: rule.id,
    rule_name: rule.name,
    triggered: true,
    score: Math.round(score),
    confidence: 0.75,
    evidence: [{
      metric_name: 'Round Number Rate',
      provider_value: roundPct,
      baseline_value: threshold,
      deviation: deviation,
      description: `${roundPct.toFixed(0)}% of amounts are round numbers (threshold: ${threshold}%)`,
      severity: score > 70 ? 'HIGH' : score > 40 ? 'MEDIUM' : 'LOW'
    }],
    flagged_claim_ids: claims.filter(c => (c.billed_amount || 0) % 100 === 0).map(c => c.claim_id),
    dollar_impact: amounts.filter(a => a % 100 === 0).reduce((sum, a) => sum + a, 0),
    execution_time_ms: 0
  };
}

function executeTemporalRule(rule: DatabaseRule, claims: Claim[]): DatabaseRuleResult {
  const thresholds = rule.thresholds as any;
  const targetCodes = rule.cptCodes || [];
  
  if (targetCodes.length === 0 || claims.length < 2) {
    return createEmptyResult(rule);
  }
  
  const relevantClaims = claims
    .filter(c => targetCodes.includes(c.cpt_hcpcs))
    .sort((a, b) => a.service_date.getTime() - b.service_date.getTime());
  
  if (relevantClaims.length < 2) {
    return createEmptyResult(rule);
  }
  
  const minDaysBetween = thresholds.min_days_between || 14;
  const violations: Claim[] = [];
  
  for (let i = 1; i < relevantClaims.length; i++) {
    const prevClaim = relevantClaims[i - 1];
    const currClaim = relevantClaims[i];
    
    const daysDiff = Math.floor(
      (currClaim.service_date.getTime() - prevClaim.service_date.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysDiff < minDaysBetween) {
      violations.push(currClaim);
    }
  }
  
  if (violations.length === 0) {
    return createEmptyResult(rule);
  }
  
  const score = Math.min(100, (violations.length / relevantClaims.length) * 200);
  
  return {
    rule_id: rule.id,
    rule_name: rule.name,
    triggered: true,
    score: Math.round(score),
    confidence: 0.9,
    evidence: [{
      metric_name: 'Frequency Violations',
      provider_value: violations.length,
      baseline_value: 0,
      deviation: violations.length,
      description: `${violations.length} claims performed <${minDaysBetween} days apart`,
      severity: score > 70 ? 'HIGH' : score > 40 ? 'MEDIUM' : 'LOW'
    }],
    flagged_claim_ids: violations.map(c => c.claim_id),
    dollar_impact: violations.reduce((sum, c) => sum + (c.billed_amount || 0), 0),
    execution_time_ms: 0
  };
}

function executeDMERule(rule: DatabaseRule, claims: Claim[]): DatabaseRuleResult {
  const targetCodes = rule.cptCodes || [];
  const thresholds = rule.thresholds as any;
  
  if (targetCodes.length === 0) {
    return createEmptyResult(rule);
  }
  
  const dmeClaims = claims.filter(c => targetCodes.includes(c.cpt_hcpcs));
  const dmeRate = (dmeClaims.length / claims.length) * 100;
  const threshold = thresholds.max_dme_rate || 30;
  
  if (dmeRate <= threshold) {
    return createEmptyResult(rule);
  }
  
  const deviation = dmeRate - threshold;
  const score = Math.min(100, (deviation / threshold) * 100);
  
  return {
    rule_id: rule.id,
    rule_name: rule.name,
    triggered: true,
    score: Math.round(score),
    confidence: 0.8,
    evidence: [{
      metric_name: 'DME Billing Rate',
      provider_value: dmeRate,
      baseline_value: threshold,
      deviation: deviation,
      description: `${dmeRate.toFixed(0)}% of claims are DME (threshold: ${threshold}%)`,
      severity: score > 70 ? 'HIGH' : score > 40 ? 'MEDIUM' : 'LOW'
    }],
    flagged_claim_ids: dmeClaims.map(c => c.claim_id),
    dollar_impact: dmeClaims.reduce((sum, c) => sum + (c.billed_amount || 0), 0),
    execution_time_ms: 0
  };
}

function executeModifierRule(rule: DatabaseRule, claims: Claim[]): DatabaseRuleResult {
  const targetModifiers = rule.modifiers || [];
  const thresholds = rule.thresholds as any;
  
  if (targetModifiers.length === 0) {
    return createEmptyResult(rule);
  }
  
  const modifierClaims = claims.filter(c => 
    c.modifiers && targetModifiers.some(mod => c.modifiers?.includes(mod))
  );
  
  const modifierRate = (modifierClaims.length / claims.length) * 100;
  const threshold = thresholds.max_modifier_rate || 10;
  
  if (modifierRate <= threshold) {
    return createEmptyResult(rule);
  }
  
  const deviation = modifierRate - threshold;
  const score = Math.min(100, (deviation / threshold) * 150);
  
  return {
    rule_id: rule.id,
    rule_name: rule.name,
    triggered: true,
    score: Math.round(score),
    confidence: 0.8,
    evidence: [{
      metric_name: 'Modifier Usage Rate',
      provider_value: modifierRate,
      baseline_value: threshold,
      deviation: deviation,
      description: `${modifierRate.toFixed(0)}% modifier usage (threshold: ${threshold}%)`,
      severity: score > 70 ? 'HIGH' : score > 40 ? 'MEDIUM' : 'LOW'
    }],
    flagged_claim_ids: modifierClaims.map(c => c.claim_id),
    dollar_impact: modifierClaims.reduce((sum, c) => sum + (c.billed_amount || 0), 0),
    execution_time_ms: 0
  };
}

async function logRuleExecution(
  rule: DatabaseRule,
  providerId: string,
  result: DatabaseRuleResult,
  executionTimeMs: number,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    await prisma.ruleExecutionLog.create({
      data: {
        ruleId: rule.id,
        providerId: providerId,
        executedAt: new Date(),
        executionTimeMs: executionTimeMs,
        triggered: result.triggered,
        score: result.score,
        confidence: result.confidence,
        evidence: result.evidence as any,
        flaggedClaimCount: result.flagged_claim_ids.length,
        flaggedClaimIds: result.flagged_claim_ids,
        dollarImpact: result.dollar_impact,
        success: success,
        errorMessage: errorMessage,
      }
    });
    
    await prisma.detectionRule.update({
      where: { id: rule.id },
      data: {
        executionCount: { increment: 1 },
        lastExecuted: new Date(),
        ...(result.triggered && { totalTriggers: { increment: 1 } })
      }
    });
  } catch (error) {
    console.error('Failed to log rule execution:', error);
  }
}

function createEmptyResult(rule: DatabaseRule): DatabaseRuleResult {
  return {
    rule_id: rule.id,
    rule_name: rule.name,
    triggered: false,
    score: 0,
    confidence: 0,
    evidence: [],
    flagged_claim_ids: [],
    dollar_impact: 0,
    execution_time_ms: 0
  };
}

export async function executeAllDatabaseRules(
  providerId: string,
  claims: Claim[]
): Promise<DatabaseRuleResult[]> {
  const rules = await loadActiveRules();
  
  if (rules.length === 0) {
    console.log('No active database rules found');
    return [];
  }
  
  console.log(`Executing ${rules.length} database rules for provider ${providerId}`);
  
  const results = await Promise.all(
    rules.map(rule => executeDatabaseRule(rule, providerId, claims))
  );
  
  return results.filter(r => r.triggered);
}
