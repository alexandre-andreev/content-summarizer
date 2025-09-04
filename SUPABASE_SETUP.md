# 🚀 Supabase Setup Guide - Content Summarizer

## 📋 Overview
This guide will help you set up Supabase for the Content Summarizer project, including database configuration, authentication, and environment variables.

## 🎯 Prerequisites
- Supabase account (create at [supabase.com](https://supabase.com))
- Project cloned and dependencies installed

## 🚀 Step-by-Step Setup

### 1. Create Supabase Project
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: content-summarizer
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to your users
5. Click "Create new project"
6. Wait for project creation (2-3 minutes)

### 2. Configure Database Schema
1. Go to your project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Copy and paste the entire content from `/supabase/schema.sql`
4. Click **Run** to execute the SQL commands

This will create:
- `users` table for user profiles
- `summaries` table for video summaries
- `usage_stats` table for analytics
- Row Level Security policies
- Database triggers for user management

### 3. Configure Authentication
1. Go to **Authentication > Settings** in your Supabase dashboard
2. In **Site URL**, add your domain(s):
   - For development: `http://localhost:3000`
   - For production: `https://your-domain.com`
3. In **Redirect URLs**, add:
   - `http://localhost:3000/auth/callback` (development)
   - `https://your-domain.com/auth/callback` (production)

#### Enable OAuth Providers (Optional)
1. Go to **Authentication > Providers**
2. **Google OAuth**:
   - Toggle "Enable Google provider"
   - Add your Google OAuth credentials
   - Configure consent screen in Google Console
3. **GitHub OAuth**:
   - Toggle "Enable GitHub provider"
   - Create GitHub OAuth app
   - Add credentials

### 4. Get API Keys
1. Go to **Settings > API** in your Supabase dashboard
2. Copy the following values:
   - **Project URL** (NEXT_PUBLIC_SUPABASE_URL)
   - **anon public** key (NEXT_PUBLIC_SUPABASE_ANON_KEY)
   - **service_role** key (SUPABASE_SERVICE_ROLE_KEY) ⚠️ Keep secret!

### 5. Configure Environment Variables
1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Update `.env.local` with your values:
   ```bash
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   
   # Existing API Keys
   GEMINI_API_KEY=your_gemini_api_key_here
   TRANSCRIPT_API_KEY=your_rapidapi_key_here
   ```

### 6. Test the Setup
1. Start your development server:
   ```bash
   pnpm dev
   ```

2. Navigate to `http://localhost:3000`
3. Click "Create Account" or "Sign In"
4. Test user registration/login
5. Test creating a summary (should save to database)
6. Check your Supabase dashboard to verify data is being stored

### 7. Verify Database Tables
1. Go to **Table Editor** in Supabase dashboard
2. You should see three tables:
   - `users` - User profiles
   - `summaries` - Video summaries
   - `usage_stats` - Usage analytics

### 8. Security Configuration
1. **Row Level Security** is automatically enabled
2. Users can only access their own data
3. API keys are properly segregated:
   - `anon` key for client-side operations
   - `service_role` key for server-side admin operations

## 🔒 Security Best Practices

### Environment Variables
- Never commit `.env.local` to version control
- Use different keys for development/production
- Rotate keys regularly in production

### Database Security
- RLS policies are enabled by default
- Users automatically isolated
- Admin operations use service role key

### Authentication
- Email confirmation enabled by default
- Password requirements enforced
- Session management handled by Supabase

## 🚀 Production Deployment

### Vercel Environment Variables
When deploying to Vercel, add these environment variables:
1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add each variable from your `.env.local`

### Database Migration
- Schema is automatically applied
- No manual migration needed
- Data persists across deployments

## 🧪 Testing Database Functions

### Test User Registration
```bash
# In browser console or API client
fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'password123'
  })
})
```

### Test Summary Creation
1. Sign in to your app
2. Enter a YouTube URL
3. Generate summary
4. Check Supabase dashboard for new records

## 🔧 Troubleshooting

### Common Issues
1. **"Invalid API key"**
   - Check environment variables are correct
   - Ensure no extra spaces in keys
   - Verify project URL matches

2. **"User not found"**
   - Check RLS policies are applied
   - Verify user registration completed
   - Check email confirmation

3. **"Database connection failed"**
   - Verify project is running (not paused)
   - Check network connectivity
   - Verify database password

### Debug SQL
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies WHERE schemaname = 'public';

-- Check user data
SELECT id, email, created_at FROM auth.users;
```

## 📊 Monitoring

### Supabase Dashboard
- Monitor database usage
- Check authentication metrics
- Review API usage
- Monitor real-time connections

### Application Logs
- Check browser console for errors
- Monitor server logs for database issues
- Use Supabase logs for debugging

## 🎯 Next Steps
After completing this setup:
1. Test all authentication flows
2. Verify summary storage and retrieval
3. Test user dashboard functionality
4. Configure production environment
5. Set up monitoring and backups

## 📚 Additional Resources
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js + Supabase Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)

Your Content Summarizer project is now ready with full database and authentication support! 🎉