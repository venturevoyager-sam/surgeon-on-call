/**
 * ADMIN DASHBOARD - Surgeon on Call
 * Company: Vaidhya Healthcare Pvt Ltd
 *
 * Full admin control panel for the Vaidhya operations team.
 *
 * Tabs:
 * 1. Overview  — platform stats at a glance
 * 2. Cases     — all cases, filters, mark complete/cancel, reassign, cascade
 * 3. Surgeons  — all surgeons, verify/reject, suspend/reactivate
 * 4. Earnings  — commission report
 *
 * Runs on port 3001 (hospital web is on 3000)
 * DEV_MODE = true — no login required during development
 *
 * CHANGE LOG:
 * - Added CasePanel: clicking SOC-XXX case ID opens a slide-out panel
 *   showing full case details + clinical documents uploaded by the hospital
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import CasePanel from './CasePanel'; // ← slide-out panel with documents

// ── CONFIG ────────────────────────────────────────────────────────────────────
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ── HELPERS ───────────────────────────────────────────────────────────────────
const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
};

const formatFee = (paise) => {
  if (!paise) return '—';
  return '₹' + (paise / 100).toLocaleString('en-IN');
};

// Status badge config for cases
const CASE_STATUS = {
  draft:       { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Draft' },
  active:      { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Active' },
  cascading:   { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Cascading' },
  confirmed:   { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Confirmed' },
  in_progress: { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'In Progress' },
  completed:   { bg: 'bg-teal-100',   text: 'text-teal-700',   label: 'Completed' },
  cancelled:   { bg: 'bg-red-100',    text: 'text-red-600',    label: 'Cancelled' },
  unfilled:    { bg: 'bg-red-100',    text: 'text-red-600',    label: 'Unfilled' },
};

// ── ROOT COMPONENT ────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview',  label: '📊 Overview' },
    { id: 'cases',     label: '🏥 Cases' },
    { id: 'surgeons',  label: '👨‍⚕️ Surgeons' },
    { id: 'earnings',  label: '💰 Earnings' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── NAV ── */}
      <nav className="bg-blue-900 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-xl">
            Surgeon <span className="text-blue-300">on Call</span>
            <span className="ml-3 text-xs bg-blue-700 text-blue-200 px-2 py-1 rounded-full font-normal">Admin</span>
          </h1>
          <p className="text-blue-400 text-xs mt-0.5">Vaidhya Healthcare Pvt Ltd</p>
        </div>
        <div className="text-blue-300 text-sm">Operations Dashboard</div>
      </nav>

      {/* ── TABS ── */}
      <div className="bg-white border-b border-gray-200 px-8">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-4 text-sm font-semibold border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {activeTab === 'overview'  && <OverviewTab />}
        {activeTab === 'cases'     && <CasesTab />}
        {activeTab === 'surgeons'  && <SurgeonsTab />}
        {activeTab === 'earnings'  && <EarningsTab />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ══════════════════════════════════════════════════════════════════════════════
function OverviewTab() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [casesRes, surgeonsRes, earningsRes] = await Promise.all([
          axios.get(`${API_URL}/api/admin/cases`),
          axios.get(`${API_URL}/api/admin/surgeons`),
          axios.get(`${API_URL}/api/admin/earnings`),
        ]);
        const cases    = casesRes.data.cases || [];
        const surgeons = surgeonsRes.data.surgeons || [];
        const summary  = earningsRes.data.summary || {};

        setStats({
          total_cases:       cases.length,
          active_cases:      cases.filter(c => ['active', 'cascading'].includes(c.status)).length,
          confirmed_cases:   cases.filter(c => c.status === 'confirmed').length,
          completed_cases:   cases.filter(c => c.status === 'completed').length,
          unfilled_cases:    cases.filter(c => c.status === 'unfilled').length,
          total_surgeons:    surgeons.length,
          verified_surgeons: surgeons.filter(s => s.verified && s.status === 'active').length,
          pending_surgeons:  surgeons.filter(s => !s.verified && s.status !== 'suspended').length,
          total_commission:  summary.total_commission || 0,
          fill_rate: cases.length > 0
            ? Math.round((cases.filter(c => ['confirmed','completed'].includes(c.status)).length / cases.length) * 100)
            : 0,
        });
      } catch (err) {
        console.error('Overview fetch failed:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <Spinner />;
  if (!stats) return (
    <div className="text-center py-16 text-gray-400">
      Failed to load stats. Make sure the backend is running.
    </div>
  );

  const statCards = [
    { label: 'Total Cases',           value: stats.total_cases,       color: 'text-blue-900' },
    { label: 'Active / Cascading',    value: stats.active_cases,      color: 'text-amber-600' },
    { label: 'Confirmed',             value: stats.confirmed_cases,   color: 'text-green-600' },
    { label: 'Completed',             value: stats.completed_cases,   color: 'text-teal-600' },
    { label: 'Unfilled',              value: stats.unfilled_cases,    color: 'text-red-500' },
    { label: 'Fill Rate',             value: `${stats.fill_rate}%`,   color: 'text-blue-700' },
    { label: 'Total Surgeons',        value: stats.total_surgeons,    color: 'text-blue-900' },
    { label: 'Verified Surgeons',     value: stats.verified_surgeons, color: 'text-green-600' },
    { label: 'Pending Verification',  value: stats.pending_surgeons,  color: 'text-amber-600' },
    { label: 'Platform Commission',   value: formatFee(stats.total_commission), color: 'text-teal-600' },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold text-blue-900 mb-6">Platform Overview</h2>
      <div className="grid grid-cols-5 gap-4">
        {statCards.map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-gray-500 text-xs mt-1">{card.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CASES TAB
// All cases with filters, status updates, reassign, cascade override.
//
// CHANGE: SOC-XXX case IDs are now clickable buttons.
// Clicking one sets `selectedCase` state which opens the CasePanel slide-out.
// CasePanel shows full case details + clinical documents.
// ══════════════════════════════════════════════════════════════════════════════
function CasesTab() {
  const [cases,          setCases]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [filter,         setFilter]         = useState('all');
  const [actionMsg,      setActionMsg]      = useState('');

  // ── NEW: selected case for the slide-out panel ──
  const [selectedCase,   setSelectedCase]   = useState(null);

  // Reassign modal state
  const [reassignCase,   setReassignCase]   = useState(null);
  const [allSurgeons,    setAllSurgeons]    = useState([]);
  const [selectedSurgeon, setSelectedSurgeon] = useState('');
  const [reassigning,    setReassigning]    = useState(false);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/admin/cases`, {
        params: { status: filter }
      });
      setCases(res.data.cases || []);
    } catch (err) {
      console.error('Failed to fetch cases:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  // Flash action message for 3 seconds
  const showMsg = (msg) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(''), 3000);
  };

  // Update case status
  const updateStatus = async (caseId, status) => {
    try {
      await axios.patch(`${API_URL}/api/admin/cases/${caseId}/status`, { status });
      showMsg(`Case marked as ${status}`);
      fetchCases();
    } catch (err) {
      showMsg('Failed to update status');
    }
  };

  // Manually trigger cascade
  const triggerCascade = async (caseId) => {
    try {
      const res = await axios.post(`${API_URL}/api/admin/cases/${caseId}/cascade`);
      showMsg(res.data.message);
      fetchCases();
    } catch (err) {
      showMsg(err.response?.data?.message || 'Failed to trigger cascade');
    }
  };

  // Open reassign modal
  const openReassign = async (case_) => {
    setReassignCase(case_);
    setSelectedSurgeon('');
    try {
      const res = await axios.get(`${API_URL}/api/admin/surgeons`, {
        params: { filter: 'verified' }
      });
      setAllSurgeons(res.data.surgeons || []);
    } catch (err) {
      console.error('Failed to load surgeons:', err);
    }
  };

  // Submit reassignment
  const submitReassign = async () => {
    if (!selectedSurgeon) return;
    setReassigning(true);
    try {
      await axios.patch(`${API_URL}/api/admin/cases/${reassignCase.id}/reassign`, {
        surgeon_id: selectedSurgeon,
      });
      showMsg('Case reassigned successfully');
      setReassignCase(null);
      fetchCases();
    } catch (err) {
      showMsg('Failed to reassign case');
    } finally {
      setReassigning(false);
    }
  };

  const filters = ['all', 'active', 'cascading', 'confirmed', 'completed', 'cancelled', 'unfilled'];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-blue-900">All Cases</h2>
        {actionMsg && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">
            ✓ {actionMsg}
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition ${
              filter === f
                ? 'bg-blue-700 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-400'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {cases.length === 0 ? (
            <div className="p-12 text-center text-gray-400">No cases found</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Case', 'Procedure', 'Hospital', 'Date', 'Fee', 'Surgeon', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cases.map(c => {
                  const st = CASE_STATUS[c.status] || CASE_STATUS.active;
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">

                      {/* ── SOC-XXX: now a clickable button that opens CasePanel ── */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedCase(c)}
                          className="text-sm font-mono font-semibold text-blue-700 hover:text-blue-900
                            hover:underline transition-colors text-left"
                          title="Click to view case details and documents"
                        >
                          SOC-{String(c.case_number).padStart(3, '0')}
                        </button>
                      </td>

                      <td className="px-4 py-3 text-sm text-gray-800">{c.procedure}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {c.hospitals?.name}<br />
                        <span className="text-xs text-gray-400">{c.hospitals?.city}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(c.surgery_date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatFee(c.fee_max)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {c.surgeons?.name || <span className="text-gray-400 italic">Not assigned</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${st.bg} ${st.text}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {['confirmed', 'cascading', 'active'].includes(c.status) && (
                            <ActionBtn color="blue" onClick={() => openReassign(c)}>Reassign</ActionBtn>
                          )}
                          {['active', 'cascading'].includes(c.status) && (
                            <ActionBtn color="amber" onClick={() => triggerCascade(c.id)}>Cascade</ActionBtn>
                          )}
                          {c.status === 'confirmed' && (
                            <ActionBtn color="teal" onClick={() => updateStatus(c.id, 'completed')}>Complete</ActionBtn>
                          )}
                          {!['completed', 'cancelled'].includes(c.status) && (
                            <ActionBtn color="red" onClick={() => {
                              if (window.confirm('Cancel this case?')) updateStatus(c.id, 'cancelled');
                            }}>Cancel</ActionBtn>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── CASE DETAIL PANEL ──────────────────────────────────────────────────
          Slides in from the right when a SOC-XXX case ID is clicked.
          Shows full case details + clinical documents uploaded by hospital.
          Close by clicking the ✕ button or clicking the dark backdrop.
      ────────────────────────────────────────────────────────────────────── */}
      <CasePanel
        case={selectedCase}
        onClose={() => setSelectedCase(null)}
      />

      {/* ── REASSIGN MODAL ── */}
      {reassignCase && (
        <Modal
          title={`Reassign Surgeon — SOC-${String(reassignCase.case_number).padStart(3,'0')}`}
          onClose={() => setReassignCase(null)}
        >
          <p className="text-sm text-gray-600 mb-4">
            Select a verified surgeon to manually assign to this case.
            The current surgeon (if any) will be marked as overridden.
          </p>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Select Surgeon</label>
          <select
            value={selectedSurgeon}
            onChange={e => setSelectedSurgeon(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 mb-4"
          >
            <option value="">— Choose a surgeon —</option>
            {allSurgeons.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.specialty?.join(', ')} · {s.city}
              </option>
            ))}
          </select>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setReassignCase(null)} className="px-4 py-2 text-sm text-gray-600 font-semibold">
              Cancel
            </button>
            <button
              onClick={submitReassign}
              disabled={!selectedSurgeon || reassigning}
              className="bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-semibold"
            >
              {reassigning ? 'Reassigning...' : 'Confirm Reassign'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SURGEONS TAB
// ══════════════════════════════════════════════════════════════════════════════
function SurgeonsTab() {
  const [surgeons, setSurgeons] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all');
  const [actionMsg, setActionMsg] = useState('');

  const fetchSurgeons = useCallback(async () => {
    setLoading(true);
    try {
      const filterParam = filter === 'verified' ? { available: 'true' }
        : filter === 'pending' ? { available: 'false' } : {};
      const res = await axios.get(`${API_URL}/api/admin/surgeons`, { params: filterParam });
      setSurgeons(res.data.surgeons || []);
    } catch (err) {
      console.error('Failed to fetch surgeons:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchSurgeons(); }, [fetchSurgeons]);

  const showMsg = (msg) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 3000); };

  const verifyAction = async (id, action) => {
    try {
      await axios.patch(`${API_URL}/api/admin/surgeons/${id}/verify`, { action });
      showMsg(`Surgeon ${action}ed successfully`);
      fetchSurgeons();
    } catch (err) { showMsg('Action failed'); }
  };

  const suspendAction = async (id, action) => {
    try {
      await axios.patch(`${API_URL}/api/admin/surgeons/${id}/suspend`, { action });
      showMsg(`Surgeon ${action}ed successfully`);
      fetchSurgeons();
    } catch (err) { showMsg('Action failed'); }
  };

  const filters = ['all', 'pending', 'verified', 'suspended'];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-blue-900">Surgeons</h2>
        {actionMsg && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">
            ✓ {actionMsg}
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-5">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition ${
              filter === f
                ? 'bg-blue-700 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-400'
            }`}
          >
            {f === 'pending' ? '⏳ Pending Verification'
              : f === 'verified'  ? '✅ Verified'
              : f === 'suspended' ? '🚫 Suspended'
              : 'All'}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {surgeons.length === 0 ? (
            <div className="p-12 text-center text-gray-400">No surgeons found</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Surgeon', 'Phone', 'Specialty', 'City', 'MCI No.', 'Cases', 'Rating', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {surgeons.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-sm text-gray-800">{s.name}</div>
                      <div className="text-xs text-gray-400">{s.experience_years} yrs exp</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.phone}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-32">
                      {s.specialty?.join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.city}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.mci_number || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.total_cases}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">⭐ {s.rating}</td>
                    <td className="px-4 py-3">
                      {s.status === 'suspended' ? (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-600">Suspended</span>
                      ) : s.verified ? (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">✅ Verified</span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">⏳ Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {!s.verified && s.status !== 'suspended' && (
                          <>
                            <ActionBtn color="green" onClick={() => verifyAction(s.id, 'verify')}>Verify</ActionBtn>
                            <ActionBtn color="red" onClick={() => {
                              if (window.confirm(`Reject ${s.name}?`)) verifyAction(s.id, 'reject');
                            }}>Reject</ActionBtn>
                          </>
                        )}
                        {s.verified && s.status === 'active' && (
                          <ActionBtn color="red" onClick={() => {
                            if (window.confirm(`Suspend ${s.name}?`)) suspendAction(s.id, 'suspend');
                          }}>Suspend</ActionBtn>
                        )}
                        {s.status === 'suspended' && (
                          <ActionBtn color="green" onClick={() => suspendAction(s.id, 'reactivate')}>Reactivate</ActionBtn>
                        )}
                        {s.certificate_url && (
                          <a
                            href={s.certificate_url}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 rounded text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                          >
                            Docs
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EARNINGS TAB
// ══════════════════════════════════════════════════════════════════════════════
function EarningsTab() {
  const [earnings, setEarnings] = useState([]);
  const [summary,  setSummary]  = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/admin/earnings`);
        setEarnings(res.data.earnings || []);
        setSummary(res.data.summary || {});
      } catch (err) {
        console.error('Failed to fetch earnings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEarnings();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <h2 className="text-xl font-bold text-blue-900 mb-6">Earnings & Commission</h2>

      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <SummaryCard label="Total Cases"          value={summary.total_cases}          color="text-blue-900" />
          <SummaryCard label="Total Commission"     value={formatFee(summary.total_commission)}   color="text-teal-600" />
          <SummaryCard label="From Hospitals (5%)"  value={formatFee(summary.hospital_commission)} color="text-blue-700" />
          <SummaryCard label="From Surgeons (5%)"   value={formatFee(summary.surgeon_commission)}  color="text-green-600" />
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {earnings.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No completed cases yet</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Case', 'Procedure', 'Hospital', 'Surgeon', 'Date', 'Surgeon Fee',
                  'Hospital Comm (5%)', 'Surgeon Comm (5%)', 'Total Comm', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {earnings.map(e => {
                const st = CASE_STATUS[e.status] || CASE_STATUS.confirmed;
                return (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-blue-700">SOC-{String(e.case_number).padStart(3,'0')}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">{e.procedure}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{e.hospitals?.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{e.surgeons?.name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(e.surgery_date)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800">{formatFee(e.surgeon_fee)}</td>
                    <td className="px-4 py-3 text-sm text-blue-700">{formatFee(e.hospital_commission)}</td>
                    <td className="px-4 py-3 text-sm text-green-600">{formatFee(e.surgeon_commission)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-teal-700">{formatFee(e.total_commission)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${st.bg} ${st.text}`}>{st.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SHARED UI COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

function ActionBtn({ children, onClick, color = 'blue' }) {
  const colors = {
    blue:  'bg-blue-50  text-blue-700  hover:bg-blue-100',
    green: 'bg-green-50 text-green-700 hover:bg-green-100',
    amber: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
    teal:  'bg-teal-50  text-teal-700  hover:bg-teal-100',
    red:   'bg-red-50   text-red-600   hover:bg-red-100',
  };
  return (
    <button onClick={onClick} className={`px-2 py-1 rounded text-xs font-semibold transition ${colors[color]}`}>
      {children}
    </button>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-gray-500 text-sm mt-1">{label}</div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
}