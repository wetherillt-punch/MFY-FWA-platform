/**
 * Detection Orchestrator
 * 
 * Main engine that coordinates all detection tiers and produces FWA leads
 */

import { ClaimData, ClaimWithHash, DetectionConfig, ProviderAnomalyResult, DEFAULT_DETECTION_CONFIG } from '@/types';
import { generateClaimHash } from './tier1';
import { detectTier1Anomalies } from './tier1';
import { detectTier2Anomalies } from './tier2';
import { detectTier3Anomalies } from './tier3';
import { detectTier4Anomalies } from './tier4';
import { scoreProvider, extractTopDrivers } from '../scoring';
import { generateNarrative, formatTopDrivers, extractAnomalyTags, formatPeerPercentiles } from '../explainability';

export async function runDetection(
  claims: ClaimData[],
  config: DetectionConfig = DEFAULT_DETECTION_CONFIG
): Promise<ProviderAnomalyResult[]> {
  
  // Add hashes to claims
  const claimsWithHash: ClaimWithHash[] = claims.map(claim => ({
    ...claim,
    service_date: typeof claim.service_date === 'string' ? new Date(claim.service_date) : claim.service_date,
    claim_hash: '',
  })).map(claim => ({
    ...claim,
    claim_hash: generateClaimHash(claim),
  }));
  
  // Get unique providers
  const providerIds = [...new Set(claimsWithHash.map(c => c.provider_id))];
  console.log(`Analyzing ${providerIds.length} providers with ${claimsWithHash.length} claims`);
  
  const results: ProviderAnomalyResult[] = [];
  
  // Analyze each provider
  for (const providerId of providerIds) {
    const providerClaims = claimsWithHash.filter(c => c.provider_id === providerId);
    
    if (providerClaims.length < 5) continue; // Skip providers with too few claims
    
    // Run all detection tiers
    const tier1Metrics = detectTier1Anomalies(claimsWithHash, providerId, config);
    const tier2Metrics = detectTier2Anomalies(claimsWithHash, providerId, providerIds, config);
    const tier3Metrics = detectTier3Anomalies(claimsWithHash, providerId, config);
    const tier4Metrics = detectTier4Anomalies(claimsWithHash, providerId, config);
    
    // Skip if no anomalies detected
    const totalAnomalies = tier1Metrics.length + tier2Metrics.length + tier3Metrics.length + tier4Metrics.length;
    if (totalAnomalies === 0) continue;
    
    // Get flagged claim IDs
    const flaggedClaimIds = providerClaims.map(c => c.claim_id);
    
    // Score the provider
    const scored = scoreProvider(
      providerId,
      tier1Metrics,
      tier2Metrics,
      tier3Metrics,
      tier4Metrics,
      providerClaims.length,
      flaggedClaimIds,
      config
    );
    
    // Get analysis window
    const dates = providerClaims.map(c => c.service_date.getTime());
    const analysisWindowStart = new Date(Math.min(...dates));
    const analysisWindowEnd = new Date(Math.max(...dates));
    
    // Get top drivers
    const allMetrics = [...tier1Metrics, ...tier2Metrics, ...tier3Metrics, ...tier4Metrics];
    const topDriverMetrics = extractTopDrivers(allMetrics, 5);
    
    // Generate narrative
    const narrative = generateNarrative(
      providerId,
      topDriverMetrics,
      providerClaims.length,
      analysisWindowStart,
      analysisWindowEnd
    );
    
    // Format peer percentiles
    const peerPercentiles = formatPeerPercentiles(allMetrics);
    
    // Create result
    const result: ProviderAnomalyResult = {
      ...scored as any,
      clusterId: 'C-GLOBAL', // TODO: Implement clustering
      peerPercentiles,
      trendData: [], // TODO: Generate trend data
      distributionData: [], // TODO: Generate distribution
    };
    
    results.push(result);
  }
  
  // Sort by overall score descending
  results.sort((a, b) => b.overallScore - a.overallScore);
  
  console.log(`Generated ${results.length} FWA leads`);
  
  return results;
}
