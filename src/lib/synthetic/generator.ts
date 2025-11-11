/**
 * Synthetic Data Generator
 * Creates test datasets with known anomalies
 */

import { ClaimData, SyntheticAnomalyConfig } from '@/types';

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomAmount(min: number, max: number, roundProb: number = 0.15): number {
  const amount = min + Math.random() * (max - min);
  // Sometimes make it a round number
  if (Math.random() < roundProb) {
    return Math.round(amount / 100) * 100;
  }
  return Math.round(amount * 100) / 100;
}

// Generate normal provider claims
function generateNormalProvider(
  providerId: string,
  claimCount: number,
  startDate: Date,
  endDate: Date
): ClaimData[] {
  const claims: ClaimData[] = [];
  
  for (let i = 0; i < claimCount; i++) {
    claims.push({
      claim_id: `CLM-${providerId}-${i.toString().padStart(6, '0')}`,
      provider_id: providerId,
      member_id: `MEM-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,      
      service_date: randomDate(startDate, endDate),
      place_of_service: '11',      
      cpt_hcpcs: '99213',
      modifiers: undefined,      
      billed_amount: Math.round(Math.random() * 500 + 50)
    });
  }
  
  return claims;
}

// Generate provider with round number storm
function generateRoundNumberStorm(
  providerId: string,
  claimCount: number,
  startDate: Date,
  endDate: Date,
  intensity: 'low' | 'medium' | 'high'
): ClaimData[] {
  const roundProb = intensity === 'high' ? 0.8 : intensity === 'medium' ? 0.6 : 0.4;
  const claims: ClaimData[] = [];
  
  for (let i = 0; i < claimCount; i++) {
    claims.push({
      claim_id: `CLM-${providerId}-${i.toString().padStart(6, '0')}`,
      provider_id: providerId,
      member_id: `MEM-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,    
      service_date: randomDate(startDate, endDate),
      place_of_service: '11', // Office
      cpt_hcpcs: '99213',
      modifiers: undefined,
      billed_amount: randomAmount(50, 500, roundProb),
    });
  }
  
  return claims;
}

// Generate provider with duplicate burst
function generateDuplicateBurst(
  providerId: string,
  claimCount: number,
  startDate: Date,
  endDate: Date,
  intensity: 'low' | 'medium' | 'high'
): ClaimData[] {
  const dupCount = intensity === 'high' ? 20 : intensity === 'medium' ? 10 : 5;
  const claims: ClaimData[] = [];
  
  // Generate some normal claims
  for (let i = 0; i < claimCount - dupCount; i++) {
    claims.push({
      claim_id: `CLM-${providerId}-${i.toString().padStart(6, '0')}`,
      provider_id: providerId,
      member_id: `MEM-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      service_date: randomDate(startDate, endDate),
      place_of_service: '11', // Office
      cpt_hcpcs: '99213',
      modifiers: undefined,  
      billed_amount: randomAmount(50, 500),
    });
  }
  
  // Add duplicates (same date and amount)
  const dupDate = randomDate(startDate, endDate);
  const dupAmount = 125.00;
  for (let i = 0; i < dupCount; i++) {
    claims.push({
      claim_id: `CLM-${providerId}-DUP-${i.toString().padStart(6, '0')}`,
      provider_id: providerId,
      member_id: `MEM-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      service_date: randomDate(startDate, endDate),
      place_of_service: '11', // Office
      cpt_hcpcs: '99213',
      modifiers: undefined,     
      billed_amount: dupAmount,
    });
  }
  
  return claims;
}

