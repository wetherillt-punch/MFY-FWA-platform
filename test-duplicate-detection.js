// Test duplicate detection logic directly
const claims = [
  { claim_id: '1', member_id: 'MEM200', service_date: '2024-02-15', cpt_hcpcs: '99213', billed_amount: '300' },
  { claim_id: '2', member_id: 'MEM200', service_date: '2024-02-15', cpt_hcpcs: '99213', billed_amount: '300' },
  { claim_id: '3', member_id: 'MEM200', service_date: '2024-02-15', cpt_hcpcs: '99213', billed_amount: '300' },
];

function normalizeDateToYYYYMMDD(dateInput) {
  if (typeof dateInput === 'string' && dateInput.includes('T')) {
    return dateInput.split('T')[0];
  }
  return dateInput;
}

function normalizeAmount(amountInput) {
  const num = typeof amountInput === 'string' ? parseFloat(amountInput) : amountInput;
  return Math.round((num || 0) * 100) / 100;
}

function findDuplicates(claims) {
  const seen = new Map();
  const duplicates = [];

  claims.forEach((claim, idx) => {
    const normalizedDate = normalizeDateToYYYYMMDD(claim.service_date);
    const normalizedAmount = normalizeAmount(claim.billed_amount);
    const key = `${claim.member_id}-${normalizedDate}-${claim.cpt_hcpcs}-${normalizedAmount}`;
    
    console.log(`Claim ${idx}: key = ${key}`);
    
    if (seen.has(key)) {
      console.log(`  -> DUPLICATE FOUND!`);
      duplicates.push(claim);
    } else {
      seen.set(key, claim);
    }
  });

  return duplicates;
}

const dups = findDuplicates(claims);
console.log(`\nTotal duplicates found: ${dups.length}`);
console.log('Expected: 2 duplicates');
