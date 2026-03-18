/**
 * APP.JS - Root Component
 * Vaidhya Healthcare Pvt Ltd
 *
 * Routes:
 *   /                         → Login
 *   /dashboard                → Dashboard
 *   /find-surgeon             → Find & book a surgeon directly (NEW)
 *   /cases/:caseId/edit       → Edit a draft case (NEW)
 *   /new-request              → New surgery request form
 *   /cases/:caseId/shortlist  → Surgeon priority shortlist
 *   /cases/:caseId            → Case detail & cascade status
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login        from './pages/Login';
import Dashboard    from './pages/Dashboard';
import NewRequest   from './pages/NewRequest';
import Shortlist    from './pages/Shortlist';
import CaseDetail   from './pages/CaseDetail';
import FindSurgeon  from './pages/FindSurgeon';   // NEW
import EditCase     from './pages/EditCase';       // NEW
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── PUBLIC ── */}
        <Route path="/" element={<Login />} />

        {/* ── PROTECTED ── */}
        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />

        {/* Browse verified surgeons and book directly */}
        <Route path="/find-surgeon" element={
          <ProtectedRoute><FindSurgeon /></ProtectedRoute>
        } />

        {/* Edit a draft case (created from Find a Surgeon flow) */}
        <Route path="/cases/:caseId/edit" element={
          <ProtectedRoute><EditCase /></ProtectedRoute>
        } />

        {/* Standard new request form */}
        <Route path="/new-request" element={
          <ProtectedRoute><NewRequest /></ProtectedRoute>
        } />

        {/* Surgeon priority shortlist */}
        <Route path="/cases/:caseId/shortlist" element={
          <ProtectedRoute><Shortlist /></ProtectedRoute>
        } />

        {/* Case detail and cascade status */}
        <Route path="/cases/:caseId" element={
          <ProtectedRoute><CaseDetail /></ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />

      </Routes>
    </BrowserRouter>
  );
}