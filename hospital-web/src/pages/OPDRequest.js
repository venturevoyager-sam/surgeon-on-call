/**
 * OPD REQUEST PAGE - Hospital Web App
 * Vaidhya Healthcare Pvt Ltd
 *
 * What this page does:
 * 1. Hospital SPOC fills in OPD consultation details
 * 2. Submits case with request_type = 'opd' to backend
 * 3. If date = today → skip_shortlist = true → auto-cascade → CaseDetail
 *    If date = future → skip_shortlist = false → navigate to Shortlist
 *
 * Sections:
 *   1 — Consultation Details (procedure, specialty, date, time)
 *   2 — Patient Details (name, age, gender)
 *   3 — Surgeon Fee (single flat fee in ₹)
 *   4 — Clinical Notes (optional free text)
 *
 * Similar to NewRequest.js but:
 *   - No duration or OT fields (not relevant for OPD)
 *   - No document upload (OPD is lightweight)
 *   - No 48hr minimum if same-day
 *   - Single fee instead of fee_min/fee_max
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import axios from 'axios';

// ── CONSTANTS ──────────────────────────────────────────────────────────────────

// SPECIALTIES: fetched from GET /api/specialties on mount (see useEffect below).
// Removed hardcoded array — now driven by the specialties table in the database.

const API_URL = process.env.REACT_APP_API_URL;


// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────
export default function OPDRequest() {
  const navigate = useNavigate();

  // ── STATE ─────────────────────────────────────────────────────────────────────

  // Hospital record for the logged-in SPOC
  const [hospital, setHospital] = useState(null);

  // Specialties fetched from API — drives the specialty dropdown
  const [specialties, setSpecialties] = useState([]);

  // Form fields — OPD includes date/time but no duration/OT
  const [form, setForm] = useState({
    procedure:          '',
    specialty_required: '',
    surgery_date:       '',    // user picks date — if today, auto-cascade
    surgery_time:       '',
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

  /**
   * Check if the selected date is today — used for the skip_shortlist hint
   * and for frontend UX messaging.
   */
  const isToday = () => {
    if (!form.surgery_date) return false;
    const today = new Date().toISOString().slice(0, 10);
    return form.surgery_date === today;
  };

  /** Validate all fields — returns true if clean */
  const validate = () => {
    const e = {};

    if (!form.procedure.trim())
      e.procedure = 'Please enter the consultation / procedure name';

    if (!form.specialty_required)
      e.specialty_required = 'Please select a specialty';

    if (!form.surgery_date)
      e.surgery_date = 'Please select a date';

    // No 48hr restriction for OPD — any date from today onward is valid

    if (!form.surgery_time)
      e.surgery_time = 'Please select a time';

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
      console.log('Submitting OPD case, date:', form.surgery_date, 'isToday:', isToday());

      // Step 1: Create the case with request_type = 'opd'
      // OPD doesn't need duration or OT — backend accepts nulls for those now
      const response = await axios.post(`${API_URL}/api/cases`, {
        hospital_id:        hospital.id,
        procedure:          form.procedure.trim(),
        specialty_required: form.specialty_required,
        surgery_date:       form.surgery_date,
        surgery_time:       form.surgery_time,
        duration_hours:     1,               // default 1h for OPD consultation
        ot_number:          'OPD',           // not a surgical OT
        fee:                Number(form.fee) * 100,  // ₹ → paise
        request_type:       'opd',
        notes:              form.notes.trim() || null,
      });

      console.log('OPD case created:', response.data);

      const caseId          = response.data.case.id;
      const skipShortlist   = response.data.skip_shortlist;
      const matchedSurgeons = response.data.matched_surgeons || [];

      if (skipShortlist && matchedSurgeons.length > 0) {
        // Same-day OPD → auto-cascade, go directly to CaseDetail
        const priorityIds = matchedSurgeons.slice(0, 5).map(s => s.id);
        console.log('Same-day OPD — auto-triggering cascade with', priorityIds.length, 'surgeons');

        await axios.patch(`${API_URL}/api/cases/${caseId}/priority`, {
          priority_list: priorityIds,
        });

        console.log('Cascade triggered successfully');
        navigate(`/cases/${caseId}`);
      } else {
        // Future-dated OPD → go to Shortlist page as normal
        console.log('Future OPD — navigating to Shortlist');
        navigate(`/cases/${caseId}/shortlist`);
      }

    } catch (err) {
      console.error('OPD case submission error:', err);
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
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-600 uppercase tracking-wide">
              OPD
            </span>
          </div>
          <h2 className="text-2xl font-bold text-body">OPD Consultation Request</h2>
          <p className="text-muted text-sm mt-1">
            Request a surgeon for an outpatient consultation. Same-day requests are auto-matched instantly.
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

              {/* Procedure / Consultation Name */}
              <div className="col-span-2">
                <label className="form-label">Consultation / Procedure *</label>
                <input
                  type="text"
                  value={form.procedure}
                  onChange={e => handleChange('procedure', e.target.value)}
                  placeholder="e.g. Orthopaedic OPD Consultation"
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

              {/* Date */}
              <div>
                <label className="form-label">Consultation Date *</label>
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

            {/* Same-day hint — show when user picks today's date */}
            {isToday() && (
              <p className="text-xs mt-4 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-blue-700">
                Same-day request detected — surgeons will be matched and notified immediately (no shortlist step).
              </p>
            )}
          </div>


          {/* ════════════════════════════════════════════════════════════════════
              SECTION 2: CONSULTATION FEE
              Single flat fee (in ₹), converted to paise on submit.
          ════════════════════════════════════════════════════════════════════ */}
          <div className="card mb-6">
            <h3 className="card-section-title">
              <span className="section-badge">2</span>
              Consultation Fee
            </h3>

            <div>
              <label className="form-label">Fee (₹) *</label>
              <input
                type="number"
                value={form.fee}
                onChange={e => handleChange('fee', e.target.value)}
                placeholder="e.g. 5000"
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
              <span className="section-badge">3</span>
              Clinical Notes
              <span className="ml-2 text-xs font-normal text-muted">(optional)</span>
            </h3>

            <textarea
              value={form.notes}
              onChange={e => handleChange('notes', e.target.value)}
              placeholder="Any relevant clinical information, patient history, or consultation requirements..."
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
              {submitting
                ? 'Finding Surgeons...'
                : isToday()
                  ? '⚡ Send Instant OPD Request'
                  : '🔍 Find Matching Surgeons'
              }
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
