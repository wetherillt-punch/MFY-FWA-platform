// Extract relevant claims for each detection rule type

export function extractRelevantClaims(lead: any, rule: any, allClaims: any[] = []): any[] {
  // Filter claims for this provider
  const providerClaims = allClaims.filter((c: any) => c.provider_id === lead.provider_id);
  
  if (!providerClaims.length) return [];

  // Get all metrics from all tiers
  const allMetrics = [
    ...(lead.tier1Metrics || []),
    ...(lead.tier2Metrics || []),
    ...(lead.tier3Metrics || []),
    ...(lead.tier4Metrics || [])
  ];
  
  // Normalize rule name for matching
  const normalizeRuleName = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  };
  
  const ruleName = normalizeRuleName(rule.rule_name || '');
  
  console.log('🔍 Searching for claims matching rule:', rule.rule_name);
  console.log('   Normalized:', ruleName);
  console.log('   Available metrics:', allMetrics.map(m => ({
    metric: m.metricName || m.metric,
    tag: m.anomalyTag,
    claimCount: m.flaggedClaimIds?.length || 0
  })));
  
  // Try to find matching metric by various name patterns
  const matchingMetric = allMetrics.find((m: any) => {
    const metricName = normalizeRuleName(m.metricName || m.metric || '');
    const anomalyTag = normalizeRuleName(m.anomalyTag || '');
    
    // Direct match
    if (metricName === ruleName || anomalyTag === ruleName) return true;
    
    // Partial matches
    if (metricName.includes(ruleName) || ruleName.includes(metricName)) return true;
    if (anomalyTag.includes(ruleName) || ruleName.includes(anomalyTag)) return true;
    
    // Special cases
    if (ruleName.includes('benford') && (metricName.includes('benford') || anomalyTag.includes('benford'))) return true;
    if (ruleName.includes('spike') && (metricName.includes('spike') || anomalyTag.includes('spike'))) return true;
    if (ruleName.includes('round') && (metricName.includes('round') || anomalyTag.includes('round'))) return true;
    if (ruleName.includes('duplicate') && (metricName.includes('duplicate') || anomalyTag.includes('duplicate'))) return true;
    if (ruleName.includes('peer') && (metricName.includes('peer') || anomalyTag.includes('peer'))) return true;
    
    return false;
  });
  
  // If we found a matching metric with flaggedClaimIds, use them!
  if (matchingMetric?.flaggedClaimIds && matchingMetric.flaggedClaimIds.length > 0) {
    console.log('✅ Found matching metric with', matchingMetric.flaggedClaimIds.length, 'claim IDs');
    
    const flaggedClaims = providerClaims.filter((c: any) => 
      matchingMetric.flaggedClaimIds.includes(c.claim_id)
    );
    
    console.log('✅ Matched', flaggedClaims.length, 'actual claims');
    
    if (flaggedClaims.length > 0) {
      // Set highlight hints for the UI
      if (ruleName.includes('duplicate')) {
        rule.highlightField = 'claim_id';
      } else if (ruleName.includes('round') || ruleName.includes('benford')) {
        rule.highlightField = 'billed_amount';
      } else if (ruleName.includes('spike')) {
        rule.highlightField = 'service_date';
      } else if (ruleName.includes('modifier')) {
        rule.highlightField = 'modifiers';
      }
      
      return flaggedClaims.slice(0, 100);
    }
  }
  
  console.log('⚠️ No matching metric found or no flaggedClaimIds, using fallback logic');
  
  // FALLBACK: Use heuristic matching (legacy)
  const ruleNameDisplay = rule.rule_name || '';
  
  // Modifier 25 Overuse
  if (ruleNameDisplay.includes('Modifier 25')) {
    return providerClaims
      .filter((c: any) => {
        const isMod25 = String(c.modifier) === '25';
        const isEM = /^9921[3-5]$|^9920[1-5]$/.test(c.cpt_hcpcs);
        return isMod25 && isEM;
      })
      .slice(0, 100);
  }
  
  // Modifier 59 Overuse
  if (ruleNameDisplay.includes('Modifier 59')) {
    return providerClaims
      .filter((c: any) => String(c.modifier) === '59')
      .slice(0, 100);
  }
  
  // Billing Spike
  if (ruleNameDisplay.includes('Spike') && rule.highlightValue) {
    const spikeDate = rule.highlightValue;
    return providerClaims
      .filter((c: any) => c.service_date.toISOString().includes(spikeDate))
      .slice(0, 100);
  }
  
  // Billing Inflation
  if (ruleNameDisplay.includes('Inflation') || ruleNameDisplay.includes('Drift')) {
    const sorted = [...providerClaims].sort((a: any, b: any) => 
      new Date(a.service_date).getTime() - new Date(b.service_date).getTime()
    );
    
    if (sorted.length < 10) return sorted;
    
    const firstClaims = sorted.slice(0, 5);
    const lastClaims = sorted.slice(-5);
    return [...firstClaims, ...lastClaims];
  }
  
  // Wound Care Frequency
  if (ruleNameDisplay.includes('Wound Care')) {
    return providerClaims
      .filter((c: any) => /^1527[15]$|^11102$/.test(c.cpt_hcpcs))
      .slice(0, 100);
  }
  
  // Peer Comparison
  if (ruleNameDisplay.includes('Peer Comparison') || ruleNameDisplay.includes('Peer Outlier')) {
    return [...providerClaims]
      .sort((a: any, b: any) => parseFloat(b.billed_amount) - parseFloat(a.billed_amount))
      .slice(0, 20);
  }
  
  // Benford's Law
  if (ruleNameDisplay.includes('Benford')) {
    return [...providerClaims]
      .filter((c: any) => {
        const amount = parseFloat(c.billed_amount || '0');
        const firstDigit = parseInt(amount.toString()[0]);
        return firstDigit >= 7 && firstDigit <= 9;
      })
      .slice(0, 50);
  }
  
  // Round Number Clustering
  if (ruleNameDisplay.includes('Round Number')) {
    return providerClaims
      .filter((c: any) => {
        const amount = parseFloat(c.billed_amount || '0');
        return Math.abs(amount % 100) < 0.01;
      })
      .slice(0, 50);
  }
  
  // Duplicate Claims
  if (ruleNameDisplay.includes('Duplicate')) {
    const seen = new Map();
    const duplicates: any[] = [];
    
    providerClaims.forEach((c: any) => {
      const key = `${c.member_id}-${c.service_date}-${c.cpt_hcpcs}-${c.billed_amount}`;
      if (seen.has(key)) {
        duplicates.push(c);
      } else {
        seen.set(key, c);
      }
    });
    
    return duplicates.slice(0, 50);
  }
  
  // Default: return sample
  console.log('⚠️ Using default sample of 10 claims');
  return providerClaims.slice(0, 10);
}
