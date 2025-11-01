/**
 * Explainability Engine
 * 
 * Generates human-readable narratives and explanations for FWA leads
 */

import { AnomalyMetric, LeadNarrative, TopDriver } from '@/types';

// ============================================================================
// METRIC NAME FORMATTING
// ============================================================================

const METRIC_DESCRIPTIONS: Record<string, string> = {
  'duplicate_hash_cluster': 'Duplicate Claims',
  'round_number_cluster': 'Round Number Clustering',
  'holiday_weekend_concentration': 'Holiday/Weekend Concentration',
  'burstiness_spike': 'Claim Volume Spikes',
  'benford_deviation': 'Benford\'s Law Deviation',
  'high_concentration': 'High Amount Concentration',
  'peer_outlier_high': 'Peer Outlier (High)',
  'claim_splitting': 'Claim Splitting Pattern',
  'anchoring': 'Repeated Identical Amounts',
  'change_point_up': 'Sudden Step-Up in Amounts',
  'gradual_drift_median': 'Gradual Drift (Median)',
  'gradual_drift_variance': 'Gradual Drift (Variance)',
  'emerging_round_number': 'Emerging Round-Number Pattern',
  'emerging_dispersion': 'Emerging Dispersion Increase',
};

// ============================================================================
// NARRATIVE GENERATION
// ============================================================================

function formatPercentile(percentile: number): string {
  if (percentile >= 99) return 'top 1%';
  if (percentile >= 95) return 'top 5%';
  if (percentile >= 90) return 'top 10%';
  if (percentile >= 75) return 'top 25%';
  return `${Math.round(percentile)}th percentile`;
}

function formatAmount(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function generateNarrative(
  providerId: string,
  topMetrics: AnomalyMetric[],
  claimCount: number,
  analysisWindowStart: Date,
  analysisWindowEnd: Date
): LeadNarrative {
  const timeframe = `${analysisWindowStart.toLocaleDateString()} - ${analysisWindowEnd.toLocaleDateString()}`;
  
  // Summary
  const tierLabels = ['hard rules', 'statistical tests', 'behavioral patterns', 'watchlist criteria'];
  const tiers = [...new Set(topMetrics.map(m => m.tier))].sort();
  const tierText = tiers.map(t => tierLabels[t - 1]).join(' and ');
  
  const summary = `Provider ${providerId} was flagged based on ${tierText} during the analysis period. The provider submitted ${claimCount} claims that exhibited ${topMetrics.length} distinct anomaly patterns.`;
  
  // Top metrics list
  const topMetricsList = topMetrics.slice(0, 3).map(m => {
    const description = METRIC_DESCRIPTIONS[m.anomalyTag] || m.metricName;
    const percentileText = formatPercentile(m.peerPercentile);
    return `${description} (${percentileText} vs peers)`;
  });
  
  // Comparison
  const primaryMetric = topMetrics[0];
  const comparisonParts = [];
  
  if (primaryMetric) {
    const metricDesc = METRIC_DESCRIPTIONS[primaryMetric.anomalyTag] || primaryMetric.metricName;
    
    if (primaryMetric.metricName.includes('Rate') || primaryMetric.metricName.includes('Percentage')) {
      comparisonParts.push(
        `${metricDesc}: ${formatPercentage(primaryMetric.providerValue)} (baseline: ${formatPercentage(primaryMetric.baseline)})`
      );
    } else if (primaryMetric.metricName.includes('Amount')) {
      comparisonParts.push(
        `${metricDesc}: ${formatAmount(primaryMetric.providerValue)} (baseline: ${formatAmount(primaryMetric.baseline)})`
      );
    } else {
      comparisonParts.push(
        `${metricDesc}: ${primaryMetric.providerValue.toFixed(2)} (baseline: ${primaryMetric.baseline.toFixed(2)})`
      );
    }
    
    comparisonParts.push(
      `This places the provider in the ${formatPercentile(primaryMetric.peerPercentile)} among peer providers.`
    );
  }
  
  const comparison = comparisonParts.join(' ');
  
  // Evidence
  const evidenceText = `Analysis reviewed ${claimCount} claim${claimCount !== 1 ? 's' : ''} submitted during the ${Math.ceil((analysisWindowEnd.getTime() - analysisWindowStart.getTime()) / (1000 * 60 * 60 * 24))}-day period. ${topMetrics.length} anomaly pattern${topMetrics.length !== 1 ? 's were' : ' was'} detected across ${new Set(topMetrics.map(m => m.tier)).size} tier${new Set(topMetrics.map(m => m.tier)).size !== 1 ? 's' : ''}.`;
  
  return {
    summary,
    timeframe,
    topMetrics: topMetricsList,
    comparison,
    evidence: evidenceText,
  };
}

// ============================================================================
// TOP DRIVERS FORMATTING
// ============================================================================

function interpretMetric(metric: AnomalyMetric): string {
  const percentileText = formatPercentile(metric.peerPercentile);
  const deviation = ((metric.providerValue - metric.baseline) / metric.baseline) * 100;
  const deviationText = deviation > 0 ? `${deviation.toFixed(0)}% higher` : `${Math.abs(deviation).toFixed(0)}% lower`;
  
  const tierLabels = ['Hard Rule', 'Statistical', 'Behavioral', 'Watchlist'];
  const tierLabel = tierLabels[metric.tier - 1];
  
  return `${METRIC_DESCRIPTIONS[metric.anomalyTag] || metric.metricName} - ${deviationText} than baseline, ${percentileText} among peers. [${tierLabel} violation]`;
}

export function formatTopDrivers(metrics: AnomalyMetric[]): TopDriver[] {
  return metrics.map(metric => ({
    metric: METRIC_DESCRIPTIONS[metric.anomalyTag] || metric.metricName,
    providerValue: metric.providerValue,
    baseline: metric.baseline,
    peerPercentile: metric.peerPercentile,
    pValue: metric.pValue,
    effectSize: metric.effectSize,
    sampleN: metric.sampleN,
    interpretation: interpretMetric(metric),
  }));
}

// ============================================================================
// ANOMALY TAGS STANDARDIZATION
// ============================================================================

export function extractAnomalyTags(
  tier1Metrics: AnomalyMetric[],
  tier2Metrics: AnomalyMetric[],
  tier3Metrics: AnomalyMetric[],
  tier4Metrics: AnomalyMetric[]
): string[] {
  const allMetrics = [...tier1Metrics, ...tier2Metrics, ...tier3Metrics, ...tier4Metrics];
  return [...new Set(allMetrics.map(m => m.anomalyTag))];
}

// ============================================================================
// PEER PERCENTILES FORMATTING
// ============================================================================

export function formatPeerPercentiles(metrics: AnomalyMetric[]): Record<string, number> {
  const percentiles: Record<string, number> = {};
  
  metrics.forEach(metric => {
    const key = METRIC_DESCRIPTIONS[metric.anomalyTag] || metric.metricName;
    percentiles[key] = metric.peerPercentile;
  });
  
  return percentiles;
}
