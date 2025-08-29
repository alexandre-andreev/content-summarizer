const { YoutubeTranscript } = require('youtube-transcript');

async function testTranscript(url) {
  try {
    console.log(`Fetching transcript for: ${url}`);
    const transcript = await YoutubeTranscript.fetchTranscript(url);
    console.log('Transcript fetched successfully:');
    console.log(JSON.stringify(transcript.slice(0, 5), null, 2)); // Log first 5 items for brevity
  } catch (error) {
    console.error('Error fetching transcript:');
    console.error(error);
  }
}

const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
testTranscript(videoUrl);