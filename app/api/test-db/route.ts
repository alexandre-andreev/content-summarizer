import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Simple test endpoint to check database connection
export async function GET(req: NextRequest) {
  try {
    console.log('=== DATABASE CONNECTION TEST ===')
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    console.log('Environment variables check:')
    console.log('- SUPABASE_URL present:', !!supabaseUrl)
    console.log('- SUPABASE_URL value:', supabaseUrl)
    console.log('- SERVICE_ROLE_KEY present:', !!supabaseServiceKey)
    console.log('- SERVICE_ROLE_KEY length:', supabaseServiceKey?.length || 0)
    console.log('- ANON_KEY present:', !!supabaseAnonKey)
    console.log('- ANON_KEY length:', supabaseAnonKey?.length || 0)
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ 
        error: 'Missing environment variables',
        details: {
          url: !!supabaseUrl,
          serviceKey: !!supabaseServiceKey
        }
      }, { status: 500 })
    }
    
    // Test with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    
    console.log('Testing service role connection...')
    const { data: testData, error: testError } = await supabaseAdmin
      .from('summaries')
      .select('count')
      .limit(1)
    
    if (testError) {
      console.error('Service role test failed:', testError)
      return NextResponse.json({ 
        error: 'Service role connection failed',
        details: testError
      }, { status: 500 })
    }
    
    console.log('✅ Service role connection successful')
    
    // Test basic table access
    const { data: summaries, error: summariesError } = await supabaseAdmin
      .from('summaries')
      .select('id, created_at')
      .limit(5)
    
    console.log('Summaries query result:', { 
      error: summariesError,
      count: summaries?.length || 0 
    })
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      environment: {
        url: supabaseUrl,
        serviceKeyLength: supabaseServiceKey.length,
        anonKeyLength: supabaseAnonKey?.length || 0
      },
      testResults: {
        serviceRoleConnection: !testError,
        summariesCount: summaries?.length || 0,
        summariesError: summariesError?.message || null
      }
    })
    
  } catch (error) {
    console.error('Unexpected error in test-db:', error)
    return NextResponse.json({ 
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}