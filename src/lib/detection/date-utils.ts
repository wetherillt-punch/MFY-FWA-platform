/**
 * Normalize various date formats to YYYY-MM-DD
 */
export function normalizeDateToYYYYMMDD(dateInput: any): string {
  if (!dateInput) return '';
  
  // Handle Date objects directly
  if (dateInput instanceof Date) {
    return dateInput.toISOString().split('T')[0];
  }
  
  // Already in YYYY-MM-DD format
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }
  
  // Handle ISO datetime strings
  if (typeof dateInput === 'string' && dateInput.includes('T')) {
    return dateInput.split('T')[0];
  }
  
  // Handle Excel serial dates
  if (typeof dateInput === 'number') {
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (dateInput - 2) * 86400000);
    return date.toISOString().split('T')[0];
  }
  
  // Try parsing as Date
  try {
    const date = new Date(dateInput);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (e) {
    // Fall through
  }
  
  // Last resort
  return String(dateInput).split('T')[0].split(' ')[0];
}

export function normalizeAmount(amountInput: any): number {
  const num = typeof amountInput === 'string' ? parseFloat(amountInput) : amountInput;
  return Math.round((num || 0) * 100) / 100;
}
