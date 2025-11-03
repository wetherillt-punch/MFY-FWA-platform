const fs = require('fs');
let content = fs.readFileSync('src/app/api/upload/route.ts', 'utf8');

// Find the return statement and add debug info
content = content.replace(
  'return NextResponse.json({',
  `console.log('Phase 3 patterns:', results.leads.find(l => l.provider_id === 'P8003')?.phase3Patterns);
    return NextResponse.json({`
);

fs.writeFileSync('src/app/api/upload/route.ts', content);
console.log('Added API debug');
