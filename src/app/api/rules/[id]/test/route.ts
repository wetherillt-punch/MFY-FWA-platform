import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/rules/[id]/test - Test rule with sample data
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { testData, testDataFile } = body;
    
    if (!testData || !Array.isArray(testData)) {
      return NextResponse.json(
        { success: false, error: 'testData must be an array of claims' },
        { status: 400 }
      );
    }
    
    // Get the rule
    const rule = await prisma.detectionRule.findUnique({
      where: { id: params.id },
    });
    
    if (!rule) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      );
    }
    
    // Execute the rule (simplified for now)
    const startTime = Date.now();
    const matches = executeRule(rule, testData);
    const executionTime = (Date.now() - startTime) / 1000;
    
    // Save test results
    const testResult = await prisma.ruleTest.create({
      data: {
        ruleId: params.id,
        testDataFile: testDataFile || 'inline-data',
        totalClaims: testData.length,
        matchesFound: matches.length,
        executionTime,
        results: { matches },
        insights: generateInsights(rule, testData, matches),
      },
    });
    
    return NextResponse.json({
      success: true,
      test: testResult,
      summary: {
        totalClaims: testData.length,
        matchesFound: matches.length,
        executionTime: `${executionTime.toFixed(2)}s`,
        matchRate: ((matches.length / testData.length) * 100).toFixed(2) + '%',
      },
    });
  } catch (error: any) {
    console.error('Error testing rule:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to test rule', message: error.message },
      { status: 500 }
    );
  }
}

// Simplified rule execution function
function executeRule(rule: any, claims: any[]): any[] {
  const matches: any[] = [];
  
  try {
    // Filter by CPT codes if specified
    let relevantClaims = claims;
    if (rule.cptCodes && rule.cptCodes.length > 0) {
      relevantClaims = claims.filter(claim => 
        rule.cptCodes.includes(claim.cptCode || claim.cpt)
      );
    }
    
    // Apply threshold logic (simplified)
    if (rule.thresholds) {
      const thresholds = rule.thresholds as any;
      
      // Group by provider and check thresholds
      const byProvider: { [key: string]: any[] } = {};
      relevantClaims.forEach(claim => {
        const providerId = claim.providerId || claim.provider || 'unknown';
        if (!byProvider[providerId]) byProvider[providerId] = [];
        byProvider[providerId].push(claim);
      });
      
      // Check each provider against thresholds
      Object.entries(byProvider).forEach(([providerId, providerClaims]) => {
        let flagged = false;
        
        if (thresholds.maxPerDay && providerClaims.length > thresholds.maxPerDay) {
          flagged = true;
        }
        
        if (thresholds.highLevelPercentage) {
          const highLevel = providerClaims.filter(c => 
            ['99215', '99205'].includes(c.cptCode || c.cpt)
          );
          const rate = highLevel.length / providerClaims.length;
          if (rate > thresholds.highLevelPercentage) flagged = true;
        }
        
        if (flagged) {
          matches.push({
            providerId,
            claimCount: providerClaims.length,
            claimIds: providerClaims.map(c => c.id || c.claimId),
            reason: `Exceeded threshold: ${providerClaims.length} claims`,
          });
        }
      });
    }
  } catch (error) {
    console.error('Error executing rule:', error);
  }
  
  return matches;
}

// Generate insights about test results
function generateInsights(rule: any, claims: any[], matches: any[]): any {
  const matchRate = (matches.length / claims.length) * 100;
  
  return {
    summary: `Found ${matches.length} potential violations in ${claims.length} claims`,
    matchRate: `${matchRate.toFixed(2)}%`,
    recommendation: matchRate > 10 
      ? 'High match rate - consider adjusting thresholds'
      : matchRate < 1
      ? 'Low match rate - rule may be too strict'
      : 'Match rate looks reasonable',
  };
}
