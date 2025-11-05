import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/rules/[id] - Get single rule
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rule = await prisma.detectionRule.findUnique({
      where: { id: params.id },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        tests: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    
    if (!rule) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      rule,
    });
  } catch (error: any) {
    console.error('Error fetching rule:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch rule', message: error.message },
      { status: 500 }
    );
  }
}

// PATCH /api/rules/[id] - Update rule
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { isActive, ...updateData } = body;
    
    // Check if rule exists and if user can edit it
    const existingRule = await prisma.detectionRule.findUnique({
      where: { id: params.id },
    });
    
    if (!existingRule) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      );
    }
    
    // Built-in rules can only toggle isActive
    if (existingRule.isBuiltIn && Object.keys(updateData).length > 0) {
      return NextResponse.json(
        { success: false, error: 'Built-in rules cannot be modified' },
        { status: 403 }
      );
    }
    
    const updatedRule = await prisma.detectionRule.update({
      where: { id: params.id },
      data: {
        ...updateData,
        ...(typeof isActive === 'boolean' && { isActive }),
        updatedAt: new Date(),
      },
    });
    
    return NextResponse.json({
      success: true,
      rule: updatedRule,
      message: 'Rule updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating rule:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update rule', message: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/rules/[id] - Delete rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if rule exists
    const rule = await prisma.detectionRule.findUnique({
      where: { id: params.id },
    });
    
    if (!rule) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      );
    }
    
    // Cannot delete built-in rules
    if (rule.isBuiltIn) {
      return NextResponse.json(
        { success: false, error: 'Built-in rules cannot be deleted' },
        { status: 403 }
      );
    }
    
    await prisma.detectionRule.delete({
      where: { id: params.id },
    });
    
    return NextResponse.json({
      success: true,
      message: 'Rule deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting rule:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete rule', message: error.message },
      { status: 500 }
    );
  }
}
