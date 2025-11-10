// ============================================================================
// DETECTION CONFIGURATION TYPES
// ============================================================================

export interface DetectionConfig {
  // Tier 1: Hard Rules
  duplicateThreshold: number;
  roundNumberThreshold: number;
  holidayMultiplier: number;
  
  // Tier 2: Statistical Outliers
  zScoreThreshold: number;
  benfordMinSampleSize: number;
  benfordChiSquareAlpha: number;
  giniThreshold: number;
  peerOutlierPercentile: number;
  
  // Tier 3: Behavioral Patterns
  claimSplittingMinCount: number;
  anchoringMinRepeats: number;
  changePointMinJump: number;
  modifier25Threshold: number;
  
  // Tier 4: Watchlist
  driftThreshold: number;
  minSampleSize: number;
  trendSignificance: number;
  
  // Scoring Thresholds
  threshold_high: number;
  threshold_medium: number;
  threshold_watchlist: number;
  minScore: number;
  
  // Filtering (NEW)
  minClaimsForDetection: number;
  suppressTier4Only: boolean;
  
  // Weights (NEW)
  tier1Weight: number;
  tier2Weight: number;
  tier3Weight: number;
  tier4Weight: number;
}

export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  // Tier 1: Hard Rules (Critical Violations)
  duplicateThreshold: 2,
  roundNumberThreshold: 0.6,
  holidayMultiplier: 2.5,
  
  // Tier 2: Statistical Outliers (Peer Comparison)
  zScoreThreshold: 3.5,
  benfordMinSampleSize: 300,
  benfordChiSquareAlpha: 0.01,
  giniThreshold: 0.85,
  peerOutlierPercentile: 98,
  
  // Tier 3: Behavioral Patterns (Clinical Abuse)
  claimSplittingMinCount: 8,
  anchoringMinRepeats: 15,
  changePointMinJump: 0.6,
  modifier25Threshold: 0.12,
  
  // Tier 4: Watchlist (Gradual Drift)
  driftThreshold: 0.35,
  minSampleSize: 50,
  trendSignificance: 0.01,
  
  // Scoring Thresholds
  threshold_high: 75,
  threshold_medium: 55,
  threshold_watchlist: 45,
  minScore: 40,
  
  // Filtering
  minClaimsForDetection: 30,
  suppressTier4Only: true,
  
  // Weights
  tier1Weight: 1.0,
  tier2Weight: 0.8,
  tier3Weight: 0.6,
  tier4Weight: 0.3,
};

// ============================================================================
// CLAIM DATA TYPES
// ============================================================================

export interface ClaimData {
  claim_id: string;
  provider_id: string;
  member_id: string;
  service_date: Date;
  billed_date?: Date;
  paid_date?: Date;
  place_of_service: string;
  cpt_hcpcs?: string;
  modifiers?: string;
  billed_amount: number;
  paid_amount?: number;
  claim_type?: string;
  serial_number?: string;
  paid_status?: string;
}

export type Claim = ClaimData;

export interface ClaimWithHash extends ClaimData {
  claim_hash: string;
}

// ============================================================================
// ANOMALY DETECTION RESULTS
// ============================================================================

export interface AnomalyMetric {
  metricName: string;
  providerValue: number;
  baseline: number;
  peerPercentile: number;
  pValue?: number;
  effectSize?: number;
  sampleN: number;
  tier: 1 | 2 | 3 | 4;
  anomalyTag: string;
  flaggedClaimIds?: string[];  // ✅ ADD THIS LINE
  flaggedClaims?: any[];       // ✅ ADD THIS LINE (for actual claim data)
}

export interface ProviderAnomalyResult {
  provider_id: string;
  
  // Tier results
  tier1Metrics: AnomalyMetric[];
  tier2Metrics: AnomalyMetric[];
  tier3Metrics: AnomalyMetric[];
  tier4Metrics: AnomalyMetric[];
  
  // Scores
  tier1Score: number;
  tier2Score: number;
  tier3Score: number;
  tier4Score: number;
  overallScore: number;
  
