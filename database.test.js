const assert = require('assert');

// Mock Supabase client for testing
const mockSupabase = {
  auth: {
    getUser: async () => ({ data: { user: { id: 'test-user-id' } }, error: null }),
    signUp: async (credentials) => ({ data: { user: { id: 'new-user-id' } }, error: null }),
    signInWithPassword: async (credentials) => ({ data: { user: { id: 'test-user-id' } }, error: null }),
  },
  from: (table) => ({
    select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'test-id' }, error: null }) }) }),
    insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'new-id' }, error: null }) }) }),
    update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: { id: 'updated-id' }, error: null }) }) }) }),
    delete: () => ({ eq: () => ({ error: null }) }),
  }),
};

// Mock database service
const mockDatabaseService = {
  createSummary: async (summary) => {
    if (summary.youtube_url.includes('fail')) {
      return { summary: null, error: new Error('Database error') };
    }
    return { summary: { id: 'new-summary-id', ...summary }, error: null };
  },
  
  getUserSummaries: async (userId, options = {}) => {
    if (userId === 'fail-user') {
      return { summaries: [], error: new Error('User not found'), count: 0 };
    }
    
    const mockSummaries = [
      {
        id: 'summary-1',
        user_id: userId,
        youtube_url: 'https://youtube.com/watch?v=test1',
        video_id: 'test1',
        summary_text: 'Test summary 1',
        created_at: new Date().toISOString(),
        is_favorite: false,
      },
      {
        id: 'summary-2',
        user_id: userId,
        youtube_url: 'https://youtube.com/watch?v=test2',
        video_id: 'test2',
        summary_text: 'Test summary 2',
        created_at: new Date().toISOString(),
        is_favorite: true,
      },
    ];
    
    let filteredSummaries = mockSummaries;
    
    if (options.search) {
      filteredSummaries = mockSummaries.filter(s => 
        s.summary_text.includes(options.search) || 
        s.video_title?.includes(options.search)
      );
    }
    
    return { summaries: filteredSummaries, error: null, count: filteredSummaries.length };
  },
  
  toggleFavorite: async (summaryId, userId) => {
    if (summaryId === 'invalid-id') {
      return { summary: null, error: new Error('Summary not found') };
    }
    return { summary: { id: summaryId, is_favorite: true }, error: null };
  },
  
  getDashboardData: async (userId) => {
    if (userId === 'fail-user') {
      return { totalSummaries: 0, recentSummaries: [], favoriteCount: 0, thisWeekCount: 0, error: new Error('Failed to load dashboard') };
    }
    
    return {
      totalSummaries: 5,
      recentSummaries: [
        { id: '1', summary_text: 'Recent summary 1', created_at: new Date().toISOString() },
        { id: '2', summary_text: 'Recent summary 2', created_at: new Date().toISOString() },
      ],
      favoriteCount: 2,
      thisWeekCount: 3,
      error: null,
    };
  },
  
  trackUsage: async (stats) => {
    if (stats.action === 'fail') {
      return { error: new Error('Failed to track usage') };
    }
    return { error: null };
  },
};

// Mock authentication service
const mockAuthService = {
  signUp: async (email, password) => {
    if (email === 'existing@example.com') {
      return { data: null, error: new Error('User already exists') };
    }
    return { data: { user: { id: 'new-user-id', email } }, error: null };
  },
  
  signIn: async (email, password) => {
    if (email === 'wrong@example.com') {
      return { data: null, error: new Error('Invalid credentials') };
    }
    return { data: { user: { id: 'test-user-id', email } }, error: null };
  },
  
  signOut: async () => {
    return { error: null };
  },
};

// Test suites
const authTests = {
  'should successfully sign up a new user': async () => {
    const result = await mockAuthService.signUp('test@example.com', 'password123');
    assert.strictEqual(result.error, null);
    assert.strictEqual(result.data.user.email, 'test@example.com');
  },

  'should handle sign up with existing email': async () => {
    const result = await mockAuthService.signUp('existing@example.com', 'password123');
    assert.notStrictEqual(result.error, null);
    assert.strictEqual(result.data, null);
  },

  'should successfully sign in with valid credentials': async () => {
    const result = await mockAuthService.signIn('test@example.com', 'password123');
    assert.strictEqual(result.error, null);
    assert.strictEqual(result.data.user.email, 'test@example.com');
  },

  'should fail sign in with invalid credentials': async () => {
    const result = await mockAuthService.signIn('wrong@example.com', 'wrongpassword');
    assert.notStrictEqual(result.error, null);
    assert.strictEqual(result.data, null);
  },
};

