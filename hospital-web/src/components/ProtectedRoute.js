/**
 * PROTECTED ROUTE COMPONENT
 * 
 * Wraps any page that requires the user to be logged in.
 * If the user is not logged in, they get redirected to the login page.
 * If they are logged in, they see the page normally.
 * 
 * Usage in App.js:
 * <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
 */

import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ProtectedRoute({ children }) {
  // null = still checking, false = not logged in, true = logged in
  const [authState, setAuthState] = useState(null);

  useEffect(() => {
    // Check if there is an active session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setAuthState(!!session); // converts session to true/false
    };
    checkSession();
  }, []);

  // Still checking — show a blank loading screen
  if (authState === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  // Not logged in — redirect to login page
  if (authState === false) {
    return <Navigate to="/" />;
  }

  // Logged in — show the protected page
  return children;
}