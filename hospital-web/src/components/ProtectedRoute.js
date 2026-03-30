/**
 * PROTECTED ROUTE COMPONENT
 *
 * Checks for hospital_id in localStorage. If not found, redirects to login.
 * Uses the same pattern as doctor-web's protected routes (localStorage-based).
 *
 * Replaced Supabase Auth session check — hospital auth now uses custom
 * hospital_auth table + bcrypt via POST /api/hospitals/login.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  // Check if hospital is logged in via localStorage
  // (set by Login.js after successful POST /api/hospitals/login)
  const hospitalId = localStorage.getItem('hospital_id');

  if (!hospitalId) {
    // Not logged in — redirect to login page
    return <Navigate to="/" />;
  }

  return children;
}
