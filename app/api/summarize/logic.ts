import { YoutubeTranscript } from 'youtube-transcript-plus';
import { GoogleGenerativeAI } from '@google/generative-ai';

// This function contains the core logic and is designed to be testable.
export async function summarizeLogic(videoUrl: string, youtubeMock?: any, geminiMock?: any) {
  if (!videoUrl) {
    throw new Error('Video URL is required');
  }

  if (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be')) {
    throw new Error('Invalid YouTube URL');
  }

  const YoutubeSource = youtubeMock || YoutubeTranscript;
  const GeminiSource = geminiMock || GoogleGenerativeAI;

  const transcript = await YoutubeSource.fetchTranscript(videoUrl);

  if (!transcript || transcript.length === 0) {
    throw new Error('Could not get transcript for this video.');
  }

  const transcriptText = transcript.map((item: { text: string }) => item.text).join(' ');

  const genAI = new GeminiSource(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

  const prompt = 'You are an expert in summarizing YouTube videos. Your task is to provide a concise and clear summary of the following transcript. Highlight the main points and key takeaways. The summary should be in Russian:';

  const result = await model.generateContent([prompt, transcriptText].join('\n'));
  return result.response.text();
}
