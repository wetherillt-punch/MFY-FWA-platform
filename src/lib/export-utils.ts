/**
 * Export claims to CSV
 */
export function exportToCSV(claims: any[], filename: string) {
  if (!claims || claims.length === 0) {
    alert('No claims to export');
    return;
  }

  // Define columns
  const columns = [
    { key: 'claim_id', label: 'Claim ID' },
    { key: 'service_date', label: 'Service Date' },
    { key: 'provider_id', label: 'Provider ID' },
    { key: 'member_id', label: 'Member ID' },
    { key: 'cpt_hcpcs', label: 'CPT/HCPCS' },
    { key: 'modifiers', label: 'Modifier' },
    { key: 'billed_amount', label: 'Billed Amount' },
    { key: 'place_of_service', label: 'POS' },
  ];

  // Create CSV header
  const header = columns.map(col => col.label).join(',');

  // Create CSV rows
  const rows = claims.map(claim => {
    return columns.map(col => {
      let value = claim[col.key];
      
      // Format dates
      if (col.key === 'service_date' && value) {
        value = new Date(value).toISOString().split('T')[0];
      }
      
      // Handle null/undefined
      if (value === null || value === undefined) {
        value = '';
      }
      
      // Escape commas and quotes
      value = String(value).replace(/"/g, '""');
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        value = `"${value}"`;
      }
      
      return value;
    }).join(',');
  });

  // Combine header and rows
  const csv = [header, ...rows].join('\n');

  // Create download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}