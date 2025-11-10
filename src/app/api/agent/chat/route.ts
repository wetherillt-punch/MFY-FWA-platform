import { NextRequest, NextResponse } from 'next/server';
import { chatWithAgent } from '@/lib/agent';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, context, conversationHistory } = body;

    if (!message || !context) {
      return NextResponse.json(
        { error: 'Invalid request: message and context required' },
        { status: 400 }
      );
    }

    console.log(`Agent chat: "${message}"`);

    const response = await chatWithAgent({
      message,
      context,
      conversationHistory,
    });

    return NextResponse.json({ response });
  } catch (error: any) {
    console.error('Agent chat error:', error);
    return NextResponse.json(
      { error: error.message || 'Chat failed' },
      { status: 500 }
    );
  }
}
