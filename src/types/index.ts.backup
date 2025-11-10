// ============================================================================
// CORE DATA TYPES
// ============================================================================

export interface ClaimData {
  claim_id: string;
  provider_id: string;
  service_date: Date | string;
  billed_amount: number;
  
  // Optional fields
  paid_amount?: number;
  member_id?: string;
  provider_zip?: string;
  place_of_service?: string;
  service_description?: string;
}

export interface ClaimWithHash extends ClaimData {
  claim_hash: string;
  service_date: Date;
}

// ============================================================================
// DETECTION TYPES
// ============================================================================

export interface DetectionConfig {
  // Tier 1 thresholds
  roundNumberThreshold: number;        // % of .00 amounts to flag
  holidayConcentrationThreshold: number;
  
  // Tier 2 thresholds
  zScoreThreshold: number;             // For burstiness detection
  benfordMinSampleSize: number;        // Minimum claims for Benford test
  benfordPValueThreshold: number;
  peerOutlierPercentile: number;       // Top X% vs peers
  
  // Tier 3 thresholds
  claimSplittingWindowDays: number;
  anchoringMinRepeats: number;
  changePointMinMagnitude: number;
  
  // Tier 4 thresholds
  driftThreshold: number;
  
  // Peer grouping
  minClusterSize: number;              // Minimum providers per cluster
  
  // Scoring
  threshold_high: number;              // Score threshold for HIGH priority
  threshold_medium: number;            // Score threshold for MEDIUM priority
  
  // Persistence
  persistenceRunsRequired: number;     // Runs before escalation
  quietRunsRequired: number;           // Quiet runs before de-escalation
}

export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  roundNumberThreshold: 0.5,
  holidayConcentrationThreshold: 2.0,
  zScoreThreshold: 3.0,
  benfordMinSampleSize: 300,
  benfordPValueThreshold: 0.01,
  peerOutlierPercentile: 2.5,
  claimSplittingWindowDays: 7,
  anchoringMinRepeats: 10,
  changePointMinMagnitude: 0.3,
  driftThreshold: 0.15,
  minClusterSize: 20,
  threshold_high: 70,
  threshold_medium: 50,
  persistenceRunsRequired: 2,
  quietRunsRequired: 2,
};

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
  interpretation: string; // Human-readable description
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
  monthlyPattern: number[]; // 12 values for seasonality
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
  trendChart: string; // Base64 image
  distributionChart: string; // Base64 image
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
