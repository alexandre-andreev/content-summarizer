import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(req: NextRequest) {
  try {
    console.log('=== CHECK USER API ===')
    
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json({ error: 'userId parameter is required' }, { status: 400 })
    }
    
    console.log('Checking user ID:', userId)
    
    // Check if user exists in auth.users
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId)
    console.log('Auth user check:', { exists: !!authUser.user, error: authError?.message })
    
    // Check if user exists in public.users
    const { data: publicUser, error: publicError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    
    console.log('Public user check:', { exists: !!publicUser, error: publicError?.message })
    
    // Check if trigger exists
    const { data: triggers, error: triggerError } = await supabaseAdmin
      .rpc('check_trigger_exists')
      .single()
    
    return NextResponse.json({
      userId,
      authUser: {
        exists: !!authUser.user,
        email: authUser.user?.email,
        createdAt: authUser.user?.created_at,
        error: authError?.message || null
      },
      publicUser: {
        exists: !!publicUser,
        email: publicUser?.email,
        displayName: publicUser?.display_name,
        createdAt: publicUser?.created_at,
        error: publicError?.message || null
      },
      triggerCheck: {
        error: triggerError?.message || null
      }
    })
    
  } catch (error) {
    console.error('Error in check-user:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}