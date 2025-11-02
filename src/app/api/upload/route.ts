import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { runComprehensiveDetection } from '@/lib/detection/orchestrator';
import { Claim } from '@/types/detection';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    // Parse and validate claims
    const claims: Claim[] = rawData.map((row: any) => ({
      claim_id: String(row.claim_id || row.CLAIM_ID || ''),
      provider_id: String(row.provider_id || row.PROVIDER_ID || ''),
      member_id: String(row.member_id || row.MEMBER_ID || ''),
      service_date: String(row.service_date || row.SERVICE_DATE || ''),
      billed_amount: String(row.billed_amount || row.BILLED_AMOUNT || '0'),
      paid_amount: String(row.paid_amount || row.PAID_AMOUNT || ''),
      cpt_hcpcs: String(row.cpt_hcpcs || row.CPT_HCPCS || row.code || ''),
      cpt_description: String(row.cpt_description || row.CPT_DESCRIPTION || row.description || ''),
      modifiers: String(row.modifiers || row.MODIFIERS || ''),
      place_of_service: String(row.place_of_service || row.PLACE_OF_SERVICE || ''),
      diagnosis_code: String(row.diagnosis_code || row.DIAGNOSIS_CODE || '')
    }));

    // Validate required fields
    const validClaims = claims.filter(c => 
      c.claim_id && c.provider_id && c.service_date && c.billed_amount
    );

    if (validClaims.length === 0) {
      return NextResponse.json({ 
        error: 'No valid claims found. Required fields: claim_id, provider_id, service_date, billed_amount' 
      }, { status: 400 });
    }

    console.log(`✅ Parsed ${validClaims.length} valid claims`);

    // Get unique providers
    const uniqueProviders = [...new Set(validClaims.map(c => c.provider_id))];
    console.log(`📊 Analyzing ${uniqueProviders.length} providers`);

    // Run comprehensive detection for each provider
    const results = uniqueProviders.map(providerId => {
      console.log(`🔍 Detecting FWA for provider ${providerId}...`);
      return runComprehensiveDetection(validClaims, providerId, uniqueProviders);
    });

    // Filter to only providers with issues (score > 0)
    const leads = results
      .filter(r => r.overallScore > 0)
      .sort((a, b) => b.overallScore - a.overallScore);

    console.log(`🚨 Found ${leads.length} leads requiring attention`);

    // Calculate summary statistics
    const highPriority = leads.filter(l => l.priority === 'HIGH').length;
    const mediumPriority = leads.filter(l => l.priority === 'MEDIUM').length;
    const watchlist = leads.filter(l => l.priority === 'WATCHLIST').length;

    const totalBilled = validClaims.reduce((sum, c) => 
      sum + parseFloat(c.billed_amount || '0'), 0
    );

    const totalFlagged = leads.reduce((sum, l) => sum + l.totalBilled, 0);

    console.log(`📈 Summary: ${highPriority} HIGH, ${mediumPriority} MEDIUM, ${watchlist} WATCHLIST`);
    console.log(`💰 Total billed: $${totalBilled.toLocaleString()}, Flagged: $${totalFlagged.toLocaleString()}`);

    return NextResponse.json({
      success: true,
      fileName: file.name,
      totalClaims: validClaims.length,
      totalProviders: uniqueProviders.length,
      leadsDetected: leads.length,
      highPriority,
      mediumPriority,
      watchlist,
      totalBilled,
      totalFlagged,
      leads,
      analysisDate: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to process file' 
    }, { status: 500 });
  }
}
