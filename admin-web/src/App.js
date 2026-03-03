/**
 * ADMIN DASHBOARD - Surgeon on Call
 * Company: Vaidhya Healthcare Pvt Ltd
 *
 * Single-page admin dashboard for the Vaidhya operations team.
 *
 * Features:
 * - Platform stats: total cases, fill rate, active surgeons, revenue
 * - All cases across all hospitals with status badges
 * - Manual override: assign any verified surgeon to any active case
 * - All surgeons with availability status
 * - Hospital-wise breakdown
 *
 * DEV_MODE=true — no login required during development
 * Run on port 3001 (hospital web runs on 3000)
 */

import React, { useState, useEffect, useCallback } from 'react';

// ── CONFIG ────────────────────────────────────────────────────────────────────
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const DEV_MODE = true;

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

// Status badge styles — consistent across tables
const STATUS_STYLES = {
  active:      { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Draft' },
  cascading:   { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Cascading' },
  confirmed:   { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Confirmed' },
  in_progress: { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'In Progress' },
  completed:   { bg: 'bg-teal-100',   text: 'text-teal-700',   label: 'Completed' },
  cancelled:   { bg: 'bg-red-100',    text: 'text-red-600',    label: 'Cancelled' },
  unfilled:    { bg: 'bg-red-100',    text: 'text-red-600',    label: 'Unfilled' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.active;
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

// ── OVERRIDE MODAL ────────────────────────────────────────────────────────────
/**
 * Modal for admin to manually assign any verified surgeon to a case.
 * Fetches all verified surgeons, lets admin pick one, confirms assignment.
 * On confirm: stops cascade, marks all others cancelled, sets confirmed surgeon.
 */
function OverrideModal({ case_, onClose, onSuccess }) {
  const [surgeons, setSurgeons] = useState([]);
  const [selectedSurgeon, setSelectedSurgeon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Fetch all verified surgeons on mount
  useEffect(() => {
    const fetchSurgeons = async () => {
      try {
        const res = await fetch(`${API_URL}/api/admin/surgeons`);
        const data = await res.json();
        setSurgeons(data.surgeons || []);
      } catch (err) {
        setError('Failed to load surgeons');
      } finally {
        setLoading(false);
      }
    };
    fetchSurgeons();
  }, []);

  // Filter surgeons by search
  const filtered = surgeons.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (Array.isArray(s.specialty) ? s.specialty.join(' ') : s.specialty || '').toLowerCase().includes(search.toLowerCase()) ||
    s.city.toLowerCase().includes(search.toLowerCase())
  );

  // Confirm override
  const handleConfirm = async () => {
    if (!selectedSurgeon) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/admin/cases/${case_.id}/override`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surgeon_id: selectedSurgeon.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Override failed');
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    // Modal backdrop
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Manual Override</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Assign a surgeon to <strong>SOC-{String(case_.case_number).padStart(3,'0')}</strong> — {case_.procedure}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none mt-0.5">×</button>
        </div>

        {/* Warning banner */}
        <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700">
            ⚠️ This will <strong>stop the cascade</strong> and mark all other surgeons as cancelled.
            The selected surgeon will be immediately confirmed.
          </p>
        </div>

        {/* Search */}
        <div className="px-6 mt-4">
          <input
            type="text"
            placeholder="Search by name, specialty, or city..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Surgeon list */}
        <div className="flex-1 overflow-y-auto px-6 mt-3 pb-2">
          {loading ? (
            <p className="text-gray-400 text-sm text-center py-8">Loading surgeons...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No surgeons found</p>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map(surgeon => (
                <div
                  key={surgeon.id}
                  onClick={() => setSelectedSurgeon(surgeon)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition
                    ${selectedSurgeon?.id === surgeon.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-100 hover:border-blue-200'
                    }`}
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center
                    text-white font-bold text-sm flex-shrink-0
                    ${selectedSurgeon?.id === surgeon.id ? 'bg-blue-600' : 'bg-gray-400'}`}>
                    {surgeon.name.split(' ').slice(-2).map(n => n[0]).join('')}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-800">{surgeon.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                      {Array.isArray(surgeon.specialty) ? surgeon.specialty.join(', ') : surgeon.specialty}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-gray-500">⭐ {surgeon.rating} · {surgeon.city}</div>
                    <div className={`text-xs mt-0.5 font-medium ${surgeon.available ? 'text-green-600' : 'text-red-500'}`}>
                      {surgeon.available ? '● Available' : '● Unavailable'}
                    </div>
                  </div>

                  {/* Selected indicator */}
                  {selectedSurgeon?.id === surgeon.id && (
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="px-6 text-red-500 text-sm">{error}</p>
        )}

        {/* Footer buttons */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedSurgeon || saving}
            className="flex-1 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving
              ? 'Assigning...'
              : selectedSurgeon
                ? `Assign ${selectedSurgeon.name.split(' ').slice(-1)[0]}`
                : 'Select a Surgeon'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── STATS TAB ─────────────────────────────────────────────────────────────────
function StatsTab({ cases, surgeons, hospitals }) {
  // Compute platform stats from data
  const totalCases = cases.length;
  const activeCases = cases.filter(c => ['active','cascading','confirmed','in_progress'].includes(c.status)).length;
  const completedCases = cases.filter(c => c.status === 'completed').length;
  const unfilledCases = cases.filter(c => c.status === 'unfilled').length;
  const fillRate = totalCases > 0
    ? Math.round((completedCases + cases.filter(c => c.status === 'confirmed').length) / totalCases * 100)
    : 0;
  const availableSurgeons = surgeons.filter(s => s.available).length;

  const statCards = [
    { label: 'Total Cases',        value: totalCases,          color: 'text-blue-900' },
    { label: 'Active Cases',       value: activeCases,         color: 'text-amber-600' },
    { label: 'Completed',          value: completedCases,      color: 'text-teal-600' },
    { label: 'Unfilled',           value: unfilledCases,       color: 'text-red-500' },
    { label: 'Fill Rate',          value: fillRate + '%',      color: 'text-green-600' },
    { label: 'Total Surgeons',     value: surgeons.length,     color: 'text-blue-900' },
    { label: 'Available Now',      value: availableSurgeons,   color: 'text-green-600' },
    { label: 'Hospitals',          value: hospitals.length,    color: 'text-blue-900' },
  ];

  // Hospital-wise case breakdown
  const hospitalBreakdown = hospitals.map(h => {
    const hCases = cases.filter(c => c.hospital_id === h.id);
    return {
      ...h,
      total: hCases.length,
      active: hCases.filter(c => ['active','cascading','confirmed','in_progress'].includes(c.status)).length,
      completed: hCases.filter(c => c.status === 'completed').length,
      unfilled: hCases.filter(c => c.status === 'unfilled').length,
    };
  }).sort((a, b) => b.total - a.total);

  return (
    <div>
      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {statCards.map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-gray-500 text-sm mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Hospital breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Hospital-wise Breakdown</h3>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Hospital</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">City</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Active</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Completed</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Unfilled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {hospitalBreakdown.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-sm">No hospitals yet</td></tr>
            ) : hospitalBreakdown.map(h => (
              <tr key={h.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4">
                  <div className="font-medium text-sm text-gray-800">{h.name}</div>
                  <div className="text-xs text-gray-400">{h.contact_email}</div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{h.city}</td>
                <td className="px-6 py-4 text-sm font-semibold text-blue-900">{h.total}</td>
                <td className="px-6 py-4 text-sm text-amber-600">{h.active}</td>
                <td className="px-6 py-4 text-sm text-teal-600">{h.completed}</td>
                <td className="px-6 py-4 text-sm text-red-500">{h.unfilled}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── CASES TAB ─────────────────────────────────────────────────────────────────
function CasesTab({ cases, hospitals, onOverride }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Build hospital lookup map for displaying hospital name
  const hospitalMap = {};
  hospitals.forEach(h => { hospitalMap[h.id] = h; });

  // Filter cases
  const filtered = cases.filter(c => {
    const matchesStatus = filter === 'all' || c.status === filter;
    const matchesSearch = !search ||
      c.procedure.toLowerCase().includes(search.toLowerCase()) ||
      String(c.case_number).includes(search) ||
      (hospitalMap[c.hospital_id]?.name || '').toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Cases that can be overridden (active, cascading, or unfilled)
  const canOverride = (status) => ['active', 'cascading', 'unfilled'].includes(status);

  return (
    <div>
      {/* Filters row */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input
          type="text"
          placeholder="Search procedure, case ID, hospital..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {['all', 'active', 'cascading', 'confirmed', 'completed', 'unfilled'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition capitalize
              ${filter === s ? 'bg-blue-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}
          >
            {s === 'all' ? 'All' : STATUS_STYLES[s]?.label || s}
          </button>
        ))}
      </div>

      {/* Cases table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Case</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Hospital</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Surgery Date</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fee</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-sm">No cases found</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4">
                  <div className="font-mono text-xs text-gray-400">SOC-{String(c.case_number).padStart(3,'0')}</div>
                  <div className="font-medium text-sm text-gray-800 mt-0.5">{c.procedure}</div>
                  <div className="text-xs text-gray-400">{c.specialty_required}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-700">{hospitalMap[c.hospital_id]?.name || '—'}</div>
                  <div className="text-xs text-gray-400">{hospitalMap[c.hospital_id]?.city || ''}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-600">{formatDate(c.surgery_date)}</div>
                  <div className="text-xs text-gray-400">{c.surgery_time}</div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {formatFee(c.fee_min)} – {formatFee(c.fee_max)}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-6 py-4">
                  {canOverride(c.status) && (
                    <button
                      onClick={() => onOverride(c)}
                      className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                    >
                      Override
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── SURGEONS TAB ──────────────────────────────────────────────────────────────
function SurgeonsTab({ surgeons }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = surgeons.filter(s => {
    const matchesSearch = !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (Array.isArray(s.specialty) ? s.specialty.join(' ') : s.specialty || '').toLowerCase().includes(search.toLowerCase()) ||
      s.city.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === 'all' ||
      (filter === 'available' && s.available) ||
      (filter === 'unavailable' && !s.available);
    return matchesSearch && matchesFilter;
  });

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <input
          type="text"
          placeholder="Search name, specialty, city..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {['all', 'available', 'unavailable'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition capitalize
              ${filter === f ? 'bg-blue-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}
          >
            {f === 'all' ? 'All' : f === 'available' ? '● Available' : '● Unavailable'}
          </button>
        ))}
      </div>

      {/* Surgeons table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Surgeon</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Specialty</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">City</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rating</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cases</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-sm">No surgeons found</td></tr>
            ) : filtered.map(s => (
              <tr key={s.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-900 flex items-center justify-center
                      text-white text-xs font-bold flex-shrink-0">
                      {s.name.split(' ').slice(-2).map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="font-medium text-sm text-gray-800">{s.name}</div>
                      <div className="text-xs text-gray-400">MCI: {s.mci_number || '—'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-xs text-gray-600">
                  {Array.isArray(s.specialty) ? s.specialty.join(', ') : s.specialty || '—'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{s.city}</td>
                <td className="px-6 py-4 text-sm text-gray-700">⭐ {s.rating || 'New'}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{s.total_cases || 0}</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold
                    ${s.available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.available ? '● Available' : '● Offline'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── HOSPITALS TAB ─────────────────────────────────────────────────────────────
function HospitalsTab({ hospitals, cases }) {
  // Count cases per hospital
  const caseCount = {};
  cases.forEach(c => {
    caseCount[c.hospital_id] = (caseCount[c.hospital_id] || 0) + 1;
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Hospital</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">City</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Cases</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Verified</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {hospitals.length === 0 ? (
            <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm">No hospitals yet</td></tr>
          ) : hospitals.map(h => (
            <tr key={h.id} className="hover:bg-gray-50 transition">
              <td className="px-6 py-4">
                <div className="font-medium text-sm text-gray-800">{h.name}</div>
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">{h.city}</td>
              <td className="px-6 py-4 text-sm text-gray-600">{h.contact_email}</td>
              <td className="px-6 py-4 text-sm font-semibold text-blue-900">{caseCount[h.id] || 0}</td>
              <td className="px-6 py-4">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold
                  ${h.verified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {h.verified ? '✓ Verified' : 'Pending'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function AdminApp() {
  // ── STATE ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('stats');
  const [cases, setCases] = useState([]);
  const [surgeons, setSurgeons] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overrideCase, setOverrideCase] = useState(null); // case being overridden

  // ── FETCH ALL DATA ─────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [casesRes, surgeonsRes, hospitalsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/cases`),
        fetch(`${API_URL}/api/admin/surgeons`),
        fetch(`${API_URL}/api/admin/hospitals`),
      ]);

      const [casesData, surgeonsData, hospitalsData] = await Promise.all([
        casesRes.json(),
        surgeonsRes.json(),
        hospitalsRes.json(),
      ]);

      setCases(casesData.cases || []);
      setSurgeons(surgeonsData.surgeons || []);
      setHospitals(hospitalsData.hospitals || []);
    } catch (err) {
      setError('Failed to load data. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── TABS ───────────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'stats',     label: '📊 Stats' },
    { id: 'cases',     label: `🏥 Cases (${cases.length})` },
    { id: 'surgeons',  label: `👨‍⚕️ Surgeons (${surgeons.length})` },
    { id: 'hospitals', label: `🏨 Hospitals (${hospitals.length})` },
  ];

  // ── RENDER ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading admin dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Override modal */}
      {overrideCase && (
        <OverrideModal
          case_={overrideCase}
          onClose={() => setOverrideCase(null)}
          onSuccess={() => {
            setOverrideCase(null);
            fetchAll(); // Refresh all data after override
          }}
        />
      )}

      {/* ── TOP NAV ── */}
      <nav className="bg-blue-900 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-white font-bold text-xl">
            Surgeon <span className="text-blue-300">on Call</span>
          </h1>
          <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded">
            ADMIN
          </span>
        </div>
        <div className="flex items-center gap-3">
          {DEV_MODE && (
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded">
              DEV MODE
            </span>
          )}
          <span className="text-blue-300 text-sm">Vaidhya Healthcare Pvt Ltd</span>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            ❌ {error}
          </div>
        )}

        {/* ── TABS ── */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition
                ${activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              {tab.label}
            </button>
          ))}

          {/* Refresh button */}
          <button
            onClick={fetchAll}
            className="ml-auto px-4 py-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            ↻ Refresh
          </button>
        </div>

        {/* ── TAB CONTENT ── */}
        {activeTab === 'stats' && (
          <StatsTab cases={cases} surgeons={surgeons} hospitals={hospitals} />
        )}
        {activeTab === 'cases' && (
          <CasesTab
            cases={cases}
            hospitals={hospitals}
            onOverride={(case_) => setOverrideCase(case_)}
          />
        )}
        {activeTab === 'surgeons' && (
          <SurgeonsTab surgeons={surgeons} />
        )}
        {activeTab === 'hospitals' && (
          <HospitalsTab hospitals={hospitals} cases={cases} />
        )}
      </div>
    </div>
  );
}