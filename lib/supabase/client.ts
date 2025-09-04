import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for our database
export interface User {
  id: string
  email: string
  display_name?: string
  avatar_url?: string
  created_at: string
  updated_at: string
  last_login?: string
  is_active: boolean
}

export interface Summary {
  id: string
  user_id: string
  youtube_url: string
  video_id: string
  video_title?: string
  video_duration?: number
  transcript_text?: string
  summary_text: string
  processing_time?: number
  created_at: string
  is_favorite: boolean
  tags?: string[]
}

export interface UsageStats {
  id: string
  user_id: string
  action: string
  summary_id?: string
  metadata?: Record<string, any>
  created_at: string
}