/**
 * CASE DETAIL PAGE - Hospital Web App
 * Company: Vaidhya Healthcare Pvt Ltd
 *
 * Shows the full status of a surgery request.
 *
 * Features:
 * - Case summary (procedure, date, time, patient)
 * - Priority cascade tracker
 * - Live countdown timer
 * - Confirmed surgeon card
 * - Edit case modal (all fields, all statuses)
 * - Delete case with confirmation
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

// Specialty options — must match surgeon specialties
const SPECIALTY_OPTIONS = [
  'General Surgery',
  'Laparoscopic Surgery',
  'Orthopedic Surgery',
  'Cardiac Surgery',
  'Neurosurgery',
  'Plastic Surgery',
  'Urological Surgery',
  'Vascular Surgery',
  'Thoracic Surgery',
  'Pediatric Surgery',
  'Gynecological Surgery',
  'ENT Surgery',
  'Ophthalmology',
  'Oncological Surgery',
  'Transplant Surgery',
];

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

  useEffect(() => {
    fetchCase();
    const interval = setInterval(fetchCase, 30000);
    return () => clearInterval(interval);
  }, [caseId]);

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
    setEditForm({
      procedure:          caseData.procedure || '',
      specialty_required: caseData.specialty_required || '',
      surgery_date:       caseData.surgery_date || '',
      surgery_time:       caseData.surgery_time?.slice(0, 5) || '',
      duration_hours:     caseData.duration_hours || '',
      ot_number:          caseData.ot_number || '',
      fee_min:            caseData.fee_min ? caseData.fee_min / 100 : '',
      fee_max:            caseData.fee_max ? caseData.fee_max / 100 : '',
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
      await axios.patch(`${API_URL}/api/cases/${caseId}`, {
        ...editForm,
        // Convert fee back to paise
        fee_min: Math.round(parseFloat(editForm.fee_min) * 100),
        fee_max: Math.round(parseFloat(editForm.fee_max) * 100),
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

  const confirmedSurgeon = priorityList.find(row => row.status === 'accepted')?.surgeons;

  // ── LOADING / ERROR ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400">Loading case details...</p>
    </div>
  );

  if (error || !caseData) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-500 mb-4">{error || 'Case not found'}</p>
        <button onClick={() => navigate('/dashboard')} className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
          Back to Dashboard
        </button>
      </div>
    </div>
  );

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── NAV ── */}
      <nav className="bg-blue-900 px-8 py-4 flex items-center justify-between">
        <h1 className="text-white font-bold text-xl">
          Surgeon <span className="text-blue-300">on Call</span>
        </h1>
        <button onClick={() => navigate('/dashboard')} className="text-blue-300 hover:text-white text-sm transition">
          ← Back to Dashboard
        </button>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* ── PAGE HEADING ── */}
        <div className="flex items-start justify-between mb-6">
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

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Edit button */}
            <button
              onClick={openEditModal}
              className="bg-white border border-gray-200 hover:border-blue-400 text-gray-700 hover:text-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2"
            >
              ✏️ Edit
            </button>

            {/* Delete button */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-white border border-gray-200 hover:border-red-400 text-gray-700 hover:text-red-600 px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2"
            >
              🗑️ Delete
            </button>

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

        <div className="grid grid-cols-3 gap-6">

          {/* ── LEFT COLUMN ── */}
          <div className="col-span-1 flex flex-col gap-4">

            {/* Case Summary Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-4">Case Details</h3>
              <div className="flex flex-col gap-3">
                <Field label="Procedure"  value={caseData.procedure} />
                <Field label="Specialty"  value={caseData.specialty_required} />
                <Field label="Date"       value={formatDate(caseData.surgery_date)} />
                <Field label="Time"       value={caseData.surgery_time} />
                <Field label="Duration"   value={`${caseData.duration_hours} hrs`} />
                <Field label="OT Number"  value={`OT ${caseData.ot_number}`} />
                <Field label="Fee Range"  value={`${formatFee(caseData.fee_min)} – ${formatFee(caseData.fee_max)}`} />
              </div>
            </div>

            {/* Patient Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-4">Patient</h3>
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
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Surgeon Cascade</h3>
                {timeLeft && (
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Waiting for response</div>
                    <div className="text-lg font-mono font-bold text-amber-600">{timeLeft}</div>
                  </div>
                )}
              </div>

              {priorityList.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">No surgeons notified yet.</p>
                  {caseData.status === 'active' && (
                    <button
                      onClick={() => navigate(`/cases/${caseId}/shortlist`)}
                      className="mt-4 bg-blue-700 hover:bg-blue-800 text-white px-6 py-2 rounded-lg text-sm font-semibold transition"
                    >
                      Select Surgeons →
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {priorityList.map((row, index) => (
                    <CascadeRow key={row.id} row={row} index={index} />
                  ))}
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
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Edit Case — SOC-{String(caseData.case_number).padStart(3, '0')}</h3>
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
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Surgery Details</h4>
                <div className="grid grid-cols-2 gap-4">

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Procedure Name</label>
                    <input
                      type="text"
                      value={editForm.procedure}
                      onChange={e => setEditForm({...editForm, procedure: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Specialty Required</label>
                    <select
                      value={editForm.specialty_required}
                      onChange={e => setEditForm({...editForm, specialty_required: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    >
                      {SPECIALTY_OPTIONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Surgery Date</label>
                    <input
                      type="date"
                      value={editForm.surgery_date}
                      onChange={e => setEditForm({...editForm, surgery_date: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Surgery Time</label>
                    <input
                      type="time"
                      value={editForm.surgery_time}
                      onChange={e => setEditForm({...editForm, surgery_time: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Duration (hours)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={editForm.duration_hours}
                      onChange={e => setEditForm({...editForm, duration_hours: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">OT Number</label>
                    <input
                      type="text"
                      value={editForm.ot_number}
                      onChange={e => setEditForm({...editForm, ot_number: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Min Fee (₹)</label>
                    <input
                      type="number"
                      value={editForm.fee_min}
                      onChange={e => setEditForm({...editForm, fee_min: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Max Fee (₹)</label>
                    <input
                      type="number"
                      value={editForm.fee_max}
                      onChange={e => setEditForm({...editForm, fee_max: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    />
                  </div>
                </div>
              </div>

              {/* Patient details section */}
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Patient Details</h4>
                <div className="grid grid-cols-2 gap-4">

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Patient Name</label>
                    <input
                      type="text"
                      value={editForm.patient_name}
                      onChange={e => setEditForm({...editForm, patient_name: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Age</label>
                    <input
                      type="number"
                      value={editForm.patient_age}
                      onChange={e => setEditForm({...editForm, patient_age: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Gender</label>
                    <select
                      value={editForm.patient_gender}
                      onChange={e => setEditForm({...editForm, patient_gender: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Clinical Notes</label>
                    <textarea
                      value={editForm.notes}
                      onChange={e => setEditForm({...editForm, notes: e.target.value})}
                      rows={3}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white px-6 py-2 rounded-lg text-sm font-semibold transition"
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
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Case?</h3>
            <p className="text-gray-500 text-sm mb-6">
              This will permanently delete <strong>SOC-{String(caseData.case_number).padStart(3, '0')} — {caseData.procedure}</strong> and all associated data. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50"
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
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-sm font-medium text-gray-800">{value || '—'}</div>
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
        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
          {index + 1}
        </div>
        <div>
          <p className="font-semibold text-gray-800 text-sm">{row.surgeons?.name || '—'}</p>
          <p className="text-xs text-gray-400">{row.surgeons?.specialty?.join(', ')}</p>
        </div>
      </div>
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.badge}`}>
        {config.label}
      </span>
    </div>
  );
}