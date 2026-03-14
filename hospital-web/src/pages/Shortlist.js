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
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

export default function Shortlist() {
  const navigate = useNavigate();

  // ── Get case ID from URL (/cases/:caseId/shortlist)
  const { caseId } = useParams();

  // ── STATE ──────────────────────────────────────────────────────────────────

  // The case details
  const [caseData, setCaseData] = useState(null);

  // All matched surgeons returned by the matching algorithm
  const [matchedSurgeons, setMatchedSurgeons] = useState([]);

  // Surgeons selected by SPOC in priority order
  // e.g. [{surgeon}, {surgeon}] where index 0 = priority 1
  const [priorityList, setPriorityList] = useState([]);

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // ── EFFECTS ────────────────────────────────────────────────────────────────

  /**
   * On load: fetch the case details and matched surgeons from backend
   */
  useEffect(() => {
    const fetchCase = async () => {
      try {
        console.log('Fetching case:', caseId);

        // Get case details from backend
        const response = await axios.get(`${API_URL}/api/cases/${caseId}`);
        console.log('Case fetched:', response.data);

        setCaseData(response.data.case);

        // Also fetch matched surgeons
        // We re-run matching by calling the cases endpoint with matching param
        const matchResponse = await axios.get(
          `${API_URL}/api/cases/${caseId}/matches`
        );
        console.log('Matched surgeons:', matchResponse.data);
        setMatchedSurgeons(matchResponse.data.matched_surgeons || []);

      } catch (error) {
        console.error('Error fetching case:', error);
        setError('Failed to load case details');
      } finally {
        setLoading(false);
      }
    };

    fetchCase();
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
    if (priorityList.length < 3) {
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading matched surgeons...</p>
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

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* ── PAGE HEADING ── */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-blue-900">Select Your Priority Surgeons</h2>
          <p className="text-gray-500 text-sm mt-1">
            {caseData?.procedure} · {caseData?.surgery_date} · {caseData?.surgery_time}
          </p>
        </div>

        {/* ── STEP INDICATOR ── */}
        <div className="flex mb-8">
          {['Post Request', 'Select Surgeons', 'Confirmation'].map((step, i) => (
            <div key={step} className={`flex-1 py-3 px-4 border-b-4 flex items-center gap-2 text-sm
              ${i === 1
                ? 'border-blue-600 text-blue-600 font-semibold'
                : i < 1 ? 'border-teal-500 text-teal-600' : 'border-gray-200 text-gray-400'
              }`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${i === 1 ? 'bg-blue-600 text-white'
                  : i < 1 ? 'bg-teal-500 text-white'
                  : 'border-2 border-gray-300 text-gray-400'}`}>
                {i < 1 ? '✓' : i + 1}
              </span>
              {step}
            </div>
          ))}
        </div>

        {/* ── ERROR ── */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            ❌ {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">

          {/* ── LEFT: MATCHED SURGEONS ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">Matched Surgeons</h3>
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
                {matchedSurgeons.length} found
              </span>
            </div>

            {matchedSurgeons.length === 0 ? (
              // No surgeons found state
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="text-4xl mb-3">🔍</div>
                <p className="font-medium text-gray-700">No surgeons available</p>
                <p className="text-gray-400 text-sm mt-1">
                  No verified surgeons found for {caseData?.specialty_required} in {caseData?.surgery_date}.
                  Our team will reach out to you shortly.
                </p>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="mt-4 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Back to Dashboard
                </button>
              </div>
            ) : (
              // Surgeon cards
              <div className="flex flex-col gap-3">
                {matchedSurgeons.map((surgeon) => {
                  const selected = isSelected(surgeon.id);
                  const priority = getPriorityNumber(surgeon.id);

                  return (
                    <div
                      key={surgeon.id}
                      className={`bg-white rounded-xl border-2 p-4 transition cursor-pointer
                        ${selected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                        }`}
                      onClick={() => !selected && addToPriority(surgeon)}
                    >
                      <div className="flex items-center gap-3">

                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center
                          text-white font-bold text-lg flex-shrink-0"
                          style={{ background: selected ? '#1A56A0' : '#64748B' }}>
                          {surgeon.name.split(' ').slice(-2).map(n => n[0]).join('')}
                        </div>

                        {/* Info */}
                        <div className="flex-1">
                          <div className="font-semibold text-gray-800">{surgeon.name}</div>
                          <div className="text-gray-500 text-xs mt-0.5">
                            {Array.isArray(surgeon.specialty)
                              ? surgeon.specialty.join(', ')
                              : surgeon.specialty}
                          </div>
                          <div className="flex gap-3 mt-1.5 flex-wrap">
                            <span className="text-xs text-gray-500">
                              ⭐ {surgeon.rating || 'New'}
                            </span>
                            <span className="text-xs text-gray-500">
                              🏥 {surgeon.total_cases} cases
                            </span>
                            <span className="text-xs text-gray-500">
                              📍 {surgeon.city}
                            </span>
                            <span className="text-xs text-gray-500">
                              🎓 {surgeon.experience_years} yrs exp
                            </span>
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
                              border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white
                              transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
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
              <h3 className="font-semibold text-gray-800">Your Priority Order</h3>
              <span className="text-xs text-gray-500">{priorityList.length} / 5 selected</span>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 min-h-64">

              {priorityList.length === 0 ? (
                // Empty state
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <div className="text-3xl mb-2">👆</div>
                  <p className="text-gray-500 text-sm font-medium">No surgeons selected yet</p>
                  <p className="text-gray-400 text-xs mt-1">
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
                        <div className="font-semibold text-sm text-gray-800">
                          {surgeon.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {surgeon.experience_years} yrs · ⭐ {surgeon.rating || 'New'}
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
              {priorityList.length >= 3 && (
                <div className="mt-4">
                  <button
                    onClick={sendRequests}
                    disabled={sending}
                    className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold
                      py-3 rounded-lg transition disabled:opacity-50"
                  >
                    {sending
                      ? 'Sending Requests...'
                      : `🚀 Send to ${priorityList.length} Surgeons`}
                  </button>
                  <p className="text-xs text-gray-400 text-center mt-2">
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