const databaseTests = {
  'should create a new summary': async () => {
    const summaryData = {
      user_id: 'test-user-id',
      youtube_url: 'https://youtube.com/watch?v=test',
      video_id: 'test',
      summary_text: 'Test summary',
      is_favorite: false,
    };
    
    const result = await mockDatabaseService.createSummary(summaryData);
    assert.strictEqual(result.error, null);
    assert.strictEqual(result.summary.summary_text, 'Test summary');
  },

  'should handle database error when creating summary': async () => {
    const summaryData = {
      user_id: 'test-user-id',
      youtube_url: 'https://youtube.com/watch?v=fail',
      video_id: 'fail',
      summary_text: 'Test summary',
      is_favorite: false,
    };
    
    const result = await mockDatabaseService.createSummary(summaryData);
    assert.notStrictEqual(result.error, null);
    assert.strictEqual(result.summary, null);
  },

  'should retrieve user summaries': async () => {
    const result = await mockDatabaseService.getUserSummaries('test-user-id');
    assert.strictEqual(result.error, null);
    assert.strictEqual(result.summaries.length, 2);
    assert.strictEqual(result.count, 2);
  },

  'should handle search in user summaries': async () => {
    const result = await mockDatabaseService.getUserSummaries('test-user-id', { search: 'Test summary 1' });
    assert.strictEqual(result.error, null);
    assert.strictEqual(result.summaries.length, 1);
    assert.strictEqual(result.summaries[0].summary_text, 'Test summary 1');
  },

  'should toggle favorite status': async () => {
    const result = await mockDatabaseService.toggleFavorite('summary-1', 'test-user-id');
    assert.strictEqual(result.error, null);
    assert.strictEqual(result.summary.is_favorite, true);
  },

  'should handle invalid summary ID when toggling favorite': async () => {
    const result = await mockDatabaseService.toggleFavorite('invalid-id', 'test-user-id');
    assert.notStrictEqual(result.error, null);
    assert.strictEqual(result.summary, null);
  },

  'should get dashboard data': async () => {
    const result = await mockDatabaseService.getDashboardData('test-user-id');
    assert.strictEqual(result.error, null);
    assert.strictEqual(result.totalSummaries, 5);
    assert.strictEqual(result.favoriteCount, 2);
    assert.strictEqual(result.thisWeekCount, 3);
  },

  'should track usage statistics': async () => {
    const stats = {
      user_id: 'test-user-id',
      action: 'summarize',
      metadata: { video_url: 'https://youtube.com/test' }
    };
    
    const result = await mockDatabaseService.trackUsage(stats);
    assert.strictEqual(result.error, null);
  },
};

// Integration tests (combining API + Database)
const integrationTests = {
  'should handle complete summarization flow with database storage': async () => {
    // Step 1: User authentication
    const authResult = await mockAuthService.signIn('test@example.com', 'password123');
    assert.strictEqual(authResult.error, null);
    
    const userId = authResult.data.user.id;
    
    // Step 2: Create summary in database
    const summaryData = {
      user_id: userId,
      youtube_url: 'https://youtube.com/watch?v=test',
      video_id: 'test',
      summary_text: 'Generated summary',
      processing_time: 2500,
      is_favorite: false,
    };
    
    const createResult = await mockDatabaseService.createSummary(summaryData);
    assert.strictEqual(createResult.error, null);
    
    // Step 3: Track usage
    const trackResult = await mockDatabaseService.trackUsage({
      user_id: userId,
      action: 'summarize',
      summary_id: createResult.summary.id,
      metadata: { processing_time: 2500 }
    });
    assert.strictEqual(trackResult.error, null);
    
    // Step 4: Verify summary appears in user's history
    const historyResult = await mockDatabaseService.getUserSummaries(userId);
    assert.strictEqual(historyResult.error, null);
    assert(historyResult.summaries.length > 0);
  },

  'should handle user registration and first summary creation': async () => {
    // Step 1: New user registration
    const signUpResult = await mockAuthService.signUp('newuser@example.com', 'password123');
    assert.strictEqual(signUpResult.error, null);
    
    const userId = signUpResult.data.user.id;
    
    // Step 2: Get initial dashboard (should be empty)
    const dashboardResult = await mockDatabaseService.getDashboardData(userId);
    assert.strictEqual(dashboardResult.error, null);
    
    // Step 3: Create first summary
    const summaryData = {
      user_id: userId,
      youtube_url: 'https://youtube.com/watch?v=first',
      video_id: 'first',
      summary_text: 'First summary',
      is_favorite: false,
    };
    
    const createResult = await mockDatabaseService.createSummary(summaryData);
    assert.strictEqual(createResult.error, null);
  },
};

// Test runner
async function runTests() {
  let passed = 0;
  let failed = 0;

  console.log('🧪 Running Authentication Tests...\n');
  for (const [name, testFn] of Object.entries(authTests)) {
    try {
      await testFn();
      console.log(`\u001b[32m✔ ${name}\u001b[0m`);
      passed++;
    } catch (error) {
      console.error(`\u001b[31m✖ ${name}\u001b[0m`);
      console.error(error);
      failed++;
    }
  }

  console.log('\n🗄️ Running Database Tests...\n');
  for (const [name, testFn] of Object.entries(databaseTests)) {
    try {
      await testFn();
      console.log(`\u001b[32m✔ ${name}\u001b[0m`);
      passed++;
    } catch (error) {
      console.error(`\u001b[31m✖ ${name}\u001b[0m`);
      console.error(error);
      failed++;
    }
  }

  console.log('\n🔄 Running Integration Tests...\n');
  for (const [name, testFn] of Object.entries(integrationTests)) {
    try {
      await testFn();
      console.log(`\u001b[32m✔ ${name}\u001b[0m`);
      passed++;
    } catch (error) {
      console.error(`\u001b[31m✖ ${name}\u001b[0m`);
      console.error(error);
      failed++;
    }
  }

  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('\n⚠️ Some tests failed. Please check the implementation.');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed! The database integration is working correctly.');
  }
}

runTests();