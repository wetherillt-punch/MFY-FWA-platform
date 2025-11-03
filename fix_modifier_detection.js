const fs = require('fs');
const content = fs.readFileSync('src/lib/detection/phase3-patterns.ts', 'utf8');

// Fix modifier 25 detection to handle both string and number
const fixed = content.replace(
  /c\.modifiers && \/\\b25\\b\/\.test\(c\.modifiers\)/,
  'c.modifiers && (String(c.modifiers).includes("25") || c.modifiers === 25 || c.modifiers === "25")'
);

fs.writeFileSync('src/lib/detection/phase3-patterns.ts', fixed);
console.log('Fixed modifier detection');
