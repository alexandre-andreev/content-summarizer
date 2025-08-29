import { GoogleGenerativeAI } from '@google/generative-ai';

function getYoutubeId(url: string): string | null {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

async function getTranscript(videoId: string): Promise<string> {
    const response = await fetch('https://www.youtube-transcript.io/api/transcripts', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${process.env.TRANSCRIPT_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: [videoId] })
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch transcript. Status: ${response.status}`);
    }

    const data = await response.json();

    // Defensive coding: check the response structure.
    if (!Array.isArray(data) || data.length === 0 || !data[0].transcript) {
        console.error('Unexpected API response structure:', data);
        throw new Error('Could not get transcript for this video. The API returned an unexpected format or an empty transcript.');
    }

    return data[0].transcript;
}

export async function summarizeLogic(videoUrl: string) {
  if (!videoUrl) {
    throw new Error('Video URL is required');
  }

  const videoId = getYoutubeId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL or could not extract video ID.');
  }

  const transcriptText = await getTranscript(videoId);

  if (!transcriptText) {
      throw new Error('Could not get transcript for this video.');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!); 
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

  const prompt = 'You are an expert in summarizing YouTube videos. Your task is to provide a concise and clear summary of the following transcript. Highlight the main points and key takeaways. The summary should be in Russian:';

  const result = await model.generateContent([prompt, transcriptText].join('\n'));
  return result.response.text();
}