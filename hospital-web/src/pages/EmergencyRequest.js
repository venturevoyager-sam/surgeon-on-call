/**
 * EMERGENCY REQUEST PAGE - Hospital Web App
 * Surgeon on Call (OPC) Pvt Ltd
 *
 * What this page does:
 * 1. Hospital SPOC fills in a minimal emergency form (no 48hr restriction)
 * 2. Submits case with request_type = 'emergency' to backend
 * 3. Backend returns skip_shortlist: true
 * 4. Frontend sends all matched surgeons; backend broadcasts to all at once (no cascade)
 * 5. Navigates directly to CaseDetail (no Shortlist step)
 *
 * Sections:
 *   1 — Surgery Details (procedure, specialty)
 *   2 — Patient Details (name, age, gender)
 *   3 — Surgeon Fee (single flat fee in ₹)
 *   4 — Clinical Notes (optional free text)
 *
 * This is intentionally a shorter form than NewRequest.js — emergencies
 * need speed, not detail. Date/time default to now, duration defaults to 2.5h.
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
export default function EmergencyRequest() {
  const navigate = useNavigate();

  // ── STATE ─────────────────────────────────────────────────────────────────────

  // Hospital record for the logged-in SPOC
  const [hospital, setHospital] = useState(null);

  // Specialties fetched from API — drives the specialty dropdown
  const [specialties, setSpecialties] = useState([]);

  // Minimal form fields for emergency
  const [form, setForm] = useState({
    procedure:          '',
    specialty_required: '',
    patient_name:       '',
    patient_age:        '',
    patient_gender:     '',
    fee:                '',    // single flat fee in ₹ (converted to paise on submit)
    notes:              '',
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

    if (!form.procedure.trim())
      e.procedure = 'Please enter the procedure name';

    if (!form.specialty_required)
      e.specialty_required = 'Please select a specialty';

    if (!form.patient_name.trim())
      e.patient_name = 'Please enter patient name';

    if (!form.patient_age || form.patient_age < 1 || form.patient_age > 120)
      e.patient_age = 'Please enter a valid patient age (1–120)';

    if (!form.patient_gender)
      e.patient_gender = 'Please select patient gender';

    // Fee is required — must be a positive number
    if (!form.fee || Number(form.fee) <= 0)
      e.fee = 'Please enter the surgeon fee';

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
      // Emergency defaults: date = today, time = now, duration = 2.5h, OT = TBD
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);           // YYYY-MM-DD
      const timeStr  = now.toTimeString().slice(0, 5);           // HH:MM

      console.log('Submitting emergency case');

      // Step 1: Create the case with request_type = 'emergency'
      const response = await axios.post(`${API_URL}/api/cases`, {
        hospital_id:        hospital.id,
        procedure:          form.procedure.trim(),
        specialty_required: form.specialty_required,
        surgery_date:       todayStr,
        surgery_time:       timeStr,
        duration_hours:     2.5,                  // default estimate for emergency
        ot_number:          'TBD',                // OT assigned later for emergencies
        patient_name:       form.patient_name.trim(),
        patient_age:        Number(form.patient_age),
        patient_gender:     form.patient_gender,
        fee:                Number(form.fee) * 100,  // ₹ → paise
        request_type:       'emergency',
        notes:              form.notes.trim() || null,
      });

      console.log('Emergency case created:', response.data);

      const caseId          = response.data.case.id;
      const matchedSurgeons = response.data.matched_surgeons || [];

      // Step 2: Emergency — broadcast to ALL matched surgeons simultaneously.
      // No cascade, no cap. Every available surgeon in the specialty gets notified.
      if (matchedSurgeons.length > 0) {
        const priorityIds = matchedSurgeons.map(s => s.id);
        console.log('Broadcasting emergency to', priorityIds.length, 'surgeons');

        await axios.patch(`${API_URL}/api/cases/${caseId}/priority`, {
          priority_list: priorityIds,
        });

        console.log('Emergency broadcast triggered successfully');
      } else {
        console.warn('No matched surgeons found — case will be active but no cascade');
      }

      // Step 3: Navigate directly to CaseDetail (skip Shortlist)
      navigate(`/cases/${caseId}`);

    } catch (err) {
      console.error('Emergency case submission error:', err);
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

        {/* ── PAGE HEADING — red/urgent styling for emergency ─────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-600 uppercase tracking-wide">
              Emergency
            </span>
          </div>
          <h2 className="text-2xl font-bold text-body">Emergency Surgery Request</h2>
          <p className="text-muted text-sm mt-1">
            Minimal form — we'll auto-match and notify surgeons immediately. No 48-hour wait.
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
              SECTION 1: SURGERY DETAILS
              Minimal: just procedure and specialty. Date/time/OT auto-filled.
          ════════════════════════════════════════════════════════════════════ */}
          <div className="card mb-6">
            <h3 className="card-section-title">
              <span className="section-badge" style={{ backgroundColor: '#dc2626' }}>1</span>
              Surgery Details
            </h3>

            <div className="grid grid-cols-2 gap-4">

              {/* Procedure Name */}
              <div className="col-span-2">
                <label className="form-label">Procedure Name *</label>
                <input
                  type="text"
                  value={form.procedure}
                  onChange={e => handleChange('procedure', e.target.value)}
                  placeholder="e.g. Emergency Appendectomy"
                  className={`input-field ${errors.procedure ? 'input-field-error' : ''}`}
                />
                {errors.procedure && <p className="field-error">{errors.procedure}</p>}
              </div>

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

            </div>

            {/* Info note about auto-filled fields */}
            <p className="text-xs text-muted mt-4 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              Date, time, and OT number are auto-filled for emergencies. You can update them from the case detail page later.
            </p>
          </div>


          {/* ════════════════════════════════════════════════════════════════════
              SECTION 2: PATIENT DETAILS
          ════════════════════════════════════════════════════════════════════ */}
          <div className="card mb-6">
            <h3 className="card-section-title">
              <span className="section-badge" style={{ backgroundColor: '#dc2626' }}>2</span>
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
              SECTION 3: SURGEON FEE
              Single flat fee (in ₹), converted to paise on submit.
          ════════════════════════════════════════════════════════════════════ */}
          <div className="card mb-6">
            <h3 className="card-section-title">
              <span className="section-badge" style={{ backgroundColor: '#dc2626' }}>3</span>
              Surgeon Fee
            </h3>

            <div>
              <label className="form-label">Fee (₹) *</label>
              <input
                type="number"
                value={form.fee}
                onChange={e => handleChange('fee', e.target.value)}
                placeholder="e.g. 25000"
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
              SECTION 4: CLINICAL NOTES (optional)
          ════════════════════════════════════════════════════════════════════ */}
          <div className="card mb-6">
            <h3 className="card-section-title">
              <span className="section-badge" style={{ backgroundColor: '#dc2626' }}>4</span>
              Clinical Notes
              <span className="ml-2 text-xs font-normal text-muted">(optional)</span>
            </h3>

            <textarea
              value={form.notes}
              onChange={e => handleChange('notes', e.target.value)}
              placeholder="Any relevant clinical information — patient condition, urgency details, special requirements..."
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
              className="flex-1 py-3 text-base inline-flex items-center justify-center gap-2
                text-white font-semibold text-sm rounded-lg transition-colors duration-150
                disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#dc2626' }}
              onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.backgroundColor = '#b91c1c'; }}
              onMouseLeave={(e) => { if (!submitting) e.currentTarget.style.backgroundColor = '#dc2626'; }}
            >
              {submitting ? 'Finding Surgeons...' : '🚨 Send Emergency Request'}
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
