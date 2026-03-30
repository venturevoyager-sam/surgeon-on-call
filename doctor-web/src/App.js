/**
 * APP.JS — Doctor Web (Surgeon Portal)
 * Company: Vaidhya Healthcare Pvt Ltd
 *
 * Routes:
 *   /login              → Phone + password login
 *   /signup             → 6-section registration form
 *   /home               → Dashboard with requests + upcoming cases
 *   /request/:caseId    → Pending request detail (accept/decline)
 *   /case/:caseId       → Accepted case detail (+ recommendation for reconsult)
 *   /profile            → Edit profile, documents, password
 *   /earnings           → Payment history + summary
 *
 * Protected routes redirect to /login if surgeon_id not in localStorage.
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isLoggedIn } from './lib/auth';
import './index.css';

// Pages
import Login         from './pages/Login';
import Signup        from './pages/Signup';
import Home          from './pages/Home';
import RequestDetail from './pages/RequestDetail';
import AcceptedCase  from './pages/AcceptedCase';
import Profile       from './pages/Profile';
import Earnings      from './pages/Earnings';

// Layout (sidebar nav)
import Layout from './components/Layout';

// Protected route wrapper — redirects to login if not authenticated
function ProtectedRoute({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login"  element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected — wrapped in Layout with sidebar */}
        <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/request/:caseId" element={<ProtectedRoute><RequestDetail /></ProtectedRoute>} />
        <Route path="/case/:caseId" element={<ProtectedRoute><AcceptedCase /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/earnings" element={<ProtectedRoute><Earnings /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
