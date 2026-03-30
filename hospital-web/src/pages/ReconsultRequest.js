/**
 * RECONSULT REQUEST PAGE - Hospital Web App
 * Surgeon on Call (OPC) Pvt Ltd
 *
 * What this page does:
 * 1. Hospital SPOC fills in re-consultation details
 * 2. Submits case with request_type = 'reconsult' to backend
 * 3. Always navigates to Shortlist page (never auto-cascades)
 *
 * Sections:
 *   1 — Consultation Details (specialty, date, time)
 *   2 — Patient Details (name, age, gender)
 *   3 — Reason for Re-consultation (free text — why the patient needs to be seen again)
 *   4 — Surgeon Fee (single flat fee in ₹)
 *   5 — Additional Notes (optional free text)
 *
 * Different from NewRequest.js:
 *   - Procedure field replaced by "Reason for Re-consultation"
 *   - No duration / OT fields (re-consult is a consultation)
 *   - No document upload
 *   - Single fee instead of fee_min/fee_max
 *   - Always goes to Shortlist (never skip_shortlist)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import axios from 'axios';
import { API_URL } from '../lib/config';

// ── CONSTANTS ──────────────────────────────────────────────────────────────────

// SPECIALTIES: fetched from GET /api/specialties on mount (see useEffect below).
// Removed hardcoded array — now driven by the specialties table in the database.


// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────
export default function ReconsultRequest() {
  const navigate = useNavigate();

  // ── STATE ─────────────────────────────────────────────────────────────────────

  // Hospital record for the logged-in SPOC
  const [hospital, setHospital] = useState(null);

  // Specialties fetched from API — drives the specialty dropdown
  const [specialties, setSpecialties] = useState([]);

  // Form fields specific to re-consultation
  const [form, setForm] = useState({
    specialty_required:  '',
    surgery_date:        '',    // scheduled re-consult date
    surgery_time:        '',
    patient_name:        '',
    patient_age:         '',
    patient_gender:      '',
    reason:              '',    // reason for re-consultation — maps to procedure field
    patient_summary:     '',    // brief patient history — maps to notes field
    fee:                 '',    // single flat fee in ₹ (converted to paise on submit)
    notes:               '',    // additional notes
  });

  // Field-level validation errors
  const [errors, setErrors] = useState({});

  // Submission loading state
  const [submitting, setSubmitting] = useState(false);

  // Top-level error message (non-field errors)
  const [submitError, setSubmitError] = useState('');


  // ── EFFECTS ───────────────────────────────────────────────────────────────────

  /**
   * On mount: find the hospital record for the logged-in SPOC
   * Uses hospital_id from localStorage (set by Login.js after custom auth login).
   */
  useEffect(() => {
    const getHospital = async () => {
      const hospitalId = localStorage.getItem('hospital_id');
      if (!hospitalId) { navigate('/'); return; }

      const { data: hospitalData, error } = await supabase
        .from('hospitals')
        .select('*')
        .eq('id', hospitalId)
        .single();

      if (error || !hospitalData) {
        console.error('Hospital not found for id:', hospitalId);
        navigate('/dashboard');
        return;
      }

      setHospital(hospitalData);
      console.log('Hospital loaded:', hospitalData.name);
    };

    getHospital();
  }, [navigate]);

  // Fetch specialties from API on mount — replaces hardcoded array
  useEffect(() => {
    axios.get(`${API_URL}/api/specialties`)
      .then(res => setSpecialties(res.data.specialties || []))
      .catch(err => console.error('Failed to load specialties:', err));
  }, []);


  // ── FORM HANDLERS ─────────────────────────────────────────────────────────────

  /** Update a single field and clear its error */
  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  /** Validate all fields — returns true if clean */
  const validate = () => {
    const e = {};

    if (!form.specialty_required)
      e.specialty_required = 'Please select a specialty';

    if (!form.surgery_date)
      e.surgery_date = 'Please select a re-consultation date';

    if (!form.surgery_time)
      e.surgery_time = 'Please select a time';

    if (!form.patient_name.trim())
      e.patient_name = 'Please enter patient name';

    if (!form.patient_age || form.patient_age < 1 || form.patient_age > 120)
      e.patient_age = 'Please enter a valid patient age (1–120)';

    if (!form.patient_gender)
      e.patient_gender = 'Please select patient gender';

    // Reason for re-consultation is required
    if (!form.reason.trim())
      e.reason = 'Please describe the reason for re-consultation';

    // Fee is required — must be a positive number
    if (!form.fee || Number(form.fee) <= 0)
      e.fee = 'Please enter the consultation fee';

    setErrors(e);
    return Object.keys(e).length === 0;
  };


  // ── FORM SUBMISSION ───────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!validate()) return;

    setSubmitting(true);

    try {
      // Build combined notes: patient summary + additional notes
      // The "reason" field maps to the backend's "procedure" column
      const combinedNotes = [
        form.patient_summary.trim() ? `Patient Summary: ${form.patient_summary.trim()}` : '',
        form.notes.trim() || '',
      ].filter(Boolean).join('\n\n') || null;

      console.log('Submitting re-consultation case');

      const response = await axios.post(`${API_URL}/api/cases`, {
        hospital_id:        hospital.id,
        procedure:          `Re-consultation: ${form.reason.trim()}`,  // stored in procedure field
        specialty_required: form.specialty_required,
        surgery_date:       form.surgery_date,
        surgery_time:       form.surgery_time,
        duration_hours:     1,               // default 1h for re-consultation
        ot_number:          'OPD',           // re-consult happens in OPD
        patient_name:       form.patient_name.trim(),
        patient_age:        Number(form.patient_age),
        patient_gender:     form.patient_gender,
        fee:                Number(form.fee) * 100,  // ₹ → paise
        request_type:       'reconsult',
        notes:              combinedNotes,
      });

      console.log('Reconsult case created:', response.data);

      // Reconsult always goes to Shortlist — never auto-cascades
      const caseId = response.data.case.id;
      navigate(`/cases/${caseId}/shortlist`);

    } catch (err) {
      console.error('Reconsult case submission error:', err);
      setSubmitError(
        err.response?.data?.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };


  // ── RENDER ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-brand-light">

      {/* ── TOP NAVIGATION ─────────────────────────────────────────────────────── */}
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


      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* ── PAGE HEADING ─────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-600 uppercase tracking-wide">
              Re-consult
            </span>
          </div>
          <h2 className="text-2xl font-bold text-body">Re-consultation Request</h2>
          <p className="text-muted text-sm mt-1">
            Request a follow-up consultation with a surgeon. You'll select your preferred surgeons after submission.
          </p>
        </div>

        {/* ── SUBMIT ERROR ─────────────────────────────────────────────────────── */}
        {submitError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            ❌ {submitError}
          </div>
        )}

        {/* ── FORM ─────────────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} noValidate>


          {/* ════════════════════════════════════════════════════════════════════
              SECTION 1: CONSULTATION DETAILS
          ════════════════════════════════════════════════════════════════════ */}
          <div className="card mb-6">
            <h3 className="card-section-title">
              <span className="section-badge">1</span>
              Consultation Details
            </h3>

            <div className="grid grid-cols-2 gap-4">

              {/* Specialty */}
              <div className="col-span-2">
                <label className="form-label">Specialty Required *</label>
                <select
                  value={form.specialty_required}
                  onChange={e => handleChange('specialty_required', e.target.value)}
                  className={`input-field ${errors.specialty_required ? 'input-field-error' : ''}`}
                >
                  <option value="">{specialties.length === 0 ? 'Loading specialties...' : 'Select specialty...'}</option>
                  {specialties.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
                {errors.specialty_required && <p className="field-error">{errors.specialty_required}</p>}
              </div>

              {/* Date */}
              <div>
                <label className="form-label">Re-consultation Date *</label>
                <input
                  type="date"
                  value={form.surgery_date}
                  onChange={e => handleChange('surgery_date', e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className={`input-field ${errors.surgery_date ? 'input-field-error' : ''}`}
                />
                <div className="flex gap-2 mt-1">
                  <button type="button" className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-body" onClick={() => handleChange('surgery_date', new Date().toISOString().slice(0, 10))}>Today</button>
                  <button type="button" className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-body" onClick={() => { const d = new Date(); d.setDate(d.getDate() + 1); handleChange('surgery_date', d.toISOString().slice(0, 10)); }}>Tomorrow</button>
                </div>
                {errors.surgery_date && <p className="field-error">{errors.surgery_date}</p>}
              </div>

              {/* Time */}
              <div>
                <label className="form-label">Consultation Time *</label>
                <input
                  type="time"
                  value={form.surgery_time}
                  onChange={e => handleChange('surgery_time', e.target.value)}
                  className={`input-field ${errors.surgery_time ? 'input-field-error' : ''}`}
                />
                {errors.surgery_time && <p className="field-error">{errors.surgery_time}</p>}
              </div>

            </div>
          </div>


          {/* ════════════════════════════════════════════════════════════════════
              SECTION 2: PATIENT DETAILS
          ════════════════════════════════════════════════════════════════════ */}
          <div className="card mb-6">
            <h3 className="card-section-title">
              <span className="section-badge">2</span>
              Patient Details
            </h3>

            <div className="grid grid-cols-2 gap-4">

              {/* Patient Name */}
              <div className="col-span-2">
                <label className="form-label">Patient Name *</label>
                <input
                  type="text"
                  value={form.patient_name}
                  onChange={e => handleChange('patient_name', e.target.value)}
                  placeholder="Full name"
                  className={`input-field ${errors.patient_name ? 'input-field-error' : ''}`}
                />
                {errors.patient_name && <p className="field-error">{errors.patient_name}</p>}
              </div>

              {/* Patient Age */}
              <div>
                <label className="form-label">Patient Age *</label>
                <input
                  type="number"
                  value={form.patient_age}
                  onChange={e => handleChange('patient_age', e.target.value)}
                  placeholder="Age in years"
                  min="1" max="120"
                  className={`input-field ${errors.patient_age ? 'input-field-error' : ''}`}
                />
                {errors.patient_age && <p className="field-error">{errors.patient_age}</p>}
              </div>

              {/* Patient Gender */}
              <div>
                <label className="form-label">Patient Gender *</label>
                <select
                  value={form.patient_gender}
                  onChange={e => handleChange('patient_gender', e.target.value)}
                  className={`input-field ${errors.patient_gender ? 'input-field-error' : ''}`}
                >
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                {errors.patient_gender && <p className="field-error">{errors.patient_gender}</p>}
              </div>

            </div>
          </div>


          {/* ════════════════════════════════════════════════════════════════════
              SECTION 3: REASON FOR RE-CONSULTATION
              This maps to the backend's "procedure" field.
          ════════════════════════════════════════════════════════════════════ */}
          <div className="card mb-6">
            <h3 className="card-section-title">
              <span className="section-badge">3</span>
              Reason for Re-consultation
            </h3>

            <div className="mb-4">
              <label className="form-label">Reason *</label>
              <textarea
                value={form.reason}
                onChange={e => handleChange('reason', e.target.value)}
                placeholder="e.g. Post-operative wound check, Suture removal, Follow-up after discharge..."
                rows={2}
                maxLength={200}
                className={`input-field resize-none ${errors.reason ? 'input-field-error' : ''}`}
              />
              {errors.reason && <p className="field-error">{errors.reason}</p>}
              <p className="text-muted text-xs mt-1 text-right">
                {form.reason.length}/200
              </p>
            </div>

            <div>
              <label className="form-label">
                Patient Summary
                <span className="ml-1 font-normal normal-case text-muted">(optional)</span>
              </label>
              <textarea
                value={form.patient_summary}
                onChange={e => handleChange('patient_summary', e.target.value)}
                placeholder="Brief history — previous surgery, diagnosis, current condition..."
                rows={3}
                maxLength={500}
                className="input-field resize-none"
              />
              <p className="text-muted text-xs mt-1 text-right">
                {form.patient_summary.length}/500
              </p>
            </div>
          </div>


          {/* ════════════════════════════════════════════════════════════════════
              SECTION 4: CONSULTATION FEE
              Single flat fee (in ₹), converted to paise on submit.
          ════════════════════════════════════════════════════════════════════ */}
          <div className="card mb-6">
            <h3 className="card-section-title">
              <span className="section-badge">4</span>
              Consultation Fee
            </h3>

            <div>
              <label className="form-label">Fee (₹) *</label>
              <input
                type="number"
                value={form.fee}
                onChange={e => handleChange('fee', e.target.value)}
                placeholder="e.g. 3000"
                min="0"
                className={`input-field ${errors.fee ? 'input-field-error' : ''}`}
              />
              {errors.fee && <p className="field-error">{errors.fee}</p>}
              <p className="text-xs text-muted mt-1">
                This is the total fee offered to the surgeon. Platform deducts 5% commission.
              </p>
            </div>
          </div>


          {/* ════════════════════════════════════════════════════════════════════
              SECTION 5: ADDITIONAL NOTES (optional)
          ════════════════════════════════════════════════════════════════════ */}
          <div className="card mb-6">
            <h3 className="card-section-title">
              <span className="section-badge">5</span>
              Additional Notes
              <span className="ml-2 text-xs font-normal text-muted">(optional)</span>
            </h3>

            <textarea
              value={form.notes}
              onChange={e => handleChange('notes', e.target.value)}
              placeholder="Any additional information for the surgeon..."
              rows={3}
              maxLength={500}
              className="input-field resize-none"
            />
            <p className="text-muted text-xs mt-1 text-right">
              {form.notes.length}/500
            </p>
          </div>


          {/* ── SUBMIT ───────────────────────────────────────────────────────── */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting || !hospital}
              className="btn-primary flex-1 py-3 text-base"
            >
              {submitting ? 'Finding Surgeons...' : '🔍 Find Matching Surgeons'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="btn-secondary px-8"
            >
              Cancel
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
