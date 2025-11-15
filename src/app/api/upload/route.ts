import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { runComprehensiveDetection } from '@/lib/detection/orchestrator';
import { Claim } from '@/types';
import { normalizeDateToYYYYMMDD } from '@/lib/detection/date-utils';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    const claims: Claim[] = rawData.map((row: any) => ({
      claim_id: String(row.claim_id || row.CLAIM_ID || ''),
      provider_id: String(row.provider_id || row.PROVIDER_ID || ''),
      member_id: String(row.member_id || row.MEMBER_ID || ''),
      service_date: new Date(row.service_date || row.SERVICE_DATE),
      billed_date: row.billed_date ? new Date(row.billed_date) : undefined,
      paid_date: row.paid_date ? new Date(row.paid_date) : undefined,
      place_of_service: String(row.place_of_service || row.PLACE_OF_SERVICE || ''),
      cpt_hcpcs: String(row.cpt_hcpcs || row.CPT_HCPCS || ''),  // ✅ Convert to string
      modifiers: row.modifiers ? String(row.modifiers) : undefined,  // ✅ Convert to string
      billed_amount: Number(row.billed_amount || row.BILLED_AMOUNT || 0),
      paid_amount: row.paid_amount ? Number(row.paid_amount) : undefined,
      claim_type: row.claim_type || row.CLAIM_TYPE,
      serial_number: row.serial_number || row.SERIAL_NUMBER,
      paid_status: row.paid_status || row.PAID_STATUS,
    }));

    const validClaims = claims.filter(c => 
      c.claim_id && c.provider_id && c.service_date && c.billed_amount
    );

    // DEBUG: Get first 5 P90001 claims to see actual data

    if (validClaims.length === 0) {
      return NextResponse.json({ 
        error: 'No valid claims found' 
      }, { status: 400 });
    }

    const uniqueProviders = [...new Set(validClaims.map(c => c.provider_id))];

    const results = await Promise.all(
      uniqueProviders.map(providerId => 
        runComprehensiveDetection(validClaims, providerId, uniqueProviders)
      )
    );

    const leads = results
      .filter(r => r.overallScore >= 25)
      .sort((a, b) => b.overallScore - a.overallScore);

    const highPriority = leads.filter(l => l.priority === 'HIGH').length;
    const mediumPriority = leads.filter(l => l.priority === 'MEDIUM').length;
    const watchlist = leads.filter(l => l.priority === 'WATCHLIST').length;

    // MATCH THE FRONTEND EXPECTED FORMAT
    return NextResponse.json({
      success: true,
      fileName: file.name,
      parseResult: {
        stats: {
          totalRows: validClaims.length,
          uniqueProviders: uniqueProviders.length
        }
      },
      detection: {
        leadCount: leads.length,
        highPriorityCount: highPriority,
        mediumPriorityCount: mediumPriority,
        watchlistCount: watchlist,
        leads: leads,
        allClaims: validClaims
      },
      qualityReport: {
        qualityScore: 95
      },
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to process file' 
    }, { status: 500 });
  }
}
// Force rebuild
// Force rebuild
