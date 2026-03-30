/**
 * REQUEST DETAIL — Doctor Web
 * Full case details for a pending request. Surgeon can accept or decline.
 * Shows countdown timer, fee breakdown, and request type badge.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getSurgeonId } from '../lib/auth';
import { formatFee, formatDate, getTimeRemaining, REQUEST_TYPE_STYLES } from '../lib/helpers';

const API_URL = process.env.REACT_APP_API_URL;

export default function RequestDetail() {
  const { caseId }  = useParams();
  const navigate    = useNavigate();
  const surgeonId   = getSurgeonId();

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  // Fetch case
  useEffect(() => {
    axios.get(`${API_URL}/api/cases/${caseId}/surgeon-view`, { params: { surgeon_id: surgeonId } })
      .then(res => setCaseData(res.data.case))
      .catch(() => setError('Failed to load case details'))
      .finally(() => setLoading(false));
  }, [caseId, surgeonId]);

  // Countdown timer
  useEffect(() => {
    if (!caseData?.expires_at) return;
    const timer = setInterval(() => setTimeLeft(getTimeRemaining(caseData.expires_at)), 1000);
    return () => clearInterval(timer);
  }, [caseData]);

  // Accept case
  const handleAccept = async () => {
    if (!window.confirm(`Accept ${caseData?.procedure}?`)) return;
    setSubmitting(true);
    try {
      await axios.patch(`${API_URL}/api/cases/${caseId}/accept`, { surgeon_id: surgeonId });
      navigate(`/case/${caseId}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to accept');
    } finally { setSubmitting(false); }
  };

  // Decline case
  const handleDecline = async () => {
    if (!window.confirm('Decline this case?')) return;
    setSubmitting(true);
    try {
      await axios.patch(`${API_URL}/api/cases/${caseId}/decline`, { surgeon_id: surgeonId });
      navigate('/home');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to decline');
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="p-8 text-center" style={{ color: '#8B8B8B' }}>Loading...</div>;
  if (error) return <div className="p-8 text-center" style={{ color: '#DC2626' }}>{error}</div>;
  if (!caseData) return null;

  const rt = REQUEST_TYPE_STYLES[caseData.request_type] || REQUEST_TYPE_STYLES.elective;
  const grossFee = caseData.fee || caseData.fee_max || 0;
  const commission = Math.round(grossFee * 0.10);
  const netPayout = grossFee - commission;

  return (
    <div className="p-6 max-w-2xl mx-auto">

      {/* Back link */}
      <button onClick={() => navigate('/home')} className="text-sm mb-4" style={{ color: '#E56717' }}>
        ← Back to Home
      </button>

      {/* Header: timer + request type */}
      <div className="bg-white rounded-xl p-5 mb-4" style={{ border: '1px solid #E8E0D8' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{ backgroundColor: rt.bg, color: rt.color }}>
            {rt.label}
          </span>
          {timeLeft && (
            <span className="text-lg font-mono font-bold" style={{ color: '#E56717' }}>
              {timeLeft}
            </span>
          )}
        </div>
        <h2 className="text-xl font-bold" style={{ color: '#444444' }}>{caseData.procedure}</h2>
        <p className="text-sm" style={{ color: '#8B8B8B' }}>{caseData.specialty_required}</p>
      </div>

      {/* Surgery details */}
      <div className="bg-white rounded-xl p-5 mb-4" style={{ border: '1px solid #E8E0D8' }}>
        <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#8B8B8B' }}>
          Surgery Details
        </h3>
        {[
          ['Date', formatDate(caseData.surgery_date)],
          ['Time', caseData.surgery_time],
          ['Duration', `${caseData.duration_hours} hrs`],
          ['OT', caseData.ot_number],
          ['Location', caseData.hospital_city || 'Revealed after acceptance'],
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
        <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#8B8B8B' }}>
          Patient
        </h3>
        {[
          ['Age', caseData.patient_age ? `${caseData.patient_age} years` : '—'],
          ['Gender', caseData.patient_gender ? caseData.patient_gender.charAt(0).toUpperCase() + caseData.patient_gender.slice(1) : '—'],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between py-2 text-sm"
            style={{ borderBottom: '1px solid #F3F0EC' }}>
            <span style={{ color: '#8B8B8B' }}>{label}</span>
            <span className="font-semibold" style={{ color: '#444444' }}>{value}</span>
          </div>
        ))}
        {caseData.notes && (
          <p className="text-sm mt-2" style={{ color: '#444444' }}>{caseData.notes}</p>
        )}
      </div>

      {/* Fee breakdown */}
      <div className="rounded-xl p-5 mb-6" style={{ backgroundColor: '#FFF7F0', border: '1px solid #F5D9C0' }}>
        <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#E56717' }}>
          Fee Breakdown
        </h3>
        <div className="flex justify-between py-2 text-sm">
          <span style={{ color: '#444444' }}>Gross Fee</span>
          <span className="font-semibold" style={{ color: '#444444' }}>{formatFee(grossFee)}</span>
        </div>
        <div className="flex justify-between py-2 text-sm" style={{ borderTop: '1px solid #F5D9C0' }}>
          <span style={{ color: '#444444' }}>Platform Commission (10%)</span>
          <span className="font-semibold" style={{ color: '#DC2626' }}>-{formatFee(commission)}</span>
        </div>
        <div className="flex justify-between py-2 text-sm" style={{ borderTop: '1px solid #F5D9C0' }}>
          <span className="font-bold" style={{ color: '#444444' }}>Your Payout</span>
          <span className="text-lg font-bold" style={{ color: '#E56717' }}>{formatFee(netPayout)}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button onClick={handleDecline} disabled={submitting}
          className="flex-1 py-3.5 rounded-xl font-semibold text-sm border-2 transition disabled:opacity-50"
          style={{ borderColor: '#DC2626', color: '#DC2626', backgroundColor: '#FEF2F2' }}>
          Decline
        </button>
        <button onClick={handleAccept} disabled={submitting}
          className="flex-[2] py-3.5 rounded-xl text-white font-semibold text-sm transition disabled:opacity-50"
          style={{ backgroundColor: '#16a34a' }}>
          {submitting ? 'Processing...' : 'Accept Case'}
        </button>
      </div>
    </div>
  );
}
