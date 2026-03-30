/**
 * ACCEPTED CASE — Doctor Web
 * Shows confirmed case details with hospital info revealed.
 * For reconsult cases: shows surgery recommendation form or submitted summary.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getSurgeonId } from '../lib/auth';
import { formatFee, formatDate, REQUEST_TYPE_STYLES } from '../lib/helpers';

const API_URL = process.env.REACT_APP_API_URL;

export default function AcceptedCase() {
  const { caseId }  = useParams();
  const navigate    = useNavigate();
  const surgeonId   = getSurgeonId();

  const [caseData, setCaseData]       = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  // Recommendation state (for reconsult cases)
  const [recommendation, setRecommendation] = useState(null);
  const [recLoading, setRecLoading]         = useState(false);
  const [showRecForm, setShowRecForm]       = useState(false);
  const [recForm, setRecForm]               = useState({
    suggested_procedure: '', recommendation_notes: '', urgency: 'elective'
  });
  const [recSubmitting, setRecSubmitting] = useState(false);
  const [recError, setRecError]           = useState('');

  // Fetch case
  useEffect(() => {
    axios.get(`${API_URL}/api/cases/${caseId}/surgeon-view`, { params: { surgeon_id: surgeonId } })
      .then(res => setCaseData(res.data.case))
      .catch(() => setError('Failed to load case'))
      .finally(() => setLoading(false));
  }, [caseId, surgeonId]);

  // Fetch existing recommendation for reconsult cases
  useEffect(() => {
    if (!caseData || caseData.request_type !== 'reconsult') return;
    setRecLoading(true);
    axios.get(`${API_URL}/api/cases/${caseId}/recommendation`)
      .then(res => setRecommendation(res.data.recommendation || null))
      .catch(() => {})
      .finally(() => setRecLoading(false));
  }, [caseData?.request_type, caseId]);

  // Submit recommendation
  const handleSubmitRec = async () => {
    if (!recForm.suggested_procedure.trim()) { setRecError('Procedure name is required'); return; }
    setRecSubmitting(true); setRecError('');
    try {
      const res = await axios.post(`${API_URL}/api/cases/${caseId}/recommend`, {
        surgeon_id: surgeonId,
        suggested_procedure: recForm.suggested_procedure.trim(),
        recommendation_notes: recForm.recommendation_notes.trim() || null,
        urgency: recForm.urgency,
      });
      setRecommendation(res.data.recommendation);
      setShowRecForm(false);
    } catch (err) {
      setRecError(err.response?.data?.message || 'Failed to submit');
    } finally { setRecSubmitting(false); }
  };

  if (loading) return <div className="p-8 text-center" style={{ color: '#8B8B8B' }}>Loading...</div>;
  if (error) return <div className="p-8 text-center" style={{ color: '#DC2626' }}>{error}</div>;
  if (!caseData) return null;

  const rt = REQUEST_TYPE_STYLES[caseData.request_type] || REQUEST_TYPE_STYLES.elective;
  const isReconsult = caseData.request_type === 'reconsult';

  return (
    <div className="p-6 max-w-2xl mx-auto">

      <button onClick={() => navigate('/home')} className="text-sm mb-4" style={{ color: '#E56717' }}>
        ← Back to Home
      </button>

      {/* Confirmed badge */}
      <div className="flex items-center gap-3 mb-4">
        <span className="px-3 py-1 rounded-full text-xs font-bold"
          style={{ backgroundColor: '#F0FDF4', color: '#16a34a' }}>
          Confirmed
        </span>
        <span className="px-3 py-1 rounded-full text-xs font-semibold"
          style={{ backgroundColor: rt.bg, color: rt.color }}>
          {rt.label}
        </span>
      </div>

      {/* Case details */}
      <div className="bg-white rounded-xl p-5 mb-4" style={{ border: '1px solid #E8E0D8' }}>
        <h2 className="text-xl font-bold mb-1" style={{ color: '#444444' }}>{caseData.procedure}</h2>
        <p className="text-sm mb-3" style={{ color: '#8B8B8B' }}>{caseData.specialty_required}</p>
        {[
          ['Date', formatDate(caseData.surgery_date)],
          ['Time', caseData.surgery_time],
          ['Duration', `${caseData.duration_hours} hrs`],
          ['OT', caseData.ot_number],
          ['Hospital', caseData.hospital_name || '—'],
          ['City', caseData.hospital_city || '—'],
          ['Fee', formatFee(caseData.fee || caseData.fee_max)],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between py-2 text-sm"
            style={{ borderBottom: '1px solid #F3F0EC' }}>
            <span style={{ color: '#8B8B8B' }}>{label}</span>
            <span className="font-semibold" style={{ color: '#444444' }}>{value || '—'}</span>
          </div>
        ))}
      </div>

      {/* Patient details */}
      <div className="bg-white rounded-xl p-5 mb-4" style={{ border: '1px solid #E8E0D8' }}>
        <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#8B8B8B' }}>Patient</h3>
        {[
          ['Name', caseData.patient_name],
          ['Age', caseData.patient_age ? `${caseData.patient_age} years` : '—'],
          ['Gender', caseData.patient_gender],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between py-2 text-sm"
            style={{ borderBottom: '1px solid #F3F0EC' }}>
            <span style={{ color: '#8B8B8B' }}>{label}</span>
            <span className="font-semibold" style={{ color: '#444444' }}>{value || '—'}</span>
          </div>
        ))}
        {caseData.notes && <p className="text-sm mt-2" style={{ color: '#444444' }}>{caseData.notes}</p>}
      </div>

      {/* ── Surgery Recommendation (reconsult only) ── */}
      {isReconsult && (
        <div className="bg-white rounded-xl p-5 mb-4" style={{ border: '1px solid #E8E0D8' }}>
          <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#E56717' }}>
            Surgery Recommendation
          </h3>

          {recLoading && <p className="text-sm" style={{ color: '#8B8B8B' }}>Loading...</p>}

          {/* Submitted summary */}
          {!recLoading && recommendation && (
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: '#16a34a', color: '#fff' }}>
                Submitted
              </span>
              <p className="font-semibold text-sm mt-2" style={{ color: '#444444' }}>{recommendation.suggested_procedure}</p>
              <p className="text-xs mt-1" style={{ color: '#8B8B8B' }}>
                Urgency: {recommendation.urgency === 'urgent' ? 'Urgent' : 'Elective'}
              </p>
              {recommendation.recommendation_notes && (
                <p className="text-sm mt-2" style={{ color: '#444444' }}>{recommendation.recommendation_notes}</p>
              )}
            </div>
          )}

          {/* Form or button */}
          {!recLoading && !recommendation && !showRecForm && (
            <button onClick={() => setShowRecForm(true)}
              className="w-full py-3 rounded-lg font-semibold text-sm border-2"
              style={{ borderColor: '#E56717', color: '#E56717' }}>
              Recommend Surgery
            </button>
          )}

          {!recLoading && !recommendation && showRecForm && (
            <div>
              {recError && (
                <div className="mb-3 p-3 rounded-lg text-sm" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                  {recError}
                </div>
              )}
              <div className="mb-3">
                <label className="block text-xs font-semibold mb-1" style={{ color: '#8B8B8B' }}>Suggested Procedure *</label>
                <input className="w-full px-4 py-3 rounded-lg text-sm border" style={{ borderColor: '#E8E0D8' }}
                  value={recForm.suggested_procedure}
                  onChange={e => setRecForm(p => ({ ...p, suggested_procedure: e.target.value }))}
                  placeholder="e.g. Laparoscopic Cholecystectomy" />
              </div>
              <div className="mb-3">
                <label className="block text-xs font-semibold mb-1" style={{ color: '#8B8B8B' }}>Clinical Notes</label>
                <textarea className="w-full px-4 py-3 rounded-lg text-sm border" style={{ borderColor: '#E8E0D8', minHeight: '80px' }}
                  value={recForm.recommendation_notes}
                  onChange={e => setRecForm(p => ({ ...p, recommendation_notes: e.target.value }))}
                  placeholder="Findings, rationale..." />
              </div>
              <div className="mb-3">
                <label className="block text-xs font-semibold mb-1" style={{ color: '#8B8B8B' }}>Urgency</label>
                <div className="flex gap-2">
                  {['elective', 'urgent'].map(u => (
                    <button key={u} type="button" onClick={() => setRecForm(p => ({ ...p, urgency: u }))}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold border-2"
                      style={{
                        borderColor: recForm.urgency === u ? (u === 'urgent' ? '#DC2626' : '#E56717') : '#E8E0D8',
                        backgroundColor: recForm.urgency === u ? (u === 'urgent' ? '#FEF2F2' : '#FFF7F0') : '#fff',
                        color: recForm.urgency === u ? (u === 'urgent' ? '#DC2626' : '#E56717') : '#8B8B8B',
                      }}>
                      {u.charAt(0).toUpperCase() + u.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowRecForm(false)}
                  className="flex-1 py-3 rounded-lg text-sm border" style={{ borderColor: '#E8E0D8', color: '#8B8B8B' }}>
                  Cancel
                </button>
                <button onClick={handleSubmitRec} disabled={recSubmitting}
                  className="flex-[2] py-3 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                  style={{ backgroundColor: '#E56717' }}>
                  {recSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
