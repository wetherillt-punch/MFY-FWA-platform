const fs = require('fs');
const content = fs.readFileSync('src/lib/detection/tier2.ts', 'utf8');

// Fix 1: Change percentile threshold from 95 to 99
let fixed = content.replace(
  'isOutlier: percentile > 95',
  'isOutlier: percentile > 99'
);

// Fix 2: Add z-score check to compareToPeers
fixed = fixed.replace(
  /const percentile = \(sorted\.filter\(v => v < targetMetric\.claimsPerMonth\)\.length \/ sorted\.length\) \* 100;/,
  `const percentile = (sorted.filter(v => v < targetMetric.claimsPerMonth).length / sorted.length) * 100;
  
  // Calculate z-score for more robust detection
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const variance = sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / sorted.length;
  const stdDev = Math.sqrt(variance);
  const zScore = stdDev > 0 ? (targetMetric.claimsPerMonth - mean) / stdDev : 0;`
);

// Fix 3: Require BOTH high percentile AND high z-score
fixed = fixed.replace(
  'isOutlier: percentile > 99',
  'isOutlier: percentile > 99 && zScore > 3'
);

fs.writeFileSync('src/lib/detection/tier2.ts', fixed);
console.log('Fixed tier2 sensitivity');
