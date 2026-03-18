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
 *   3 — Surgeon Fee Budget (min, max)
 *   4 — Documents (optional file upload — PDF, JPG, PNG, max 5MB each, up to 3)
 *   5 — Clinical Notes (optional free text)
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import axios from 'axios';

// ── CONSTANTS ──────────────────────────────────────────────────────────────────

const SPECIALTIES = [
  'General Surgery',
  'Laparoscopic Surgery',
  'Orthopaedics',
  'Cardiothoracic Surgery',
  'Neurosurgery',
  'Urology',
  'Gynaecology',
  'Plastic Surgery',
  'ENT Surgery',
  'Ophthalmology',
  'Vascular Surgery',
  'Paediatric Surgery',
  'Spine Surgery',
  'Bariatric Surgery',
];

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

  // ── STATE ─────────────────────────────────────────────────────────────────────

  // Hospital record for the logged-in SPOC
  const [hospital, setHospital] = useState(null);

  // All text/select form fields in one object
  const [form, setForm] = useState({
    procedure:          '',
    specialty_required: '',
    surgery_date:       '',
    surgery_time:       '',
    duration_hours:     '',
    ot_number:          '',
    patient_name:       '',
    patient_age:        '',
    patient_gender:     '',
    fee_min:            '',
    fee_max:            '',
    notes:              '',
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
   * DEV_MODE: hardcoded email — no auth needed
   */
  useEffect(() => {
    const getHospital = async () => {
      const devEmail = 'venturevoyager.sam@gmail.com';
      console.log('DEV_MODE: Using hardcoded email:', devEmail);

      const { data: hospitalData, error } = await supabase
        .from('hospitals')
        .select('*')
        .eq('contact_email', devEmail)
        .single();

      if (error || !hospitalData) {
        console.error('Hospital not found for email:', devEmail);
        navigate('/dashboard');
        return;
      }

      setHospital(hospitalData);
      console.log('Hospital loaded:', hospitalData.name);
    };

    getHospital();
  }, [navigate]);


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

    if (!form.surgery_date) {
      e.surgery_date = 'Please select a surgery date';
    } else {
      const surgeryDate = new Date(form.surgery_date);
      const minDate = new Date();
      minDate.setHours(minDate.getHours() + 48);
      if (surgeryDate < minDate)
        e.surgery_date = 'Surgery date must be at least 48 hours from now';
    }

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

    if (!form.fee_min || Number(form.fee_min) <= 0)
      e.fee_min = 'Please enter minimum fee';

    if (!form.fee_max || Number(form.fee_max) <= 0)
      e.fee_max = 'Please enter maximum fee';

    if (Number(form.fee_max) <= Number(form.fee_min))
      e.fee_max = 'Maximum fee must be greater than minimum fee';

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
        fee_min:            Number(form.fee_min),
        fee_max:            Number(form.fee_max),
        notes:              form.notes.trim() || null,
        // Documents array — stored as JSONB in cases table
        // Each entry: { name, url, type }
        documents:          documentUrls.length > 0 ? documentUrls : null,
      });

      console.log('Case created:', response.data);

      // Redirect to shortlist page
      navigate(`/cases/${response.data.case.id}/shortlist`);

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
                  <option value="">Select specialty...</option>
                  {SPECIALTIES.map(s => (
                    <option key={s} value={s}>{s}</option>
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
                  className={`input-field ${errors.surgery_date ? 'input-field-error' : ''}`}
                />
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
              SECTION 3: SURGEON FEE BUDGET
          ════════════════════════════════════════════════════════════════════ */}
          <div className="card mb-6">
            <h3 className="card-section-title">
              <span className="section-badge">3</span>
              Surgeon Fee Budget
            </h3>

            <div className="grid grid-cols-2 gap-4">

              {/* Fee Min */}
              <div>
                <label className="form-label">Minimum Fee (₹) *</label>
                <input
                  type="number"
                  value={form.fee_min}
                  onChange={e => handleChange('fee_min', e.target.value)}
                  placeholder="e.g. 15000"
                  min="0"
                  className={`input-field ${errors.fee_min ? 'input-field-error' : ''}`}
                />
                {errors.fee_min && <p className="field-error">{errors.fee_min}</p>}
              </div>

              {/* Fee Max */}
              <div>
                <label className="form-label">Maximum Fee (₹) *</label>
                <input
                  type="number"
                  value={form.fee_max}
                  onChange={e => handleChange('fee_max', e.target.value)}
                  placeholder="e.g. 25000"
                  min="0"
                  className={`input-field ${errors.fee_max ? 'input-field-error' : ''}`}
                />
                {errors.fee_max && <p className="field-error">{errors.fee_max}</p>}
              </div>

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