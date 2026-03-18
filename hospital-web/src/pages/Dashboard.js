/**
 * DASHBOARD PAGE - Hospital Web App
 * Vaidhya Healthcare Pvt Ltd
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

const API_URL = process.env.REACT_APP_API_URL;

export default function Dashboard() {
  // ── STATE ──────────────────────────────────────────────────────────────────
  const [user,        setUser]        = useState(null);
  const [hospital,    setHospital]    = useState(null);
  const [activeCases, setActiveCases] = useState([]);
  const [pastCases,   setPastCases]   = useState([]);
  const [activeTab,   setActiveTab]   = useState('active');
  const [loading,     setLoading]     = useState(true);

  const navigate = useNavigate();

  // ── LOAD ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      // DEV MODE — hardcoded email
      const devEmail = 'venturevoyager.sam@gmail.com';
      setUser({ email: devEmail });

      // Get hospital record
      const { data: hospitalData } = await supabase
        .from('hospitals')
        .select('*')
        .eq('contact_email', devEmail)
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
    const { data: cases } = await supabase
      .from('cases')
      .select('*')
      .eq('hospital_id', hospitalId)
      .order('created_at', { ascending: false });

    if (!cases) return;

    // Draft cases (from Find a Surgeon flow) go into active tab
    setActiveCases(cases.filter(c =>
      ['draft', 'active', 'cascading', 'confirmed', 'in_progress'].includes(c.status)
    ));
    setPastCases(cases.filter(c =>
      ['completed', 'cancelled', 'unfilled'].includes(c.status)
    ));
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
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

          {/* New Request — standard form flow */}
          <button
            onClick={() => navigate('/new-request')}
            className="btn-primary px-4 py-2 text-sm"
          >
            + New Request
          </button>

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
                <button onClick={() => navigate('/find-surgeon')} className="btn-secondary px-6 py-2 text-sm">
                  🔍 Find a Surgeon
                </button>
                <button onClick={() => navigate('/new-request')} className="btn-primary px-6 py-2 text-sm">
                  + New Request
                </button>
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
                  {['Case ID', 'Procedure', 'Surgery Date', 'Fee Range', 'Status', 'Action'].map(h => (
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

                    {/* Fee */}
                    <td style={{ display: 'table-cell', padding: '14px 20px', fontSize: '13px', color: '#8B8B8B' }}>
                      {c.fee_min ? `${formatFee(c.fee_min)} – ${formatFee(c.fee_max)}` : '—'}
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