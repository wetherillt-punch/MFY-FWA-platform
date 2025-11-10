export interface DMEAnomaly {
  rule_id: string;
  rule_name: string;
  tier: 'A' | 'B' | 'C';
  severity: 'high' | 'medium' | 'low';
  description: string;
  evidence: {
    affected_members: number;
    affected_claims: number;
    total_exposure: number;
    violation_rate: string;
    expected_threshold: string;
    peer_percentile?: number;
    exemplar_claims: any[];
  };
  weight: number;
}

export interface RefillAnalysis {
  member_id: string;
  refills: {
    service_date: string;
    cpt_hcpcs: string;
    days_gap: number;
    expected_days: number;
    violation: boolean;
  }[];
}

export interface DMEProductFamily {
  family: string;
  codes: string[];
  expected_days_supply: number;
  lcd_limit: string;
}

export const DME_FAMILIES: DMEProductFamily[] = [
  {
    family: 'CPAP Supplies',
    codes: ['A7030', 'A7031', 'A7032', 'A7033', 'A7034', 'A7035', 'A7036', 'A7037', 'A7038', 'A7039'],
    expected_days_supply: 30,
    lcd_limit: '1-2 per month depending on item'
  },
  {
    family: 'Diabetes Testing',
    codes: ['A4253', 'A4259'],
    expected_days_supply: 30,
    lcd_limit: '100-300 strips per month'
  },
  {
    family: 'CPAP Machine',
    codes: ['E0601'],
    expected_days_supply: 0, // Rental, not supply
    lcd_limit: '13 months rental cap'
  }
];
