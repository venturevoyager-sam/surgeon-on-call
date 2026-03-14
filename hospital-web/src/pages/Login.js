/**
 * LOGIN PAGE - Hospital Web App
 * 
 * This is the first screen a hospital SPOC sees.
 * They enter their email and we send them a magic link via Supabase.
 * Clicking the magic link logs them in automatically — no password needed.
 * 
 * Flow:
 * 1. SPOC enters email → clicks Send Login Link
 * 2. Supabase sends magic link to their email
 * 3. SPOC clicks link in email → redirected back to app → logged in
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Login() {
  // ── STATE ──────────────────────────────────────────────────────────────────
  // email: what the user types in the input field
  const [email, setEmail] = useState('');
  
  // loading: true while we're waiting for Supabase to send the email
  const [loading, setLoading] = useState(false);
  
  // message: success or error message shown to the user
  const [message, setMessage] = useState('');
  
  // isError: true if message is an error (shown in red), false for success (shown in green)
  const [isError, setIsError] = useState(false);
  const navigate = useNavigate();

  // ── HANDLE LOGIN ───────────────────────────────────────────────────────────
  /**
   * Called when the form is submitted.
   * Sends a magic link to the entered email via Supabase Auth.
   */
  const handleLogin = async (e) => {
    // Prevent the form from refreshing the page (default browser behaviour)
    e.preventDefault();

    // Basic validation — make sure email is not empty
    if (!email) {
      setMessage('Please enter your email address.');
      setIsError(true);
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      // Ask Supabase to send a magic link to this email
      // emailRedirectTo: where to send the user after they click the link
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: window.location.origin + '/dashboard'
        }
      });

      if (error) throw error;

      // Success — tell the user to check their email
      setMessage('✅ Login link sent! Check your email and click the link to sign in.');
      setIsError(false);

    } catch (error) {
      // Something went wrong — show the error
      setMessage('❌ ' + error.message);
      setIsError(true);
    } finally {
      // Always stop the loading spinner when done
      setLoading(false);
    }
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">

        {/* ── LOGO & HEADING ── */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-900">
            Surgeon <span className="text-blue-500">on Call</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">by Vaidhya Healthcare Pvt Ltd</p>
          <div className="mt-6">
            <h2 className="text-xl font-semibold text-gray-800">Hospital Portal</h2>
            <p className="text-gray-500 text-sm mt-1">
              Enter your email to receive a secure login link
            </p>
          </div>
        </div>

        {/* ── LOGIN CARD ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleLogin}>

            {/* Email Input */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="spoc@hospital.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Login Link'}
            </button>

          </form>

          {/* Success / Error Message */}
          {message && (
            <div className={`mt-4 p-4 rounded-lg text-sm ${
              isError 
                ? 'bg-red-50 text-red-700 border border-red-200' 
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {message}
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Only verified hospital accounts can access this portal. 
          Contact support to register your hospital.
        </p>

      </div>
    </div>
  );
}