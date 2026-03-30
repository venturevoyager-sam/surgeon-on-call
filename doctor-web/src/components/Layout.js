/**
 * LAYOUT — Doctor Web
 * Wraps all protected pages with:
 *   - Desktop: sidebar navigation (left)
 *   - Mobile: bottom navigation bar
 *   - Verification banner for unverified surgeons
 *
 * Uses surgeon profile data fetched once and passed down.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { getSurgeonId, getSurgeonName, logoutSurgeon } from '../lib/auth';

const API_URL = process.env.REACT_APP_API_URL;

// Navigation items for sidebar and bottom nav
const NAV_ITEMS = [
  { path: '/home',     label: 'Home',     icon: '🏠' },
  { path: '/profile',  label: 'Profile',  icon: '👤' },
  { path: '/earnings', label: 'Earnings', icon: '💰' },
];

export default function Layout({ children }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const surgeonId = getSurgeonId();

  const [surgeon, setSurgeon] = useState(null);

  // Fetch surgeon profile once on mount — used for verification banner
  useEffect(() => {
    if (!surgeonId) return;
    axios.get(`${API_URL}/api/surgeons/${surgeonId}`)
      .then(res => setSurgeon(res.data.surgeon))
      .catch(() => {});
  }, [surgeonId]);

  const handleLogout = () => {
    logoutSurgeon();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="flex min-h-screen" style={{ fontFamily: '"DM Sans", ui-sans-serif, sans-serif' }}>

      {/* ── DESKTOP SIDEBAR (hidden on mobile) ── */}
      <aside
        className="hidden md:flex flex-col w-56 flex-shrink-0"
        style={{ backgroundColor: '#2C1A0E' }}
      >
        {/* Brand */}
        <div className="px-5 pt-6 pb-4">
          <h1 className="text-lg font-extrabold">
            <span style={{ color: '#FFFFFF' }}>Surgeon </span>
            <span style={{ color: '#E56717' }}>on Call</span>
          </h1>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Doctor Portal
          </p>
        </div>

        {/* Surgeon name */}
        <div className="px-5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {getSurgeonName() || 'Doctor'}
          </p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 mt-2">
          {NAV_ITEMS.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm mb-1 flex items-center gap-3 transition"
              style={{
                backgroundColor: isActive(item.path) ? 'rgba(229,103,23,0.15)' : 'transparent',
                color: isActive(item.path) ? '#E56717' : 'rgba(255,255,255,0.5)',
                fontWeight: isActive(item.path) ? '600' : '400',
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 pb-5">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-3"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            <span>🚪</span> Logout
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 flex flex-col min-h-screen" style={{ backgroundColor: '#FDF8F5' }}>

        {/* Verification banner — shown when surgeon is not yet verified */}
        {surgeon && !surgeon.verified && (
          <div className="px-4 py-3 text-sm text-center" style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>
            Your account is pending verification. You will start receiving surgery requests once verified.
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 pb-20 md:pb-0">
          {children}
        </main>

        {/* ── MOBILE BOTTOM NAV (hidden on desktop) ── */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 flex justify-around py-2 border-t"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E0D8', zIndex: 50 }}
        >
          {NAV_ITEMS.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center gap-0.5 px-4 py-1"
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs" style={{
                color: isActive(item.path) ? '#E56717' : '#8B8B8B',
                fontWeight: isActive(item.path) ? '600' : '400',
              }}>
                {item.label}
              </span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