// Generate provider with single month spike
function generateSingleMonthSpike(
  providerId: string,
  claimCount: number,
  startDate: Date,
  endDate: Date,
  intensity: 'low' | 'medium' | 'high'
): ClaimData[] {
  const spikeRatio = intensity === 'high' ? 0.6 : intensity === 'medium' ? 0.4 : 0.3;
  const spikeCount = Math.floor(claimCount * spikeRatio);
  const normalCount = claimCount - spikeCount;
  
  const claims: ClaimData[] = [];
  
  // Normal claims spread across period
  for (let i = 0; i < normalCount; i++) {
    claims.push({
      claim_id: `CLM-${providerId}-${i.toString().padStart(6, '0')}`,
      provider_id: providerId,
      member_id: `MEM-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      service_date: randomDate(startDate, endDate),
      place_of_service: '11', // Office
      cpt_hcpcs: '99213',
      modifiers: undefined,   
      billed_amount: randomAmount(50, 500),
    });
  }
  
  // Spike claims in one week
  const spikeStart = new Date(startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2);
  const spikeEnd = new Date(spikeStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  for (let i = 0; i < spikeCount; i++) {
    claims.push({
      claim_id: `CLM-${providerId}-SPIKE-${i.toString().padStart(6, '0')}`,
      provider_id: providerId,
      member_id: `MEM-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      service_date: randomDate(spikeStart, spikeEnd),
      place_of_service: '11',
      cpt_hcpcs: '99213',
      modifiers: undefined,
      billed_amount: randomAmount(50, 500),
    });
  }
  
  return claims;
}

// Generate provider with gradual drift
function generateGradualDrift(
  providerId: string,
  claimCount: number,
  startDate: Date,
  endDate: Date,
  intensity: 'low' | 'medium' | 'high'
): ClaimData[] {
  const driftFactor = intensity === 'high' ? 2.0 : intensity === 'medium' ? 1.5 : 1.3;
  const claims: ClaimData[] = [];
  
  const periodMs = endDate.getTime() - startDate.getTime();
  
  for (let i = 0; i < claimCount; i++) {
    const progress = i / claimCount;
    const baseAmount = 200;
    const driftedAmount = baseAmount + (baseAmount * (driftFactor - 1) * progress);
    
    claims.push({
      claim_id: `CLM-${providerId}-${i.toString().padStart(6, '0')}`,
      provider_id: providerId,
      member_id: `MEM-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      service_date: randomDate(startDate, endDate),
      place_of_service: '11', // Office
      cpt_hcpcs: '99213',
      modifiers: undefined,
      billed_amount: randomAmount(driftedAmount * 0.8, driftedAmount * 1.2, 0.15),
    });
  }
  
  return claims;
}

// Main generator
export function generateSyntheticDataset(
  normalProvidersCount: number = 100,
  anomalousProvidersCount: number = 10,
  startDate: Date = new Date('2024-01-01'),
  endDate: Date = new Date('2024-12-31')
): ClaimData[] {
  const allClaims: ClaimData[] = [];
  
  // Generate normal providers
  console.log(`Generating ${normalProvidersCount} normal providers...`);
  for (let i = 0; i < normalProvidersCount; i++) {
    const providerId = `PROV-N-${i.toString().padStart(4, '0')}`;
    const claimCount = 30 + Math.floor(Math.random() * 70); // 30-100 claims
    allClaims.push(...generateNormalProvider(providerId, claimCount, startDate, endDate));
  }
  
  // Generate anomalous providers
  console.log(`Generating ${anomalousProvidersCount} anomalous providers...`);
  const anomalyTypes: Array<[string, any]> = [
    ['round_number', generateRoundNumberStorm],
    ['duplicate', generateDuplicateBurst],
    ['spike', generateSingleMonthSpike],
    ['drift', generateGradualDrift],
  ];
  
  for (let i = 0; i < anomalousProvidersCount; i++) {
    const providerId = `PROV-A-${i.toString().padStart(4, '0')}`;
    const claimCount = 50 + Math.floor(Math.random() * 100); // 50-150 claims
    const [type, generator] = anomalyTypes[i % anomalyTypes.length];
    const intensity: 'low' | 'medium' | 'high' = i < 3 ? 'high' : i < 7 ? 'medium' : 'low';
    
    console.log(`  Provider ${providerId}: ${type} (${intensity})`);
    allClaims.push(...generator(providerId, claimCount, startDate, endDate, intensity));
  }
  
  console.log(`Generated ${allClaims.length} total claims`);
  return allClaims;
}
