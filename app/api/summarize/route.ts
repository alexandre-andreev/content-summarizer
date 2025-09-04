import { NextRequest, NextResponse } from 'next/server';
import { summarizeLogic } from './logic';

// Add timeout wrapper function
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}

export async function POST(req: NextRequest) {
  try {
    console.log('=== SUMMARIZE API STARTED ===')
    const { videoUrl } = await req.json();
    console.log('Video URL received:', videoUrl);
    
    console.log('Starting summarization with timeout...');
    // Add 120 second timeout (2 minutes) to prevent hanging
    const summary = await withTimeout(
      summarizeLogic(videoUrl),
      120000 // 2 minutes
    );
    
    console.log('✅ Summarization completed successfully');
    console.log('Summary length:', summary?.length || 0);
    return NextResponse.json({ summary });
  } catch (error) {
    console.error('❌ Error in /api/summarize:', error);

    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    console.error('Error message:', errorMessage);

    // Return the raw error message directly for better debugging
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}