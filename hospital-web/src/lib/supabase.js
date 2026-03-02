/**
 * SUPABASE CLIENT - Hospital Web App
 * 
 * Creates a Supabase client for the hospital frontend.
 * Used for authentication (magic link login) and 
 * real-time subscriptions (GPS tracking).
 * 
 * Note: Environment variables in React must start with REACT_APP_
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase credentials in .env file');
}

// Create and export the Supabase client
// This same client is imported wherever we need auth or realtime
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);