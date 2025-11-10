// Helper to get relevant claims for a pattern
function getRelevantClaims(lead: any, pattern: any): any[] {
  // This will be populated with actual claim data from sessionStorage
  // For now, return empty array - will be filled by page component
  return []
}

export function formatDetectionRules(lead: any) {
  const rules: any[] = [];

  // Tier 2: Peer Comparison Rules
  if (lead.tier2Metrics && lead.tier2Metrics.length > 0) {
    lead.tier2Metrics.forEach((metric: any) => {
      const providerVal = metric.providerValue || metric.value || "N/A";
      const formattedValue = typeof providerVal === 'number' 
        ? (metric.metric?.includes('Amount') || metric.metric?.includes('Billed') 
            ? `$${providerVal.toLocaleString()}` 
            : providerVal.toString())
        : providerVal;

      // Generate COMPLEMENTARY narrative with specific claim details
      let narrative = "";
      const metricName = metric.metric || "";
      const claimCount = lead.claimCount || "N/A";
      const totalBilled = lead.totalBilled || 0;
      
      if (metricName.includes("Benford")) {
        narrative = `Analysis of ${claimCount} claims totaling $${totalBilled.toLocaleString()} reveals first-digit distributions that deviate significantly from Benford's Law. Legitimate billing data typically shows natural number patterns, but this provider's amounts cluster in ways consistent with potential fabrication or manipulation.`;
      } else if (metricName.includes("Spike") || metricName.includes("Daily")) {
        // Extract z-score from metric.zscore or parse from providerValue like "Z=4.02"
        let zScore = metric.zscore;
        if (!zScore && providerVal && typeof providerVal === 'string' && providerVal.includes('Z=')) {
          const match = providerVal.match(/Z=([0-9.]+)/);
          if (match) zScore = parseFloat(match[1]);
        }
        const zScoreStr = zScore ? zScore.toFixed(2) : "significantly high";
        const zScoreClause = zScore 
          ? `, with a z-score of ${zScoreStr} (${zScoreStr} standard deviations above normal)`
          : " that significantly exceeds normal patterns";
        narrative = `This provider submitted ${claimCount} claims totaling $${totalBilled.toLocaleString()}. The daily billing pattern shows a concentrated spike${zScoreClause}. Such concentrated billing often indicates batch submissions, backdating, or potential claim fabrication.`;
      } else if (metricName.includes("Billed Amount") || metricName.includes("Average")) {
        const peerAvg = metric.peerAverage || 0;
        const excess = (providerVal - peerAvg) * claimCount;
        narrative = `Across ${claimCount} claims, this provider billed ${formattedValue} per claim versus the peer average of $${peerAvg.toLocaleString()}. If billing at peer rates, the total would be $${(peerAvg * claimCount).toLocaleString()} instead of $${totalBilled.toLocaleString()}, suggesting approximately $${excess.toLocaleString()} in potentially excessive charges.`;
      } else {
        narrative = `Based on ${claimCount} claims totaling $${totalBilled.toLocaleString()}, this provider's billing patterns place them in the top 1% of all providers, warranting detailed review of claim documentation and medical necessity.`;
      }

      rules.push({
        tier: "Tier 2",
        rule_name: `Peer Comparison - ${metric.metric}`,
        description: "Provider is statistical outlier compared to peers",
        narrative: narrative,
        threshold: "99th percentile + z-score >3.0",
        provider_value: formattedValue,
        benchmark: `Peer avg: ${metric.peerAverage || 'undefined'}`,
        evidence: `Percentile: ${metric.percentile || 'undefined'}th, Z-score: ${metric.zscore?.toFixed(2) || 'undefined'}`,
        severity: (metric.zscore && metric.zscore > 4) ? "HIGH" : "MEDIUM",
        claims: [],  // Will be populated by page component
        highlightField: metricName.includes("Spike") ? "service_date" : "billed_amount",
        highlightValue: ""
      });
    });
  }

  // Tier 3: Advanced Patterns
  if (lead.phase3Patterns && lead.phase3Patterns.length > 0) {
    lead.phase3Patterns.forEach((pattern: any) => {
      let providerValue = "N/A";
      if (pattern.evidence) {
        if (pattern.evidence.mod25_pct) {
          providerValue = pattern.evidence.mod25_pct;
        } else if (pattern.evidence.value) {
          providerValue = pattern.evidence.value.toString();
        } else if (pattern.evidence.percentage) {
          providerValue = pattern.evidence.percentage;
        }
      }

      let evidenceStr = "";
      let narrative = "";
      
      if (pattern.evidence) {
        const ev = pattern.evidence;
        
        if (ev.em_visits && ev.mod25_count) {
          // Modifier 25 pattern
          evidenceStr = `${ev.mod25_count} of ${ev.em_visits} E&M visits had modifier 25`;
          const pct = Math.round((ev.mod25_count / ev.em_visits) * 100);
          const timeframe = lead.claimCount ? "over the analysis period" : "in the dataset";
          narrative = `Across ${ev.em_visits} evaluation and management visits ${timeframe}, modifier 25 was attached to ${ev.mod25_count} claims (${pct}%). Medicare expects modifier 25 usage below 5% as it indicates a separate, significant E&M service beyond the primary procedure. This ${pct}% rate suggests systematic overbilling for services not actually performed separately, potentially representing $${((ev.mod25_count * 150) * 0.95).toLocaleString()} in inappropriate charges (assuming ~$150 per E&M code).`;
          
        } else if (ev.spike_date && ev.spike_amount) {
          // Billing spike pattern
          evidenceStr = `$${ev.spike_amount?.toLocaleString()} billed on ${ev.spike_date}`;
          const percentOfTotal = lead.totalBilled ? Math.round((ev.spike_amount / lead.totalBilled) * 100) : 0;
          narrative = `On ${ev.spike_date}, this provider submitted claims totaling $${ev.spike_amount?.toLocaleString()}, representing ${percentOfTotal}% of their total billing for the period. This single-day concentration of ${ev.claim_count || "multiple"} claims is highly unusual and may indicate batch billing of old dates of service, backdating, or fabrication of claims.`;
          
        } else if (ev.total_wound_claims) {
          // Wound care frequency
          evidenceStr = `${ev.total_wound_claims} wound care claims with ${ev.frequency_violations} violations`;
          narrative = `Provider submitted ${ev.total_wound_claims} skin substitute procedure claims, with ${ev.frequency_violations} instances showing treatments less than 14 days apart. Medicare coverage policy requires at least 14 days between treatments for wound healing. These ${ev.frequency_violations} violations suggest potential billing for medically unnecessary procedures or improper timing of treatments.`;
          
        } else if (pattern.pattern?.includes("Inflation") || pattern.pattern?.includes("Drift")) {
          // Billing inflation - extract from description since evidence may not have structured data
          evidenceStr = pattern.description || "";
          
          // Try to parse percentage from description (e.g., "11% increase in avg claim amount over 6 months")
          let percentageStr = "significant";
          const pctMatch = pattern.description?.match(/(\d+)%/);
          if (pctMatch) {
            percentageStr = `${pctMatch[1]}%`;
          }
          
          // Calculate approximate impact if we have claim data
          const avgBilled = lead.totalBilled && lead.claimCount ? lead.totalBilled / lead.claimCount : 0;
          const percentNum = pctMatch ? parseInt(pctMatch[1]) : 10;
          const estimatedIncrease = avgBilled * (percentNum / 100) * lead.claimCount;
          
          if (avgBilled > 0) {
            const startAvg = avgBilled / (1 + (percentNum / 100));
            narrative = `Analysis shows the provider's average claim amount increased by ${percentageStr} over 6 months, from approximately $${Math.round(startAvg).toLocaleString()} to $${Math.round(avgBilled).toLocaleString()} per claim. Across ${lead.claimCount} claims, this represents approximately $${Math.round(estimatedIncrease).toLocaleString()} in additional charges beyond typical inflation rates, suggesting progressive upcoding or service intensity creep.`;
          } else {
            narrative = `Analysis shows a ${percentageStr} increase in average claim amount over 6 months. While some increase is normal for inflation and case mix, this rate of change exceeds typical patterns and may indicate progressive upcoding, service intensity creep, or shift toward higher-complexity billing codes.`;
          }
          
        } else if (pattern.pattern?.includes("Refill-Too-Soon") || 
                   pattern.pattern?.includes("Refill") ||
                   (ev.affected_members && ev.violation_rate)) {
          // DME Refill-Too-Soon pattern
          const members = ev.affected_members || 0;
          const claims = ev.affected_claims || 0;
          const rate = ev.violation_rate || "N/A";
          const threshold = ev.expected_threshold || "≥25% of refills or ≥8 members";
          const exposure = ev.total_exposure || 0;
          
          evidenceStr = `${claims} early refills across ${members} members (${rate} violation rate)`;
          narrative = `Analysis of CPAP and diabetes supply claims reveals ${claims} instances where supplies were refilled before 80% of the expected timeline had elapsed, affecting ${members} unique members. The violation rate of ${rate} exceeds the threshold of ${threshold}, suggesting systematic early refilling that may indicate stockpiling, resale, or billing for supplies not actually dispensed. Estimated financial exposure: $${exposure.toLocaleString()}.`;
          
        } else if (pattern.pattern?.includes("Modifier Misuse") || 
                   (ev.violation_rate && (ev.violation_rate.includes('KX') || ev.violation_rate.includes('NU')))) {
          // DME Modifier Misuse pattern
          const members = ev.affected_members || 0;
          const claims = ev.affected_claims || 0;
          const rate = ev.violation_rate || "N/A";
          const exposure = ev.total_exposure || 0;
          
          evidenceStr = `${claims} DME claims with improper modifier usage (${rate})`;
          narrative = `Provider shows excessive use of modifiers at a rate of ${rate}, significantly exceeding peer averages. This pattern across ${claims} claims affecting ${members} members suggests systematic modifier abuse to justify coverage or inflate reimbursement. Typical modifier usage is below 10%, making this ${rate} rate a clear outlier. Estimated improper billing: $${exposure.toLocaleString()}.`;
          
        } else if (pattern.pattern?.includes("Rental Cap")) {
          // DME Rental Cap Exceeded
          const members = ev.affected_members || 0;
          const claims = ev.affected_claims || 0;
          const rate = ev.violation_rate || "N/A";
          const exposure = ev.total_exposure || 0;
          
          evidenceStr = `${rate} across ${members} members`;
          narrative = `Analysis reveals ${claims} instances where rental equipment (CPAP, oxygen, wheelchairs) continued beyond the 13-month Medicare rental cap without converting to purchase (NU modifier). Medicare requires suppliers to convert rentals to purchase after 13 months. These ${claims} violations across ${members} members suggest systematic overbilling for rental fees that should have ceased. Estimated improper billing: $${exposure.toLocaleString()}.`;
          
        } else if (pattern.pattern?.includes("Serial") && pattern.pattern?.includes("Reuse")) {
          // DME Serial Number Reuse
          const members = ev.affected_members || 0;
          const claims = ev.affected_claims || 0;
          const rate = ev.violation_rate || "N/A";
          const exposure = ev.total_exposure || 0;
          
          evidenceStr = `${rate} detected`;
          narrative = `Provider billed ${claims} claims where the same equipment serial number was used for multiple different members within 60 days, affecting ${members} unique members. Each piece of durable medical equipment should have a unique serial number per patient. This pattern suggests equipment recycling, fraudulent serial number reporting, or billing for equipment not actually provided. Estimated exposure: $${exposure.toLocaleString()}.`;
          
        } else if (pattern.pattern?.includes("Orphan J-Code") || pattern.pattern?.includes("Infusion Drug")) {
          // DME Orphan J-Codes
          const members = ev.affected_members || 0;
          const claims = ev.affected_claims || 0;
          const exposure = ev.total_exposure || 0;
          
          evidenceStr = `${claims} orphan drug claims across ${members} members`;
          narrative = `Provider submitted ${claims} infusion drug claims (J1745, J1569) without corresponding administration codes (96365, 96366) within a 7-day window for the same member. Infusion drugs require professional administration services to be billed together. These orphan J-codes suggest billing for drugs without actual infusion services, potentially indicating drug diversion, stockpiling, or fraudulent billing. Estimated exposure: $${exposure.toLocaleString()}.`;
          
        } else if (pattern.pattern?.includes("Institutional Overlap")) {
          // DME Institutional Overlap
          const members = ev.affected_members || 0;
          const claims = ev.affected_claims || 0;
          const rate = ev.violation_rate || "N/A";
          const exposure = ev.total_exposure || 0;
          
          evidenceStr = `${claims} DME claims during institutional stays (${rate} rate)`;
          narrative = `Provider billed ${claims} DME claims (${rate} of total) during periods when members were in skilled nursing facilities, hospice, or inpatient hospital settings. Medicare Part A typically covers DME during these institutional stays, making separate Part B DME billing improper. This pattern across ${members} members suggests systematic billing for supplies that should be bundled into facility payments. Estimated improper billing: $${exposure.toLocaleString()}.`;
          
        } else if (pattern.pattern?.includes("Velocity Drift") || pattern.pattern?.includes("Supply Velocity")) {
          // DME Supply Velocity Drift
          const members = ev.affected_members || 0;
          const claims = ev.affected_claims || 0;
          const rate = ev.violation_rate || "N/A";
          const exposure = ev.total_exposure || 0;
          
          evidenceStr = `${rate} increase in supply frequency`;
          narrative = `Analysis shows a ${rate} increase in supply units per member over 6 months for CPAP and diabetes supplies across ${members} members. While some variation is normal, this sustained upward trend exceeds typical patterns and may indicate progressive over-ordering, member stockpiling encouragement, or billing for supplies not actually provided. Total claims analyzed: ${claims}. Estimated excess billing: $${exposure.toLocaleString()}.`;
          
        } else if (pattern.pattern?.includes("Code-Mix Shift") || pattern.pattern?.includes("Code Mix")) {
          // DME Code-Mix Shift
          const members = ev.affected_members || 0;
          const claims = ev.affected_claims || 0;
          const rate = ev.violation_rate || "N/A";
          const exposure = ev.total_exposure || 0;
          
          evidenceStr = `${rate} shift to higher-cost codes`;
          narrative = `Provider's brace and orthotic billing shows a ${rate} shift toward higher-allowance codes (L1902, L4361) over recent months without corresponding changes in diagnosis severity or patient complexity. This ${claims}-claim pattern affecting ${members} members suggests potential upcoding to maximize reimbursement rather than clinical necessity driving code selection. Estimated excess reimbursement: $${exposure.toLocaleString()}.`;
          
        } else if (pattern.pattern?.includes("Denial") && pattern.pattern?.includes("Exploit")) {
          // DME Denial Pattern Exploits
          const members = ev.affected_members || 0;
          const chains = ev.affected_claims || 0;
          const rate = ev.violation_rate || "N/A";
          const exposure = ev.total_exposure || 0;
          
          evidenceStr = `${rate} with modifier/POS manipulation`;
          narrative = `Provider demonstrated ${chains} instances of denied claims being successfully rebilled within 14 days after changing modifiers or place of service codes, affecting ${members} members. While correcting legitimate errors is appropriate, this pattern suggests systematic testing of different billing combinations to circumvent coverage rules rather than addressing underlying documentation or medical necessity issues. Estimated improper payments obtained: $${exposure.toLocaleString()}.`;
          
        } else {
          // Generic fallback
          evidenceStr = typeof ev === 'object' 
            ? Object.entries(ev)
                .filter(([key]) => !key.includes('exemplar_claims'))
                .map(([key, val]) => `${key.replace(/_/g, ' ')}: ${val}`)
                .join(', ')
            : String(ev);
          narrative = `Review of ${lead.claimCount || "the"} claims reveals this pattern across multiple dates of service, suggesting systematic rather than isolated behavior that requires investigation of medical records and billing documentation.`;
        }
      }

      // Determine highlighting based on pattern type
      let highlightField = "";
      let highlightValue = "";
      
      if (pattern.pattern?.includes("Modifier 25")) {
        highlightField = "modifiers";
        highlightValue = "25";
      } else if (pattern.pattern?.includes("Modifier 59")) {
        highlightField = "modifiers";
        highlightValue = "59";
      } else if (pattern.pattern?.includes("Spike")) {
        highlightField = "service_date";
        highlightValue = pattern.evidence?.spike_date || "";
      } else if (pattern.pattern?.includes("Inflation")) {
        highlightField = "billed_amount";
        highlightValue = "";
      }

      rules.push({
        tier: "Tier 3",
        rule_name: pattern.pattern,
        description: pattern.description || "Advanced fraud pattern detected",
        narrative: narrative,
        threshold: pattern.evidence?.expected || "See benchmark",
        provider_value: providerValue,
        benchmark: pattern.evidence?.expected || "Normal range",
        evidence: evidenceStr,
        severity: pattern.severity === "high" ? "HIGH" : pattern.severity === "medium" ? "MEDIUM" : "LOW",
        claims: [],  // Will be populated by page component
        highlightField: highlightField,
        highlightValue: highlightValue
      });
    });
  }

  return rules;
}
