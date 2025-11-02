/**
 * Normalize various date formats to YYYY-MM-DD
 * Handles: ISO strings, Excel serial dates, MM/DD/YYYY, etc.
 */
export function normalizeDateToYYYYMMDD(dateInput: any): string {
  if (!dateInput) return '';
  
  // Already in YYYY-MM-DD format
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }
  
  // Handle ISO datetime strings (2024-01-01T00:00:00.000Z)
  if (typeof dateInput === 'string' && dateInput.includes('T')) {
    return dateInput.split('T')[0];
  }
  
  // Handle Excel serial dates (number of days since 1900-01-01)
  if (typeof dateInput === 'number') {
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (dateInput - 2) * 86400000); // -2 for Excel bug
    return date.toISOString().split('T')[0];
  }
  
  // Try parsing as Date object
  try {
    const date = new Date(dateInput);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (e) {
    // Fall through
  }
  
  // Last resort: return as string and extract date part
  const str = String(dateInput);
  if (str.includes('T')) return str.split('T')[0];
  if (str.includes(' ')) return str.split(' ')[0];
  
  return str;
}

/**
 * Normalize amount to avoid floating point issues
 */
export function normalizeAmount(amountInput: any): number {
  const num = typeof amountInput === 'string' ? parseFloat(amountInput) : amountInput;
  return Math.round((num || 0) * 100) / 100;
}
