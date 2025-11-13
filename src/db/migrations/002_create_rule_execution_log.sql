-- Migration: Create rule_execution_log table
-- Purpose: Audit trail for all rule executions
-- Version: 1.0.0

CREATE TABLE IF NOT EXISTS rule_execution_log (
  log_id BIGSERIAL PRIMARY KEY,
  rule_id VARCHAR(50) NOT NULL,
  provider_id VARCHAR(50) NOT NULL,
  
  -- Execution metadata
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  execution_time_ms INTEGER NOT NULL,
  
  -- Result data
  triggered BOOLEAN NOT NULL,
  score DECIMAL(5,2),
  confidence DECIMAL(3,2),
  
  -- Evidence and impact
  evidence JSONB DEFAULT '[]',
  flagged_claim_count INTEGER DEFAULT 0,
  flagged_claim_ids TEXT[], -- Array of claim IDs
  dollar_impact DECIMAL(12,2) DEFAULT 0,
  
  -- Additional context
  metadata JSONB DEFAULT '{}',
  
  -- Error handling
  success BOOLEAN DEFAULT true NOT NULL,
  error_message TEXT,
  error_stack TEXT,
  
  -- Foreign key
  CONSTRAINT fk_rule FOREIGN KEY (rule_id) 
    REFERENCES detection_rules(rule_id) 
    ON DELETE CASCADE
);

-- Indexes for querying
CREATE INDEX idx_log_rule_id ON rule_execution_log(rule_id);
CREATE INDEX idx_log_provider_id ON rule_execution_log(provider_id);
CREATE INDEX idx_log_executed_at ON rule_execution_log(executed_at DESC);
CREATE INDEX idx_log_triggered ON rule_execution_log(triggered) WHERE triggered = true;
CREATE INDEX idx_log_success ON rule_execution_log(success) WHERE success = false;

-- Composite index for common queries
CREATE INDEX idx_log_rule_provider_date ON rule_execution_log(rule_id, provider_id, executed_at DESC);

-- Partition by date for performance (optional - for high volume)
-- This can be enabled later if log volume becomes large
-- CREATE TABLE rule_execution_log_2025_01 PARTITION OF rule_execution_log
-- FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Comments
COMMENT ON TABLE rule_execution_log IS 'Audit log of all detection rule executions with results and performance metrics';
COMMENT ON COLUMN rule_execution_log.evidence IS 'JSON array of evidence objects showing what was detected';
COMMENT ON COLUMN rule_execution_log.metadata IS 'Additional context like specialty, region, rule parameters used';
COMMENT ON COLUMN rule_execution_log.flagged_claim_ids IS 'Array of specific claim IDs that triggered this rule';