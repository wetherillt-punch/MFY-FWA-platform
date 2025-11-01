import { NextResponse } from 'next/server';
import { generateSyntheticDataset } from '@/lib/synthetic/generator';
import { runDetection } from '@/lib/detection/orchestrator';

export async function POST() {
  try {
    // Generate synthetic dataset
    console.log('Generating synthetic dataset...');
    const claims = generateSyntheticDataset(50, 10); // 50 normal, 10 anomalous providers
    
    // Run detection
    console.log('Running detection...');
    const leads = await runDetection(claims);
    
    // Calculate stats
    const highPriorityCount = leads.filter(l => l.priority === 'HIGH').length;
    const mediumPriorityCount = leads.filter(l => l.priority === 'MEDIUM').length;
    const watchlistCount = leads.filter(l => l.priority === 'WATCHLIST').length;
    
    const uniqueProviders = new Set(claims.map(c => c.provider_id)).size;
    
    return NextResponse.json({
      success: true,
      totalProviders: uniqueProviders,
      totalClaims: claims.length,
      leadCount: leads.length,
      highPriorityCount,
      mediumPriorityCount,
      watchlistCount,
      leads,
    });
  } catch (error: any) {
    console.error('Detection error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
