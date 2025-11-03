const fs = require('fs');
const content = fs.readFileSync('src/lib/detection/orchestrator.ts', 'utf8');

// Fix the broken lines 358-359
const fixed = content
  .replace(/advancedPatterns: \[\],  };[\r\n]+\s*phase3Patterns: \[\],}/, 'advancedPatterns: []\n  };\n}');

fs.writeFileSync('src/lib/detection/orchestrator.ts', fixed);
console.log('Fixed orchestrator.ts');
