/**
 * Database Operations for Detection Rules
 * Uses Drizzle ORM for type-safe database queries
 */

import { db } from '@/db';
import { 
  detectionRules, 
  ruleExecutionLog, 
  ruleOverrides,
  type DetectionRule,
  type NewRuleExecutionLog,
  type RuleOverride 
} from '@/db/schema-rules';
import { eq, and, desc, sql } from 'drizzle-orm';
import { RuleConfig, RuleExecutionLog, DetectionContext } from '../types';

// ============================================================================
// RULE CONFIGURATION MANAGEMENT
// ============================================================================

/**
 * Load all detection rules from database
 */
export async function loadAllRules(): Promise<RuleConfig[]> {
  const rules = await db.select().from(detectionRules);
  return rules.map(convertToRuleConfig);
}

/**
 * Load a single rule by ID
 */
export async function loadRule(rule_id: string): Promise<RuleConfig | null> {
  const results = await db
    .select()
    .from(detectionRules)
    .where(eq(detectionRules.ruleId, rule_id))
    .limit(1);
  
  return results.length > 0 ? convertToRuleConfig(results[0]) : null;
}

/**
 * Load all enabled rules
 */
export async function loadEnabledRules(): Promise<RuleConfig[]> {
  const rules = await db
    .select()
    .from(detectionRules)
    .where(eq(detectionRules.enabled, true));
  
  return rules.map(convertToRuleConfig);
}

/**
 * Load rules by category
 */
export async function loadRulesByCategory(category: string): Promise<RuleConfig[]> {
  const rules = await db
    .select()
    .from(detectionRules)
    .where(eq(detectionRules.category, category));
  
  return rules.map(convertToRuleConfig);
}

/**
 * Update rule configuration
 */
export async function updateRuleConfig(
  rule_id: string,
  updates: Partial<RuleConfig>
): Promise<void> {
  const updateData: any = {};
  
  if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
  if (updates.parameters) updateData.parameters = updates.parameters;
  if (updates.thresholds) updateData.thresholds = updates.thresholds;
  if (updates.weight !== undefined) updateData.weight = String(updates.weight);
  if (updates.description) updateData.description = updates.description;
  
  await db
    .update(detectionRules)
    .set(updateData)
    .where(eq(detectionRules.ruleId, rule_id));
}

/**
 * Toggle rule enabled status
 */
export async function toggleRule(rule_id: string, enabled: boolean): Promise<void> {
  await db
    .update(detectionRules)
    .set({ enabled })
    .where(eq(detectionRules.ruleId, rule_id));
}

// ============================================================================
// RULE OVERRIDES MANAGEMENT
// ============================================================================

/**
 * Get overrides for a specific rule and context
 */
export async function getApplicableOverrides(
  rule_id: string,
  context: {
    specialty?: string;
    region?: string;
    provider_type?: string;
  }
): Promise<RuleOverride[]> {
  const conditions = [
    eq(ruleOverrides.ruleId, rule_id),
    eq(ruleOverrides.active, true)
  ];
  
  // Build dynamic filter based on context
  if (context.specialty) {
    const results = await db
      .select()
      .from(ruleOverrides)
      .where(
        and(
          ...conditions,
          eq(ruleOverrides.specialty, context.specialty)
        )
      );
    if (results.length > 0) return results;
  }
  
  if (context.region) {
    const results = await db
      .select()
      .from(ruleOverrides)
      .where(
        and(
          ...conditions,
          eq(ruleOverrides.region, context.region)
        )
      );
    if (results.length > 0) return results;
  }
  
  if (context.provider_type) {
    const results = await db
      .select()
      .from(ruleOverrides)
      .where(
        and(
          ...conditions,
          eq(ruleOverrides.providerType, context.provider_type)
        )
      );
    if (results.length > 0) return results;
  }
  
  return [];
}

/**
 * Apply overrides to a rule configuration
 */
export function applyOverrides(
  baseConfig: RuleConfig,
  overrides: RuleOverride[]
): RuleConfig {
  let config = { ...baseConfig };
  
  for (const override of overrides) {
    if (!override.active) continue;
    
    if (override.enabledOverride !== null) {
      config.enabled = override.enabledOverride;
    }
    
    if (override.parametersOverride) {
      config.parameters = {
        ...config.parameters,
        ...(override.parametersOverride as Record<string, any>)
      };
    }
    
    if (override.thresholdsOverride) {
      config.thresholds = {
        ...config.thresholds,
        ...(override.thresholdsOverride as any)
      };
    }
    
    if (override.weightOverride !== null) {
      config.weight = Number(override.weightOverride);
    }
  }
  
  return config;
}

// ============================================================================
// EXECUTION LOGGING
// ============================================================================

/**
 * Log a rule execution result
 */
