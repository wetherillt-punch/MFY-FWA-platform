/**
 * Core Type Definitions for Modular Detection Rules System
 * Version: 1.0.0
 */

import { Claim } from '@/types';

// ============================================================================
// RULE CONFIGURATION
// ============================================================================

export interface RuleConfig {
  rule_id: string;
  rule_name: string;
  category: RuleCategory;
  enabled: boolean;
  version: string;
  
  parameters: Record<string, number | string | boolean>;
  
  thresholds: {
    flag_threshold: number;
    high_priority_threshold: number;
    medium_priority_threshold: number;
  };
  
  weight: number;
  
  description: string;
  created_at: Date;
  updated_at: Date;
  last_executed: Date | null;
  
  execution_count: number;
  avg_execution_time_ms: number;
  total_triggers: number;
  success_rate: number;
}

export type RuleCategory = 
  | 'provider_cpt'
  | 'severity_weighted'
  | 'dollar_weighted'
  | 'roi_based'
  | 'temporal_analysis'
  | 'specialty_specific';

export interface RuleOverride {
  override_id: number;
  rule_id: string;
  
  specialty?: string;
  region?: string;
  provider_type?: string;
  
  enabled_override?: boolean;
  parameters_override?: Record<string, any>;
  thresholds_override?: Partial<RuleConfig['thresholds']>;
  weight_override?: number;
  
  active: boolean;
  created_at: Date;
  created_by: string;
  reason: string;
}

// ============================================================================
// RULE EXECUTION
// ============================================================================

export interface DetectionContext {
  provider_id: string;
  specialty?: string;
  region?: string;
  provider_type?: string;
  
  total_providers: number;
  dataset_date_range: {
    start: Date;
    end: Date;
  };
  
  peer_baselines?: {
    avg_claims_per_month: number;
    avg_claim_amount: number;
    avg_claims_per_patient: number;
    common_cpts: Array<{
      code: string;
      frequency: number;
    }>;
  };
  
  execution_id: string;
  execution_timestamp: Date;
}

export interface RuleResult {
  rule_id: string;
  triggered: boolean;
  score: number;
  confidence: number;
  
  evidence: Evidence[];
  flagged_claim_ids: string[];
  dollar_impact: number;
  
  metadata: Record<string, any>;
  
  execution_time_ms?: number;
  error?: {
    message: string;
    stack?: string;
  };
}

export interface Evidence {
  metric_name: string;
  provider_value: number;
  baseline_value: number;
  deviation: number;
  description: string;
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface AggregatedRuleResult {
  provider_id: string;
  
  overall_score: number;
  weighted_score: number;
  confidence: number;
  priority: 'IMMEDIATE' | 'HIGH' | 'MEDIUM' | 'WATCHLIST' | 'NONE';
  
  rule_results: RuleResult[];
  rules_triggered: number;
  rules_executed: number;
  
  all_evidence: Evidence[];
  total_flagged_claims: number;
  unique_flagged_claim_ids: string[];
  total_dollar_impact: number;
  
  execution_summary: {
    total_execution_time_ms: number;
    successful_rules: number;
    failed_rules: number;
    rules_with_errors: Array<{
      rule_id: string;
      error: string;
    }>;
  };
  
  executed_at: Date;
}

// ============================================================================
// RULE EXECUTOR INTERFACE
// ============================================================================

export interface RuleExecutor {
  execute(
    provider_id: string,
    claims: Claim[],
    config: RuleConfig,
    context: DetectionContext
  ): Promise<RuleResult>;
  
  validate(config: RuleConfig): boolean;
  
  getDescription(): string;
}

// ============================================================================
// DATABASE LOG TYPES
// ============================================================================

export interface RuleExecutionLog {
  log_id: number;
  rule_id: string;
  provider_id: string;
  
  executed_at: Date;
  execution_time_ms: number;
  
  triggered: boolean;
  score: number;
  confidence: number;
  
  evidence: Evidence[];
  flagged_claim_count: number;
  flagged_claim_ids: string[];
  dollar_impact: number;
  
  metadata: Record<string, any>;
  
  success: boolean;
  error_message?: string;
  error_stack?: string;
}

export interface RulePerformanceMetrics {
  rule_id: string;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  success_rate: number;
  
  avg_execution_time_ms: number;
  min_execution_time_ms: number;
  max_execution_time_ms: number;
  
  total_triggers: number;
  trigger_rate: number;
  
  avg_score_when_triggered: number;
  avg_dollar_impact: number;
  
  last_executed: Date;
}

export interface BaselineMetrics {
  specialty: string;
  region?: string;
  
  claims_per_month: {
    mean: number;
    median: number;
    p75: number;
    p90: number;
    p99: number;
  };
  
  claim_amount: {
    mean: number;
    median: number;
    p75: number;
    p90: number;
    p99: number;
  };
  
  cpt_concentration: {
    expected_top_code_pct: number;
    expected_top_3_pct: number;
  };
  
  modifier_rates: {
    mod25: number;
    mod59: number;
    mod76: number;
  };
  
  sample_size: number;
  calculated_at: Date;
}