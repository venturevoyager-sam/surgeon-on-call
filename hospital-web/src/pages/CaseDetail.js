/**
 * CASE DETAIL PAGE - Hospital Web App
 * Company: Vaidhya Healthcare Pvt Ltd
 *
 * Shows the full status of a surgery request after priority list is sent.
 *
 * Shows:
 * - Case summary (procedure, date, time, patient)
 * - Priority cascade tracker (which surgeon was notified, accepted, declined)
 * - Live countdown timer for the surgeon currently being waited on
 * - Confirmed surgeon card (once someone accepts)
 * - GPS tracking button (on surgery day)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

export default function CaseDetail() {
  const navigate = useNavigate();
  const { caseId } = useParams();

  // ── STATE ──────────────────────────────────────────────────────────────────
  const [caseData, setCaseData] = useState(null);
  const [priorityList, setPriorityList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Countdown timer for the currently notified surgeon
  const [timeLeft, setTimeLeft] = useState(null);

  // ── FETCH CASE ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchCase = async () => {
      try {
        console.log('Fetching case detail:', caseId);
        const response = await axios.get(`${API_URL}/api/cases/${caseId}`);
        console.log('Case detail received:', response.data);
        setCaseData(response.data.case);
        setPriorityList(response.data.priority_list || []);
      } catch (error) {
        console.error('Error fetching case:', error);
        setError('Failed to load case details');
      } finally {
        setLoading(false);
      }
    };

    fetchCase();

    // Refresh case data every 30 seconds to pick up status changes
    const interval = setInterval(fetchCase, 30000);
    return () => clearInterval(interval);
  }, [caseId]);

  // ── COUNTDOWN TIMER ────────────────────────────────────────────────────────
  useEffect(() => {
    // Find the currently notified surgeon (status = 'notified')
    const notifiedRow = priorityList.find(row => row.status === 'notified');
    if (!notifiedRow?.expires_at) {
      setTimeLeft(null);
      return;
    }

    // Calculate time remaining every second
    const timer = setInterval(() => {
      const now = new Date();
      const expires = new Date(notifiedRow.expires_at);
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        clearInterval(timer);
        return;
      }

      // Format as HH:MM:SS
      const hours   = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(
        `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [priorityList]);

  // ── HELPERS ────────────────────────────────────────────────────────────────

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  const formatFee = (paise) => {
    if (!paise) return '—';
    return '₹' + (paise / 100).toLocaleString('en-IN');
  };

  // Status styles for cascade tracker
  const cascadeStyles = {
    pending:  { bg: 'bg-gray-100', text: 'text-gray-500', badge: 'bg-gray-200 text-gray-600',   icon: '⏳', label: 'Waiting' },
    notified: { bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', icon: '📲', label: 'Notified' },
    accepted: { bg: 'bg-green-50', text: 'text-green-700', badge: 'bg-green-100 text-green-700', icon: '✅', label: 'Accepted' },
    declined: { bg: 'bg-red-50',   text: 'text-red-600',   badge: 'bg-red-100 text-red-600',     icon: '❌', label: 'Declined' },
    expired:  { bg: 'bg-gray-50',  text: 'text-gray-400',  badge: 'bg-gray-100 text-gray-500',   icon: '⏰', label: 'Expired' },
  };

  // Overall case status badge
  const statusBadge = {
    active:      'bg-gray-100 text-gray-600',
    cascading:   'bg-amber-100 text-amber-700',
    confirmed:   'bg-green-100 text-green-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed:   'bg-teal-100 text-teal-700',
    cancelled:   'bg-red-100 text-red-600',
    unfilled:    'bg-red-100 text-red-600',
  };

  const statusLabel = {
    active:      'Draft',
    cascading:   'Awaiting Response',
    confirmed:   'Confirmed',
    in_progress: 'In Progress',
    completed:   'Completed',
    cancelled:   'Cancelled',
    unfilled:    'Unfilled — No Response',
  };

  // ── IS SURGERY DAY ─────────────────────────────────────────────────────────
  const isSurgeryDay = () => {
    if (!caseData?.surgery_date) return false;
    const today = new Date().toISOString().split('T')[0];
    return caseData.surgery_date === today;
  };

  // ── CONFIRMED SURGEON ──────────────────────────────────────────────────────
  const confirmedSurgeon = priorityList.find(row => row.status === 'accepted')?.surgeons;

  // ── RENDER ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading case details...</p>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'Case not found'}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── TOP NAVIGATION ── */}
      <nav className="bg-blue-900 px-8 py-4 flex items-center justify-between">
        <h1 className="text-white font-bold text-xl">
          Surgeon <span className="text-blue-300">on Call</span>
        </h1>
        <button
          onClick={() => navigate('/dashboard')}
          className="text-blue-300 hover:text-white text-sm transition"
        >
          ← Back to Dashboard
        </button>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* ── PAGE HEADING ── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-bold text-blue-900">
                SOC-{String(caseData.case_number).padStart(3, '0')}
              </h2>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge[caseData.status]}`}>
                {statusLabel[caseData.status]}
              </span>
            </div>
            <p className="text-gray-500 text-sm">{caseData.procedure}</p>
          </div>

          {/* GPS button — only on surgery day when confirmed */}
          {isSurgeryDay() && caseData.status === 'confirmed' && (
            <button
              onClick={() => navigate(`/cases/${caseId}/gps`)}
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2"
            >
              📍 Track Surgeon
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-6">

          {/* ── LEFT COLUMN: Case details + Confirmed surgeon ── */}
          <div className="col-span-1 flex flex-col gap-4">

            {/* Case Summary Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-4">
                Case Details
              </h3>
              <div className="flex flex-col gap-3">
                <div>
                  <div className="text-xs text-gray-400">Procedure</div>
                  <div className="text-sm font-medium text-gray-800">{caseData.procedure}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Specialty</div>
                  <div className="text-sm font-medium text-gray-800">{caseData.specialty_required}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Surgery Date</div>
                  <div className="text-sm font-medium text-gray-800">{formatDate(caseData.surgery_date)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Surgery Time</div>
                  <div className="text-sm font-medium text-gray-800">{caseData.surgery_time}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">OT Number</div>
                  <div className="text-sm font-medium text-gray-800">{caseData.ot_number}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Patient</div>
                  <div className="text-sm font-medium text-gray-800">
                    {caseData.patient_name}, {caseData.patient_age}y ({caseData.patient_gender})
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Fee Budget</div>
                  <div className="text-sm font-medium text-gray-800">
                    {formatFee(caseData.fee_min)} – {formatFee(caseData.fee_max)}
                  </div>
                </div>
                {caseData.notes && (
                  <div>
                    <div className="text-xs text-gray-400">Notes</div>
                    <div className="text-sm text-gray-600">{caseData.notes}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Confirmed Surgeon Card — shown once accepted */}
            {confirmedSurgeon && (
              <div className="bg-green-50 rounded-xl border border-green-200 p-5">
                <h3 className="font-semibold text-green-700 text-sm uppercase tracking-wide mb-3">
                  ✅ Confirmed Surgeon
                </h3>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-green-600 flex items-center justify-center
                    text-white font-bold text-lg flex-shrink-0">
                    {confirmedSurgeon.name.split(' ').slice(-2).map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800">{confirmedSurgeon.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {confirmedSurgeon.experience_years} yrs · ⭐ {confirmedSurgeon.rating}
                    </div>
                    <div className="text-xs text-gray-500">{confirmedSurgeon.city}</div>
                  </div>
                </div>
                <p className="text-xs text-green-600 mt-3">
                  Our associate will contact you shortly to confirm logistics.
                </p>
              </div>
            )}

            {/* Unfilled state */}
            {caseData.status === 'unfilled' && (
              <div className="bg-red-50 rounded-xl border border-red-200 p-5">
                <h3 className="font-semibold text-red-600 text-sm mb-2">No Surgeons Available</h3>
                <p className="text-xs text-red-500">
                  All surgeons in your priority list have declined or not responded.
                  Our team will reach out to you with alternatives.
                </p>
                <button
                  onClick={() => navigate('/new-request')}
                  className="mt-3 w-full bg-red-600 text-white text-xs font-semibold py-2 rounded-lg"
                >
                  Post New Request
                </button>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN: Cascade Tracker ── */}
          <div className="col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
                  Surgeon Request Cascade
                </h3>
                {/* Live countdown for currently notified surgeon */}
                {timeLeft && caseData.status === 'cascading' && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200
                    px-3 py-1.5 rounded-lg">
                    <span className="text-xs text-amber-600 font-medium">Next cascade in</span>
                    <span className="text-sm font-bold text-amber-700 font-mono">{timeLeft}</span>
                  </div>
                )}
              </div>

              {priorityList.length === 0 ? (
                <p className="text-gray-400 text-sm">No priority list set yet.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {priorityList.map((row, index) => {
                    const style = cascadeStyles[row.status] || cascadeStyles.pending;
                    const surgeon = row.surgeons;

                    return (
                      <div
                        key={row.id}
                        className={`flex items-center gap-4 p-4 rounded-xl border
                          ${row.status === 'notified' ? 'border-amber-300' : 'border-gray-100'}
                          ${style.bg}`}
                      >
                        {/* Priority number */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center
                          text-sm font-bold flex-shrink-0
                          ${row.status === 'accepted' ? 'bg-green-500 text-white'
                            : row.status === 'notified' ? 'bg-amber-400 text-white'
                            : row.status === 'declined' || row.status === 'expired' ? 'bg-gray-300 text-gray-500'
                            : 'bg-gray-200 text-gray-500'}`}>
                          {index + 1}
                        </div>

                        {/* Surgeon info */}
                        <div className="flex-1">
                          {surgeon ? (
                            <>
                              <div className={`font-semibold text-sm ${style.text}`}>
                                {surgeon.name}
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">
                                {surgeon.experience_years} yrs · ⭐ {surgeon.rating || 'New'} · {surgeon.city}
                              </div>
                            </>
                          ) : (
                            <div className="text-sm text-gray-500">Surgeon details loading...</div>
                          )}
                        </div>

                        {/* Status badge */}
                        <div className="flex flex-col items-end gap-1">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${style.badge}`}>
                            {style.icon} {style.label}
                          </span>
                          {row.status === 'notified' && row.expires_at && (
                            <span className="text-xs text-amber-500">
                              Expires: {new Date(row.expires_at).toLocaleTimeString('en-IN', {
                                hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                          )}
                          {row.responded_at && (
                            <span className="text-xs text-gray-400">
                              {new Date(row.responded_at).toLocaleTimeString('en-IN', {
                                hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* How cascade works explanation */}
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-600">
                  <strong>How it works:</strong> Request is sent to Priority 1 first.
                  If they don't respond within 2 hours or decline,
                  it automatically moves to Priority 2, and so on.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}