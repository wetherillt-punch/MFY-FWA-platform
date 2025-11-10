import { NextRequest, NextResponse } from 'next/server';
import { analyzeWithAgent } from '@/lib/agent';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leads, totalClaims, totalProviders, fileName } = body;

    if (!leads || !Array.isArray(leads)) {
      return NextResponse.json(
        { error: 'Invalid request: leads required' },
        { status: 400 }
      );
    }

    console.log(`Agent analyzing ${leads.length} leads...`);

    const analysis = await analyzeWithAgent({
      leads,
      totalClaims,
      totalProviders,
      fileName,
    });

    return NextResponse.json({ analysis });
  } catch (error: any) {
    console.error('Agent analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Analysis failed' },
      { status: 500 }
    );
  }
}
