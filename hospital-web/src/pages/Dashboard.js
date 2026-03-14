/**
 * DASHBOARD PAGE - Hospital Web App
 * 
 * This is the main screen a hospital SPOC sees after logging in.
 * 
 * It shows:
 * - Stats row: cases this month, active requests, fill rate, avg confirmation time
 * - Active cases table: all ongoing surgery requests
 * - Past cases table: completed surgeries
 * 
 * Data is fetched from our backend API which reads from Supabase.
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  // ── STATE ──────────────────────────────────────────────────────────────────
  
  // Current logged in user (hospital SPOC)
  const [user, setUser] = useState(null);
  
  // List of active cases for this hospital
  const [activeCases, setActiveCases] = useState([]);
  
  // List of completed/cancelled cases
  const [pastCases, setPastCases] = useState([]);
  
  // Which tab is selected: 'active' or 'past'
  const [activeTab, setActiveTab] = useState('active');
  
  // Loading state while fetching data
  const [loading, setLoading] = useState(true);

  // navigate: used to redirect to other pages
  const navigate = useNavigate();

  // ── EFFECTS ────────────────────────────────────────────────────────────────

  /**
   * On page load: get the current logged in user from Supabase
   * If no user is logged in, redirect back to login page
   */
 useEffect(() => {
  const getUser = async () => {
    // Get the real logged-in user from Supabase Auth
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      // No session — send them back to login
      navigate('/');
      return;
    }

    const email = session.user.email;
    setUser({ email });
    fetchCases(email);
  };
  getUser();
}, [navigate]);

  // ── DATA FETCHING ──────────────────────────────────────────────────────────

  /**
   * Fetch all cases for this hospital from Supabase
   * Splits them into active and past cases
   */
  const fetchCases = async (email) => {
    setLoading(true);
    try {
      // First find the hospital record for this SPOC email
      const { data: hospital, error: hospitalError } = await supabase
        .from('hospitals')
        .select('*')
        .eq('contact_email', email)
        .single();

      if (hospitalError || !hospital) {
        // Hospital not found or not verified yet
        setLoading(false);
        return;
      }

      // Fetch all cases for this hospital, newest first
      const { data: cases, error: casesError } = await supabase
        .from('cases')
        .select('*')
        .eq('hospital_id', hospital.id)
        .order('created_at', { ascending: false });

      if (casesError) throw casesError;

      // Split into active and past cases
      const active = cases.filter(c => 
        ['active', 'cascading', 'confirmed', 'in_progress'].includes(c.status)
      );
      const past = cases.filter(c => 
        ['completed', 'cancelled', 'unfilled'].includes(c.status)
      );

      setActiveCases(active);
      setPastCases(past);

    } catch (error) {
      console.error('Error fetching cases:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── HELPERS ────────────────────────────────────────────────────────────────

  /**
   * Returns the right colour badge for each case status
   */
  const getStatusBadge = (status) => {
    const styles = {
      active:       'bg-gray-100 text-gray-600',
      cascading:    'bg-amber-100 text-amber-700',
      confirmed:    'bg-green-100 text-green-700',
      in_progress:  'bg-blue-100 text-blue-700',
      completed:    'bg-teal-100 text-teal-700',
      cancelled:    'bg-red-100 text-red-600',
      unfilled:     'bg-red-100 text-red-600',
    };
    const labels = {
      active:       'Draft',
      cascading:    'Awaiting Response',
      confirmed:    'Confirmed',
      in_progress:  'In Progress',
      completed:    'Completed',
      cancelled:    'Cancelled',
      unfilled:     'Unfilled',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
        {labels[status] || status}
      </span>
    );
  };

  /**
   * Format date nicely: 2026-03-07 → Mar 7, 2026
   */
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  /**
   * Format paise to rupees: 4500000 → ₹45,000
   */
  const formatFee = (paise) => {
    if (!paise) return '—';
    return '₹' + (paise / 100).toLocaleString('en-IN');
  };

  // ── HANDLE LOGOUT ──────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── TOP NAVIGATION ── */}
      <nav className="bg-blue-900 px-8 py-4 flex items-center justify-between">
        <h1 className="text-white font-bold text-xl">
          Surgeon <span className="text-blue-300">on Call</span>
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-blue-200 text-sm">{user?.email}</span>
          <button
            onClick={() => navigate('/new-request')}
            className="bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            + New Request
          </button>
          <button
            onClick={handleLogout}
            className="text-blue-300 hover:text-white text-sm transition"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* ── PAGE HEADING ── */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-blue-900">Dashboard</h2>
          <p className="text-gray-500 text-sm mt-1">Manage your surgery requests</p>
        </div>

        {/* ── STATS ROW ── */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-3xl font-bold text-blue-900">
              {activeCases.length + pastCases.length}
            </div>
            <div className="text-gray-500 text-sm mt-1">Total Cases</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-3xl font-bold text-blue-900">
              {activeCases.length}
            </div>
            <div className="text-gray-500 text-sm mt-1">Active Requests</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-3xl font-bold text-blue-900">
              {pastCases.filter(c => c.status === 'completed').length}
            </div>
            <div className="text-gray-500 text-sm mt-1">Completed</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-3xl font-bold text-blue-900">5%</div>
            <div className="text-gray-500 text-sm mt-1">Platform Commission</div>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'active'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Active Cases ({activeCases.length})
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'past'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Past Cases ({pastCases.length})
          </button>
        </div>

        {/* ── CASES TABLE ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            // Loading state
            <div className="p-12 text-center text-gray-400">
              Loading cases...
            </div>
          ) : (activeCases.length === 0 && activeTab === 'active') || 
              (pastCases.length === 0 && activeTab === 'past') ? (
            // Empty state
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">🏥</div>
              <p className="text-gray-500 font-medium">No cases yet</p>
              <p className="text-gray-400 text-sm mt-1">
                Click <strong>+ New Request</strong> to post your first surgery request
              </p>
            </div>
          ) : (
            // Cases table
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Case ID</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Procedure</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Surgery Date</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fee Range</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(activeTab === 'active' ? activeCases : pastCases).map((case_) => (
                  <tr key={case_.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm font-mono text-gray-500">
                      SOC-{String(case_.case_number).padStart(3, '0')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-800 text-sm">{case_.procedure}</div>
                      <div className="text-gray-400 text-xs mt-0.5">{case_.specialty_required}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(case_.surgery_date)}
                      <div className="text-gray-400 text-xs">{case_.surgery_time}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatFee(case_.fee_min)} – {formatFee(case_.fee_max)}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(case_.status)}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => navigate(`/cases/${case_.id}`)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}