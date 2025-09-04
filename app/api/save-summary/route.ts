import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No authorization token provided' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Verify the token with the regular Supabase client
    const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      console.error('Token verification failed:', authError)
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await req.json()
    const { youtube_url, video_id, summary_text, processing_time } = body

    // Validate required fields
    if (!youtube_url || !video_id || !summary_text) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    console.log('API: Saving summary for user:', user.id)

    // Save to database using service role (bypasses RLS)
    const { data: summary, error } = await supabaseAdmin
      .from('summaries')
      .insert({
        user_id: user.id,
        youtube_url,
        video_id,
        summary_text,
        processing_time: processing_time || null,
        is_favorite: false
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to save summary' }, { status: 500 })
    }

    console.log('API: Summary saved successfully:', summary.id)
    return NextResponse.json({ summary, success: true })

  } catch (error) {
    console.error('Error in save-summary API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}