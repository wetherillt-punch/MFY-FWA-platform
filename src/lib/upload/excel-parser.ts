/**
 * Excel File Parser - Fixed column detection
 */

import * as XLSX from 'xlsx';
import { ClaimData } from '@/types';

export interface ParseResult {
  success: boolean;
  claims: ClaimData[];
  errors: string[];
  warnings: string[];
  stats: {
    totalRows: number;
    validRows: number;
    uniqueProviders: number;
    dateRange: { start: Date; end: Date } | null;
  };
}

export function parseExcelFile(buffer: ArrayBuffer): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const claims: ClaimData[] = [];

  try {
    const workbook = XLSX.read(buffer, { type: 'array' });
    
    // Find data sheet
    let rawData: any[] = [];
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const testData: any[] = XLSX.utils.sheet_to_json(worksheet);
      
      if (testData.length >= 10) {
        const firstRow = testData[0];
        const columns = Object.keys(firstRow);
        const hasDataColumns = columns.some(col => 
          col.toLowerCase().includes('claim') || 
          col.toLowerCase().includes('provider') ||
          col.toLowerCase().includes('amount')
        );
        
        if (hasDataColumns) {
          rawData = testData;
          console.log(`Using sheet with ${testData.length} rows`);
          break;
        }
      }
    }
    
    if (rawData.length === 0) {
      errors.push('No data found');
      return {
        success: false,
        claims: [],
        errors,
        warnings,
        stats: { totalRows: 0, validRows: 0, uniqueProviders: 0, dateRange: null },
      };
    }

    const actualColumns = Object.keys(rawData[0]);
    console.log('Columns:', actualColumns);
    
    // Direct mapping - exact match or underscore match
    const columnMap: Record<string, string> = {};
    
    for (const col of actualColumns) {
      const colLower = col.toLowerCase();
      
      // Check each required field
      if (colLower === 'claim_id' || colLower === 'claimid') {
        columnMap.claim_id = col;
      }
      else if (colLower === 'provider_id' || colLower === 'providerid' || colLower === 'npi') {
        columnMap.provider_id = col;
      }
      else if (colLower === 'service_date' || colLower === 'servicedate' || colLower === 'date') {
        columnMap.service_date = col;
      }
      else if (colLower === 'billed_amount' || colLower === 'billedamount' || colLower === 'amount') {
        columnMap.billed_amount = col;
      }
      else if (colLower === 'paid_amount' || colLower === 'paidamount') {
        columnMap.paid_amount = col;
      }
      else if (colLower === 'member_id' || colLower === 'memberid') {
        columnMap.member_id = col;
      }
      else if (colLower === 'provider_zip' || colLower === 'providerzip') {
        columnMap.provider_zip = col;
      }
      else if (colLower === 'place_of_service' || colLower === 'placeofservice') {
        columnMap.place_of_service = col;
      }
      else if (colLower === 'service_description' || colLower === 'servicedescription') {
        columnMap.service_description = col;
      }
    }
    
    console.log('Mapped columns:', JSON.stringify(columnMap));
    
    if (!columnMap.claim_id || !columnMap.provider_id || !columnMap.service_date || !columnMap.billed_amount) {
      errors.push(`Missing required columns. Mapped: ${JSON.stringify(columnMap)}`);
      return {
        success: false,
        claims: [],
        errors,
        warnings,
        stats: { totalRows: 0, validRows: 0, uniqueProviders: 0, dateRange: null },
      };
    }

    // Parse rows
    let validCount = 0;
    const dates: Date[] = [];
    const providerSet = new Set<string>();

    rawData.forEach((row) => {
      try {
        const claim_id = String(row[columnMap.claim_id] || '').trim();
        const provider_id = String(row[columnMap.provider_id] || '').trim();
        const service_date_raw = row[columnMap.service_date];
        const billed_amount = parseFloat(row[columnMap.billed_amount]);

        if (!claim_id || !provider_id || !service_date_raw || isNaN(billed_amount)) {
          return;
        }

        let service_date: Date;
        if (typeof service_date_raw === 'number') {
          service_date = new Date((service_date_raw - 25569) * 86400 * 1000);
        } else if (typeof service_date_raw === 'string') {
          service_date = new Date(service_date_raw);
        } else if (service_date_raw instanceof Date) {
          service_date = service_date_raw;
        } else {
          return;
        }

        if (isNaN(service_date.getTime())) {
          return;
        }

        const claim: ClaimData = {
          claim_id,
          provider_id,
          member_id: (columnMap.member_id && row[columnMap.member_id]) || 'UNKNOWN',
          service_date,
          place_of_service: (columnMap.place_of_service && row[columnMap.place_of_service]) || '11',
          billed_amount,
        };

        if (columnMap.paid_amount && row[columnMap.paid_amount]) {
          claim.paid_amount = parseFloat(row[columnMap.paid_amount]);
        }
        if (columnMap.member_id && row[columnMap.member_id]) {
          claim.member_id = String(row[columnMap.member_id]).trim();
        }
        if (columnMap.provider_zip && row[columnMap.provider_zip]) {
          claim.provider_zip = String(row[columnMap.provider_zip]).trim();
        }
        if (columnMap.place_of_service && row[columnMap.place_of_service]) {
          claim.place_of_service = String(row[columnMap.place_of_service]).trim();
        }
        if (columnMap.service_description && row[columnMap.service_description]) {
          claim.service_description = String(row[columnMap.service_description]).trim();
        }

        claims.push(claim);
        dates.push(service_date);
        providerSet.add(provider_id);
        validCount++;
      } catch (err) {
        // Skip
      }
    });

    console.log(`Successfully parsed ${validCount} claims`);

    if (validCount === 0) {
      errors.push('No valid claims parsed');
      return {
        success: false,
        claims: [],
        errors,
        warnings,
        stats: { totalRows: rawData.length, validRows: 0, uniqueProviders: 0, dateRange: null },
      };
    }

    const dateRange = dates.length > 0 ? {
      start: new Date(Math.min(...dates.map(d => d.getTime()))),
      end: new Date(Math.max(...dates.map(d => d.getTime()))),
    } : null;

    return {
      success: true,
      claims,
      errors,
      warnings,
      stats: {
        totalRows: rawData.length,
        validRows: validCount,
        uniqueProviders: providerSet.size,
        dateRange,
      },
    };
  } catch (err: any) {
    console.error('Parse error:', err);
    errors.push(`Parse error: ${err.message}`);
    return {
      success: false,
      claims: [],
      errors,
      warnings,
      stats: { totalRows: 0, validRows: 0, uniqueProviders: 0, dateRange: null },
    };
  }
}
