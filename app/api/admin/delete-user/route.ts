import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function DELETE(req: NextRequest) {
  try {
    console.log('=== DELETE USER API ===')
    
    const { email } = await req.json()
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    
    console.log('Deleting user with email:', email)
    
    // First, find the user by email in auth.users
    const { data: { users }, error: getUserError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (getUserError) {
      console.error('Error listing users:', getUserError)
      return NextResponse.json({ 
        error: 'Failed to list users', 
        details: getUserError.message 
      }, { status: 500 })
    }
    
    const targetUser = users.find(user => user.email === email)
    
    if (!targetUser) {
      console.log('User not found in auth.users')
      return NextResponse.json({ 
        error: 'User not found', 
        email 
      }, { status: 404 })
    }
    
    console.log('Found user:', {
      id: targetUser.id,
      email: targetUser.email,
      createdAt: targetUser.created_at
    })
    
    // Delete user from auth.users (this will cascade delete from public.users due to RLS and triggers)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(targetUser.id)
    
    if (deleteAuthError) {
      console.error('Failed to delete auth user:', deleteAuthError)
      return NextResponse.json({ 
        error: 'Failed to delete user from authentication', 
        details: deleteAuthError.message 
      }, { status: 500 })
    }
    
    // Also manually clean up public.users table (in case cascade doesn't work)
    const { error: deletePublicError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', targetUser.id)
    
    if (deletePublicError && deletePublicError.code !== 'PGRST116') {
      console.warn('Warning: Failed to delete from public.users:', deletePublicError.message)
      // Don't fail the request, as auth deletion succeeded
    }
    
    console.log('✅ User successfully deleted:', email)
    
    return NextResponse.json({
      message: 'User successfully deleted',
      email: email,
      userId: targetUser.id,
      deletedAt: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Error in delete-user:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}