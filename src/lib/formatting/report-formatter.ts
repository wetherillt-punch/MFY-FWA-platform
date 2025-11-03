/**
 * Deterministic formatting functions for consistent report display
 * Separates AI reasoning from presentation logic
 */

export function formatDeviation(deviation: number): string {
  if (deviation === 0) return '0%';
  if (deviation > 0) return `+${deviation}%`;
  return `${deviation}%`; // Already has minus sign
}

export function formatPercentagePoints(pp: number): string {
  if (pp === 0) return '0pp';
  if (pp > 0) return `+${pp}pp`;
  return `${pp}pp`;
}

export function formatCurrency(amount: number): string {
  // Always format as positive - overpayments are liabilities to recover
  const absAmount = Math.abs(amount);
  return `$${absAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatPriority(priority: string): { color: string; label: string } {
  const map: Record<string, { color: string; label: string }> = {
    'IMMEDIATE_INVESTIGATION': { color: 'red', label: 'IMMEDIATE INVESTIGATION' },
    'HIGH_PRIORITY': { color: 'orange', label: 'HIGH PRIORITY' },
    'ROUTINE_MONITORING': { color: 'green', label: 'ROUTINE MONITORING' },
    'WATCHLIST': { color: 'blue', label: 'WATCHLIST' }
  };
  return map[priority] || { color: 'gray', label: priority };
}

export interface ComparativeMetric {
  provider: number;
  peer: number;
  deviation: number;
  formatted_deviation: string;
}

export function formatComparativeMetric(
  provider: number,
  peer: number,
  type: 'percentage' | 'currency' | 'count' = 'count'
): ComparativeMetric {
  const deviation = provider - peer;
  const deviationPercent = peer !== 0 ? ((provider - peer) / peer) * 100 : 0;
  
  return {
    provider,
    peer,
    deviation: Math.round(deviationPercent),
    formatted_deviation: formatDeviation(Math.round(deviationPercent))
  };
}
