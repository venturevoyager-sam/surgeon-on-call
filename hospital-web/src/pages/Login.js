/**
 * LOGIN PAGE - Hospital Web App
 * Vaidhya Healthcare Pvt Ltd
 *
 * Split layout:
 *   Left  — brand panel (dark charcoal, logo, tagline, trust signals)
 *   Right — email + password form (warm cream background)
 *
 * Auth: Custom hospital_auth table + bcrypt (via POST /api/hospitals/login).
 * No Supabase Auth — uses same pattern as surgeon login.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

export default function Login() {
  const navigate = useNavigate();

  // ── STATE ──────────────────────────────────────────────────────────────────
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [showPass, setShowPass] = useState(false); // toggle password visibility

  // ── HANDLE LOGIN ───────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Custom auth via hospital_auth table + bcrypt (no Supabase Auth)
      const res = await axios.post(`${API_URL}/api/hospitals/login`, {
        email: email.trim(),
        password,
      });

      // Save hospital_id and name to localStorage for session management
      localStorage.setItem('hospital_id', res.data.hospital_id);
      localStorage.setItem('hospital_name', res.data.hospital_name);

      // Success — redirect to dashboard
      navigate('/dashboard');

    } catch (err) {
      setError(err.response?.data?.message || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen" style={{ fontFamily: '"DM Sans", ui-sans-serif, sans-serif' }}>

      {/* ════════════════════════════════════════════════════════════════════
          LEFT PANEL — Brand identity
          Dark charcoal with logo, tagline, trust signals
      ════════════════════════════════════════════════════════════════════ */}
      <div
        className="hidden md:flex flex-col justify-between"
        style={{
          width: '42%',
          background: 'linear-gradient(145deg, #3d3330 0%, #444444 55%, #3a3a3a 100%)',
          padding: '48px 44px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative circles */}
        <div style={{
          position: 'absolute', top: '-80px', right: '-80px',
          width: '280px', height: '280px', borderRadius: '50%',
          backgroundColor: 'rgba(229,103,23,0.08)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-60px', left: '-60px',
          width: '200px', height: '200px', borderRadius: '50%',
          backgroundColor: 'rgba(229,103,23,0.06)', pointerEvents: 'none',
        }} />

        {/* ── Logo + company ── */}
        <div>
          <img
            src="/logo.png"
            alt="Surgeon on Call"
            style={{ height: '52px', width: 'auto', objectFit: 'contain' }}
            onError={(e) => {
              e.target.style.display = 'none';
              document.getElementById('left-brand-fallback').style.display = 'block';
            }}
          />
          {/* Text fallback if logo missing */}
          <h1
            id="left-brand-fallback"
            style={{ display: 'none', color: '#fff', fontSize: '22px', fontWeight: '700' }}
          >
            Surgeon <span style={{ color: '#E56717' }}>on Call</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '10px' }}>
            by Vaidhya Healthcare Pvt Ltd
          </p>
        </div>

        {/* ── Tagline ── */}
        <div>
          <h2 style={{
            color: '#ffffff',
            fontSize: '26px',
            fontWeight: '700',
            lineHeight: '1.35',
            letterSpacing: '-0.02em',
            marginBottom: '14px',
          }}>
            The right surgeon,<br />
            <span style={{ color: '#E56717' }}>exactly when you need.</span>
          </h2>
          <p style={{
            color: 'rgba(255,255,255,0.45)',
            fontSize: '14px',
            lineHeight: '1.7',
            maxWidth: '280px',
          }}>
            On-demand surgical staffing for hospitals.
            Verified surgeons, matched in minutes.
          </p>
        </div>

        {/* ── Trust signals ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            'Verified surgeon credentials',
            'Multi-specialty coverage',
            'Cascade matching in minutes',
          ].map((text) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                backgroundColor: 'rgba(229,103,23,0.2)',
                color: '#E56717', fontSize: '11px', fontWeight: '700',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✓</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                {text}
              </span>
            </div>
          ))}
        </div>
      </div>


      {/* ════════════════════════════════════════════════════════════════════
          RIGHT PANEL — Login form
          Warm cream background, email + password
      ════════════════════════════════════════════════════════════════════ */}
      <div
        className="flex flex-col items-center justify-center flex-1 px-8 py-12"
        style={{ backgroundColor: '#FDF8F5' }}
      >
        <div style={{ width: '100%', maxWidth: '380px' }}>

          {/* Mobile-only logo (hidden on md+) */}
          <div className="flex justify-center mb-8 md:hidden">
            <img
              src="/logo.png"
              alt="Surgeon on Call"
              style={{ height: '44px', width: 'auto', objectFit: 'contain' }}
              onError={(e) => e.target.style.display = 'none'}
            />
          </div>

          {/* ── Heading ── */}
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{
              fontSize: '24px', fontWeight: '700',
              color: '#444444', letterSpacing: '-0.02em', marginBottom: '6px',
            }}>
              Hospital Portal
            </h1>
            <p style={{ color: '#8B8B8B', fontSize: '14px' }}>
              Sign in to manage your surgery requests
            </p>
          </div>

          {/* ── Form ── */}
          <form onSubmit={handleLogin} noValidate>

            {/* Email field */}
            <div style={{ marginBottom: '18px' }}>
              <label className="form-label">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="spoc@hospital.com"
                disabled={loading}
                className="input-field"
                style={{ fontSize: '14px' }}
              />
            </div>

            {/* Password field */}
            <div style={{ marginBottom: '24px' }}>
              <label className="form-label">Password</label>
              {/* Wrapper for input + show/hide button */}
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="input-field"
                  style={{ fontSize: '14px', paddingRight: '60px' }}
                />
                {/* Show / Hide toggle */}
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    color: '#8B8B8B', fontSize: '12px', fontWeight: '600',
                    cursor: 'pointer', padding: 0,
                    fontFamily: '"DM Sans", sans-serif',
                    letterSpacing: '0.03em',
                  }}
                >
                  {showPass ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div style={{
                marginBottom: '18px',
                padding: '11px 14px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                color: '#DC2626',
                fontSize: '13px',
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
              style={{ padding: '13px', fontSize: '15px' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

          </form>

          {/* Register link */}
          <p style={{
            marginTop: '24px',
            textAlign: 'center',
            fontSize: '14px',
            color: '#8B8B8B',
          }}>
            New hospital?{' '}
            <span
              onClick={() => navigate('/register')}
              style={{
                color: '#E56717',
                fontWeight: '600',
                cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
              onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
            >
              Register here
            </span>
          </p>

          {/* Footer */}
          <p style={{
            marginTop: '16px',
            color: '#8B8B8B', fontSize: '12px',
            textAlign: 'center', lineHeight: '1.6',
          }}>
            Only verified hospital accounts can access this portal.
          </p>

        </div>
      </div>

    </div>
  );
}