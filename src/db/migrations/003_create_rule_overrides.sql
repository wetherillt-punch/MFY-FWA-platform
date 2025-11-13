-- Migration: Create rule_overrides table
-- Purpose: Allow specialty/region-specific rule configuration
-- Version: 1.0.0

CREATE TABLE IF NOT EXISTS rule_overrides (
  override_id SERIAL PRIMARY KEY,
  rule_id VARCHAR(50) NOT NULL,
  
  -- Override conditions (at least one must be specified)
  specialty VARCHAR(100),
  region VARCHAR(50),
  provider_type VARCHAR(50),
  
  -- Override values (NULL means no override for that field)
  enabled_override BOOLEAN,
  parameters_override JSONB,
  thresholds_override JSONB,
  weight_override DECIMAL(5,2),
  
  -- Metadata
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_by VARCHAR(100),
  reason TEXT,
  
  -- Foreign key
  CONSTRAINT fk_rule_override FOREIGN KEY (rule_id) 
    REFERENCES detection_rules(rule_id) 
    ON DELETE CASCADE,
    
  -- Validation
  CONSTRAINT valid_weight_override CHECK (
    weight_override IS NULL OR 
    (weight_override >= 0 AND weight_override <= 10)
  ),
  CONSTRAINT has_condition CHECK (
    specialty IS NOT NULL OR 
    region IS NOT NULL OR 
    provider_type IS NOT NULL
  )
);

-- Indexes
CREATE INDEX idx_overrides_rule_id ON rule_overrides(rule_id);
CREATE INDEX idx_overrides_specialty ON rule_overrides(specialty) WHERE specialty IS NOT NULL;
CREATE INDEX idx_overrides_region ON rule_overrides(region) WHERE region IS NOT NULL;
CREATE INDEX idx_overrides_active ON rule_overrides(active) WHERE active = true;

-- Comments
COMMENT ON TABLE rule_overrides IS 'Specialty/region-specific overrides for detection rules';
COMMENT ON COLUMN rule_overrides.specialty IS 'Medical specialty (e.g., Cardiology, Dermatology)';
COMMENT ON COLUMN rule_overrides.region IS 'Geographic region (e.g., Northeast, West Coast)';
COMMENT ON COLUMN rule_overrides.provider_type IS 'Provider classification (e.g., Hospital, Clinic, Individual)';
COMMENT ON COLUMN rule_overrides.reason IS 'Business justification for this override';