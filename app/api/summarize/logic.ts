import { GoogleGenerativeAI } from '@google/generative-ai';

// Alternative AI provider function
async function summarizeWithOpenAI(transcriptText: string): Promise<string> {
  console.log('🤖 OpenAI Step 1: Starting OpenAI summarization...');
  
  const openaiApiKey = process.env.OPENAI_API_KEY;
  console.log('🔑 OpenAI API key present:', !!openaiApiKey);
  
  if (!openaiApiKey || openaiApiKey === 'ДОБАВЬТЕ_ВАШ_OPENAI_КЛЮЧ_ЗДЕСЬ') {
    // If no OpenAI key configured, return a placeholder summary
    console.log('🤖 OpenAI Step 2: API key not configured, returning placeholder summary');
    const cleanText = sanitizeTextForAPI(transcriptText);
    return `Краткое содержание:\n\nВидео содержит ${cleanText.length} символов текста. К сожалению, автоматическое резюмирование временно недоступно из-за ограничений API. \n\nДля получения полного резюме необходимо настроить OpenAI API ключ.\n\n[Это автоматически сгенерированное сообщение]`;
  }

  console.log('🤖 OpenAI Step 3: Sanitizing text...');
  // Additional safeguard - ensure text is clean and properly encoded
  const cleanText = sanitizeTextForAPI(transcriptText);
  console.log('🤖 OpenAI Step 4: Text sanitized, length:', cleanText.length);
  
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
  
  console.log('🤖 OpenAI Step 5: Request body prepared');
  
  // Convert to JSON with proper encoding
  const bodyString = JSON.stringify(requestBody);
  console.log('🤖 OpenAI Step 6: Making API request...');
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: bodyString
  });

  console.log('🤖 OpenAI Step 7: Response received, status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ OpenAI API error:', response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  console.log('🤖 OpenAI Step 8: Parsing response...');
  const data = await response.json();
  console.log('🤖 OpenAI Step 9: Response parsed successfully');
  
  const summary = data.choices[0].message.content;
  console.log('✅ OpenAI summary completed, length:', summary?.length || 0);
  return summary;
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
    console.log('🔗 Transcript Step 1: Getting transcript for video ID:', videoId)
    const apiKey = process.env.TRANSCRIPT_API_KEY;
    console.log('🔑 Transcript API key present:', !!apiKey)
    
    console.log('🔗 Transcript Step 2: Making API request...');
    const response = await fetch('https://www.youtube-transcript.io/api/transcripts', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${apiKey}`,
            'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({ ids: [videoId] })
    });

    console.log('🔗 Transcript Step 3: Response received, status:', response.status)
    
    if (!response.ok) {
        if (response.status === 401) {
            const keyHint = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : 'Not loaded';
            console.error('❌ Authorization failed (401). Key hint:', keyHint);
            throw new Error(`Authorization failed (401). Key hint: [${keyHint}]`);
        }
        console.error('❌ Failed to fetch transcript. Status:', response.status);
        throw new Error(`Failed to fetch transcript. Status: ${response.status}`);
    }

    console.log('🔗 Transcript Step 4: Parsing response...');
    const data = await response.json();
    console.log('🔗 Transcript Step 5: Response parsed');
    console.log('Data type:', typeof data, 'Is array:', Array.isArray(data));
    console.log('Array length:', Array.isArray(data) ? data.length : 'N/A');

    // Defensive coding: check the response structure revealed by curl.
    if (!Array.isArray(data) || data.length === 0 || !data[0].tracks || !Array.isArray(data[0].tracks) || data[0].tracks.length === 0 || !data[0].tracks[0].transcript) {
        console.error('❌ Unexpected API response structure:', data);
        throw new Error('Could not get transcript for this video. The API returned an unexpected format or an empty transcript.');
    }

    console.log('🔗 Transcript Step 6: Extracting transcript segments...');
    const transcriptSegments = data[0].tracks[0].transcript;
    console.log('Transcript segments found:', transcriptSegments?.length || 0)
    
    console.log('🔗 Transcript Step 7: Joining segments...');
    const rawText = transcriptSegments.map((segment: any) => segment.text).join(' ');
    console.log('Raw transcript length:', rawText.length)
    
    console.log('🔗 Transcript Step 8: Sanitizing text...');
    // Sanitize the text to prevent encoding issues
    const sanitized = sanitizeTextForAPI(rawText);
    console.log('✅ Transcript sanitized, final length:', sanitized.length)
    return sanitized;
}

export async function summarizeLogic(videoUrl: string) {
  console.log('📹 Starting summarizeLogic for:', videoUrl)
  
  if (!videoUrl) {
    throw new Error('Video URL is required');
  }

  const videoId = getYoutubeId(videoUrl);
  console.log('🆔 Extracted video ID:', videoId)
  
  if (!videoId) {
    throw new Error('Invalid YouTube URL or could not extract video ID.');
  }

  console.log('📜 Getting transcript...')
  const transcriptText = await getTranscript(videoId);

  if (!transcriptText) {
      throw new Error('Could not get transcript for this video.');
  }

  // Sanitize transcript text to prevent encoding issues
  const sanitizedTranscript = sanitizeTextForAPI(transcriptText);
  console.log(`✅ Transcript processed: ${sanitizedTranscript.length} characters`);
  
  // Truncate if too long (Gemini has limits)
  const maxLength = 30000;
  const finalTranscript = sanitizedTranscript.length > maxLength 
    ? sanitizedTranscript.substring(0, maxLength) + '...'
    : sanitizedTranscript;

  console.log(`🧬 Final transcript length: ${finalTranscript.length} characters`);

  // Try Gemini first, fallback to OpenAI if blocked
  try {
    console.log('🤖 Step 1: Trying Gemini API...');
    console.log('🔑 Gemini API key present:', !!process.env.GEMINI_API_KEY);
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!); 
    console.log('🤖 Step 2: GoogleGenerativeAI instance created');
    
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
    console.log('🤖 Step 3: Model instance created');

    const prompt = 'You are an expert in summarizing YouTube videos. Your task is to provide a concise and clear summary of the following transcript. Highlight the main points and key takeaways. The summary should be in Russian:';

    console.log('🤖 Step 4: Sending request to Gemini...');
    console.log('📝 Prompt length:', prompt.length);
    console.log('📄 Transcript length for API:', finalTranscript.length);
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Gemini API timeout after 90 seconds')), 90000);
    });
    
    // Use parts array format to avoid encoding issues
    const contentPromise = model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { text: finalTranscript }
        ]
      }]
    });
    
    console.log('🤖 Step 5: Waiting for Gemini response...');
    const result = await Promise.race([contentPromise, timeoutPromise]) as any;
    console.log('🤖 Step 6: Gemini response received');
    
    const summary = result.response.text();
    console.log('🤖 Step 7: Text extracted from response');
    console.log('✅ Gemini API succeeded, summary length:', summary?.length || 0);
    return summary;
  } catch (geminiError: any) {
    console.log('❌ Gemini failed, error details:', {
      message: geminiError.message,
      name: geminiError.name,
      stack: geminiError.stack?.substring(0, 500) + '...'
    });
    
    // Check for various error conditions
    const errorMessage = geminiError.message || '';
    const shouldTryOpenAI = 
      errorMessage.includes('location is not supported') || 
      errorMessage.includes('User location') ||
      errorMessage.includes('ByteString') ||
      errorMessage.includes('character') ||
      errorMessage.includes('encoding');
    
    if (shouldTryOpenAI) {
      console.log('🔄 Using OpenAI due to Gemini restriction/encoding issue');
      console.log('🤖 Step 8: Trying OpenAI fallback...');
      return await summarizeWithOpenAI(finalTranscript);
    }
    
    // If it's other error, still try OpenAI as fallback
    try {
      console.log('🔄 Trying OpenAI as general fallback...');
      console.log('🤖 Step 8: Calling OpenAI service...');
      const openaiResult = await summarizeWithOpenAI(finalTranscript);
      console.log('✅ OpenAI fallback succeeded');
      return openaiResult;
    } catch (openaiError: any) {
      console.error('❌ Both AI services failed');
      console.error('Gemini error:', geminiError.message);
      console.error('OpenAI error:', openaiError.message);
      // If both fail, throw the original Gemini error
      throw new Error(`Both AI services failed. Gemini: ${geminiError.message}. OpenAI: ${openaiError.message}`);
    }
  }
}