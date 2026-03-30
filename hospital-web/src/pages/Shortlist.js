/**
 * SHORTLIST PAGE - Hospital Web App
 * Company: Vaidhya Healthcare Pvt Ltd
 *
 * After a hospital posts a surgery request, they land here.
 * This page shows matched surgeons and lets the SPOC:
 * 1. View matched surgeons with their details
 * 2. Select up to 5 surgeons in priority order
 * 3. Send the request cascade
 *
 * Flow:
 * NewRequest form → (case created) → Shortlist page → (priority set) → Case Status page
 *
 * UPDATED (Migration 002):
 *   - "Your go-to surgeons" section: top 3 most-booked surgeons for this hospital,
 *     derived from confirmed/completed cases via GET /api/cases?hospital_id=X.
 *   - Matched surgeons sorted by avg_hourly_rate ascending (cheapest first),
 *     with match_score as tiebreaker.
 *   - avg_hourly_rate displayed on every surgeon card as ₹X,XXX/hr.
 *   - "Within budget range" badge on surgeons whose avg_hourly_rate falls
 *     within ±20% of the case fee.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;


// ── HELPERS (pure functions, used in render) ─────────────────────────────────

/**
 * Format paise integer to Indian-style rupee string: ₹X,XX,XXX/hr
 * e.g. 80000000 paise → ₹8,00,000/hr
 * Returns null if value is falsy so the caller can hide the element.
 */
const formatRate = (paise) => {
  if (!paise) return null;
  const rupees = paise / 100;
  // toLocaleString('en-IN') gives Indian grouping: 8,00,000
  return `₹${rupees.toLocaleString('en-IN')}/hr`;
};

/**
 * Check whether a surgeon's avg_hourly_rate is within ±20% of the case fee.
 * Both values are in paise. Returns false if either value is missing.
 */
const isWithinBudget = (avgRate, caseFee) => {
  if (!avgRate || !caseFee) return false;
  const lower = caseFee * 0.8;
  const upper = caseFee * 1.2;
  return avgRate >= lower && avgRate <= upper;
};


// ── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function Shortlist() {
  const navigate = useNavigate();
  const location = useLocation();

  // ── Get case ID from URL (/cases/:caseId/shortlist)
  const { caseId } = useParams();

  // ADDED (Migration 004): If navigating from a re-consult conversion, the
  // recommending surgeon ID is passed via route state. We auto-add them to
  // the priority list at position #1 once matched surgeons are loaded.
  const recommendingSurgeonId = location.state?.recommending_surgeon_id || null;

  // ── STATE ──────────────────────────────────────────────────────────────────

  // The case details (includes hospital_id, fee, procedure, etc.)
  const [caseData, setCaseData] = useState(null);

  // All matched surgeons returned by the matching algorithm
  const [matchedSurgeons, setMatchedSurgeons] = useState([]);

  // Surgeons selected by SPOC in priority order
  // e.g. [{surgeon}, {surgeon}] where index 0 = priority 1
  const [priorityList, setPriorityList] = useState([]);

  // ADDED (Migration 002): Top booked surgeons for the "Your go-to surgeons" section.
  // Each entry: { surgeon_id, count, surgeon } where surgeon comes from the
  // matched surgeons list (so we have name, specialty, avg_hourly_rate).
  const [goToSurgeons, setGoToSurgeons] = useState([]);

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // ── EFFECTS ────────────────────────────────────────────────────────────────

  /**
   * On load: fetch the case details, matched surgeons, and hospital cases
   * (for the go-to surgeons section).
   */
  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Fetching case:', caseId);

        // ── 1. Get case details from backend ──────────────────────────────
        const response = await axios.get(`${API_URL}/api/cases/${caseId}`);
        console.log('Case fetched:', response.data);

        const fetchedCase = response.data.case;
        setCaseData(fetchedCase);

        // ── 2. Fetch matched surgeons ─────────────────────────────────────
        const matchResponse = await axios.get(
          `${API_URL}/api/cases/${caseId}/matches`
        );
        console.log('Matched surgeons:', matchResponse.data);

        const matched = matchResponse.data.matched_surgeons || [];

        // ADDED (Migration 002): Sort by avg_hourly_rate ascending (cheapest first).
        // Surgeons without a rate sink to the bottom. Tiebreaker: match_score desc.
        const sorted = [...matched].sort((a, b) => {
          const rateA = a.avg_hourly_rate || Infinity;
          const rateB = b.avg_hourly_rate || Infinity;
          if (rateA !== rateB) return rateA - rateB;
          return (b.match_score || 0) - (a.match_score || 0);
        });

        setMatchedSurgeons(sorted);

        // ── ADDED (Migration 004): Auto-add recommending surgeon to priority list ──
        // If this page was opened from a re-consult conversion, find the
        // recommending surgeon in the matched list and add them at position #1.
        if (recommendingSurgeonId) {
          const recSurgeon = sorted.find(s => s.id === recommendingSurgeonId);
          if (recSurgeon) {
            console.log('Auto-adding recommending surgeon to priority list:', recSurgeon.name);
            setPriorityList([recSurgeon]);
          } else {
            console.log('Recommending surgeon not found in matches:', recommendingSurgeonId);
          }
        }

        // ── 3. Fetch all hospital cases to derive go-to surgeons ──────────
        // Uses the hospital_id from the case we just fetched.
        if (fetchedCase?.hospital_id) {
          const casesRes = await axios.get(
            `${API_URL}/api/cases?hospital_id=${fetchedCase.hospital_id}`
          );
          const allCases = casesRes.data.cases || [];
          console.log('Hospital cases fetched for go-to:', allCases.length);

          // Count confirmed/completed cases per surgeon
          const countMap = {};
          allCases.forEach(c => {
            if (
              c.confirmed_surgeon_id &&
              (c.status === 'confirmed' || c.status === 'completed')
            ) {
              countMap[c.confirmed_surgeon_id] =
                (countMap[c.confirmed_surgeon_id] || 0) + 1;
            }
          });

          // Sort by count descending, take top 3
          const topIds = Object.entries(countMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

          // Enrich with surgeon details from the matched list.
          // If a go-to surgeon isn't in the current match results we still
          // want to show them, so we fall back to a minimal object.
          const enriched = topIds
            .map(([surgeonId, count]) => {
              const surgeon = sorted.find(s => s.id === surgeonId);
              // Only show if we have surgeon details (they must appear in matches
              // to be selectable — otherwise we'd add a surgeon who doesn't match)
              if (!surgeon) return null;
              return { surgeon_id: surgeonId, count, surgeon };
            })
            .filter(Boolean);

          console.log('Go-to surgeons:', enriched.map(g => g.surgeon.name));
          setGoToSurgeons(enriched);
        }

      } catch (error) {
        console.error('Error fetching case:', error);
        setError('Failed to load case details');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [caseId]);

  // ── HANDLERS ───────────────────────────────────────────────────────────────

  /**
   * Add a surgeon to the priority list
   * Max 5 surgeons allowed
   */
  const addToPriority = (surgeon) => {
    // Check if already in list
    if (priorityList.find(s => s.id === surgeon.id)) {
      console.log('Surgeon already in priority list:', surgeon.name);
      return;
    }

    // Check max limit
    if (priorityList.length >= 5) {
      console.log('Priority list is full (max 5)');
      return;
    }

    console.log('Adding surgeon to priority list:', surgeon.name);
    setPriorityList(prev => [...prev, surgeon]);
  };

  /**
   * Remove a surgeon from the priority list
   */
  const removeFromPriority = (surgeonId) => {
    console.log('Removing surgeon from priority list:', surgeonId);
    setPriorityList(prev => prev.filter(s => s.id !== surgeonId));
  };

  /**
   * Send the priority list to the backend
   * This triggers the cascade — first surgeon gets notified immediately
   */
  const sendRequests = async () => {
    if (priorityList.length < 1) {
      setError('Please select at least 1 surgeons before sending');
      return;
    }

    setSending(true);
    setError('');

    try {
      console.log('Sending priority list to backend:', priorityList.map(s => s.name));

      const response = await axios.patch(
        `${API_URL}/api/cases/${caseId}/priority`,
        {
          // Send array of surgeon IDs in priority order
          priority_list: priorityList.map(s => s.id)
        }
      );

      console.log('Priority list saved:', response.data);

      // Redirect to case status page
      navigate(`/cases/${caseId}`);

    } catch (error) {
      console.error('Error sending priority list:', error);
      setError(error.response?.data?.message || 'Failed to send requests');
    } finally {
      setSending(false);
    }
  };

  // ── HELPERS ────────────────────────────────────────────────────────────────

  /**
   * Check if a surgeon is already in the priority list
   */
  const isSelected = (surgeonId) => {
    return !!priorityList.find(s => s.id === surgeonId);
  };

  /**
   * Get priority number for a surgeon (1-5), or null if not selected
   */
  const getPriorityNumber = (surgeonId) => {
    const index = priorityList.findIndex(s => s.id === surgeonId);
    return index === -1 ? null : index + 1;
  };

  // Priority badge colours
  const priorityColors = {
    1: 'bg-teal-500',
    2: 'bg-blue-500',
    3: 'bg-amber-500',
    4: 'bg-gray-400',
    5: 'bg-gray-400',
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-light flex items-center justify-center">
        <p style={{ color: '#8B8B8B' }}>Loading matched surgeons...</p>
      </div>
    );
  }

  // ADDED (Migration 002): Precompute the case fee for budget-range highlighting.
  // fee is stored in paise on the case object.
  const caseFee = caseData?.fee || null;

  return (
    <div className="min-h-screen bg-brand-light">

      {/* ── TOP NAVIGATION ── */}
      <nav className="topnav">
        <h1 className="topnav-brand">
          Surgeon <span>on Call</span>
        </h1>
        <button
          onClick={() => navigate('/dashboard')}
          className="btn-ghost text-gray-400 hover:text-brand"
        >
          ← Back to Dashboard
        </button>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* ── PAGE HEADING ── */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold" style={{ color: '#444444' }}>
            Select Your Priority Surgeons
          </h2>
          <p style={{ color: '#8B8B8B' }} className="text-sm mt-1">
            {caseData?.procedure} · {caseData?.surgery_date} · {caseData?.surgery_time}
            {/* ADDED (Migration 002): Show case fee next to case info for reference */}
            {caseFee && (
              <span className="ml-2 font-medium" style={{ color: '#E56717' }}>
                · Case fee: ₹{(caseFee / 100).toLocaleString('en-IN')}
              </span>
            )}
          </p>
        </div>

        {/* ── STEP INDICATOR ── */}
        <div className="flex mb-8">
          {['Post Request', 'Select Surgeons', 'Confirmation'].map((step, i) => (
            <div key={step} className={`flex-1 py-3 px-4 border-b-4 flex items-center gap-2 text-sm
              ${i === 1
                ? 'font-semibold'
                : i < 1 ? 'text-teal-600' : ''
              }`}
              style={
                i === 1 ? { borderColor: '#E56717', color: '#E56717' }
                : i < 1 ? { borderColor: '#14b8a6' }
                : { borderColor: '#E8E0D8', color: '#8B8B8B' }
              }
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${i < 1 ? 'bg-teal-500 text-white' : ''}`}
                style={
                  i === 1 ? { backgroundColor: '#E56717', color: '#ffffff' }
                  : i > 1 ? { border: '2px solid #E8E0D8', color: '#8B8B8B' }
                  : {}
                }
              >
                {i < 1 ? '✓' : i + 1}
              </span>
              {step}
            </div>
          ))}
        </div>

        {/* ── ERROR ── */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}


        {/* ════════════════════════════════════════════════════════════════════
            ADDED (Migration 002): YOUR GO-TO SURGEONS
            Horizontal row of up to 3 cards showing the hospital's most-booked
            surgeons. Derived from confirmed/completed case counts.
            Hidden entirely if no confirmed surgeons exist for this hospital.
        ════════════════════════════════════════════════════════════════════ */}
        {goToSurgeons.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold mb-3" style={{ color: '#444444' }}>
              Your go-to surgeons
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {goToSurgeons.map(({ surgeon, count }) => {
                const selected = isSelected(surgeon.id);
                return (
                  <div
                    key={surgeon.id}
                    onClick={() => addToPriority(surgeon)}
                    className={`rounded-xl p-4 transition cursor-pointer text-center
                      ${selected
                        ? 'ring-2 opacity-60 cursor-default'
                        : 'hover:shadow-md'
                      }`}
                    style={{
                      backgroundColor: '#ffffff',
                      border: selected ? '2px solid #E56717' : '1px solid #E8E0D8',
                      ...(selected ? {} : {}),
                    }}
                  >
                    {/* Surgeon avatar — initials in brand circle */}
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center
                        text-white font-bold text-lg mx-auto mb-2"
                      style={{ backgroundColor: selected ? '#CD4D00' : '#E56717' }}
                    >
                      {surgeon.name.split(' ').slice(-2).map(n => n[0]).join('')}
                    </div>

                    {/* Surgeon name */}
                    <div className="font-semibold text-sm truncate" style={{ color: '#444444' }}>
                      {surgeon.name}
                    </div>

                    {/* Specialty */}
                    <div className="text-xs truncate mt-0.5" style={{ color: '#8B8B8B' }}>
                      {Array.isArray(surgeon.specialty)
                        ? surgeon.specialty.join(', ')
                        : surgeon.specialty}
                    </div>

                    {/* Avg hourly rate */}
                    {formatRate(surgeon.avg_hourly_rate) && (
                      <div className="text-xs font-semibold mt-1.5" style={{ color: '#E56717' }}>
                        {formatRate(surgeon.avg_hourly_rate)}
                      </div>
                    )}

                    {/* Booking count badge */}
                    <div className="text-xs mt-1.5 rounded-full inline-block px-2 py-0.5"
                      style={{ backgroundColor: '#FDF8F5', color: '#8B8B8B' }}>
                      {count} past booking{count !== 1 ? 's' : ''}
                    </div>

                    {/* Already-selected indicator */}
                    {selected && (
                      <div className="text-xs font-semibold mt-1" style={{ color: '#E56717' }}>
                        Added
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}


        <div className="grid grid-cols-2 gap-6">

          {/* ── LEFT: MATCHED SURGEONS ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold" style={{ color: '#444444' }}>Matched Surgeons</h3>
              <span className="text-xs font-bold px-2 py-1 rounded-full"
                style={{ backgroundColor: '#FDF8F5', color: '#E56717' }}>
                {matchedSurgeons.length} found
              </span>
            </div>

            {matchedSurgeons.length === 0 ? (
              // No surgeons found state
              <div className="bg-white rounded-xl p-8 text-center"
                style={{ border: '1px solid #E8E0D8' }}>
                <div className="text-4xl mb-3">🔍</div>
                <p className="font-medium" style={{ color: '#444444' }}>No surgeons available</p>
                <p className="text-sm mt-1" style={{ color: '#8B8B8B' }}>
                  No verified surgeons found for {caseData?.specialty_required} on {caseData?.surgery_date}.
                  Our team will reach out to you shortly.
                </p>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="mt-4 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ backgroundColor: '#E56717' }}
                >
                  Back to Dashboard
                </button>
              </div>
            ) : (
              // Surgeon cards — sorted by avg_hourly_rate asc (done in useEffect)
              <div className="flex flex-col gap-3">
                {matchedSurgeons.map((surgeon) => {
                  const selected = isSelected(surgeon.id);
                  const priority = getPriorityNumber(surgeon.id);

                  // ADDED (Migration 002): Check if this surgeon's rate is
                  // within ±20% of the case fee for the budget badge.
                  const budgetMatch = isWithinBudget(surgeon.avg_hourly_rate, caseFee);

                  return (
                    <div
                      key={surgeon.id}
                      className={`bg-white rounded-xl border-2 p-4 transition cursor-pointer
                        ${selected ? 'bg-orange-50' : ''}`}
                      style={{
                        borderColor: selected ? '#E56717'
                          : budgetMatch ? '#86efac'   // subtle green border for budget match
                          : '#E8E0D8',
                        ...(selected ? { backgroundColor: '#FDF8F5' } : {}),
                        ...(!selected ? { ':hover': { borderColor: '#E56717' } } : {}),
                      }}
                      onMouseEnter={(e) => {
                        if (!selected && !budgetMatch) e.currentTarget.style.borderColor = '#E56717';
                      }}
                      onMouseLeave={(e) => {
                        if (!selected && !budgetMatch) e.currentTarget.style.borderColor = '#E8E0D8';
                        if (!selected && budgetMatch) e.currentTarget.style.borderColor = '#86efac';
                      }}
                      onClick={() => !selected && addToPriority(surgeon)}
                    >
                      <div className="flex items-center gap-3">

                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center
                          text-white font-bold text-lg flex-shrink-0"
                          style={{ background: selected ? '#E56717' : '#64748B' }}>
                          {surgeon.name.split(' ').slice(-2).map(n => n[0]).join('')}
                        </div>

                        {/* Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold" style={{ color: '#444444' }}>
                              {surgeon.name}
                            </span>

                            {/* ADDED (Migration 004): "Recommended surgeon" badge */}
                            {recommendingSurgeonId && surgeon.id === recommendingSurgeonId && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: '#FFF7F0', color: '#E56717', border: '1px solid #F5D9C0' }}>
                                Recommended surgeon
                              </span>
                            )}

                            {/* ADDED (Migration 002): "Within budget range" badge */}
                            {budgetMatch && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>
                                Within budget range
                              </span>
                            )}
                          </div>

                          <div className="text-xs mt-0.5" style={{ color: '#8B8B8B' }}>
                            {Array.isArray(surgeon.specialty)
                              ? surgeon.specialty.join(', ')
                              : surgeon.specialty}
                          </div>

                          <div className="flex gap-3 mt-1.5 flex-wrap">
                            <span className="text-xs" style={{ color: '#8B8B8B' }}>
                              ⭐ {surgeon.rating || 'New'}
                            </span>
                            <span className="text-xs" style={{ color: '#8B8B8B' }}>
                              🏥 {surgeon.total_cases} cases
                            </span>
                            <span className="text-xs" style={{ color: '#8B8B8B' }}>
                              📍 {surgeon.city}
                            </span>
                            <span className="text-xs" style={{ color: '#8B8B8B' }}>
                              🎓 {surgeon.experience_years} yrs exp
                            </span>

                            {/* ADDED (Migration 002): avg_hourly_rate display */}
                            {formatRate(surgeon.avg_hourly_rate) && (
                              <span className="text-xs font-semibold" style={{ color: '#E56717' }}>
                                {formatRate(surgeon.avg_hourly_rate)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Priority badge or Add button */}
                        {selected ? (
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center
                            text-white text-sm font-bold flex-shrink-0 ${priorityColors[priority]}`}>
                            {priority}
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); addToPriority(surgeon); }}
                            disabled={priorityList.length >= 5}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg border
                              transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                            style={{
                              borderColor: '#E56717',
                              color: '#E56717',
                            }}
                            onMouseEnter={(e) => {
                              if (priorityList.length < 5) {
                                e.currentTarget.style.backgroundColor = '#E56717';
                                e.currentTarget.style.color = '#ffffff';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#E56717';
                            }}
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── RIGHT: PRIORITY LIST ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold" style={{ color: '#444444' }}>Your Priority Order</h3>
              <span className="text-xs" style={{ color: '#8B8B8B' }}>
                {priorityList.length} / 5 selected
              </span>
            </div>

            <div className="bg-white rounded-xl p-5 min-h-64"
              style={{ border: '1px solid #E8E0D8' }}>

              {priorityList.length === 0 ? (
                // Empty state
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <div className="text-3xl mb-2">👆</div>
                  <p className="text-sm font-medium" style={{ color: '#8B8B8B' }}>
                    No surgeons selected yet
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#8B8B8B' }}>
                    Click surgeons from the left to add them here
                  </p>
                </div>
              ) : (
                // Priority list
                <div className="flex flex-col gap-2">
                  {priorityList.map((surgeon, index) => (
                    <div
                      key={surgeon.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border-l-4
                        ${index === 0 ? 'border-teal-500 bg-teal-50'
                          : index === 1 ? 'border-blue-400 bg-blue-50'
                          : 'border-gray-300 bg-gray-50'}`}
                    >
                      {/* Priority number */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center
                        text-white text-xs font-bold flex-shrink-0
                        ${priorityColors[index + 1]}`}>
                        {index + 1}
                      </div>

                      {/* Surgeon info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm" style={{ color: '#444444' }}>
                            {surgeon.name}
                          </span>
                          {/* ADDED (Migration 004): Recommended surgeon label in priority list */}
                          {recommendingSurgeonId && surgeon.id === recommendingSurgeonId && (
                            <span className="text-xs px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: '#FFF7F0', color: '#E56717', fontSize: '10px' }}>
                              Recommended
                            </span>
                          )}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: '#8B8B8B' }}>
                          {surgeon.experience_years} yrs · ⭐ {surgeon.rating || 'New'}
                          {/* ADDED (Migration 002): Show rate in priority list too */}
                          {formatRate(surgeon.avg_hourly_rate) && (
                            <span className="ml-2 font-semibold" style={{ color: '#E56717' }}>
                              · {formatRate(surgeon.avg_hourly_rate)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Remove button */}
                      <button
                        onClick={() => removeFromPriority(surgeon.id)}
                        className="text-gray-400 hover:text-red-500 transition text-lg leading-none"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Send button */}
              {priorityList.length >= 1 && (
                <div className="mt-4">
                  <button
                    onClick={sendRequests}
                    disabled={sending}
                    className="w-full text-white font-semibold
                      py-3 rounded-lg transition disabled:opacity-50"
                    style={{ backgroundColor: '#E56717' }}
                    onMouseEnter={(e) => { if (!sending) e.currentTarget.style.backgroundColor = '#CD4D00'; }}
                    onMouseLeave={(e) => { if (!sending) e.currentTarget.style.backgroundColor = '#E56717'; }}
                  >
                    {sending
                      ? 'Sending Requests...'
                      : `Send to ${priorityList.length} Surgeon${priorityList.length !== 1 ? 's' : ''}`}
                  </button>
                  <p className="text-xs text-center mt-2" style={{ color: '#8B8B8B' }}>
                    Request goes to Priority 1 first. If no response in 2 hours, cascades to Priority 2.
                  </p>
                </div>
              )}

              {/* Minimum selection hint */}
              {priorityList.length === 0  && (
                <p className="text-xs text-amber-600 text-center mt-4">
                  Select at least {1 - priorityList.length} more surgeon{1 - priorityList.length > 1 ? 's' : ''} to continue
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
