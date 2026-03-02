/**
 * SUPABASE CLIENT CONFIGURATION
 * 
 * This file creates and exports a single Supabase client instance.
 * Every part of the backend that needs to read or write to the database
 * imports this client — we create it once and reuse it everywhere.
 * 
 * Supabase gives us:
 * - PostgreSQL database
 * - Authentication (OTP for surgeons, magic link for hospitals)
 * - Realtime subscriptions (used for GPS tracking)
 * - File storage (surgeon credential documents)
 */

// createClient: Supabase function that creates a connected database client
const { createClient } = require('@supabase/supabase-js');

// ── ENVIRONMENT VARIABLES ─────────────────────────────────────────────────────
// These values come from the .env file — never hardcode them here
// SUPABASE_URL: your project's unique API endpoint
// SUPABASE_ANON_KEY: your publishable key (safe to use server-side)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// ── VALIDATION ────────────────────────────────────────────────────────────────
// If either value is missing, throw an error immediately
// Better to fail at startup than get mysterious errors later

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase credentials. Check your .env file has SUPABASE_URL and SUPABASE_ANON_KEY set.'
  );
}

// ── CREATE CLIENT ─────────────────────────────────────────────────────────────
// Creates the Supabase client with our project credentials
// This client can query the database, handle auth, and more

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export the client so other files can import and use it
// Usage in other files: const supabase = require('./supabase');
module.exports = supabase;