export async function logRuleExecution(log: Omit<RuleExecutionLog, 'log_id'>): Promise<void> {
  await db.insert(ruleExecutionLog).values({
    ruleId: log.rule_id,
    providerId: log.provider_id,
    executedAt: log.executed_at,
    executionTimeMs: log.execution_time_ms,
    triggered: log.triggered,
    score: log.score ? String(log.score) : null,
    confidence: log.confidence ? String(log.confidence) : null,
    evidence: log.evidence as any,
    flaggedClaimCount: log.flagged_claim_count,
    flaggedClaimIds: log.flagged_claim_ids,
    dollarImpact: log.dollar_impact ? String(log.dollar_impact) : '0',
    metadata: log.metadata as any,
    success: log.success,
    errorMessage: log.error_message,
    errorStack: log.error_stack,
  });
}

/**
 * Update rule performance metrics
 */
export async function updateRuleMetrics(
  rule_id: string,
  execution_time_ms: number,
  triggered: boolean,
  success: boolean
): Promise<void> {
  // Get current metrics
  const current = await db
    .select()
    .from(detectionRules)
    .where(eq(detectionRules.ruleId, rule_id))
    .limit(1);
  
  if (current.length === 0) return;
  
  const rule = current[0];
  const newExecutionCount = rule.executionCount + 1;
  const newTotalTriggers = triggered ? rule.totalTriggers + 1 : rule.totalTriggers;
  
  // Calculate new average execution time
  const currentAvg = rule.avgExecutionTimeMs || 0;
  const newAvg = Math.round(
    (currentAvg * rule.executionCount + execution_time_ms) / newExecutionCount
  );
  
  // Calculate success rate
  const successCount = success ? 1 : 0;
  const currentSuccessRate = Number(rule.successRate) || 100;
  const currentSuccessCount = Math.round((currentSuccessRate / 100) * rule.executionCount);
  const newSuccessRate = ((currentSuccessCount + successCount) / newExecutionCount) * 100;
  
  await db
    .update(detectionRules)
    .set({
      executionCount: newExecutionCount,
      totalTriggers: newTotalTriggers,
      avgExecutionTimeMs: newAvg,
      successRate: String(newSuccessRate.toFixed(2)),
      lastExecuted: new Date(),
    })
    .where(eq(detectionRules.ruleId, rule_id));
}

/**
 * Get rule execution history for a provider
 */
export async function getRuleExecutionHistory(
  provider_id: string,
  rule_id?: string,
  limit: number = 100
): Promise<RuleExecutionLog[]> {
  let query = db
    .select()
    .from(ruleExecutionLog)
    .where(eq(ruleExecutionLog.providerId, provider_id))
    .orderBy(desc(ruleExecutionLog.executedAt))
    .limit(limit);
  
  if (rule_id) {
    query = db
      .select()
      .from(ruleExecutionLog)
      .where(
        and(
          eq(ruleExecutionLog.providerId, provider_id),
          eq(ruleExecutionLog.ruleId, rule_id)
        )
      )
      .orderBy(desc(ruleExecutionLog.executedAt))
      .limit(limit);
  }
  
  const results = await query;
  return results.map(convertToRuleExecutionLog);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert database record to RuleConfig
 */
function convertToRuleConfig(dbRule: DetectionRule): RuleConfig {
  return {
    rule_id: dbRule.ruleId,
    rule_name: dbRule.ruleName,
    category: dbRule.category as any,
    enabled: dbRule.enabled,
    version: dbRule.version,
    parameters: dbRule.parameters as Record<string, any>,
    thresholds: dbRule.thresholds as any,
    weight: Number(dbRule.weight),
    description: dbRule.description || '',
    created_at: dbRule.createdAt,
    updated_at: dbRule.updatedAt,
    last_executed: dbRule.lastExecuted,
    execution_count: dbRule.executionCount,
    avg_execution_time_ms: dbRule.avgExecutionTimeMs || 0,
    total_triggers: dbRule.totalTriggers,
    success_rate: Number(dbRule.successRate),
  };
}

/**
 * Convert database record to RuleExecutionLog
 */
function convertToRuleExecutionLog(dbLog: any): RuleExecutionLog {
  return {
    log_id: dbLog.logId,
    rule_id: dbLog.ruleId,
    provider_id: dbLog.providerId,
    executed_at: dbLog.executedAt,
    execution_time_ms: dbLog.executionTimeMs,
    triggered: dbLog.triggered,
    score: dbLog.score ? Number(dbLog.score) : 0,
    confidence: dbLog.confidence ? Number(dbLog.confidence) : 0,
    evidence: dbLog.evidence || [],
    flagged_claim_count: dbLog.flaggedClaimCount || 0,
    flagged_claim_ids: dbLog.flaggedClaimIds || [],
    dollar_impact: dbLog.dollarImpact ? Number(dbLog.dollarImpact) : 0,
    metadata: dbLog.metadata || {},
    success: dbLog.success,
    error_message: dbLog.errorMessage,
    error_stack: dbLog.errorStack,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  loadAllRules,
  loadRule,
  loadEnabledRules,
  loadRulesByCategory,
  updateRuleConfig,
  toggleRule,
  getApplicableOverrides,
  applyOverrides,
  logRuleExecution,
  updateRuleMetrics,
  getRuleExecutionHistory,
};