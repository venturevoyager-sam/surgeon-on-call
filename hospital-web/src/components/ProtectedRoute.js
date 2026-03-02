/**
 * PROTECTED ROUTE COMPONENT
 *
 * In DEVELOPMENT mode: bypasses auth check completely.
 * In PRODUCTION: checks for a valid Supabase session.
 *
 * To switch to production mode, change DEV_MODE to false.
 */

import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// ── DEV MODE FLAG ─────────────────────────────────────────────────────────────
// Set to true during development to skip login
// Set to false before going live
const DEV_MODE = true;

export default function ProtectedRoute({ children }) {
  const [authState, setAuthState] = useState(null);

  useEffect(() => {
    if (DEV_MODE) {
      // Skip auth check in development
      console.log('DEV_MODE: Auth check bypassed');
      setAuthState(true);
      return;
    }

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setAuthState(!!session);
    };
    checkSession();
  }, []);

  if (authState === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (authState === false) {
    return <Navigate to="/" />;
  }

  return children;
}