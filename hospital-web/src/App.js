/**
 * APP.JS - Root Component
 * 
 * This is the root of the entire hospital web app.
 * It sets up routing — which page to show for which URL.
 * 
 * Routes:
 * /          → Login page
 * /dashboard → Dashboard (protected — only logged in users)
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';

// Placeholder for Dashboard — we'll build this next
function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-blue-900">Dashboard</h1>
        <p className="text-gray-500 mt-2">Coming up next — Sprint 2</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login page — shown at root URL */}
        <Route path="/" element={<Login />} />

        {/* Dashboard — shown after login */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Any unknown URL redirects to login */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}