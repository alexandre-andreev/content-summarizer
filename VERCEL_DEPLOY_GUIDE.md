# 🚀 Vercel Deploy Guide - Content Summarizer with Database

## 📋 Prerequisites
- [x] Code committed to GitHub repository
- [x] Supabase database configured and running
- [x] All API keys available

## 🔧 Step-by-Step Deployment

### 1. Vercel Dashboard Setup
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import from GitHub: `alexandre-andreev/content-summarizer`
4. Configure project settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

### 2. Environment Variables Configuration
Navigate to **Project Settings** → **Environment Variables** and add:

| Variable Name | Value | Environment |
|---------------|-------|-------------|
| `GEMINI_API_KEY` | `AIzaSyD3ZVaL9WlRNT6hznb0dsdJnLEQn_5kv6s` | Production, Preview, Development |
| `TRANSCRIPT_API_KEY` | `68b1dbcf6e5abb7435211898` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://fyetqamckztihwkukpzc.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5ZXRxYW1ja3p0aWh3a3VrcHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5OTgzMTksImV4cCI6MjA3MjU3NDMxOX0.m9P_6KDYNnzYKjF8HuUSJ2mvjFlssljlsVAvHcO29o4` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5ZXRxYW1ja3p0aWh3a3VrcHpjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njk5ODMxOSwiZXhwIjoyMDcyNTc0MzE5fQ.bVmbt1SCOihQo9k9eo0c7RsaLepnv_bK3mUdDWWNmPI` | Production, Preview, Development |

### 3. Deploy Process
1. After adding all environment variables, click **"Deploy"**
2. Vercel will automatically:
   - Clone the repository
   - Install dependencies with `pnpm install`
   - Build the project with `npm run build`
   - Deploy to production

### 4. Expected Build Output
```bash
✓ Creating an optimized production build
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
✓ Finalizing page optimization
```

### 5. Post-Deploy Verification
After successful deployment, test:

#### **5.1 Basic Functionality**
- [ ] Home page loads correctly
- [ ] Form accepts YouTube URLs
- [ ] API endpoints respond properly

#### **5.2 Database Integration**
- [ ] User registration works
- [ ] Login/logout functionality
- [ ] Dashboard displays correctly
- [ ] Summary history saves to database

#### **5.3 AI Summarization**
- [ ] YouTube transcript extraction works
- [ ] Gemini API summarization (should work without VPN on Vercel)
- [ ] Summary display and formatting

## 🎯 Expected Features After Deploy

### ✅ **Working Features**
1. **YouTube Video Summarization**
   - Paste any YouTube URL
   - Get AI-generated summary in Russian
   - Works with Gemini API (no VPN needed on Vercel)

2. **User Authentication**
   - Email/password registration
   - Login/logout
   - Session management
   - OAuth integration (Google, GitHub)

3. **Database Integration**
   - User profiles automatically created
   - All summaries saved to user account
   - Summary history with search and filters
   - Favorites functionality

4. **Dashboard & Analytics**
   - Personal statistics
   - Recent summaries
   - Usage analytics
   - Summary management

## 🔗 **URLs After Deploy**
- **Production**: `https://content-summarizer-[hash].vercel.app`
- **Custom Domain**: (if configured)

## 🛠️ **Troubleshooting**

### Build Errors
If build fails, check:
1. **Environment Variables**: All 5 variables added correctly
2. **Dependencies**: `package.json` and `pnpm-lock.yaml` in repo
3. **TypeScript**: No type errors in code

### Runtime Errors
1. **Database Connection**: Check Supabase keys and URL
2. **API Access**: Verify Gemini and Transcript API keys
3. **CORS Issues**: Should be resolved automatically on Vercel

### Performance Issues
1. **Cold Starts**: Normal for serverless functions
2. **API Timeouts**: Increase timeout limits if needed
3. **Database Queries**: Optimized with proper indexing

## 🎉 **Success Criteria**
After deployment, you should have:
- ✅ Full-featured YouTube summarizer
- ✅ User accounts and authentication
- ✅ Summary history and management
- ✅ Working without VPN (Gemini API accessible)
- ✅ Database persistence for all user data

## 📞 **Support**
If issues arise:
1. Check Vercel deployment logs
2. Verify environment variables
3. Test Supabase connection
4. Check API key limits and quotas