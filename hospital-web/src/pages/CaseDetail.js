/**
 * CASE DETAIL PAGE - Hospital Web App
 * Company: Surgeon on Call (OPC) Pvt Ltd
 *
 * Shows the full status of a surgery request.
 *
 * Features:
 * - Case summary (procedure, date, time, patient)
 * - Request type badge — Emergency (red), OPD (blue), Re-consult (purple), Elective (grey)
 * - Priority cascade tracker
 * - Live countdown timer
 * - Emergency auto-poll (10s) with pulsing live indicator
 * - Single fee display (paise → ₹) replacing fee_min/fee_max
 * - Confirmed surgeon card
 * - Edit case modal (all fields, all statuses)
 * - Delete case with confirmation
 *
 * UPDATED (Migration 001):
 *   - Added request_type badge near case title
 *   - Emergency cases poll every 10s (others keep 30s)
 *   - Fee display changed from range to single flat fee
 *   - Edit modal updated from fee_min/fee_max to single fee
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../lib/config';

// SPECIALTY_OPTIONS: removed — was hardcoded with different naming than other pages,
// causing a mismatch bug. Now fetched from GET /api/specialties (see useEffect below).
// This ensures all pages use the same canonical specialty names from the database.

export default function CaseDetail() {
  const navigate = useNavigate();
  const { caseId } = useParams();

  // ── STATE ──────────────────────────────────────────────────────────────────
  const [caseData, setCaseData]     = useState(null);
  const [priorityList, setPriorityList] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [timeLeft, setTimeLeft]     = useState(null);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm]           = useState({});
  const [saving, setSaving]               = useState(false);
  const [saveError, setSaveError]         = useState('');

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting]                   = useState(false);

  // Specialties fetched from API — drives the specialty dropdown in edit modal
  const [specialties, setSpecialties] = useState([]);

  // Surgery recommendation state (Migration 004)
  // For re-consult cases: fetched recommendation from the confirmed surgeon
  const [recommendation, setRecommendation] = useState(null);
  const [recLoading, setRecLoading]         = useState(false);
  const [converting, setConverting]         = useState(false);

  // ── FETCH CASE ─────────────────────────────────────────────────────────────
  const fetchCase = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/cases/${caseId}`);
      setCaseData(response.data.case);
      setPriorityList(response.data.priority_list || []);
    } catch (error) {
      console.error('Error fetching case:', error);
      setError('Failed to load case details');
    } finally {
      setLoading(false);
    }
  };

  // UPDATED (Migration 001): Emergency cases poll every 10s for faster
  // cascade updates. All other request types keep the original 30s interval.
  // The polling rate adapts when caseData.request_type changes (e.g. on first load).
  useEffect(() => {
    fetchCase();
  }, [caseId]);

  // ── FETCH SURGERY RECOMMENDATION (Migration 004) ─────────────────────────
  // For re-consult cases, check if the confirmed surgeon has submitted a
  // surgery recommendation. Fetched once after caseData loads.
  useEffect(() => {
    if (!caseData) return;
    if (caseData.request_type !== 'reconsult') return;

    const fetchRec = async () => {
      setRecLoading(true);
      try {
        const res = await axios.get(`${API_URL}/api/cases/${caseId}/recommendation`);
        setRecommendation(res.data.recommendation || null);
      } catch (err) {
        console.error('Failed to fetch recommendation:', err);
      } finally {
        setRecLoading(false);
      }
    };
    fetchRec();
  }, [caseData?.request_type, caseId]);

  // Fetch specialties from API on mount — replaces hardcoded SPECIALTY_OPTIONS array.
  // Fixes the naming mismatch bug where CaseDetail used different specialty names
  // (e.g. "Orthopedic Surgery") than the rest of the app (e.g. "Orthopaedics").
  useEffect(() => {
    axios.get(`${API_URL}/api/specialties`)
      .then(res => setSpecialties(res.data.specialties || []))
      .catch(err => console.error('Failed to load specialties:', err));
  }, []);

  useEffect(() => {
    const isEmergency = caseData?.request_type === 'emergency';
    const pollMs = isEmergency ? 10000 : 30000;  // 10s for emergency, 30s for others
    const interval = setInterval(fetchCase, pollMs);
    return () => clearInterval(interval);
  }, [caseId, caseData?.request_type]);

  // ── COUNTDOWN TIMER ────────────────────────────────────────────────────────
  useEffect(() => {
    const notifiedRow = priorityList.find(row => row.status === 'notified');
    if (!notifiedRow?.expires_at) { setTimeLeft(null); return; }

    const timer = setInterval(() => {
      const now = new Date();
      const expires = new Date(notifiedRow.expires_at);
      const diff = expires - now;
      if (diff <= 0) { setTimeLeft('Expired'); clearInterval(timer); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [priorityList]);

  // ── OPEN EDIT MODAL ────────────────────────────────────────────────────────
  // Pre-fills the form with current case data
  const openEditModal = () => {
    // UPDATED (Migration 001): Single fee field replaces fee_min/fee_max
    setEditForm({
      procedure:          caseData.procedure || '',
      specialty_required: caseData.specialty_required || '',
      surgery_date:       caseData.surgery_date || '',
      surgery_time:       caseData.surgery_time?.slice(0, 5) || '',
      duration_hours:     caseData.duration_hours || '',
      ot_number:          caseData.ot_number || '',
      fee:                caseData.fee ? caseData.fee / 100 : '',       // paise → ₹ for display
      patient_name:       caseData.patient_name || '',
      patient_age:        caseData.patient_age || '',
      patient_gender:     caseData.patient_gender || '',
      notes:              caseData.notes || '',
    });
    setSaveError('');
    setShowEditModal(true);
  };

  // ── SAVE EDITS ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      // UPDATED (Migration 001): Send single fee in paise instead of fee_min/fee_max
      await axios.patch(`${API_URL}/api/cases/${caseId}`, {
        ...editForm,
        fee: Math.round(parseFloat(editForm.fee) * 100),  // ₹ → paise
        patient_age: parseInt(editForm.patient_age),
        duration_hours: parseFloat(editForm.duration_hours),
      });
      await fetchCase();
      setShowEditModal(false);
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // ── DELETE CASE ────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/api/cases/${caseId}`);
      navigate('/dashboard');
    } catch (err) {
      console.error('Delete failed:', err);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // ── CONVERT RE-CONSULT TO SURGERY (Migration 004) ─────────────────────────
  // Called when hospital clicks "Create Surgery Request" on the recommendation
  // banner. Marks the re-consult as converted, then navigates to NewRequest
  // with pre-filled data from the recommendation and original case.
  const handleConvert = async () => {
    setConverting(true);
    try {
      await axios.patch(`${API_URL}/api/cases/${caseId}/convert`, {
        hospital_id: caseData.hospital_id,
      });

      // Navigate to NewRequest with pre-fill data via route state
      navigate('/new-request', {
        state: {
          fromReconsult:        true,
          parent_case_id:       caseId,
          specialty_required:   caseData.specialty_required,
          patient_name:         caseData.patient_name,
          patient_age:          caseData.patient_age,
          patient_gender:       caseData.patient_gender,
          suggested_procedure:  recommendation.suggested_procedure,
          recommendation_notes: recommendation.recommendation_notes,
          recommending_surgeon_id: recommendation.surgeon_id,
        },
      });
    } catch (err) {
      console.error('Convert failed:', err);
      alert(err.response?.data?.message || 'Failed to convert case. Please try again.');
    } finally {
      setConverting(false);
    }
  };

  // Dismiss a surgery recommendation — update its status locally.
  // A full backend dismiss endpoint could be added later; for now we just
  // hide the banner client-side so the SPOC can continue without it.
  const handleDismissRecommendation = () => {
    setRecommendation(null);
  };

  // ── HELPERS ────────────────────────────────────────────────────────────────
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  const formatFee = (paise) => {
    if (!paise) return '—';
    return '₹' + (paise / 100).toLocaleString('en-IN');
  };

  const statusBadge = {
    draft:      'bg-gray-100 text-gray-600',
    active:     'bg-blue-100 text-blue-700',
    cascading:  'bg-amber-100 text-amber-700',
    confirmed:  'bg-green-100 text-green-700',
    unfilled:   'bg-red-100 text-red-600',
    completed:  'bg-teal-100 text-teal-700',
    cancelled:  'bg-gray-100 text-gray-500',
  };

  const statusLabel = {
    draft:      'Draft',
    active:     'Active — Pending Shortlist',
    cascading:  'Cascading — Awaiting Response',
    confirmed:  'Confirmed',
    unfilled:   'Unfilled — No Response',
    completed:  'Completed',
    cancelled:  'Cancelled',
  };

  const isSurgeryDay = () => {
    if (!caseData?.surgery_date) return false;
    return caseData.surgery_date === new Date().toISOString().split('T')[0];
  };

  // NEW (Migration 001): Request type badge styling
  // Maps request_type to a colored badge shown near the case title
  const requestTypeBadge = {
    emergency: { cls: 'bg-red-100 text-red-600',    label: 'Emergency' },
    opd:       { cls: 'bg-blue-100 text-blue-600',   label: 'OPD' },
    reconsult: { cls: 'bg-purple-100 text-purple-600', label: 'Re-consult' },
    elective:  { cls: 'bg-gray-100 text-gray-500',   label: 'Elective' },
  };

  // Whether this is an emergency case (used for live indicator and poll rate)
  const isEmergency = caseData?.request_type === 'emergency';

  const confirmedSurgeon = priorityList.find(row => row.status === 'accepted')?.surgeons;

  // ── LOADING / ERROR ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-brand-light flex items-center justify-center">
      <p className="text-muted">Loading case details...</p>
    </div>
  );

  if (error || !caseData) return (
    <div className="min-h-screen bg-brand-light flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-500 mb-4">{error || 'Case not found'}</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary px-4 py-2 text-sm">
          Back to Dashboard
        </button>
      </div>
    </div>
  );

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-brand-light">

      {/* NEW (Migration 001): Keyframe animation for the emergency live pulsing dot.
          Defined inline via <style> to avoid modifying tailwind.config.js. */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.75); }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav className="topnav">
        <div className="flex items-center">
          <img
            src="/logo.png"
            alt="Surgeon on Call"
            style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'block';
            }}
          />
          <h1 className="topnav-brand" style={{ display: 'none' }}>
            Surgeon <span>on Call</span>
          </h1>
        </div>
        <button onClick={() => navigate('/dashboard')} className="btn-ghost text-gray-400 hover:text-brand text-sm transition">
          ← Back to Dashboard
        </button>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* ── PAGE HEADING ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-bold text-body">
                SOC-{String(caseData.case_number).padStart(3, '0')}
              </h2>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge[caseData.status]}`}>
                {statusLabel[caseData.status]}
              </span>

              {/* NEW (Migration 001): Request type badge — Emergency, OPD, Re-consult, Elective */}
              {caseData.request_type && (
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                  (requestTypeBadge[caseData.request_type] || requestTypeBadge.elective).cls
                }`}>
                  {(requestTypeBadge[caseData.request_type] || requestTypeBadge.elective).label}
                </span>
              )}
            </div>
            <p className="text-muted text-sm">{caseData.procedure}</p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Edit button */}
            <button
              onClick={openEditModal}
              className="bg-white border border-warm hover:border-brand text-body hover:text-brand px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2"
            >
              ✏️ Edit
            </button>

            {/* Delete button */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-white border border-warm hover:border-red-400 text-body hover:text-red-600 px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2"
            >
              🗑️ Delete
            </button>

            {/* Request New Surgeons button — only for unfilled cases (all surgeons declined/expired) */}
            {caseData.status === 'unfilled' && (
              <button
                onClick={() => navigate(`/cases/${caseId}/shortlist`)}
                style={{ backgroundColor: '#E56717' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#CD4D00'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#E56717'}
                className="text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2"
              >
                Request New Surgeons
              </button>
            )}

            {/* GPS button — only on surgery day */}
            {isSurgeryDay() && caseData.status === 'confirmed' && (
              <button
                onClick={() => navigate(`/cases/${caseId}/gps`)}
                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2"
              >
                📍 Track Surgeon
              </button>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SURGERY RECOMMENDATION BANNER (Migration 004)
            Shown when a confirmed surgeon on a re-consult case has submitted
            a surgery recommendation. Displays procedure, urgency, notes, and
            two actions: convert to surgery or dismiss.
        ════════════════════════════════════════════════════════════════════ */}
        {caseData.request_type === 'reconsult' && recLoading && (
          <div className="mb-6 p-4 rounded-xl text-center" style={{ backgroundColor: '#FDF8F5', border: '1px solid #E8E0D8' }}>
            <p style={{ color: '#8B8B8B' }} className="text-sm">Checking for surgery recommendations...</p>
          </div>
        )}

        {caseData.request_type === 'reconsult' && !recLoading && recommendation && (
          <div className="mb-6 rounded-xl overflow-hidden" style={{ border: '2px solid #E56717' }}>
            {/* Banner header */}
            <div className="px-5 py-3 flex items-center gap-2" style={{ backgroundColor: '#FFF7F0' }}>
              <span className="text-lg">💡</span>
              <span className="text-sm font-bold uppercase tracking-wide" style={{ color: '#E56717' }}>
                Surgery Recommendation
              </span>
            </div>

            {/* Banner body */}
            <div className="px-5 py-4 bg-white">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Surgeon name */}
                  {recommendation.surgeons && (
                    <p className="text-xs mb-2" style={{ color: '#8B8B8B' }}>
                      Recommended by <span className="font-semibold" style={{ color: '#444444' }}>
                        {recommendation.surgeons.name}
                      </span>
                    </p>
                  )}

                  {/* Suggested procedure */}
                  <p className="font-bold text-lg" style={{ color: '#444444' }}>
                    {recommendation.suggested_procedure}
                  </p>

                  {/* Urgency badge */}
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                    ${recommendation.urgency === 'urgent'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-gray-100 text-gray-500'
                    }`}>
                    {recommendation.urgency === 'urgent' ? 'Urgent' : 'Elective'}
                  </span>

                  {/* Recommendation notes */}
                  {recommendation.recommendation_notes && (
                    <p className="mt-3 text-sm leading-relaxed" style={{ color: '#444444' }}>
                      {recommendation.recommendation_notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 mt-4 pt-4" style={{ borderTop: '1px solid #E8E0D8' }}>
                <button
                  onClick={handleConvert}
                  disabled={converting}
                  className="flex-1 text-white font-semibold py-3 rounded-lg text-sm transition disabled:opacity-50"
                  style={{ backgroundColor: '#E56717' }}
                  onMouseEnter={e => { if (!converting) e.currentTarget.style.backgroundColor = '#CD4D00'; }}
                  onMouseLeave={e => { if (!converting) e.currentTarget.style.backgroundColor = '#E56717'; }}
                >
                  {converting ? 'Converting...' : 'Create Surgery Request'}
                </button>
                <button
                  onClick={handleDismissRecommendation}
                  disabled={converting}
                  className="px-6 py-3 rounded-lg text-sm font-semibold transition"
                  style={{ color: '#8B8B8B', border: '1px solid #E8E0D8' }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">

          {/* ── LEFT COLUMN ── */}
          <div className="col-span-1 flex flex-col gap-4">

            {/* Case Summary Card */}
            <div className="card">
              <h3 className="font-semibold text-body text-sm uppercase tracking-wide mb-4">Case Details</h3>
              <div className="flex flex-col gap-3">
                <Field label="Procedure"  value={caseData.procedure} />
                <Field label="Specialty"  value={caseData.specialty_required} />
                <Field label="Date"       value={formatDate(caseData.surgery_date)} />
                <Field label="Time"       value={caseData.surgery_time} />
                <Field label="Duration"   value={`${caseData.duration_hours} hrs`} />
                <Field label="OT Number"  value={`OT ${caseData.ot_number}`} />
                {/* UPDATED (Migration 001): Single fee display, with fallback to range for old cases */}
                <Field label="Fee" value={
                  caseData.fee
                    ? formatFee(caseData.fee)
                    : caseData.fee_min
                      ? `${formatFee(caseData.fee_min)} – ${formatFee(caseData.fee_max)}`
                      : '—'
                } />
              </div>
            </div>

            {/* Patient Card */}
            <div className="card">
              <h3 className="font-semibold text-body text-sm uppercase tracking-wide mb-4">Patient</h3>
              <div className="flex flex-col gap-3">
                <Field label="Age"    value={`${caseData.patient_age} yrs`} />
                <Field label="Gender" value={caseData.patient_gender} />
                {caseData.notes && <Field label="Notes" value={caseData.notes} />}
              </div>
            </div>

            {/* Confirmed Surgeon Card */}
            {confirmedSurgeon && (
              <div className="bg-green-50 rounded-xl border border-green-200 p-5">
                <h3 className="font-semibold text-green-800 text-sm uppercase tracking-wide mb-3">✅ Confirmed Surgeon</h3>
                <p className="font-bold text-green-900">{confirmedSurgeon.name}</p>
                <p className="text-green-700 text-sm mt-1">{confirmedSurgeon.specialty?.join(', ')}</p>
                <p className="text-green-600 text-sm">{confirmedSurgeon.city}</p>
                <p className="text-green-600 text-sm mt-1">⭐ {confirmedSurgeon.rating} · {confirmedSurgeon.experience_years} yrs exp</p>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN: Cascade tracker ── */}
          <div className="col-span-2">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-body text-sm uppercase tracking-wide">Surgeon Cascade</h3>

                  {/* NEW (Migration 001): Pulsing live indicator for emergency cases.
                      Shows when auto-polling is active (10s interval).
                      CSS animation is inline to avoid needing a Tailwind keyframe config. */}
                  {isEmergency && (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-50 border border-red-200">
                      <span
                        className="inline-block w-2 h-2 rounded-full bg-red-500"
                        style={{
                          animation: 'pulse-dot 1.5s ease-in-out infinite',
                        }}
                      />
                      <span className="text-xs font-semibold text-red-600">LIVE</span>
                    </span>
                  )}
                </div>
                {timeLeft && (
                  <div className="text-right">
                    <div className="text-xs text-muted">Waiting for response</div>
                    <div className="text-lg font-mono font-bold text-amber-600">{timeLeft}</div>
                  </div>
                )}
              </div>

              {priorityList.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted text-sm">No surgeons notified yet.</p>
                  {caseData.status === 'active' && (
                    <button
                      onClick={() => navigate(`/cases/${caseId}/shortlist`)}
                      className="mt-4 btn-primary px-6 py-2 text-sm"
                    >
                      Select Surgeons →
                    </button>
                  )}
                  {/* Edge case: unfilled with no priority rows (rows cleaned up) */}
                  {caseData.status === 'unfilled' && (
                    <button
                      onClick={() => navigate(`/cases/${caseId}/shortlist`)}
                      style={{ backgroundColor: '#E56717' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#CD4D00'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = '#E56717'}
                      className="mt-4 text-white px-6 py-2 rounded-lg text-sm font-semibold transition"
                    >
                      Request New Surgeons →
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {(() => {
                    const acceptedRow = priorityList.find(r => r.status === 'accepted');
                    const displayList = acceptedRow ? [acceptedRow] : priorityList;
                    return displayList.map((row, index) => (
                      <CascadeRow key={row.id} row={row} index={index} />
                    ));
                  })()}

                  {/* Banner when all surgeons have declined/expired — case is unfilled */}
                  {caseData.status === 'unfilled' && (
                    <div className="mt-4 p-4 rounded-xl text-center"
                      style={{ backgroundColor: '#FDF8F5', border: '1px solid #E8E0D8' }}>
                      <p className="text-sm font-semibold mb-1" style={{ color: '#444444' }}>
                        All surgeons have declined or expired
                      </p>
                      <p className="text-xs mb-3" style={{ color: '#8B8B8B' }}>
                        You can request new surgeons to fill this case.
                      </p>
                      <button
                        onClick={() => navigate(`/cases/${caseId}/shortlist`)}
                        style={{ backgroundColor: '#E56717' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#CD4D00'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#E56717'}
                        className="text-white px-6 py-2 rounded-lg text-sm font-semibold transition"
                      >
                        Request New Surgeons →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── EDIT MODAL ── */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b border-warm">
              <h3 className="text-lg font-bold text-body">Edit Case — SOC-{String(caseData.case_number).padStart(3, '0')}</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            {/* Modal body */}
            <div className="p-6 flex flex-col gap-5">

              {saveError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                  {saveError}
                </div>
              )}

              {/* Surgery details section */}
              <div>
                <h4 className="text-xs font-bold text-muted uppercase tracking-wide mb-3">Surgery Details</h4>
                <div className="grid grid-cols-2 gap-4">

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-muted mb-1">Procedure Name</label>
                    <input
                      type="text"
                      value={editForm.procedure}
                      onChange={e => setEditForm({...editForm, procedure: e.target.value})}
                      className="w-full border border-warm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-muted mb-1">Specialty Required</label>
                    <select
                      value={editForm.specialty_required}
                      onChange={e => setEditForm({...editForm, specialty_required: e.target.value})}
                      className="w-full border border-warm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                    >
                      {specialties.length === 0
                        ? <option value="">Loading specialties...</option>
                        : specialties.map(s => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))
                      }
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">Surgery Date</label>
                    <input
                      type="date"
                      value={editForm.surgery_date}
                      onChange={e => setEditForm({...editForm, surgery_date: e.target.value})}
                      className="w-full border border-warm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">Surgery Time</label>
                    <input
                      type="time"
                      value={editForm.surgery_time}
                      onChange={e => setEditForm({...editForm, surgery_time: e.target.value})}
                      className="w-full border border-warm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">Duration (hours)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={editForm.duration_hours}
                      onChange={e => setEditForm({...editForm, duration_hours: e.target.value})}
                      className="w-full border border-warm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">OT Number</label>
                    <input
                      type="text"
                      value={editForm.ot_number}
                      onChange={e => setEditForm({...editForm, ot_number: e.target.value})}
                      className="w-full border border-warm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                  </div>

                  {/* UPDATED (Migration 001): Single fee field replaces min/max */}
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-muted mb-1">Surgeon Fee (₹)</label>
                    <input
                      type="number"
                      value={editForm.fee}
                      onChange={e => setEditForm({...editForm, fee: e.target.value})}
                      placeholder="e.g. 25000"
                      className="w-full border border-warm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                    <p className="text-xs text-gray-400 mt-1">Total fee offered to surgeon. Platform deducts 5% commission.</p>
                  </div>
                </div>
              </div>

              {/* Patient details section */}
              <div>
                <h4 className="text-xs font-bold text-muted uppercase tracking-wide mb-3">Patient Details</h4>
                <div className="grid grid-cols-2 gap-4">

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-muted mb-1">Patient Name</label>
                    <input
                      type="text"
                      value={editForm.patient_name}
                      onChange={e => setEditForm({...editForm, patient_name: e.target.value})}
                      className="w-full border border-warm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">Age</label>
                    <input
                      type="number"
                      value={editForm.patient_age}
                      onChange={e => setEditForm({...editForm, patient_age: e.target.value})}
                      className="w-full border border-warm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">Gender</label>
                    <select
                      value={editForm.patient_gender}
                      onChange={e => setEditForm({...editForm, patient_gender: e.target.value})}
                      className="w-full border border-warm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-muted mb-1">Clinical Notes</label>
                    <textarea
                      value={editForm.notes}
                      onChange={e => setEditForm({...editForm, notes: e.target.value})}
                      rows={3}
                      className="w-full border border-warm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-warm">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-sm text-muted hover:text-body font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary px-6 py-2 text-sm disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-body mb-2">Delete Case?</h3>
            <p className="text-muted text-sm mb-6">
              This will permanently delete <strong>SOC-{String(caseData.case_number).padStart(3, '0')} — {caseData.procedure}</strong> and all associated data. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-warm rounded-lg text-sm font-semibold text-muted hover:bg-brand-light"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── HELPER COMPONENTS ──────────────────────────────────────────────────────────

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-sm font-medium text-body">{value || '—'}</div>
    </div>
  );
}

function CascadeRow({ row, index }) {
  const statusConfig = {
    pending:  { bg: 'bg-gray-50',   border: 'border-gray-200', badge: 'bg-gray-100 text-gray-500',   label: 'Pending' },
    notified: { bg: 'bg-amber-50',  border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', label: '⏳ Waiting' },
    accepted: { bg: 'bg-green-50',  border: 'border-green-200', badge: 'bg-green-100 text-green-700', label: '✅ Accepted' },
    declined: { bg: 'bg-red-50',    border: 'border-red-200',   badge: 'bg-red-100 text-red-600',     label: '✗ Declined' },
    expired:  { bg: 'bg-gray-50',   border: 'border-gray-200', badge: 'bg-gray-100 text-gray-500',   label: 'Expired' },
  };

  const config = statusConfig[row.status] || statusConfig.pending;

  return (
    <div className={`flex items-center justify-between p-4 rounded-xl border ${config.bg} ${config.border}`}>
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center" style={{ backgroundColor: 'rgba(229,103,23,0.12)', color: '#E56717' }}>
          {index + 1}
        </div>
        <div>
          <p className="font-semibold text-body text-sm">{row.surgeons?.name || '—'}</p>
          <p className="text-xs text-muted">{row.surgeons?.specialty?.join(', ')}</p>
        </div>
      </div>
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.badge}`}>
        {config.label}
      </span>
    </div>
  );
}