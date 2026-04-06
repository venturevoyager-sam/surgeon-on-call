/**
 * SUPABASE CLIENT — Admin Web
 * Used for file uploads to surgeon-documents bucket.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY  = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
export const STORAGE_BUCKET = 'surgeon-documents';
