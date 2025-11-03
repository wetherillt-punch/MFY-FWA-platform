const fs = require('fs');
let content = fs.readFileSync('src/lib/detection/tier2.ts', 'utf8');

// 1. Benford's Law - raise chi-square threshold (currently 15.507)
content = content.replace(
  'violation: chiSquare > 15.507',
  'violation: chiSquare > 20' // Much higher threshold
);

// 2. Spike detection - raise z-score threshold from 3 to 4
content = content.replace(
  /\.filter\(s => s\.zScore > 3\)/,
  '.filter(s => s.zScore > 4)'
);

// 3. Gini concentration - raise threshold from 0.7 to 0.85
content = content.replace(
  'if (gini > 0.7) {',
  'if (gini > 0.85) {'
);

// 4. Reduce minimum claims threshold from 20 to 30
content = content.replace(
  'if (providerClaims.length < 20)',
  'if (providerClaims.length < 30)'
);

fs.writeFileSync('src/lib/detection/tier2.ts', content);
console.log('Fixed all tier2 thresholds');
