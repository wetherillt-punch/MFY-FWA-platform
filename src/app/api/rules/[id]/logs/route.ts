import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/rules/[id]/logs - Get execution history for a rule
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    
    const logs = await prisma.ruleExecutionLog.findMany({
      where: {
        ruleId: params.id,
      },
      orderBy: {
        executedAt: 'desc',
      },
      take: limit,
    });
    
    return NextResponse.json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error: any) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch logs', message: error.message },
      { status: 500 }
    );
  }
}
