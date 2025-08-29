import { NextRequest, NextResponse } from 'next/server';
import { summarizeLogic } from './logic';

export async function POST(req: NextRequest) {
  try {
    const { videoUrl } = await req.json();
    const summary = await summarizeLogic(videoUrl);
    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error in /api/summarize:', error);

    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';

    // Return the raw error message directly for better debugging
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}