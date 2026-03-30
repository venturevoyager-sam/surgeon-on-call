/**
 * APP.JS - Root Component
 * Vaidhya Healthcare Pvt Ltd
 *
 * Routes:
 *   /                         → Login
 *   /register                 → Hospital self-registration
 *   /dashboard                → Dashboard
 *   /find-surgeon             → Find & book a surgeon directly
 *   /cases/:caseId/edit       → Edit a draft case
 *   /new-request              → Elective surgery request form
 *   /emergency-request        → Emergency surgery request (minimal form, auto-cascade)
 *   /opd-request              → OPD consultation request (same-day = auto-cascade)
 *   /reconsult-request        → Re-consultation request (always goes to shortlist)
 *   /cases/:caseId/shortlist  → Surgeon priority shortlist
 *   /cases/:caseId            → Case detail & cascade status
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login              from './pages/Login';
import HospitalSignup     from './pages/HospitalSignup';
import Dashboard          from './pages/Dashboard';
import NewRequest         from './pages/NewRequest';
import EmergencyRequest   from './pages/EmergencyRequest';    // NEW — Migration 001
import OPDRequest         from './pages/OPDRequest';          // NEW — Migration 001
import ReconsultRequest   from './pages/ReconsultRequest';    // NEW — Migration 001
import Shortlist          from './pages/Shortlist';
import CaseDetail         from './pages/CaseDetail';
import FindSurgeon        from './pages/FindSurgeon';
import EditCase           from './pages/EditCase';
import ProtectedRoute     from './components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── PUBLIC ── */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<HospitalSignup />} />

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

        {/* Elective surgery request form (standard) */}
        <Route path="/new-request" element={
          <ProtectedRoute><NewRequest /></ProtectedRoute>
        } />

        {/* Emergency surgery request — minimal form, auto-cascade */}
        <Route path="/emergency-request" element={
          <ProtectedRoute><EmergencyRequest /></ProtectedRoute>
        } />

        {/* OPD consultation request — same-day = auto-cascade, future = shortlist */}
        <Route path="/opd-request" element={
          <ProtectedRoute><OPDRequest /></ProtectedRoute>
        } />

        {/* Re-consultation request — always goes to shortlist */}
        <Route path="/reconsult-request" element={
          <ProtectedRoute><ReconsultRequest /></ProtectedRoute>
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