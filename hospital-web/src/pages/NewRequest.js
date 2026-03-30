/**
 * NEW SURGERY REQUEST PAGE - Hospital Web App
 * Vaidhya Healthcare Pvt Ltd
 *
 * What this page does:
 * 1. Hospital SPOC fills in surgery details
 * 2. Optionally uploads clinical documents (stored in Supabase Storage)
 * 3. Submits case to backend → matching algorithm runs
 * 4. Redirected to Shortlist page to set surgeon priority order
 *
 * Sections:
 *   1 — Surgery Details (procedure, specialty, date/time, duration, OT)
 *   2 — Patient Details (name, age, gender)
 *   3 — Surgeon Fee (single flat fee in ₹, stored as paise)
 *   4 — Documents (optional file upload — PDF, JPG, PNG, max 5MB each, up to 5)
 *   5 — Clinical Notes (optional free text)
 *
 * UPDATED (Migration 001):
 *   - Fee section changed from min/max range to single flat fee
 *   - Submits request_type: 'elective' to backend
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import axios from 'axios';

// ── CONSTANTS ──────────────────────────────────────────────────────────────────

// SPECIALTIES: fetched from GET /api/specialties on mount (see useEffect below).
// Removed hardcoded array — now driven by the specialties table in the database.

const DURATIONS = [
  { label: '1 – 2 hours', value: 1.5 },
  { label: '2 – 3 hours', value: 2.5 },
  { label: '3 – 4 hours', value: 3.5 },
  { label: '4+ hours',    value: 5.0 },
];

// File upload constraints
const MAX_FILES      = 5;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB per file
const ALLOWED_TYPES  = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/heic', 'image/heif'];
const ALLOWED_EXTS   = '.pdf, .jpg, .jpeg, .png, .webp, .heic, .heif';

// Supabase Storage bucket for case documents
// You must create this bucket in Supabase → Storage → New Bucket
// Bucket name: case-documents
// Set to "private" — we generate signed URLs on upload
const STORAGE_BUCKET = 'case-documents';

const API_URL = process.env.REACT_APP_API_URL;


// ── HELPER: format bytes to human-readable size ────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── HELPER: get a file icon emoji based on MIME type ──────────────────────────
function fileIcon(type) {
  if (type === 'application/pdf') return '📄';
  if (type.startsWith('image/'))  return '🖼️';
  return '📎';
}


// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────
export default function NewRequest() {
  const navigate = useNavigate();
  const location = useLocation();

  // ── RE-CONSULT CONVERSION PRE-FILL (Migration 004) ──────────────────────────
  // When navigating from CaseDetail after converting a re-consult, the route
  // state contains pre-fill data: specialty, patient details, suggested procedure,
  // recommendation notes, parent case ID, and the recommending surgeon ID.
  const reconsultData = location.state?.fromReconsult ? location.state : null;

  // ── STATE ─────────────────────────────────────────────────────────────────────

  // Hospital record for the logged-in SPOC
  const [hospital, setHospital] = useState(null);

  // Specialties fetched from API — drives the specialty dropdown
  const [specialties, setSpecialties] = useState([]);

  // All text/select form fields in one object
  // If opened from a re-consult conversion, pre-fill available fields.
  const [form, setForm] = useState({
    procedure:          reconsultData?.suggested_procedure || '',
    specialty_required: reconsultData?.specialty_required  || '',
    surgery_date:       '',
    surgery_time:       '',
    duration_hours:     '',
    ot_number:          '',
    patient_name:       reconsultData?.patient_name   || '',
    patient_age:        reconsultData?.patient_age     ? String(reconsultData.patient_age) : '',
    patient_gender:     reconsultData?.patient_gender  || '',
    fee:                '',    // single flat fee in ₹ (converted to paise on submit)
    notes:              reconsultData?.recommendation_notes || '',
  });

  // Field-level validation errors
  const [errors, setErrors] = useState({});

  // Submission loading state
  const [submitting, setSubmitting] = useState(false);

  // Top-level error message (non-field errors)
  const [submitError, setSubmitError] = useState('');

  // ── FILE UPLOAD STATE ──────────────────────────────────────────────────────
  // Each entry: { file: File, status: 'pending'|'uploading'|'done'|'error', url: string|null, error: string|null }
  const [uploadedFiles, setUploadedFiles]   = useState([]);
  const [uploadingAny,  setUploadingAny]    = useState(false);
  const [fileError,     setFileError]       = useState('');

  // Hidden file input ref — we trigger it from our custom button
  const fileInputRef = useRef(null);


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

    if (!form.surgery_date)
      e.surgery_date = 'Please select a surgery date';

    if (!form.surgery_time)
      e.surgery_time = 'Please select a surgery time';

    if (!form.duration_hours)
      e.duration_hours = 'Please select estimated duration';

    if (!form.ot_number.trim())
      e.ot_number = 'Please enter the OT number';

    if (!form.patient_name.trim())
      e.patient_name = 'Please enter patient name';

    if (!form.patient_age || form.patient_age < 1 || form.patient_age > 120)
      e.patient_age = 'Please enter a valid patient age (1–120)';

    if (!form.patient_gender)
      e.patient_gender = 'Please select patient gender';

    // UPDATED (Migration 001): Single fee replaces min/max range
    if (!form.fee || Number(form.fee) <= 0)
      e.fee = 'Please enter the surgeon fee';

    setErrors(e);
    return Object.keys(e).length === 0;
  };


  // ── FILE UPLOAD HANDLERS ───────────────────────────────────────────────────

  /**
   * Called when the user picks files from the OS picker.
   * Validates each file and starts uploading immediately.
   */
  const handleFileSelect = async (e) => {
    setFileError('');
    const picked = Array.from(e.target.files || []);

    // Reset file input so the same file can be re-selected after removal
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (!picked.length) return;

    // Check total count limit
    if (uploadedFiles.length + picked.length > MAX_FILES) {
      setFileError(`You can upload a maximum of ${MAX_FILES} files.`);
      return;
    }

    // Validate each file before uploading
    for (const file of picked) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setFileError(`"${file.name}" is not allowed. Only PDF, JPG, and PNG files are accepted.`);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setFileError(`"${file.name}" is too large. Maximum file size is 5 MB.`);
        return;
      }
    }

    // Add each file to state as 'pending' then upload
    const newEntries = picked.map(file => ({
      file,
      status: 'pending',
      url:    null,
      error:  null,
      name:   file.name,
      size:   file.size,
      type:   file.type,
    }));

    setUploadedFiles(prev => [...prev, ...newEntries]);
    setUploadingAny(true);

    // Upload each file to Supabase Storage
    const startIndex = uploadedFiles.length;
    for (let i = 0; i < newEntries.length; i++) {
      const entry = newEntries[i];
      const idx   = startIndex + i;

      // Update status to 'uploading'
      setUploadedFiles(prev => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], status: 'uploading' };
        return updated;
      });

      try {
        // Build a unique storage path: cases/{timestamp}_{filename}
        const timestamp  = Date.now();
        const safeName   = entry.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `cases/${timestamp}_${safeName}`;

        console.log(`Uploading file to Supabase Storage: ${storagePath}`);

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, entry.file, {
            cacheControl: '3600',
            upsert: false,          // don't overwrite — timestamp ensures uniqueness
            contentType: entry.file.type,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError.message);
          throw new Error(uploadError.message);
        }

        console.log('File uploaded:', uploadData.path);

        // Get a public URL for the file
        // Note: bucket must have public access, OR use createSignedUrl for private buckets
        const { data: urlData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(uploadData.path);

        const publicUrl = urlData?.publicUrl || null;
        console.log('Public URL:', publicUrl);

        // Update entry to 'done' with URL
        setUploadedFiles(prev => {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], status: 'done', url: publicUrl };
          return updated;
        });

      } catch (err) {
        console.error('File upload failed:', err.message);

        // Update entry to 'error'
        setUploadedFiles(prev => {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], status: 'error', error: err.message };
          return updated;
        });
      }
    }

    setUploadingAny(false);
  };

  /** Remove a file from the list (does NOT delete from storage — clean up separately if needed) */
  const handleRemoveFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setFileError('');
  };


  // ── FORM SUBMISSION ───────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!validate()) return;

    // Don't submit while files are still uploading
    if (uploadingAny) {
      setSubmitError('Please wait for files to finish uploading.');
      return;
    }

    setSubmitting(true);

    try {
      // Collect all successfully uploaded file URLs
      const documentUrls = uploadedFiles
        .filter(f => f.status === 'done' && f.url)
        .map(f => ({ name: f.name, url: f.url, type: f.type }));

      console.log('Submitting case with documents:', documentUrls);

      // UPDATED (Migration 001): Sends single fee (in paise) and request_type = 'elective'
      // UPDATED (Migration 004): Includes parent_case_id when created from a re-consult conversion
      const response = await axios.post(`${API_URL}/api/cases`, {
        hospital_id:        hospital.id,
        procedure:          form.procedure.trim(),
        specialty_required: form.specialty_required,
        surgery_date:       form.surgery_date,
        surgery_time:       form.surgery_time,
        duration_hours:     Number(form.duration_hours),
        ot_number:          form.ot_number.trim(),
        patient_name:       form.patient_name.trim(),
        patient_age:        Number(form.patient_age),
        patient_gender:     form.patient_gender,
        fee:                Number(form.fee) * 100,  // ₹ → paise
        request_type:       'elective',
        parent_case_id:     reconsultData?.parent_case_id || null,  // NEW (Migration 004)
        notes:              form.notes.trim() || null,
        // Documents array — stored as JSONB in cases table
        // Each entry: { name, url, type }
        documents:          documentUrls.length > 0 ? documentUrls : null,
      });

      console.log('Case created:', response.data);

      // Redirect to shortlist page
      // UPDATED (Migration 004): Pass recommending surgeon ID so the Shortlist
      // page can auto-add them at position #1.
      navigate(`/cases/${response.data.case.id}/shortlist`, {
        state: reconsultData?.recommending_surgeon_id
          ? { recommending_surgeon_id: reconsultData.recommending_surgeon_id }
          : undefined,
      });

    } catch (err) {
      console.error('Case submission error:', err);
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
          <h2 className="text-2xl font-bold text-body">New Surgery Request</h2>
          <p className="text-muted text-sm mt-1">
            Fill in the details below. We'll match you with the best available surgeons.
          </p>
        </div>

        {/* ── RE-CONSULT PRE-FILL BANNER (Migration 004) ──────────────────────── */}
        {/* Shown when this form was opened from converting a re-consult case.
            Informs the SPOC that fields have been pre-filled from the surgeon's
            recommendation so they can review and adjust before submitting. */}
        {reconsultData && (
          <div className="mb-6 p-4 rounded-lg flex items-start gap-3"
            style={{ backgroundColor: '#FFF7F0', border: '1px solid #F5D9C0' }}>
            <span className="text-lg mt-0.5">💡</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#444444' }}>
                Pre-filled from re-consult recommendation
              </p>
              <p className="text-xs mt-1" style={{ color: '#8B8B8B' }}>
                Procedure, patient details, and notes have been carried over. Review and adjust as needed before submitting.
              </p>
            </div>
          </div>
        )}

        {/* ── SUBMIT ERROR ─────────────────────────────────────────────────────── */}
        {submitError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {submitError}
          </div>
        )}

        {/* ── FORM ─────────────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} noValidate>


          {/* ════════════════════════════════════════════════════════════════════
              SECTION 1: SURGERY DETAILS
          ════════════════════════════════════════════════════════════════════ */}
          <div className="card mb-6">
            <h3 className="card-section-title">
              <span className="section-badge">1</span>
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
                  placeholder="e.g. Laparoscopic Cholecystectomy"
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

              {/* Surgery Date */}
              <div>
                <label className="form-label">Surgery Date *</label>
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

              {/* Surgery Time */}
              <div>
                <label className="form-label">Surgery Time *</label>
                <input
                  type="time"
                  value={form.surgery_time}
                  onChange={e => handleChange('surgery_time', e.target.value)}
                  className={`input-field ${errors.surgery_time ? 'input-field-error' : ''}`}
                />
                {errors.surgery_time && <p className="field-error">{errors.surgery_time}</p>}
              </div>

              {/* Duration */}
              <div>
                <label className="form-label">Estimated Duration *</label>
                <select
                  value={form.duration_hours}
                  onChange={e => handleChange('duration_hours', e.target.value)}
                  className={`input-field ${errors.duration_hours ? 'input-field-error' : ''}`}
                >
                  <option value="">Select duration...</option>
                  {DURATIONS.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
                {errors.duration_hours && <p className="field-error">{errors.duration_hours}</p>}
              </div>

              {/* OT Number */}
              <div>
                <label className="form-label">OT Number *</label>
                <input
                  type="text"
                  value={form.ot_number}
                  onChange={e => handleChange('ot_number', e.target.value)}
                  placeholder="e.g. OT-3"
                  className={`input-field ${errors.ot_number ? 'input-field-error' : ''}`}
                />
                {errors.ot_number && <p className="field-error">{errors.ot_number}</p>}
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
              SECTION 3: SURGEON FEE
              UPDATED (Migration 001): Single flat fee replaces min/max range.
              Stored in paise (₹ × 100) in the database.
          ════════════════════════════════════════════════════════════════════ */}
          <div className="card mb-6">
            <h3 className="card-section-title">
              <span className="section-badge">3</span>
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
              SECTION 4: DOCUMENTS (optional)
              Uploads go directly to Supabase Storage from the browser.
              URLs are collected and sent with the case POST to the backend.
          ════════════════════════════════════════════════════════════════════ */}
          <div className="card mb-6">
            <h3 className="card-section-title">
              <span className="section-badge">4</span>
              Clinical Documents
              <span className="ml-2 text-xs font-normal text-muted">(optional)</span>
            </h3>

            <p className="text-sm text-muted mb-4">
              Upload reports, scans, or referral letters that will help the surgeon prepare.
              Accepted: PDF, JPG, PNG · Max 5 MB each · Up to {MAX_FILES} files.
            </p>

            {/* ── File error message ── */}
            {fileError && (
              <div className="mb-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                ❌ {fileError}
              </div>
            )}

            {/* ── Uploaded files list ── */}
            {uploadedFiles.length > 0 && (
              <div className="mb-4 space-y-2">
                {uploadedFiles.map((f, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm
                      ${f.status === 'done'      ? 'bg-orange-50 border-orange-200' : ''}
                      ${f.status === 'uploading' ? 'bg-gray-50 border-warm animate-pulse' : ''}
                      ${f.status === 'error'     ? 'bg-red-50 border-red-200' : ''}
                      ${f.status === 'pending'   ? 'bg-gray-50 border-warm' : ''}
                    `}
                  >
                    {/* File icon */}
                    <span className="text-lg flex-shrink-0">
                      {fileIcon(f.type)}
                    </span>

                    {/* File name + size */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-body truncate">{f.name}</p>
                      <p className="text-xs text-muted">{formatBytes(f.size)}</p>
                    </div>

                    {/* Status indicator */}
                    <div className="flex-shrink-0">
                      {f.status === 'uploading' && (
                        <span className="text-xs text-muted">Uploading...</span>
                      )}
                      {f.status === 'done' && (
                        <span className="text-xs text-green-600 font-semibold">✓ Uploaded</span>
                      )}
                      {f.status === 'error' && (
                        <span className="text-xs text-red-500">Upload failed</span>
                      )}
                      {f.status === 'pending' && (
                        <span className="text-xs text-muted">Waiting...</span>
                      )}
                    </div>

                    {/* Remove button — disabled while uploading */}
                    {f.status !== 'uploading' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(i)}
                        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center
                          text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Remove file"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Upload button — hidden if max files reached ── */}
            {uploadedFiles.length < MAX_FILES && (
              <div>
                {/* Hidden native file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_EXTS}
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  aria-label="Upload clinical documents"
                />

                {/* Custom styled trigger button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAny}
                  className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-warm
                    rounded-lg text-sm text-muted hover:border-brand hover:text-brand
                    transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed w-full
                    justify-center"
                >
                  <span className="text-lg">📎</span>
                  {uploadingAny ? 'Uploading...' : 'Click to attach files'}
                </button>

                <p className="text-xs text-muted mt-2 text-center">
                  {MAX_FILES - uploadedFiles.length} of {MAX_FILES} files remaining
                </p>
              </div>
            )}

            {/* ── All slots used ── */}
            {uploadedFiles.length >= MAX_FILES && (
              <p className="text-xs text-muted text-center">
                Maximum {MAX_FILES} files uploaded. Remove one to add another.
              </p>
            )}

          </div>


          {/* ════════════════════════════════════════════════════════════════════
              SECTION 5: CLINICAL NOTES (optional)
          ════════════════════════════════════════════════════════════════════ */}
          <div className="card mb-6">
            <h3 className="card-section-title">
              <span className="section-badge">5</span>
              Clinical Notes
              <span className="ml-2 text-xs font-normal text-muted">(optional)</span>
            </h3>

            <textarea
              value={form.notes}
              onChange={e => handleChange('notes', e.target.value)}
              placeholder="Any relevant clinical information, patient conditions, or surgeon requirements..."
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
              disabled={submitting || !hospital || uploadingAny}
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

          {/* Hint if files are still uploading */}
          {uploadingAny && (
            <p className="text-center text-xs text-muted mt-3">
              ⏳ Waiting for files to finish uploading before submitting...
            </p>
          )}

        </form>
      </div>
    </div>
  );
}