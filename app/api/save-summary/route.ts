import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: NextRequest) {
  try {
    console.log('=== SAVE SUMMARY API STARTED ===')
    
    // Get the authorization header
    const authHeader = req.headers.get('authorization')
    console.log('Auth header present:', !!authHeader)
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ No authorization token provided')
      return NextResponse.json({ error: 'No authorization token provided' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    console.log('Token length:', token.length)
    
    // Verify the token with the regular Supabase client
    const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    console.log('Supabase client created for token verification')
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      console.error('❌ Token verification failed:', authError?.message || 'No user found')
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    
    console.log('✅ Token verified for user:', user.id)

    const body = await req.json()
    const { youtube_url, video_id, video_title, summary_text, processing_time } = body
    
    console.log('Request body received:', {
      youtube_url: youtube_url?.substring(0, 50) + '...',
      video_id,
      video_title,
      summary_text_length: summary_text?.length || 0,
      processing_time
    })

    // Validate required fields
    if (!youtube_url || !video_id || !summary_text) {
      console.error('❌ Missing required fields:', { youtube_url: !!youtube_url, video_id: !!video_id, summary_text: !!summary_text })
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    if (!summary_text || summary_text.trim().length === 0) {
      console.error('❌ Summary text is empty or whitespace only')
      return NextResponse.json({ error: 'Summary text cannot be empty' }, { status: 400 })
    }

    console.log('✅ All validations passed.');

    // Check if user exists in public.users table, create if missing
    console.log('🔍 Checking if user exists in public.users...');
    const { data: existingUser, error: userCheckError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();
    
    if (userCheckError && userCheckError.code === 'PGRST116') {
      console.log('👤 User not found in public.users, creating automatically...');
      
      // Create user record automatically
      const userMetadata = user.user_metadata || {};
      const { error: createUserError } = await supabaseAdmin
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          display_name: userMetadata.display_name || userMetadata.name || null,
          avatar_url: userMetadata.avatar_url || userMetadata.picture || null,
          created_at: user.created_at,
          last_login: new Date().toISOString(),
          is_active: true
        });
      
      if (createUserError) {
        console.error('❌ Failed to create user record:', createUserError);
        return NextResponse.json({ 
          error: 'Failed to create user record', 
          details: createUserError.message 
        }, { status: 500 });
      }
      
      console.log('✅ User record created automatically');
    } else if (userCheckError) {
      console.error('❌ Error checking user existence:', userCheckError);
      return NextResponse.json({ 
        error: 'Database error', 
        details: userCheckError.message 
      }, { status: 500 });
    } else {
      console.log('✅ User exists in public.users');
    }

    console.log('💾 Saving to database...');
    console.log('Using supabase URL:', supabaseUrl)
    console.log('Service role key present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Save to database using service role (bypasses RLS)
    const insertData = {
      user_id: user.id,
      youtube_url,
      video_id,
      video_title: video_title || null,
      summary_text: summary_text.trim(),
      processing_time: processing_time || null,
      is_favorite: false
    }
    
    console.log('Insert data prepared:', {
      user_id: insertData.user_id,
      youtube_url: insertData.youtube_url.substring(0, 50) + '...',
      video_id: insertData.video_id,
      video_title: insertData.video_title,
      summary_text_length: insertData.summary_text.length,
      processing_time: insertData.processing_time,
      is_favorite: insertData.is_favorite
    })
    
    const { data: summary, error } = await supabaseAdmin
      .from('summaries')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('❌ Database insert error:', error)
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      return NextResponse.json({ error: 'Failed to save summary', details: error.message }, { status: 500 })
    }

    console.log('✅ Summary saved successfully!')
    console.log('Saved summary details:', {
      id: summary.id,
      user_id: summary.user_id,
      created_at: summary.created_at,
      summary_length: summary.summary_text?.length || 0
    })
    
    return NextResponse.json({ summary, success: true })

  } catch (error) {
    console.error('❌ Unexpected error in save-summary API:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}