// Test with the EXACT data format from Excel

// Simulate normalizeDateToYYYYMMDD
function normalizeDateToYYYYMMDD(dateInput) {
  if (dateInput instanceof Date) {
    return dateInput.toISOString().split('T')[0];
  }
  if (typeof dateInput === 'string' && dateInput.includes('T')) {
    return dateInput.split('T')[0];
  }
  if (typeof dateInput === 'string') return dateInput;
  try {
    const date = new Date(dateInput);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (e) {}
  return String(dateInput);
}

// Test claims with normalized dates (as they would be after upload processing)
const claims = [
  {
    claim_id: 'CLM001030',
    member_id: 'MEM200',
    service_date: normalizeDateToYYYYMMDD('2024-02-15'),  // Normalized
    cpt_hcpcs: '99213',
    billed_amount: '300'  // String
  },
  {
    claim_id: 'CLM001031',
    member_id: 'MEM200',
    service_date: normalizeDateToYYYYMMDD('2024-02-15'),
    cpt_hcpcs: '99213',
    billed_amount: '300'
  },
  {
    claim_id: 'CLM001032',
    member_id: 'MEM200',
    service_date: normalizeDateToYYYYMMDD('2024-02-15'),
    cpt_hcpcs: '99213',
    billed_amount: '300'
  }
];

function findDuplicates(claims) {
  const seen = new Map();
  const duplicates = [];

  claims.forEach((claim, idx) => {
    const normalizedDate = claim.service_date.split('T')[0];
    const normalizedAmount = Math.round(parseFloat(claim.billed_amount || '0') * 100) / 100;
    const key = `${claim.member_id}-${normalizedDate}-${claim.cpt_hcpcs}-${normalizedAmount}`;
    
    console.log(`Claim ${idx}: ${key}`);
    
    if (seen.has(key)) {
      console.log(`  -> DUPLICATE!`);
      duplicates.push(claim);
    } else {
      seen.set(key, claim);
    }
  });

  return duplicates;
}

console.log('Testing duplicate detection with normalized data:');
console.log('='.repeat(60));
const dups = findDuplicates(claims);
console.log(`\nResult: ${dups.length} duplicates found (expected: 2)`);
console.log(dups.length === 2 ? '✅ PASS' : '❌ FAIL');
