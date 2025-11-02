export interface Claim {
  claim_id: string;
  provider_id: string;
  member_id?: string;
  service_date: string;
  billed_amount: string;
  paid_amount?: string;
  cpt_hcpcs: string;
  cpt_description?: string;
  modifiers?: string;
  place_of_service?: string;
  diagnosis_code?: string;
}

export interface DetectionConfig {
  roundNumberThreshold: number;
  zScoreThreshold: number;
  benfordMinSampleSize: number;
  threshold_high: number;
  threshold_medium: number;
}

export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  roundNumberThreshold: 0.5,        // 50%
  zScoreThreshold: 3.0,             // 3σ
  benfordMinSampleSize: 100,        // Min for statistical validity
  threshold_high: 60,               // HIGH cutoff
  threshold_medium: 45,             // MEDIUM cutoff
};
