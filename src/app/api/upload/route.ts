import { NextRequest, NextResponse } from 'next/server';
import { parseExcelFile } from '@/lib/upload/excel-parser';
import { validateClaims, generateDatasetHash } from '@/lib/quality';
import { runDetection } from '@/lib/detection/orchestrator';

export const maxDuration = 60; // 60 seconds timeout
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an Excel file (.xlsx or .xls)' },
        { status: 400 }
      );
    }

    console.log(`Processing file: ${file.name} (${file.size} bytes)`);

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Parse Excel
    console.log('Parsing Excel file...');
    const parseResult = parseExcelFile(arrayBuffer);
    
    if (!parseResult.success || parseResult.claims.length === 0) {
      return NextResponse.json(
        { 
          error: 'Failed to parse file',
          details: parseResult.errors,
          warnings: parseResult.warnings,
        },
        { status: 400 }
      );
    }

    console.log(`Parsed ${parseResult.claims.length} claims from ${parseResult.stats.uniqueProviders} providers`);

    // Validate data quality
    console.log('Validating data quality...');
    const qualityReport = validateClaims(parseResult.claims);
    
    if (!qualityReport.passed) {
      console.log('Quality validation failed:', qualityReport.errors);
      return NextResponse.json(
        {
          error: 'Data quality validation failed',
          qualityReport,
          parseResult,
        },
        { status: 400 }
      );
    }

    // Generate dataset hash
    const datasetHash = generateDatasetHash(parseResult.claims);
    console.log(`Dataset hash: ${datasetHash}`);

    // Run detection
    console.log('Running FWA detection...');
    const leads = await runDetection(parseResult.claims);
    
    console.log(`Detection complete: ${leads.length} leads generated`);

    // Calculate stats
    const highPriorityCount = leads.filter(l => l.priority === 'HIGH').length;
    const mediumPriorityCount = leads.filter(l => l.priority === 'MEDIUM').length;
    const watchlistCount = leads.filter(l => l.priority === 'WATCHLIST').length;

    return NextResponse.json({
      success: true,
      fileName: file.name,
      datasetHash,
      parseResult: {
        stats: parseResult.stats,
        warnings: parseResult.warnings,
      },
      qualityReport: {
        qualityScore: qualityReport.rates.qualityScore,
        validRows: qualityReport.validRows,
        totalRows: qualityReport.totalRows,
        warnings: qualityReport.warnings,
      },
      detection: {
        leadCount: leads.length,
        highPriorityCount,
        mediumPriorityCount,
        watchlistCount,
        leads,
      },
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
