const fs = require('fs');
let content = fs.readFileSync('src/lib/detection/phase3-patterns.ts', 'utf8');

// Add logging right before the filter
const debugCode = `
  // DEBUG: Log sample E&M claims to see what modifiers look like
  if (emCodes.length > 0) {
    console.log('=== MODIFIER 25 DEBUG ===');
    console.log('Provider has', emCodes.length, 'E&M codes');
    console.log('Sample claims:', emCodes.slice(0, 5).map(c => ({
      cpt: c.cpt_hcpcs,
      modifiers: c.modifiers,
      modifiersType: typeof c.modifiers,
      stringCheck: String(c.modifiers),
      includesCheck: String(c.modifiers).includes("25")
    })));
  }
`;

content = content.replace(
  'const withMod25 = emCodes.filter',
  debugCode + '\n  const withMod25 = emCodes.filter'
);

fs.writeFileSync('src/lib/detection/phase3-patterns.ts', content);
console.log('Added debug logging');
