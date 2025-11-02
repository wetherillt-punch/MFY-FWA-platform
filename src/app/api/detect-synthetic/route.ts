import { NextResponse } from 'next/server';
import { generateSyntheticDataset } from '@/lib/synthetic/generator';
import { runComprehensiveDetection } from '@/lib/detection/orchestrator';
import { Claim } from '@/types/detection';

export async function POST() {
  try {
    console.log('Generating synthetic dataset...');
    const syntheticClaims = generateSyntheticDataset();
    
    // Convert to Claim format
    const claims: Claim[] = syntheticClaims.map((c: any) => ({
      claim_id: c.claim_id,
      provider_id: c.provider_id,
      member_id: c.member_id || '',
      service_date: c.service_date,
      billed_amount: String(c.billed_amount),
      paid_amount: String(c.paid_amount || c.billed_amount),
      cpt_hcpcs: c.cpt_hcpcs || c.code || '',
      cpt_description: c.description || '',
      modifiers: c.modifiers || '',
      place_of_service: c.place_of_service || '',
      diagnosis_code: c.diagnosis_code || ''
    }));
    
    console.log('Generated synthetic claims:', claims.length);
    
    // Run detection on all providers
    const uniqueProviders = [...new Set(claims.map(c => c.provider_id))];
    console.log('Analyzing providers:', uniqueProviders.length);
    
    const results = uniqueProviders.map(providerId => {
      return runComprehensiveDetection(claims, providerId, uniqueProviders);
    });

    // Filter to leads with issues
    const leads = results
      .filter(r => r.overallScore > 0)
      .sort((a, b) => b.overallScore - a.overallScore);

    const highPriority = leads.filter(l => l.priority === 'HIGH').length;
    const mediumPriority = leads.filter(l => l.priority === 'MEDIUM').length;
    const watchlist = leads.filter(l => l.priority === 'WATCHLIST').length;

    const totalBilled = claims.reduce((sum, c) => 
      sum + parseFloat(c.billed_amount || '0'), 0
    );

    return NextResponse.json({
      success: true,
      fileName: 'synthetic_test_data.json',
      totalClaims: claims.length,
      totalProviders: uniqueProviders.length,
      leadsDetected: leads.length,
      highPriority,
      mediumPriority,
      watchlist,
      totalBilled,
      leads,
      analysisDate: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Synthetic detection error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to run synthetic detection' 
    }, { status: 500 });
  }
}
