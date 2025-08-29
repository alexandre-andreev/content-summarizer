const assert = require('assert');
// We need to use require here because of ES module interoperability with the .ts files
const { summarizeLogic } = require('./app/api/summarize/logic.ts');

// Mock Dependencies
const mockYoutubeTranscript = {
  fetchTranscript: async (url) => {
    if (url.includes('fail_transcript')) {
      throw new Error('Failed to fetch transcript');
    }
    if (url.includes('no_transcript')) {
        return [];
    }
    return [{ text: 'this is a' }, { text: 'test transcript' }];
  },
};

const mockGemini = class {
    constructor() {}
    getGenerativeModel() {
        return {
            generateContent: async (prompt) => {
                if (prompt.includes('fail_gemini')) {
                    throw new Error('Failed to generate content');
                }
                return { response: { text: () => 'mock summary' } };
            }
        }
    }
}

// Test Runner
const tests = {
  'should return a summary for a valid URL': async () => {
    const summary = await summarizeLogic('https://youtube.com/watch?v=success', mockYoutubeTranscript, mockGemini);
    assert.strictEqual(summary, 'mock summary');
  },

  'should throw an error for an invalid URL': async () => {
    await assert.rejects(
      summarizeLogic('https://example.com', mockYoutubeTranscript, mockGemini),
      { message: 'Invalid YouTube URL' }
    );
  },

  'should throw an error when transcript is empty': async () => {
    await assert.rejects(
      summarizeLogic('https://youtube.com/watch?v=no_transcript', mockYoutubeTranscript, mockGemini),
      { message: 'Could not get transcript for this video.' }
    );
  },

  'should throw an error when transcript fetching fails': async () => {
    await assert.rejects(
      summarizeLogic('https://youtube.com/watch?v=fail_transcript', mockYoutubeTranscript, mockGemini),
      { message: 'Failed to fetch transcript' }
    );
  },

  'should throw an error when Gemini fails': async () => {
    // Need to create a specific prompt that our mock will catch
    const failingTranscriptMock = {
        fetchTranscript: async () => [{ text: 'fail_gemini' }]
    }
    await assert.rejects(
      summarizeLogic('https://youtube.com/watch?v=success', failingTranscriptMock, mockGemini),
      { message: 'Failed to generate content' }
    );
  },
};

async function runTests() {
  let passed = 0;
  let failed = 0;

  for (const [name, testFn] of Object.entries(tests)) {
    try {
      await testFn();
      console.log(`\u001b[32m✔ ${name}\u001b[0m`); // Green checkmark
      passed++;
    } catch (error) {
      console.error(`\u001b[31m✖ ${name}\u001b[0m`); // Red X
      console.error(error);
      failed++;
    }
  }

  console.log(`\nTests finished. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1); // Exit with error code if any test fails
  }
}

runTests();
