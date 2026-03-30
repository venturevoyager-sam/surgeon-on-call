/**
 * LOGIN PAGE — Doctor Web
 * Phone + password login via POST /api/surgeons/login.
 * On success saves surgeon_id + name to localStorage and navigates to /home.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { loginSurgeon } from '../lib/auth';

const API_URL = process.env.REACT_APP_API_URL;

export default function Login() {
  const navigate = useNavigate();
  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone.trim() || !password) { setError('Phone and password are required'); return; }
    setLoading(true); setError('');
    try {
      const res = await axios.post(`${API_URL}/api/surgeons/login`, { phone: phone.trim(), password });
      loginSurgeon(res.data.surgeon_id, res.data.name);
      navigate('/home');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: '#FDF8F5', fontFamily: '"DM Sans", ui-sans-serif, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>

        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold">
            <span style={{ color: '#444444' }}>Surgeon </span>
            <span style={{ color: '#E56717' }}>on Call</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: '#8B8B8B' }}>Doctor Portal</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: '16px' }}>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8B8B8B' }}>Phone Number</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="10-digit mobile number" disabled={loading}
              className="w-full px-4 py-3 rounded-lg text-sm border focus:outline-none focus:border-orange-400"
              style={{ borderColor: '#E8E0D8', color: '#444444' }} />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8B8B8B' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" disabled={loading}
              className="w-full px-4 py-3 rounded-lg text-sm border focus:outline-none focus:border-orange-400"
              style={{ borderColor: '#E8E0D8', color: '#444444' }} />
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-lg text-white font-semibold text-sm transition disabled:opacity-50"
            style={{ backgroundColor: '#E56717' }}
            onMouseEnter={e => { if(!loading) e.currentTarget.style.backgroundColor='#CD4D00'; }}
            onMouseLeave={e => { if(!loading) e.currentTarget.style.backgroundColor='#E56717'; }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: '#8B8B8B' }}>
          New surgeon?{' '}
          <span onClick={() => navigate('/signup')} className="cursor-pointer font-semibold"
            style={{ color: '#E56717' }}>
            Register here
          </span>
        </p>
      </div>
    </div>
  );
}
