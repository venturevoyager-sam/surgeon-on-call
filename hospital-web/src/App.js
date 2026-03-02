/**
 * APP.JS - Root Component
 * Sets up all routes for the hospital web app.
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewRequest from './pages/NewRequest';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login page — public */}
        <Route path="/" element={<Login />} />

        {/* Dashboard — protected */}
        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />

        {/* New surgery request form — protected */}
        <Route path="/new-request" element={
          <ProtectedRoute><NewRequest /></ProtectedRoute>
        } />

        {/* Unknown URLs go to login */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}