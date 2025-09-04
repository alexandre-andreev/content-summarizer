import { GoogleGenerativeAI } from '@google/generative-ai';

// Alternative AI provider function
async function summarizeWithOpenAI(transcriptText: string): Promise<string> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey || openaiApiKey === 'ДОБАВЬТЕ_ВАШ_OPENAI_КЛЮЧ_ЗДЕСЬ') {
    // If no OpenAI key configured, return a placeholder summary
    console.log('OpenAI API key not configured, returning placeholder summary');
    const cleanText = sanitizeTextForAPI(transcriptText);
    return `Краткое содержание:\n\nВидео содержит ${cleanText.length} символов текста. К сожалению, автоматическое резюмирование временно недоступно из-за ограничений API. \n\nДля получения полного резюме необходимо настроить OpenAI API ключ.\n\n[Это автоматически сгенерированное сообщение]`;
  }

  // Additional safeguard - ensure text is clean and properly encoded
  const cleanText = sanitizeTextForAPI(transcriptText);
  
  // Ensure the text is properly encoded for JSON
  const requestBody = {
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: 'You are an expert in summarizing YouTube videos. Your task is to provide a concise and clear summary of video transcripts. Highlight the main points and key takeaways. The summary should be in Russian.'
      },
      {
        role: 'user',
        content: `Please summarize this YouTube video transcript:\n\n${cleanText}`
      }
    ],
    max_tokens: 1000,
    temperature: 0.7
  };
  
  // Convert to JSON with proper encoding
  const bodyString = JSON.stringify(requestBody);
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: bodyString
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function getYoutubeId(url: string): string | null {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Helper function to clean and normalize text for API processing
function sanitizeTextForAPI(text: string): string {
    try {
        // First, normalize Unicode to prevent encoding issues
        const normalized = text.normalize('NFC');
        
        // Remove or replace problematic characters that can cause ByteString errors
        const cleaned = normalized
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
            .replace(/[\u2000-\u206F\u2E00-\u2E7F\u3000-\u303F]/g, ' ') // Replace various space characters
            .replace(/[\uFEFF\uFFFE\uFFFF]/g, '') // Remove byte order marks and other problematic Unicode
            .replace(/\s+/g, ' ') // Normalize multiple spaces
            .trim();
        
        // Test if the string can be safely encoded to UTF-8
        const encoder = new TextEncoder();
        const decoder = new TextDecoder('utf-8', { fatal: true });
        
        try {
            const encoded = encoder.encode(cleaned);
            decoder.decode(encoded); // This will throw if encoding is invalid
            return cleaned;
        } catch (encodingError) {
            // If encoding fails, fallback to ASCII-safe version
            console.warn('Text encoding issue detected, falling back to ASCII-safe version');
            return cleaned.replace(/[^\x00-\x7F]/g, ''); // Keep only ASCII characters
        }
    } catch (error) {
        console.error('Error in sanitizeTextForAPI:', error);
        // Ultimate fallback - keep only basic ASCII
        return text.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
    }
}

async function getTranscript(videoId: string): Promise<string> {
    const apiKey = process.env.TRANSCRIPT_API_KEY;
    const response = await fetch('https://www.youtube-transcript.io/api/transcripts', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${apiKey}`,
            'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({ ids: [videoId] })
    });

    if (!response.ok) {
        if (response.status === 401) {
            const keyHint = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : 'Not loaded';
            throw new Error(`Authorization failed (401). Key hint: [${keyHint}]`);
        }
        throw new Error(`Failed to fetch transcript. Status: ${response.status}`);
    }

    const data = await response.json();

    // Defensive coding: check the response structure revealed by curl.
    if (!Array.isArray(data) || data.length === 0 || !data[0].tracks || !Array.isArray(data[0].tracks) || data[0].tracks.length === 0 || !data[0].tracks[0].transcript) {
        console.error('Unexpected API response structure:', data);
        throw new Error('Could not get transcript for this video. The API returned an unexpected format or an empty transcript.');
    }

    const transcriptSegments = data[0].tracks[0].transcript;
    const rawText = transcriptSegments.map((segment: any) => segment.text).join(' ');
    
    // Sanitize the text to prevent encoding issues
    return sanitizeTextForAPI(rawText);
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

  // Sanitize transcript text to prevent encoding issues
  const sanitizedTranscript = sanitizeTextForAPI(transcriptText);
  console.log(`Transcript length: ${sanitizedTranscript.length} characters`);
  
  // Truncate if too long (Gemini has limits)
  const maxLength = 30000;
  const finalTranscript = sanitizedTranscript.length > maxLength 
    ? sanitizedTranscript.substring(0, maxLength) + '...'
    : sanitizedTranscript;

  // Try Gemini first, fallback to OpenAI if blocked
  try {
    console.log('Trying Gemini API...');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!); 
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

    const prompt = 'You are an expert in summarizing YouTube videos. Your task is to provide a concise and clear summary of the following transcript. Highlight the main points and key takeaways. The summary should be in Russian:';

    // Use parts array format to avoid encoding issues
    const result = await model.generateContent({
      contents: [{
        parts: [
          { text: prompt },
          { text: finalTranscript }
        ]
      }]
    });
    
    return result.response.text();
  } catch (geminiError: any) {
    console.log('Gemini failed, trying OpenAI...', geminiError.message);
    
    // Check for various error conditions
    const errorMessage = geminiError.message || '';
    const shouldTryOpenAI = 
      errorMessage.includes('location is not supported') || 
      errorMessage.includes('User location') ||
      errorMessage.includes('ByteString') ||
      errorMessage.includes('character') ||
      errorMessage.includes('encoding');
    
    if (shouldTryOpenAI) {
      console.log('Using OpenAI due to Gemini restriction/encoding issue');
      return await summarizeWithOpenAI(finalTranscript);
    }
    
    // If it's other error, still try OpenAI as fallback
    try {
      return await summarizeWithOpenAI(finalTranscript);
    } catch (openaiError: any) {
      // If both fail, throw the original Gemini error
      throw new Error(`Both AI services failed. Gemini: ${geminiError.message}. OpenAI: ${openaiError.message}`);
    }
  }
}