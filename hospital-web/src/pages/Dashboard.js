/**
 * DASHBOARD PAGE - Hospital Web App
 * Surgeon on Call (OPC) Pvt Ltd
 *
 * Header (updated):
 *   Logo | Find a Surgeon | + New Request | 🔔 (placeholder) | Hospital Name | Logout
 *
 * Body:
 *   Stats row + Active/Past cases table
 *
 * All cases (active and draft) are shown.
 * Draft cases created via "Find a Surgeon" flow show a "Complete Details →" action.
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../lib/config';

export default function Dashboard() {
  // ── STATE ──────────────────────────────────────────────────────────────────
  const [user,        setUser]        = useState(null);
  const [hospital,    setHospital]    = useState(null);
  const [activeCases, setActiveCases] = useState([]);
  const [pastCases,   setPastCases]   = useState([]);
  const [activeTab,   setActiveTab]   = useState('active');
  const [loading,     setLoading]     = useState(true);

  // NEW (Migration 001): Controls the request type selector dropdown
  const [showRequestMenu, setShowRequestMenu] = useState(false);
  const [showEmptyFindMenu, setShowEmptyFindMenu] = useState(false);
  const [showEmptyRequestMenu, setShowEmptyRequestMenu] = useState(false);

  const navigate = useNavigate();

  // ── LOAD ───────────────────────────────────────────────────────────────────
  // Uses hospital_id from localStorage (set by Login.js after custom auth login)
  useEffect(() => {
    const load = async () => {
      const hospitalId = localStorage.getItem('hospital_id');
      if (!hospitalId) { navigate('/'); return; }

      setUser({ name: localStorage.getItem('hospital_name') });

      // Get hospital record by ID (not email — no more devEmail hardcoding)
      const { data: hospitalData } = await supabase
        .from('hospitals')
        .select('*')
        .eq('id', hospitalId)
        .single();

      if (hospitalData) {
        setHospital(hospitalData);
        await fetchCases(hospitalData.id);
      }
      setLoading(false);
    };
    load();
  }, []);

  // ── FETCH CASES ────────────────────────────────────────────────────────────
  const fetchCases = async (hospitalId) => {
    // Join case_priority_list to get expires_at for the currently notified surgeon.
    // This lets us sort active cases by urgency (soonest expiry first).
    const { data: cases } = await supabase
      .from('cases')
      .select('*, case_priority_list(expires_at, status)')
      .eq('hospital_id', hospitalId)
      .order('created_at', { ascending: false });

    if (!cases) return;

    // Draft cases (from Find a Surgeon flow) go into active tab
    const active = cases.filter(c =>
      ['draft', 'active', 'cascading', 'confirmed', 'in_progress'].includes(c.status)
    );

    // ── Sort active cases by urgency ─────────────────────────────────────
    // 1. Emergency cases always first (regardless of expiry)
    // 2. Non-emergency cases sorted by soonest expires_at ascending
    // 3. Cases with no active expiry (draft, shortlist stage) sink to bottom
    active.sort((a, b) => {
      const aEmergency = a.request_type === 'emergency';
      const bEmergency = b.request_type === 'emergency';

      // Emergency cases always come first
      if (aEmergency && !bEmergency) return -1;
      if (!aEmergency && bEmergency) return 1;

      // Within the same group, sort by the active (notified) row's expires_at.
      // Find the currently notified row's expires_at from the joined priority list.
      const aExpiry = getActiveExpiry(a.case_priority_list);
      const bExpiry = getActiveExpiry(b.case_priority_list);

      // Cases with no active expiry sink to the bottom of their group
      if (aExpiry && !bExpiry) return -1;
      if (!aExpiry && bExpiry) return 1;
      if (!aExpiry && !bExpiry) return 0;

      // Soonest expiry first (most urgent at top)
      return new Date(aExpiry) - new Date(bExpiry);
    });

    setActiveCases(active);
    setPastCases(cases.filter(c =>
      ['completed', 'cancelled', 'unfilled'].includes(c.status)
    ));
  };

  /**
   * Extract the expires_at timestamp from the currently active (notified) priority
   * list row. Returns null if no surgeon is currently notified (e.g. draft cases
   * or cases where the cascade hasn't started yet).
   */
  const getActiveExpiry = (priorityList) => {
    if (!priorityList || !Array.isArray(priorityList)) return null;
    const notifiedRow = priorityList.find(row => row.status === 'notified');
    return notifiedRow?.expires_at || null;
  };

  // ── HELPERS ────────────────────────────────────────────────────────────────

  /** Status badge */
  const getStatusBadge = (status) => {
    const map = {
      draft:       { cls: 'bg-gray-100 text-gray-500',    label: 'Draft' },
      active:      { cls: 'bg-orange-100 text-orange-700', label: 'Active' },
      cascading:   { cls: 'bg-amber-100 text-amber-700',  label: 'Awaiting Response' },
      confirmed:   { cls: 'bg-green-100 text-green-700',  label: 'Confirmed' },
      in_progress: { cls: 'bg-blue-100 text-blue-700',    label: 'In Progress' },
      completed:   { cls: 'bg-teal-100 text-teal-700',    label: 'Completed' },
      cancelled:   { cls: 'bg-red-100 text-red-500',      label: 'Cancelled' },
      unfilled:    { cls: 'bg-red-100 text-red-500',      label: 'Unfilled' },
    };
    const s = map[status] || { cls: 'bg-gray-100 text-gray-500', label: status };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${s.cls}`}>
        {s.label}
      </span>
    );
  };

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  const formatFee = (p) => {
    if (!p) return '—';
    return '₹' + (p / 100).toLocaleString('en-IN');
  };

  // Logout — clear localStorage and redirect to login
  // (Replaced supabase.auth.signOut — hospital auth is now custom)
  const handleLogout = () => {
    localStorage.removeItem('hospital_id');
    localStorage.removeItem('hospital_name');
    navigate('/');
  };

  const displayedCases = activeTab === 'active' ? activeCases : pastCases;

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-brand-light">

      {/* ══════════════════════════════════════════════════════════════════════
          HEADER
          Logo | Find a Surgeon | + New Request | 🔔 | Hospital Name | Logout
      ══════════════════════════════════════════════════════════════════════ */}
      <nav className="topnav">

        {/* Logo */}
        <div className="flex items-center">
          <img
            src="/logo.png"
            alt="Surgeon on Call"
            style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
            onError={(e) => {
              e.target.style.display = 'none';
              document.getElementById('dash-brand-fallback').style.display = 'block';
            }}
          />
          <h1
            id="dash-brand-fallback"
            className="topnav-brand"
            style={{ display: 'none' }}
          >
            Surgeon <span>on Call</span>
          </h1>
        </div>

        {/* Right side nav items */}
        <div className="flex items-center gap-2">

          {/* Find a Surgeon — navigates to the surgeon listing page */}
          <button
            onClick={() => navigate('/find-surgeon')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px',
              backgroundColor: 'rgba(229,103,23,0.12)',
              border: '1px solid rgba(229,103,23,0.3)',
              borderRadius: '8px',
              color: '#E56717',
              fontSize: '13px', fontWeight: '600',
              cursor: 'pointer',
              fontFamily: '"DM Sans", sans-serif',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(229,103,23,0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(229,103,23,0.12)'}
          >
            🔍 Find a Surgeon
          </button>

          {/* NEW (Migration 001): Request type selector dropdown.
              Replaces the single "New Request" button with a menu that lets
              the SPOC choose: Emergency, OPD, Re-consult, or Elective Surgery.
              Emergency is styled red/urgent to stand out. */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowRequestMenu(prev => !prev)}
              className="btn-primary px-4 py-2 text-sm"
            >
              + New Request ▾
            </button>

            {/* Dropdown menu — appears below the button */}
            {showRequestMenu && (
              <>
                {/* Invisible backdrop to close menu on outside click */}
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                  onClick={() => setShowRequestMenu(false)}
                />

                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '6px',
                    width: '240px',
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #E8E0D8',
                    boxShadow: '0 8px 24px rgba(68, 44, 20, 0.15)',
                    zIndex: 50,
                    overflow: 'hidden',
                  }}
                >
                  {/* Emergency — visually distinct with red styling */}
                  <button
                    onClick={() => { setShowRequestMenu(false); navigate('/emergency-request'); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      width: '100%', padding: '12px 16px',
                      fontSize: '13px', fontWeight: '600',
                      color: '#dc2626',
                      backgroundColor: '#FEF2F2',
                      border: 'none', cursor: 'pointer',
                      fontFamily: '"DM Sans", sans-serif',
                      textAlign: 'left',
                      borderBottom: '1px solid #FECACA',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FEE2E2'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FEF2F2'}
                  >
                    <span style={{ fontSize: '16px' }}>🚨</span>
                    Emergency
                  </button>

                  {/* OPD */}
                  <button
                    onClick={() => { setShowRequestMenu(false); navigate('/opd-request'); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      width: '100%', padding: '12px 16px',
                      fontSize: '13px', fontWeight: '500',
                      color: '#444444',
                      backgroundColor: '#ffffff',
                      border: 'none', cursor: 'pointer',
                      fontFamily: '"DM Sans", sans-serif',
                      textAlign: 'left',
                      borderBottom: '1px solid #E8E0D8',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FDF8F5'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                  >
                    <span style={{ fontSize: '16px' }}>🏥</span>
                    OPD Consultation
                  </button>

                  {/* Re-consult */}
                  <button
                    onClick={() => { setShowRequestMenu(false); navigate('/reconsult-request'); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      width: '100%', padding: '12px 16px',
                      fontSize: '13px', fontWeight: '500',
                      color: '#444444',
                      backgroundColor: '#ffffff',
                      border: 'none', cursor: 'pointer',
                      fontFamily: '"DM Sans", sans-serif',
                      textAlign: 'left',
                      borderBottom: '1px solid #E8E0D8',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FDF8F5'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                  >
                    <span style={{ fontSize: '16px' }}>🔄</span>
                    Re-consultation
                  </button>

                  {/* Elective Surgery (standard — goes to existing NewRequest.js) */}
                  <button
                    onClick={() => { setShowRequestMenu(false); navigate('/new-request'); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      width: '100%', padding: '12px 16px',
                      fontSize: '13px', fontWeight: '500',
                      color: '#444444',
                      backgroundColor: '#ffffff',
                      border: 'none', cursor: 'pointer',
                      fontFamily: '"DM Sans", sans-serif',
                      textAlign: 'left',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FDF8F5'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                  >
                    <span style={{ fontSize: '16px' }}>🔪</span>
                    Elective Surgery
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 🔔 Notification bell — placeholder, not wired up yet */}
          <button
            title="Notifications — coming soon"
            style={{
              width: '36px', height: '36px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              backgroundColor: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
          >
            🔔
          </button>

          {/* Hospital name */}
          <div style={{
            padding: '6px 12px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', marginBottom: '1px' }}>
              Hospital
            </p>
            <p style={{ color: '#ffffff', fontSize: '12px', fontWeight: '600' }}>
              {hospital?.name || '...'}
            </p>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="btn-ghost text-gray-400 hover:text-brand"
            style={{ fontSize: '13px' }}
          >
            Logout
          </button>

        </div>
      </nav>


      {/* ══════════════════════════════════════════════════════════════════════
          BODY
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Page heading */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-body">Dashboard</h2>
          <p className="text-muted text-sm mt-1">Manage your surgery requests</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { value: activeCases.length + pastCases.length, label: 'Total Cases' },
            { value: activeCases.filter(c => c.status !== 'draft').length, label: 'Active Requests' },
            { value: activeCases.filter(c => c.status === 'draft').length, label: 'Draft Cases' },
            { value: pastCases.filter(c => c.status === 'completed').length, label: 'Completed' },
          ].map(({ value, label }) => (
            <div key={label} className="card">
              <div className="text-3xl font-bold text-brand">{value}</div>
              <div className="text-muted text-sm mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-warm">
          {[
            { key: 'active', label: `Active Cases (${activeCases.length})` },
            { key: 'past',   label: `Past Cases (${pastCases.length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-6 py-3 text-sm font-semibold border-b-2 transition ${
                activeTab === key
                  ? 'border-brand text-brand'
                  : 'border-transparent text-muted hover:text-body'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Cases table */}
        <div
          className="bg-white rounded-xl overflow-hidden"
          style={{ border: '1px solid #E8E0D8', boxShadow: '0 1px 4px 0 rgba(68,44,20,0.06)' }}
        >
          {loading ? (
            <div className="p-12 text-center text-muted">Loading cases...</div>

          ) : displayedCases.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">🏥</div>
              <p className="font-medium text-body">No cases yet</p>
              <p className="text-muted text-sm mt-1 mb-6">
                Post a request or browse our surgeon network to get started
              </p>
              <div className="flex gap-3 justify-center">
                {/* Find a Surgeon — dropdown with all 4 case types */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => { setShowEmptyFindMenu(prev => !prev); setShowEmptyRequestMenu(false); }}
                    className="btn-secondary px-6 py-2 text-sm"
                  >
                    🔍 Find a Surgeon ▾
                  </button>
                  {showEmptyFindMenu && (
                    <>
                      <div
                        style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                        onClick={() => setShowEmptyFindMenu(false)}
                      />
                      <div style={{
                        position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                        marginTop: '6px', width: '240px', backgroundColor: '#ffffff',
                        borderRadius: '12px', border: '1px solid #E8E0D8',
                        boxShadow: '0 8px 24px rgba(68, 44, 20, 0.15)', zIndex: 50, overflow: 'hidden',
                      }}>
                        {[
                          { emoji: '🚨', label: 'Emergency', path: '/find-surgeon?type=emergency', red: true },
                          { emoji: '🏥', label: 'OPD Consultation', path: '/find-surgeon?type=opd' },
                          { emoji: '🔄', label: 'Re-consultation', path: '/find-surgeon?type=reconsult' },
                          { emoji: '🔪', label: 'Elective Surgery', path: '/find-surgeon?type=elective' },
                        ].map(({ emoji, label, path, red }, idx, arr) => (
                          <button
                            key={label}
                            onClick={() => { setShowEmptyFindMenu(false); navigate(path); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              width: '100%', padding: '12px 16px',
                              fontSize: '13px', fontWeight: red ? '600' : '500',
                              color: red ? '#dc2626' : '#444444',
                              backgroundColor: red ? '#FEF2F2' : '#ffffff',
                              border: 'none', cursor: 'pointer',
                              fontFamily: '"DM Sans", sans-serif', textAlign: 'left',
                              borderBottom: idx < arr.length - 1 ? `1px solid ${red ? '#FECACA' : '#E8E0D8'}` : 'none',
                              transition: 'background-color 0.15s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = red ? '#FEE2E2' : '#FDF8F5'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = red ? '#FEF2F2' : '#ffffff'}
                          >
                            <span style={{ fontSize: '16px' }}>{emoji}</span>
                            {label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* + New Request — dropdown with all 4 case types */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => { setShowEmptyRequestMenu(prev => !prev); setShowEmptyFindMenu(false); }}
                    className="btn-primary px-6 py-2 text-sm"
                  >
                    + New Request ▾
                  </button>
                  {showEmptyRequestMenu && (
                    <>
                      <div
                        style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                        onClick={() => setShowEmptyRequestMenu(false)}
                      />
                      <div style={{
                        position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                        marginTop: '6px', width: '240px', backgroundColor: '#ffffff',
                        borderRadius: '12px', border: '1px solid #E8E0D8',
                        boxShadow: '0 8px 24px rgba(68, 44, 20, 0.15)', zIndex: 50, overflow: 'hidden',
                      }}>
                        {[
                          { emoji: '🚨', label: 'Emergency', path: '/emergency-request', red: true },
                          { emoji: '🏥', label: 'OPD Consultation', path: '/opd-request' },
                          { emoji: '🔄', label: 'Re-consultation', path: '/reconsult-request' },
                          { emoji: '🔪', label: 'Elective Surgery', path: '/new-request' },
                        ].map(({ emoji, label, path, red }, idx, arr) => (
                          <button
                            key={label}
                            onClick={() => { setShowEmptyRequestMenu(false); navigate(path); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              width: '100%', padding: '12px 16px',
                              fontSize: '13px', fontWeight: red ? '600' : '500',
                              color: red ? '#dc2626' : '#444444',
                              backgroundColor: red ? '#FEF2F2' : '#ffffff',
                              border: 'none', cursor: 'pointer',
                              fontFamily: '"DM Sans", sans-serif', textAlign: 'left',
                              borderBottom: idx < arr.length - 1 ? `1px solid ${red ? '#FECACA' : '#E8E0D8'}` : 'none',
                              transition: 'background-color 0.15s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = red ? '#FEE2E2' : '#FDF8F5'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = red ? '#FEF2F2' : '#ffffff'}
                          >
                            <span style={{ fontSize: '16px' }}>{emoji}</span>
                            {label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

          ) : (
            <table style={{
              width: '100%', borderCollapse: 'collapse',
              tableLayout: 'auto', display: 'table',
            }}>
              <thead style={{ display: 'table-header-group' }}>
                <tr style={{
                  display: 'table-row',
                  backgroundColor: '#FDF8F5',
                  borderBottom: '1px solid #E8E0D8',
                }}>
                  {['Case ID', 'Procedure', 'Surgery Date', 'Fee', 'Status', 'Action'].map(h => (
                    <th key={h} style={{
                      display: 'table-cell',
                      textAlign: 'left', padding: '12px 20px',
                      fontSize: '11px', fontWeight: '600',
                      color: '#8B8B8B', textTransform: 'uppercase',
                      letterSpacing: '0.06em', whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ display: 'table-row-group' }}>
                {displayedCases.map((c, i) => (
                  <tr
                    key={c.id}
                    style={{
                      display: 'table-row',
                      backgroundColor: i % 2 === 0 ? '#ffffff' : '#FEFCFA',
                      borderBottom: '1px solid #E8E0D8',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FDF8F5'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = i % 2 === 0 ? '#ffffff' : '#FEFCFA'}
                  >
                    {/* Case ID */}
                    <td style={{ display: 'table-cell', padding: '14px 20px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#444', fontFamily: 'monospace' }}>
                        SOC-{String(c.case_number).padStart(3, '0')}
                      </span>
                    </td>

                    {/* Procedure */}
                    <td style={{ display: 'table-cell', padding: '14px 20px' }}>
                      <div style={{ fontWeight: '500', fontSize: '14px', color: '#444' }}>
                        {c.procedure || <span style={{ color: '#8B8B8B', fontStyle: 'italic' }}>Not filled yet</span>}
                      </div>
                      <div style={{ fontSize: '12px', color: '#8B8B8B', marginTop: '2px' }}>{c.specialty_required}</div>
                    </td>

                    {/* Date */}
                    <td style={{ display: 'table-cell', padding: '14px 20px' }}>
                      <div style={{ fontSize: '13px', color: '#444' }}>{formatDate(c.surgery_date)}</div>
                      <div style={{ fontSize: '12px', color: '#8B8B8B', marginTop: '2px' }}>{c.surgery_time}</div>
                    </td>

                    {/* Fee — show flat fee if available, fall back to range for old cases */}
                    <td style={{ display: 'table-cell', padding: '14px 20px', fontSize: '13px', color: '#8B8B8B' }}>
                      {c.fee ? formatFee(c.fee) : c.fee_min ? `${formatFee(c.fee_min)} – ${formatFee(c.fee_max)}` : '—'}
                    </td>

                    {/* Status */}
                    <td style={{ display: 'table-cell', padding: '14px 20px' }}>
                      {getStatusBadge(c.status)}
                    </td>

                    {/* Action — draft cases get "Complete Details", others get "View" */}
                    <td style={{ display: 'table-cell', padding: '14px 20px' }}>
                      {c.status === 'draft' ? (
                        <button
                          onClick={() => navigate(`/cases/${c.id}/edit`)}
                          style={{
                            color: '#E56717', fontSize: '13px', fontWeight: '600',
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontFamily: '"DM Sans", sans-serif', padding: 0,
                          }}
                          onMouseEnter={(e) => e.target.style.color = '#CD4D00'}
                          onMouseLeave={(e) => e.target.style.color = '#E56717'}
                        >
                          Complete Details →
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate(`/cases/${c.id}`)}
                          style={{
                            color: '#E56717', fontSize: '13px', fontWeight: '600',
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontFamily: '"DM Sans", sans-serif', padding: 0,
                          }}
                          onMouseEnter={(e) => e.target.style.color = '#CD4D00'}
                          onMouseLeave={(e) => e.target.style.color = '#E56717'}
                        >
                          View →
                        </button>
                      )}
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