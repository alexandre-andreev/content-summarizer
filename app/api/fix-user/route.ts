import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: NextRequest) {
  try {
    console.log('=== FIX USER API ===')
    
    const { userId } = await req.json()
    
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    
    console.log('Fixing user ID:', userId)
    
    // Get auth user details
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId)
    
    if (authError || !authUser.user) {
      console.error('Auth user not found:', authError?.message)
      return NextResponse.json({ 
        error: 'Auth user not found', 
        details: authError?.message 
      }, { status: 404 })
    }
    
    console.log('Auth user found:', {
      id: authUser.user.id,
      email: authUser.user.email,
      createdAt: authUser.user.created_at
    })
    
    // Check if public user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()
    
    if (existingUser) {
      console.log('Public user already exists')
      return NextResponse.json({ 
        message: 'User already exists in public.users table',
        userId,
        status: 'already_exists'
      })
    }
    
    // Create user in public.users table
    const userMetadata = authUser.user.user_metadata || {}
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        email: authUser.user.email,
        display_name: userMetadata.display_name || userMetadata.name || null,
        avatar_url: userMetadata.avatar_url || userMetadata.picture || null,
        created_at: authUser.user.created_at,
        last_login: new Date().toISOString(),
        is_active: true
      })
      .select()
      .single()
    
    if (insertError) {
      console.error('Failed to create public user:', insertError)
      return NextResponse.json({ 
        error: 'Failed to create user record', 
        details: insertError.message 
      }, { status: 500 })
    }
    
    console.log('✅ User created successfully:', newUser.id)
    
    return NextResponse.json({
      message: 'User successfully created in public.users table',
      user: {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.display_name,
        createdAt: newUser.created_at
      },
      status: 'created'
    })
    
  } catch (error) {
    console.error('Error in fix-user:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}