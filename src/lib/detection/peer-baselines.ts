import { Claim } from '@/types/detection';

export interface PeerBaseline {
  metric: string;
  providerValue: number;
  peerMedian: number;
  peerP75: number;
  peerP95: number;
  percentile: number;
  isOutlier: boolean;
}

export function calculatePeerBaselines(
  providerId: string,
  allClaims: Claim[],
  allProviders: string[]
): PeerBaseline[] {
  const baselines: PeerBaseline[] = [];

  // 1. Claims per month
  const claimsPerMonthBaseline = calculateMetricBaseline(
    allProviders,
    allClaims,
    providerId,
    (claims) => claims.length / 3 // Assuming 3 months
  );
  baselines.push({
    metric: 'Claims per Month',
    ...claimsPerMonthBaseline
  });

  // 2. Average claim amount
  const avgAmountBaseline = calculateMetricBaseline(
    allProviders,
    allClaims,
    providerId,
    (claims) => {
      const amounts = claims.map(c => parseFloat(c.billed_amount || '0'));
      return amounts.reduce((a, b) => a + b, 0) / amounts.length;
    }
  );
  baselines.push({
    metric: 'Average Claim Amount',
    ...avgAmountBaseline
  });

  // 3. Round number percentage
  const roundPctBaseline = calculateMetricBaseline(
    allProviders,
    allClaims,
    providerId,
    (claims) => {
      const amounts = claims.map(c => parseFloat(c.billed_amount || '0'));
      const roundCount = amounts.filter(a => a % 100 === 0).length;
      return (roundCount / amounts.length) * 100;
    }
  );
  baselines.push({
    metric: 'Round Number %',
    ...roundPctBaseline
  });

  // 4. Weekend concentration
  const weekendBaseline = calculateMetricBaseline(
    allProviders,
    allClaims,
    providerId,
    (claims) => {
      const weekendCount = claims.filter(c => {
        const day = new Date(c.service_date).getDay();
        return day === 0 || day === 6;
      }).length;
      return (weekendCount / claims.length) * 100;
    }
  );
  baselines.push({
    metric: 'Weekend Claims %',
    ...weekendBaseline
  });

  // 5. Modifier-59 usage
  const mod59Baseline = calculateMetricBaseline(
    allProviders,
    allClaims,
    providerId,
    (claims) => {
      const mod59Count = claims.filter(c => c.modifiers?.includes('59')).length;
      return (mod59Count / claims.length) * 100;
    }
  );
  baselines.push({
    metric: 'Modifier-59 Usage %',
    ...mod59Baseline
  });

  return baselines;
}

function calculateMetricBaseline(
  allProviders: string[],
  allClaims: Claim[],
  targetProviderId: string,
  metricFn: (claims: Claim[]) => number
): Omit<PeerBaseline, 'metric'> {
  // Calculate metric for all providers
  const providerValues = allProviders.map(pid => {
    const claims = allClaims.filter(c => c.provider_id === pid);
    return {
      providerId: pid,
      value: claims.length > 0 ? metricFn(claims) : 0
    };
  });

  const targetValue = providerValues.find(p => p.providerId === targetProviderId)?.value || 0;
  const values = providerValues.map(p => p.value).sort((a, b) => a - b);

  const median = values[Math.floor(values.length / 2)];
  const p75 = values[Math.floor(values.length * 0.75)];
  const p95 = values[Math.floor(values.length * 0.95)];
  
  const percentile = (values.filter(v => v < targetValue).length / values.length) * 100;

  return {
    providerValue: Math.round(targetValue * 100) / 100,
    peerMedian: Math.round(median * 100) / 100,
    peerP75: Math.round(p75 * 100) / 100,
    peerP95: Math.round(p95 * 100) / 100,
    percentile: Math.round(percentile),
    isOutlier: percentile > 95
  };
}
