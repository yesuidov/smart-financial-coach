import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Helper functions for database operations
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export const signUp = async (email, password, userData) => {
  return await supabase.auth.signUp({
    email,
    password,
    options: {
      data: userData
    }
  })
}

export const signIn = async (email, password) => {
  return await supabase.auth.signInWithPassword({
    email,
    password
  })
}

export const signOut = async () => {
  return await supabase.auth.signOut()
}

export const resetPassword = async (email) => {
  return await supabase.auth.resetPasswordForEmail(email)
}

// Database helpers
export const createUserProfile = async (userId, profileData) => {
  return await supabase
    .from('user_profiles')
    .insert([{
      id: userId,
      ...profileData
    }])
}

export const getUserProfile = async (userId) => {
  return await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single()
}

export const updateUserProfile = async (userId, updates) => {
  return await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
}