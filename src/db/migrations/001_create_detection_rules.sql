-- Migration: Create detection_rules table
-- Purpose: Store configuration for all detection rules
-- Version: 1.0.0

CREATE TABLE IF NOT EXISTS detection_rules (
  rule_id VARCHAR(50) PRIMARY KEY,
  rule_name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  enabled BOOLEAN DEFAULT true NOT NULL,
  version VARCHAR(20) NOT NULL,
  
  -- JSON configuration for flexibility
  parameters JSONB NOT NULL DEFAULT '{}',
  thresholds JSONB NOT NULL DEFAULT '{}',
  weight DECIMAL(5,2) NOT NULL DEFAULT 1.0,
  
  -- Metadata
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  last_executed TIMESTAMP,
  
  -- Performance tracking
  execution_count INTEGER DEFAULT 0 NOT NULL,
  avg_execution_time_ms INTEGER DEFAULT 0,
  total_triggers INTEGER DEFAULT 0 NOT NULL,
  success_rate DECIMAL(5,2) DEFAULT 100.0,
  
  -- Validation
  CONSTRAINT valid_category CHECK (
    category IN (
      'provider_cpt', 
      'severity_weighted', 
      'dollar_weighted', 
      'roi_based',
      'temporal_analysis',
      'specialty_specific'
    )
  ),
  CONSTRAINT valid_weight CHECK (weight >= 0 AND weight <= 10),
  CONSTRAINT valid_success_rate CHECK (success_rate >= 0 AND success_rate <= 100)
);

-- Indexes for performance
CREATE INDEX idx_rules_category ON detection_rules(category);
CREATE INDEX idx_rules_enabled ON detection_rules(enabled) WHERE enabled = true;
CREATE INDEX idx_rules_last_executed ON detection_rules(last_executed);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_detection_rules_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_detection_rules_timestamp
BEFORE UPDATE ON detection_rules
FOR EACH ROW
EXECUTE FUNCTION update_detection_rules_timestamp();

-- Comments for documentation
COMMENT ON TABLE detection_rules IS 'Configuration and metadata for all fraud detection rules';
COMMENT ON COLUMN detection_rules.parameters IS 'JSON object containing rule-specific parameters that can be tuned';
COMMENT ON COLUMN detection_rules.thresholds IS 'JSON object containing threshold values (flag, high_priority, medium_priority)';
COMMENT ON COLUMN detection_rules.weight IS 'Multiplier for this rule contribution to overall score (0-10)';
COMMENT ON COLUMN detection_rules.success_rate IS 'Percentage of successful executions (excluding errors/timeouts)';