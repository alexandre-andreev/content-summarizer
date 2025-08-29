import { NextRequest, NextResponse } from 'next/server';
import { summarizeLogic } from './logic';

export async function POST(req: NextRequest) {
  try {
    const { videoUrl } = await req.json();
    const summary = await summarizeLogic(videoUrl);
    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error in /api/summarize:', error);

    let errorMessage = 'An internal server error occurred.';
    let status = 500;

    if (error instanceof Error) {
        errorMessage = error.message;
        if (errorMessage.includes('URL')) {
            status = 400;
        }
        if (errorMessage.includes('transcript')) {
            status = 404;
        }
    }

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
