import { GoogleGenerativeAI } from '@google/generative-ai';

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
    
    // More detailed logging for debugging
    if (Array.isArray(data) && data.length > 0) {
        console.log('First item structure:', {
            hasTracks: !!data[0].tracks,
            tracksIsArray: Array.isArray(data[0].tracks),
            tracksLength: data[0].tracks?.length || 0
        });
        
        if (data[0].tracks && Array.isArray(data[0].tracks) && data[0].tracks.length > 0) {
            console.log('First track structure:', {
                hasTranscript: !!data[0].tracks[0].transcript,
                transcriptIsArray: Array.isArray(data[0].tracks[0].transcript),
                transcriptLength: data[0].tracks[0].transcript?.length || 0
            });
        }
    }

    // Defensive coding: check the response structure revealed by curl.
    if (!Array.isArray(data) || data.length === 0 || !data[0].tracks || !Array.isArray(data[0].tracks) || data[0].tracks.length === 0 || !data[0].tracks[0].transcript) {
        console.error('❌ Unexpected API response structure:', JSON.stringify(data, null, 2).substring(0, 1000));
        throw new Error('Не удалось получить транскрипт для этого видео. Возможно, видео не имеет доступных субтитров.');
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

  // Check if title generation is disabled via environment variable
  const disableTitleGeneration = process.env.DISABLE_TITLE_GENERATION === 'true';
  
  if (disableTitleGeneration) {
    console.log('🔄 Title generation disabled, using simple summary mode');
    return await generateSimpleSummary(finalTranscript);
  }
  // Use Google Gemini API for summarization
  try {
    console.log('🤖 Step 1: Trying Gemini API...');
    console.log('🔑 Gemini API key present:', !!process.env.GEMINI_API_KEY);
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!); 
    console.log('🤖 Step 2: GoogleGenerativeAI instance created');
    
    // Try with a more reliable model first
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    console.log('🤖 Step 3: Model instance created with gemini-1.5-flash');

    // Simplified prompt for better reliability
    const prompt = `Проанализируйте следующий транскрипт YouTube видео и создайте:
1. Короткое название (2-4 слова)
2. Краткое изложение основных моментов

Формат ответа:
Название: [название]
Изложение: [текст изложения]

Транскрипт:`

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
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000
      }
    });
    
    console.log('🤖 Step 5: Waiting for Gemini response...');
    const result = await Promise.race([contentPromise, timeoutPromise]) as any;
    console.log('🤖 Step 6: Gemini response received');
    
    const responseText = result.response.text();
    console.log('🤖 Step 7: Text extracted from response');
    console.log('📄 Raw response length:', responseText?.length || 0);
    
    // Parse the response to extract title and summary
    try {
      let title = 'Видео YouTube';
      let summary = responseText;
      
      // Try to extract title and summary from structured format
      const titleMatch = responseText.match(/Название:\s*(.+?)\n/i);
      const summaryMatch = responseText.match(/Изложение:\s*([\s\S]+)/i);
      
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim();
      }
      
      if (summaryMatch && summaryMatch[1]) {
        summary = summaryMatch[1].trim();
      }
      
      // Fallback: try JSON parsing if structured format fails
      if (title === 'Видео YouTube' && (responseText.includes('{') || responseText.includes('```json'))) {
        try {
          let jsonText = responseText;
          
          // Remove code block markers if present
          if (jsonText.includes('```json')) {
            jsonText = jsonText.replace(/```json\s*|\s*```/g, '').trim();
          }
          
          const parsed = JSON.parse(jsonText);
          if (parsed.title) title = parsed.title;
          if (parsed.summary) summary = parsed.summary;
        } catch (jsonError) {
          console.log('⚠️ JSON parsing failed, using text extraction results');
        }
      }
      
      console.log('📝 Generated title:', title);
      console.log('📝 Summary length:', summary?.length || 0);
      
      return {
        title: title,
        summary: summary
      };
    } catch (parseError) {
      console.warn('⚠️ Failed to parse response, using fallback');
      console.log('Raw response:', responseText.substring(0, 200) + '...');
      
      // Ultimate fallback: treat entire response as summary
      return {
        title: "Видео YouTube",
        summary: responseText
      };
    }
  } catch (geminiError: any) {
    console.error('❌ Gemini API failed:', {
      message: geminiError.message,
      name: geminiError.name,
      stack: geminiError.stack?.substring(0, 500) + '...'
    });
    
    // Provide informative error message based on the type of error
    const errorMessage = geminiError.message || '';
    
    if (errorMessage.includes('location is not supported') || errorMessage.includes('User location')) {
      throw new Error('Невозможно получить доступ к Google Gemini API из вашего региона. Попробуйте использовать VPN или свяжитесь с администратором.');
    }
    
    if (errorMessage.includes('API key')) {
      throw new Error('Ошибка ключа API. Пожалуйста, проверьте конфигурацию Google Gemini API.');
    }
    
    if (errorMessage.includes('timeout')) {
      throw new Error('Превышено время ожидания ответа от AI API. Попробуйте ещё раз.');
    }
    
    if (errorMessage.includes('overloaded') || errorMessage.includes('503') || errorMessage.includes('Service Unavailable')) {
      // Fallback: create summary without AI title generation
      console.log('⚠️ Gemini API overloaded, falling back to simple summary mode');
      
      try {
        // Simple fallback using basic model
        const fallbackModel = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!).getGenerativeModel({ 
          model: 'gemini-pro' 
        });
        
        const simpleSummary = await fallbackModel.generateContent(
          `Кратко опишите основные моменты этого транскрипта:\n\n${finalTranscript}`
        );
        
        const summaryText = simpleSummary.response.text();
        return {
          title: "Видео YouTube",
          summary: summaryText
        };
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
        throw new Error('Сервис суммаризации временно недоступен. Попробуйте позже.');
      }
    }
    
    // Generic error message for other cases
    throw new Error(`Ошибка при создании резюме: ${errorMessage}. Попробуйте ещё раз одно видео.`);
  }
}

// Simple summary function without title generation
async function generateSimpleSummary(transcript: string) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const result = await model.generateContent(
      `Кратко опишите основные моменты и ключевые мысли этого видео:\n\n${transcript}`
    );
    
    return {
      title: 'Видео YouTube',
      summary: result.response.text()
    };
  } catch (error) {
    console.error('❌ Simple summary failed:', error);
    throw new Error('Ошибка при создании краткого изложения. Попробуйте ещё раз.');
  }
}