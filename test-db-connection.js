// Simple database connection test
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

// Manually read environment variables
const envContent = fs.readFileSync('.env.local', 'utf8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=')
  if (key && value) {
    envVars[key.trim()] = value.trim()
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('🔍 Testing database connection...')
console.log('Supabase URL:', supabaseUrl)
console.log('Anon Key (first 20 chars):', supabaseAnonKey?.substring(0, 20) + '...')

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testConnection() {
  try {
    console.log('\n🧪 Test 1: Basic connection test')
    const { data, error } = await supabase
      .from('summaries')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('❌ Connection failed:', error.message)
      return false
    }
    
    console.log('✅ Basic connection works')
    
    // Test 2: RLS test (without authentication)
    console.log('\n🧪 Test 2: RLS test (should fail without auth)')
    const { data: data2, error: error2 } = await supabase
      .from('summaries')
      .select('*')
      .limit(1)
    
    if (error2) {
      console.log('⚠️ RLS correctly blocking unauthenticated access:', error2.message)
    } else {
      console.log('📋 Data returned (RLS might be disabled):', data2)
    }
    
    return true
  } catch (err) {
    console.error('💥 Connection test failed:', err.message)
    return false
  }
}

testConnection().then(success => {
  if (success) {
    console.log('\n✅ Database connection test completed')
  } else {
    console.log('\n❌ Database connection test failed')
  }
  process.exit(0)
})