-- Seed: Initial Detection Rules Configuration
-- Purpose: Load Phase 1 rules with production-ready parameters
-- Version: 1.0.0

-- Clear existing data (for development only - remove in production)
-- DELETE FROM rule_execution_log;
-- DELETE FROM rule_overrides;
-- DELETE FROM detection_rules;

-- Rule 1: CPT Concentration Analysis
INSERT INTO detection_rules (
  rule_id,
  rule_name,
  category,
  enabled,
  version,
  parameters,
  thresholds,
  weight,
  description
) VALUES (
  'cpt_concentration_001',
  'CPT Code Concentration Analysis',
  'provider_cpt',
  true,
  '1.0.0',
  '{
    "concentration_threshold": 30,
    "deviation_multiplier": 2.0,
    "min_claim_count": 20,
    "top_n_codes": 5
  }'::jsonb,
  '{
    "flag_threshold": 40,
    "high_priority_threshold": 70,
    "medium_priority_threshold": 50
  }'::jsonb,
  1.5,
  'Detects providers who concentrate billing on specific CPT codes beyond specialty norms. High concentration may indicate template billing or limited scope of practice fraud.'
);

-- Rule 2: CPT Upcoding Detection
INSERT INTO detection_rules (
  rule_id,
  rule_name,
  category,
  enabled,
  version,
  parameters,
  thresholds,
  weight,
  description
) VALUES (
  'cpt_upcoding_001',
  'CPT Upcoding Pattern Detection',
  'provider_cpt',
  true,
  '1.0.0',
  '{
    "complexity_threshold": 0.7,
    "peer_deviation_threshold": 2.5,
    "min_sample_size": 30,
    "focus_codes": ["99213", "99214", "99215"]
  }'::jsonb,
  '{
    "flag_threshold": 50,
    "high_priority_threshold": 75,
    "medium_priority_threshold": 60
  }'::jsonb,
  2.0,
  'Identifies systematic upcoding of E&M visits to higher complexity levels (e.g., billing 99215 instead of 99213). Compares provider distribution to specialty peers.'
);

-- Rule 3: Qualitative Red Flag Detection
INSERT INTO detection_rules (
  rule_id,
  rule_name,
  category,
  enabled,
  version,
  parameters,
  thresholds,
  weight,
  description
) VALUES (
  'red_flag_001',
  'Qualitative Red Flag Detection',
  'severity_weighted',
  true,
  '1.0.0',
  '{
    "modifier25_abuse_threshold": 0.8,
    "duplicate_claims_threshold": 10,
    "impossible_pattern_threshold": 1,
    "auto_escalate": true
  }'::jsonb,
  '{
    "flag_threshold": 100,
    "high_priority_threshold": 100,
    "medium_priority_threshold": 75
  }'::jsonb,
  10.0,
  'Detects critical qualitative violations that automatically escalate to HIGH priority: excessive modifier 25 usage (>80%), duplicate claims, medically impossible patterns. These override other scoring.'
);

-- Rule 4: Dollar Exposure Analysis
INSERT INTO detection_rules (
  rule_id,
  rule_name,
  category,
  enabled,
  version,
  parameters,
  thresholds,
  weight,
  description
) VALUES (
  'dollar_exposure_001',
  'High Dollar Exposure Flagging',
  'dollar_weighted',
  true,
  '1.0.0',
  '{
    "high_exposure_threshold": 50000,
    "medium_exposure_threshold": 25000,
    "exposure_multiplier": 1.5,
    "include_flagged_only": true
  }'::jsonb,
  '{
    "flag_threshold": 25000,
    "high_priority_threshold": 50000,
    "medium_priority_threshold": 35000
  }'::jsonb,
  1.8,
  'Prioritizes cases based on total dollar amount at risk. High-exposure cases (>$50K) receive elevated priority even with moderate anomaly scores. Ensures ROI-positive investigations.'
);

-- Rule 5: Investigation ROI Calculator
INSERT INTO detection_rules (
  rule_id,
  rule_name,
  category,
  enabled,
  version,
  parameters,
  thresholds,
  weight,
  description
) VALUES (
  'roi_calculator_001',
  'Investigation ROI Prioritization',
  'roi_based',
  true,
  '1.0.0',
  '{
    "avg_investigation_cost": 2500,
    "recovery_rate_default": 0.65,
    "min_roi_ratio": 3.0,
    "confidence_weight": 0.3
  }'::jsonb,
  '{
    "flag_threshold": 5000,
    "high_priority_threshold": 15000,
    "medium_priority_threshold": 10000
  }'::jsonb,
  2.5,
  'Calculates expected value of investigation: (estimated_overpayment × recovery_likelihood) / investigation_cost. Prioritizes cases with ROI > 3:1 to ensure efficient resource allocation.'
);

-- Example: Specialty-specific override for Dermatology
INSERT INTO rule_overrides (
  rule_id,
  specialty,
  enabled_override,
  parameters_override,
  reason,
  created_by
) VALUES (
  'cpt_concentration_001',
  'Dermatology',
  true,
  '{
    "concentration_threshold": 40,
    "deviation_multiplier": 2.5
  }'::jsonb,
  'Dermatology naturally has higher CPT concentration due to common procedures (biopsies, excisions). Adjusted threshold to reduce false positives.',
  'system'
);

-- Verify seeded data
SELECT 
  rule_id,
  rule_name,
  category,
  enabled,
  weight,
  (parameters->>'concentration_threshold') as sample_param
FROM detection_rules
ORDER BY weight DESC;