  // Priority
  priority: 'HIGH' | 'MEDIUM' | 'WATCHLIST';
  
  // Evidence
  claimCount: number;
  flaggedClaimIds: string[];
  
  // Peer context
  clusterId: string;
  peerPercentiles: Record<string, number>;
  
  // Trends
  trendData: TrendPoint[];
  distributionData: DistributionBucket[];
}

export interface TrendPoint {
  date: string;
  value: number;
  label?: string;
}

export interface DistributionBucket {
  bucket: string;
  count: number;
  percentage: number;
}

// ============================================================================
// EXPLAINABILITY TYPES
// ============================================================================

export interface TopDriver {
  metric: string;
  providerValue: number;
  baseline: number;
  peerPercentile: number;
  pValue?: number;
  effectSize?: number;
  sampleN: number;
  interpretation: string;
}

export interface LeadNarrative {
  summary: string;
  timeframe: string;
  topMetrics: string[];
  comparison: string;
  evidence: string;
}

// ============================================================================
// PEER CLUSTERING TYPES
// ============================================================================

export interface ProviderFeatures {
  provider_id: string;
  claimCount: number;
  avgBilledAmount: number;
  medianBilledAmount: number;
  variance: number;
  burstiness: number;
  roundNumberShare: number;
  benfordDeviation: number;
  weekendShare: number;
  monthlyPattern: number[];
}

export interface ClusterResult {
  clusterId: string;
  providers: string[];
  centroid: ProviderFeatures;
  baselineMetrics: Record<string, number>;
}

// ============================================================================
// DATA QUALITY TYPES
// ============================================================================

export interface DataQualityReport {
  totalRows: number;
  validRows: number;
  
  issues: {
    nullClaimIds: number;
    nullProviderIds: number;
    nullServiceDates: number;
    nullBilledAmounts: number;
    impossibleDates: number;
    negativeAmounts: number;
    zeroAmounts: number;
    duplicateClaimIds: number;
  };
  
  rates: {
    nullRate: number;
    duplicateRate: number;
    invalidDateRate: number;
    qualityScore: number;
  };
  
  passed: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

export interface PDFExportData {
  leadId: string;
  providerId: string;
  overallScore: number;
  priority: string;
  narrative: LeadNarrative;
  topDrivers: TopDriver[];
  trendChart: string;
  distributionChart: string;
  peerPercentiles: Record<string, number>;
  claims: ClaimData[];
  runId: string;
  timestamp: Date;
}

export interface CSVExportBundle {
  claimsCSV: string;
  leadJSON: string;
}

// ============================================================================
// API TYPES
// ============================================================================

export interface IngestRequest {
  fileName?: string;
  claims: ClaimData[];
}

export interface IngestResponse {
  datasetId: string;
  datasetHash: string;
  qualityReport: DataQualityReport;
  message: string;
}

export interface DetectRequest {
  datasetId: string;
  config?: Partial<DetectionConfig>;
}

export interface DetectResponse {
  runId: string;
  leadCount: number;
  highPriorityCount: number;
  mediumPriorityCount: number;
  watchlistCount: number;
  leads: ProviderAnomalyResult[];
}

export interface LeadDetailResponse {
  lead: ProviderAnomalyResult;
  narrative: LeadNarrative;
  topDrivers: TopDriver[];
  provenance: ProvenanceData;
}

export interface ProvenanceData {
  datasetHash: string;
  runId: string;
  codeVersion: string;
  modelVersion: string;
  clusterVersion: string;
  timestamp: Date;
}

// ============================================================================
// SYNTHETIC DATA TYPES
// ============================================================================

export interface SyntheticAnomalyConfig {
  type: 'round_number_storm' | 'duplicate_burst' | 'single_month_spike' | 'gradual_drift';
  intensity: 'low' | 'medium' | 'high';
  startDate: Date;
  durationDays: number;
}

export interface SyntheticDatasetConfig {
  normalProvidersCount: number;
  anomalousProvidersCount: number;
  claimsPerProvider: { min: number; max: number };
  dateRange: { start: Date; end: Date };
  anomalies: SyntheticAnomalyConfig[];
}
