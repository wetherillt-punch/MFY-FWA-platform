/**
 * Drizzle ORM Schema for Detection Rules Tables
 */

import { 
  pgTable, 
  varchar, 
  boolean, 
  decimal, 
  text, 
  timestamp, 
  integer,
  jsonb,
  serial,
  bigserial,
  check
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// DETECTION RULES TABLE
// ============================================================================

export const detectionRules = pgTable('detection_rules', {
  ruleId: varchar('rule_id', { length: 50 }).primaryKey(),
  ruleName: varchar('rule_name', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  enabled: boolean('enabled').notNull().default(true),
  version: varchar('version', { length: 20 }).notNull(),
  
  // JSON fields
  parameters: jsonb('parameters').notNull().default({}),
  thresholds: jsonb('thresholds').notNull().default({}),
  
  weight: decimal('weight', { precision: 5, scale: 2 }).notNull().default('1.0'),
  
  // Metadata
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastExecuted: timestamp('last_executed'),
  
  // Performance tracking
  executionCount: integer('execution_count').notNull().default(0),
  avgExecutionTimeMs: integer('avg_execution_time_ms').default(0),
  totalTriggers: integer('total_triggers').notNull().default(0),
  successRate: decimal('success_rate', { precision: 5, scale: 2 }).default('100.0'),
});

// ============================================================================
// RULE EXECUTION LOG TABLE
// ============================================================================

export const ruleExecutionLog = pgTable('rule_execution_log', {
  logId: bigserial('log_id', { mode: 'number' }).primaryKey(),
  ruleId: varchar('rule_id', { length: 50 }).notNull().references(() => detectionRules.ruleId, { onDelete: 'cascade' }),
  providerId: varchar('provider_id', { length: 50 }).notNull(),
  
  executedAt: timestamp('executed_at').notNull().defaultNow(),
  executionTimeMs: integer('execution_time_ms').notNull(),
  
  triggered: boolean('triggered').notNull(),
  score: decimal('score', { precision: 5, scale: 2 }),
  confidence: decimal('confidence', { precision: 3, scale: 2 }),
  
  evidence: jsonb('evidence').default([]),
  flaggedClaimCount: integer('flagged_claim_count').default(0),
  flaggedClaimIds: text('flagged_claim_ids').array(),
  dollarImpact: decimal('dollar_impact', { precision: 12, scale: 2 }).default('0'),
  
  metadata: jsonb('metadata').default({}),
  
  success: boolean('success').notNull().default(true),
  errorMessage: text('error_message'),
  errorStack: text('error_stack'),
});

// ============================================================================
// RULE OVERRIDES TABLE
// ============================================================================

export const ruleOverrides = pgTable('rule_overrides', {
  overrideId: serial('override_id').primaryKey(),
  ruleId: varchar('rule_id', { length: 50 }).notNull().references(() => detectionRules.ruleId, { onDelete: 'cascade' }),
  
  specialty: varchar('specialty', { length: 100 }),
  region: varchar('region', { length: 50 }),
  providerType: varchar('provider_type', { length: 50 }),
  
  enabledOverride: boolean('enabled_override'),
  parametersOverride: jsonb('parameters_override'),
  thresholdsOverride: jsonb('thresholds_override'),
  weightOverride: decimal('weight_override', { precision: 5, scale: 2 }),
  
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: varchar('created_by', { length: 100 }),
  reason: text('reason'),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const detectionRulesRelations = relations(detectionRules, ({ many }) => ({
  executionLogs: many(ruleExecutionLog),
  overrides: many(ruleOverrides),
}));

export const ruleExecutionLogRelations = relations(ruleExecutionLog, ({ one }) => ({
  rule: one(detectionRules, {
    fields: [ruleExecutionLog.ruleId],
    references: [detectionRules.ruleId],
  }),
}));

export const ruleOverridesRelations = relations(ruleOverrides, ({ one }) => ({
  rule: one(detectionRules, {
    fields: [ruleOverrides.ruleId],
    references: [detectionRules.ruleId],
  }),
}));

// ============================================================================
// TYPES (inferred from schema)
// ============================================================================

export type DetectionRule = typeof detectionRules.$inferSelect;
export type NewDetectionRule = typeof detectionRules.$inferInsert;

export type RuleExecutionLogEntry = typeof ruleExecutionLog.$inferSelect;
export type NewRuleExecutionLog = typeof ruleExecutionLog.$inferInsert;

export type RuleOverride = typeof ruleOverrides.$inferSelect;
export type NewRuleOverride = typeof ruleOverrides.$inferInsert;