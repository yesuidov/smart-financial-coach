import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [authError, setAuthError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    // Get initial session with proper error handling
    const getInitialSession = async () => {
      try {
        setAuthError(null);
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error);
          setAuthError({
            type: 'session_fetch',
            message: 'Unable to verify your session. Please sign in again.',
            retryable: true
          });
        } else {
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            try {
              await fetchUserProfile(session.user.id);
            } catch (profileError) {
              // Profile error is handled in fetchUserProfile
              console.error('Profile fetch failed during session init:', profileError);
            }
          }
        }
      } catch (error) {
        console.error('Session initialization error:', error);
        setAuthError({
          type: 'session_init',
          message: 'Unable to initialize your session. Please refresh the page.',
          retryable: true
        });
      } finally {
        setLoading(false);
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event, session?.user?.email)
        setSession(session)
        setUser(session?.user ?? null)
        
        if (session?.user) {
          await fetchUserProfile(session.user.id)
        } else {
          setProfile(null)
        }
        
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserProfile = async (userId, attempt = 1) => {
    const maxAttempts = 3;
    
    try {
      setAuthError(null);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No profile found - user needs to complete onboarding
          setProfile(null);
          return;
        }
        
        // Retry on network errors with exponential backoff
        if (attempt < maxAttempts && (error.message.includes('network') || error.message.includes('timeout'))) {
          console.log(`Retrying profile fetch (attempt ${attempt + 1}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          return fetchUserProfile(userId, attempt + 1);
        }
        
        throw error;
      }

      setProfile(data);
    } catch (error) {
      console.error('Profile fetch error:', error);
      setAuthError({
        type: 'profile_fetch',
        message: 'Unable to load your profile. Please check your connection and try again.',
        retryable: attempt < maxAttempts
      });
      throw error;
    }
  }

  const signUp = async (email, password, userData = {}) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: userData.displayName || userData.first_name || '',
            first_name: userData.first_name || '',
            last_name: userData.last_name || ''
          }
        }
      })

      if (error) throw error

      // The profile will be created automatically by the database trigger
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      setUser(null)
      setProfile(null)
      setSession(null)
      
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const updateProfile = async (updates) => {
    if (!user) return { error: 'No user logged in' }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error

      setProfile(data)
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const resetPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      
      if (error) throw error
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  // Create sample financial data for new users
  const createSampleData = async () => {
    if (!user) return

    try {
      const { error } = await supabase.rpc('create_sample_data', {
        p_user_id: user.id
      })

      if (error) {
        console.error('Error creating sample data:', error)
      } else {
        console.log('Sample data created successfully')
      }
    } catch (error) {
      console.error('Sample data creation error:', error)
    }
  }

  const retryAuth = async () => {
    setAuthError(null);
    setRetryCount(prev => prev + 1);
    
    if (user) {
      try {
        await fetchUserProfile(user.id);
      } catch (error) {
        console.error('Retry failed:', error);
      }
    } else {
      // Retry session initialization
      window.location.reload();
    }
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  const value = {
    user,
    profile,
    session,
    loading,
    authError,
    retryCount,
    signUp,
    signIn,
    signOut,
    updateProfile,
    resetPassword,
    fetchUserProfile,
    createSampleData,
    retryAuth,
    clearAuthError
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}