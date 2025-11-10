import rulesData from './rules.json';

export interface FWARule {
  rule_id: string;
  name: string;
  category: string;
  severity: string;
  weight: number;
  codes_targeted: string[];
  thresholds: any;
  peer_baseline: any;
  detection_signals: string[];
  explain_short: string;
  explain_deep: string;
  investigation_steps: string[];
}

export interface RuleMatch {
  rule_id: string;
  rule_name: string;
  severity: string;
  weight: number;
  confidence: number;
  explanation: string;
  evidence: any;
}

export class FWARuleMatcher {
  private rules: FWARule[];
  private peerBaselines: any;

  constructor() {
    this.rules = rulesData.rules as FWARule[];
    this.peerBaselines = rulesData.peer_baselines;
  }

  matchRules(lead: any): RuleMatch[] {
    const matches: RuleMatch[] = [];

    // Check each rule
    for (const rule of this.rules) {
      const match = this.evaluateRule(rule, lead);
      if (match) {
        matches.push(match);
      }
    }

    // Sort by weight (highest first)
    return matches.sort((a, b) => b.weight - a.weight);
  }

  private evaluateRule(rule: FWARule, lead: any): RuleMatch | null {
    let confidence = 0;
    const evidence: any = {};

    // R-WOUND-001: Daily wound care
    if (rule.rule_id === 'R-WOUND-001') {
      if (lead.hasDailyPattern && lead.hasRoundNumbers) {
        confidence = 0.95;
        evidence.consecutive_days = 'detected';
        evidence.round_pct = '100%';
        
        const matchingCodes = lead.topCodes?.filter((c: any) => 
          rule.codes_targeted.includes(c.code)
        );
        
        if (matchingCodes && matchingCodes.length > 0) {
          confidence = 1.0;
          evidence.codes = matchingCodes.map((c: any) => c.code);
          evidence.total_amount = matchingCodes.reduce((sum: number, c: any) => 
            sum + c.totalBilled, 0
          );
        }
      }
    }

    // R-MOD59-001: Modifier-59 unbundling
    if (rule.rule_id === 'R-MOD59-001') {
      if (lead.hasModifier59) {
        confidence = 0.9;
        evidence.modifier_59_pct = 'high';
        
        const matchingCodes = lead.topCodes?.filter((c: any) => 
          rule.codes_targeted.includes(c.code)
        );
        
        if (matchingCodes && matchingCodes.length > 0) {
          confidence = 1.0;
          evidence.codes = matchingCodes.map((c: any) => c.code);
          
          // Calculate actual modifier-59 percentage
          matchingCodes.forEach((code: any) => {
            const mod59Count = code.modifiers?.filter((m: any) => 
              String(m) === '59'
            ).length || 0;
            const mod59Pct = (mod59Count / code.count * 100).toFixed(0);
            evidence[`${code.code}_mod59_pct`] = `${mod59Pct}%`;
          });
        }
      }
    }

    // R-ROUND-001: Round-number anchoring
    if (rule.rule_id === 'R-ROUND-001') {
      if (lead.hasRoundNumbers) {
        confidence = 0.8;
        evidence.round_number_detected = true;
        
        if (lead.topCodes && lead.topCodes.length > 0) {
          const totalAmounts = lead.topCodes.reduce((sum: number, c: any) => 
            sum + c.amounts.length, 0
          );
          const roundAmounts = lead.topCodes.reduce((sum: number, c: any) => 
            sum + c.amounts.filter((a: number) => a % 100 === 0).length, 0
          );
          const roundPct = (roundAmounts / totalAmounts * 100).toFixed(0);
          
          evidence.round_pct = `${roundPct}%`;
          evidence.peer_baseline = `${rule.peer_baseline.round_pct_all_specialties}%`;
          
          if (parseInt(roundPct) > rule.thresholds.hard.round_pct) {
            confidence = 1.0;
          }
        }
      }
    }

    // R-VOLUME-001: High volume
    if (rule.rule_id === 'R-VOLUME-001') {
      if (lead.claimCount > rule.thresholds.soft.claims_per_month) {
        const claimsPerDay = (lead.claimCount / 30).toFixed(1);
        confidence = 0.7;
        evidence.claims_per_day = claimsPerDay;
        evidence.peer_baseline = rule.peer_baseline.claims_per_day;
        
        if (lead.claimCount > rule.thresholds.hard.claims_per_month) {
          confidence = 0.9;
        }
      }
    }

    // Only return match if confidence > 0
    if (confidence === 0) {
      return null;
    }

    return {
      rule_id: rule.rule_id,
      rule_name: rule.name,
      severity: rule.severity,
      weight: rule.weight,
      confidence,
      explanation: this.buildExplanation(rule, lead, evidence),
      evidence
    };
  }

  private buildExplanation(rule: FWARule, lead: any, evidence: any): string {
    let explanation = rule.explain_short;

    // Add specific details
    if (evidence.codes) {
      explanation += ` Codes: ${evidence.codes.join(', ')}.`;
    }
    
    if (evidence.round_pct) {
      explanation += ` Round-$ amounts: ${evidence.round_pct} vs peer ${evidence.peer_baseline}.`;
    }
    
    if (evidence.modifier_59_pct) {
      explanation += ` Modifier-59 usage: ${evidence.modifier_59_pct}.`;
    }
    
    if (evidence.claims_per_day) {
      explanation += ` Volume: ${evidence.claims_per_day} claims/day vs peer ${evidence.peer_baseline}.`;
    }

    return explanation;
  }

  getPeerBaseline(metric: string, specialty?: string): number {
    // Navigate peer baselines object
    const keys = metric.split('.');
    let value: any = this.peerBaselines;
    
    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        return 0;
      }
    }
    
    return typeof value === 'number' ? value : 0;
  }

  getRuleById(ruleId: string): FWARule | undefined {
    return this.rules.find(r => r.rule_id === ruleId);
  }

  getAllRules(): FWARule[] {
    return this.rules;
  }
}

// Singleton instance
export const ruleMatcher = new FWARuleMatcher();
