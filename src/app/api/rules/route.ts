import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/rules - List all detection rules
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Optional filters
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');
    const isBuiltIn = searchParams.get('isBuiltIn');
    
    const rules = await prisma.detectionRule.findMany({
      where: {
        ...(category && { category: category as any }),
        ...(isActive !== null && { isActive: isActive === 'true' }),
        ...(isBuiltIn !== null && { isBuiltIn: isBuiltIn === 'true' }),
      },
      orderBy: [
        { isBuiltIn: 'desc' }, // Built-in rules first
        { tier: 'asc' },
        { name: 'asc' },
      ],
    });
    
    return NextResponse.json({
      success: true,
      count: rules.length,
      rules,
    });
  } catch (error: any) {
    console.error('Error fetching rules:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch rules', message: error.message },
      { status: 500 }
    );
  }
}

// POST /api/rules - Create new custom rule
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      name,
      description,
      category,
      severity,
      tier,
      cptCodes,
      modifiers,
      thresholds,
      generatedCode,
      createdBy,
    } = body;
    
    // Validation
    if (!name || !description || !category || !severity) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Check for duplicate name
    const existing = await prisma.detectionRule.findFirst({
      where: { name },
    });
    
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A rule with this name already exists' },
        { status: 400 }
      );
    }
    
    // Create the rule
    const rule = await prisma.detectionRule.create({
      data: {
        name,
        description,
        category,
        severity,
        tier: tier || 'custom',
        cptCodes: cptCodes || [],
        modifiers: modifiers || [],
        thresholds: thresholds || {},
        generatedCode: generatedCode || '',
        isBuiltIn: false,
        isActive: false, // Starts inactive for custom rules
        status: 'PENDING', // Requires admin approval
        createdBy: createdBy || 'unknown',
      },
    });
    
    return NextResponse.json({
      success: true,
      rule,
      message: 'Rule created successfully. Awaiting admin approval.',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating rule:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create rule', message: error.message },
      { status: 500 }
    );
  }
}
