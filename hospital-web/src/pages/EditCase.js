/**
 * EDIT CASE PAGE — Hospital Web App
 * Vaidhya Healthcare Pvt Ltd
 *
 * Shown after a hospital books a surgeon via "Find a Surgeon".
 * The case is already created in DB as a "draft" with the surgeon pre-assigned.
 * All other fields are empty — hospital fills them here and saves.
 *
 * On save:
 *   - PATCH /api/cases/:id  →  updates case with all filled fields
 *   - Status changes from "draft" → "active"
 *   - Redirected to /cases/:id/shortlist to confirm priority
 *
 * The form is identical to NewRequest but:
 *   - Surgeon is shown at the top (pre-assigned, locked)
 *   - Submit says "Save & Continue" instead of "Find Matching Surgeons"
 *   - No specialty-based matching runs — surgeon is already chosen
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

// SPECIALTIES array removed — was dead code (never referenced in JSX).
// EditCase uses surgeon.specialty[] from the pre-assigned surgeon, not a global list.

const DURATIONS = [
  { label: '1 – 2 hours', value: 1.5 },
  { label: '2 – 3 hours', value: 2.5 },
  { label: '3 – 4 hours', value: 3.5 },
  { label: '4+ hours',    value: 5.0 },
];

const MAX_FILES      = 5;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES  = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/heic'];
const ALLOWED_EXTS   = '.pdf, .jpg, .jpeg, .png, .webp, .heic';
const STORAGE_BUCKET = 'case-documents';

function formatBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
function fileIcon(type) {
  if (type === 'application/pdf') return '📄';
  if (type?.startsWith('image/')) return '🖼️';
  return '📎';
}

export default function EditCase() {
  const navigate   = useNavigate();
  const { caseId } = useParams();
  const location   = useLocation();

  // Surgeon passed from FindSurgeon via navigate state
  const surgeonFromNav = location.state?.surgeon || null;

  // ── STATE ──────────────────────────────────────────────────────────────────
  const [hospital,     setHospital]     = useState(null);
  const [caseData,     setCaseData]     = useState(null);  // existing draft from DB
  const [surgeon,      setSurgeon]      = useState(surgeonFromNav);
  const [loading,      setLoading]      = useState(true);
  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState('');
  const [errors,       setErrors]       = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadingAny,  setUploadingAny]  = useState(false);
  const [fileError,     setFileError]     = useState('');
  const fileInputRef = useRef(null);

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

  // ── LOAD CASE + HOSPITAL ───────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      // Uses hospital_id from localStorage (set by Login.js after custom auth login)
      const hospitalId = localStorage.getItem('hospital_id');

      // Get hospital
      const { data: hosp } = await supabase
        .from('hospitals')
        .select('*')
        .eq('id', hospitalId)
        .single();
      setHospital(hosp);

      // Get existing case (draft)
      const { data: existingCase } = await supabase
        .from('cases')
        .select('*')
        .eq('id', caseId)
        .single();

      if (existingCase) {
        setCaseData(existingCase);

        // Pre-fill form if case already has some data
        setForm({
          procedure:          existingCase.procedure          || '',
          specialty_required: existingCase.specialty_required || '',
          surgery_date:       existingCase.surgery_date       || '',
          surgery_time:       existingCase.surgery_time       || '',
          duration_hours:     existingCase.duration_hours     || '',
          ot_number:          existingCase.ot_number          || '',
          patient_name:       existingCase.patient_name       || '',
          patient_age:        existingCase.patient_age        || '',
          patient_gender:     existingCase.patient_gender     || '',
          fee_min:            existingCase.fee_min            ? String(existingCase.fee_min / 100) : '',
          fee_max:            existingCase.fee_max            ? String(existingCase.fee_max / 100) : '',
          notes:              existingCase.notes              || '',
        });

        // Pre-fill documents if any were saved
        if (Array.isArray(existingCase.documents) && existingCase.documents.length > 0) {
          setUploadedFiles(existingCase.documents.map(d => ({
            ...d, status: 'done', file: null,
          })));
        }
      }

      // If surgeon wasn't passed via nav state, fetch from DB
      if (!surgeon && existingCase?.confirmed_surgeon_id) {
        const { data: surg } = await supabase
          .from('surgeons')
          .select('id, name, specialty, city, rating, experience_years, bio, profile_photo_url')
          .eq('id', existingCase.confirmed_surgeon_id)
          .single();
        setSurgeon(surg);

        // Auto-populate specialty from surgeon if not already set
        if (surg?.specialty?.length > 0 && !existingCase.specialty_required) {
          setForm(prev => ({ ...prev, specialty_required: surg.specialty[0] }));
        }
      } else if (surgeonFromNav?.specialty?.length > 0 && !existingCase?.specialty_required) {
        // Surgeon came via nav state — still auto-populate specialty
        setForm(prev => ({ ...prev, specialty_required: surgeonFromNav.specialty[0] }));
      }

      setLoading(false);
    };
    load();
  }, [caseId]);

  // ── FORM HANDLERS ──────────────────────────────────────────────────────────
  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.procedure.trim())       e.procedure          = 'Please enter the procedure name';
    if (!form.specialty_required)     e.specialty_required = 'Please select a specialty';
    if (!form.surgery_date)           e.surgery_date       = 'Please select a surgery date';
    if (!form.surgery_time)           e.surgery_time       = 'Please select a surgery time';
    if (!form.duration_hours)         e.duration_hours     = 'Please select estimated duration';
    if (!form.ot_number.trim())       e.ot_number          = 'Please enter the OT number';
    if (!form.patient_name.trim())    e.patient_name       = 'Please enter patient name';
    if (!form.patient_age || form.patient_age < 1 || form.patient_age > 120)
                                      e.patient_age        = 'Please enter a valid age (1–120)';
    if (!form.patient_gender)         e.patient_gender     = 'Please select patient gender';
    if (!form.fee_min || Number(form.fee_min) <= 0)
                                      e.fee_min            = 'Please enter minimum fee';
    if (!form.fee_max || Number(form.fee_max) <= 0)
                                      e.fee_max            = 'Please enter maximum fee';
    if (Number(form.fee_max) <= Number(form.fee_min))
                                      e.fee_max            = 'Maximum fee must be greater than minimum';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── FILE UPLOAD ────────────────────────────────────────────────────────────
  const handleFileSelect = async (e) => {
    setFileError('');
    const picked = Array.from(e.target.files || []);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!picked.length) return;

    if (uploadedFiles.length + picked.length > MAX_FILES) {
      setFileError(`Maximum ${MAX_FILES} files allowed.`);
      return;
    }
    for (const file of picked) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setFileError(`"${file.name}" is not allowed. Only PDF, JPG, PNG files.`);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setFileError(`"${file.name}" exceeds 5 MB limit.`);
        return;
      }
    }

    const newEntries = picked.map(file => ({
      file, status: 'pending', url: null, error: null,
      name: file.name, size: file.size, type: file.type,
    }));
    setUploadedFiles(prev => [...prev, ...newEntries]);
    setUploadingAny(true);

    const startIndex = uploadedFiles.length;
    for (let i = 0; i < newEntries.length; i++) {
      const entry = newEntries[i];
      const idx   = startIndex + i;

      setUploadedFiles(prev => {
        const u = [...prev];
        u[idx] = { ...u[idx], status: 'uploading' };
        return u;
      });

      try {
        const timestamp   = Date.now();
        const safeName    = entry.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `cases/${timestamp}_${safeName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, entry.file, {
            cacheControl: '3600', upsert: false,
            contentType: entry.file.type,
          });

        if (uploadError) throw new Error(uploadError.message);

        const { data: urlData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(uploadData.path);

        setUploadedFiles(prev => {
          const u = [...prev];
          u[idx] = { ...u[idx], status: 'done', url: urlData?.publicUrl || null };
          return u;
        });
      } catch (err) {
        setUploadedFiles(prev => {
          const u = [...prev];
          u[idx] = { ...u[idx], status: 'error', error: err.message };
          return u;
        });
      }
    }
    setUploadingAny(false);
  };

  const handleRemoveFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setFileError('');
  };

  // ── SAVE CASE ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!validate()) return;
    if (uploadingAny) {
      setSubmitError('Please wait for files to finish uploading.');
      return;
    }

    setSubmitting(true);

    try {
      const documentUrls = uploadedFiles
        .filter(f => f.status === 'done' && f.url)
        .map(f => ({ name: f.name, url: f.url, type: f.type }));

      // PATCH the draft case with all filled-in details
      // Status moves from "draft" → "active"
      await axios.patch(`${API_URL}/api/cases/${caseId}`, {
        procedure:          form.procedure.trim(),
        specialty_required: form.specialty_required,
        surgery_date:       form.surgery_date,
        surgery_time:       form.surgery_time,
        duration_hours:     Number(form.duration_hours),
        ot_number:          form.ot_number.trim(),
        patient_name:       form.patient_name.trim(),
        patient_age:        Number(form.patient_age),
        patient_gender:     form.patient_gender,
        fee_min:            Number(form.fee_min) * 100,   // convert to paise
        fee_max:            Number(form.fee_max) * 100,
        notes:              form.notes.trim() || null,
        documents:          documentUrls.length > 0 ? documentUrls : null,
        status:             'active',
      });

      // Go to shortlist so hospital can confirm priority
      navigate(`/cases/${caseId}/shortlist`);

    } catch (err) {
      console.error('Save case error:', err);
      setSubmitError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-brand-light flex items-center justify-center">
        <p className="text-muted">Loading case...</p>
      </div>
    );
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-brand-light">

      {/* ── HEADER ── */}
      <nav className="topnav">
        <div className="flex items-center">
          <img
            src="/logo.png"
            alt="Surgeon on Call"
            style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="btn-ghost text-gray-400 hover:text-brand"
        >
          ← Back to Dashboard
        </button>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* ── PAGE HEADING ── */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-body">Fill Case Details</h2>
          <p className="text-muted text-sm mt-1">
            Complete the surgery details below. The surgeon has already been booked.
          </p>
        </div>

        {/* ── BOOKED SURGEON BANNER ── */}
        {surgeon && (
          <div style={{
            backgroundColor: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex', alignItems: 'center', gap: '14px',
          }}>
            {/* Avatar */}
            <div style={{
              width: '44px', height: '44px', borderRadius: '10px',
              backgroundColor: '#444', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {surgeon.profile_photo_url ? (
                <img src={surgeon.profile_photo_url} alt={surgeon.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              ) : (
                <span style={{ color: '#E56717', fontWeight: '700', fontSize: '14px' }}>
                  {surgeon.name.split(' ').slice(1, 3).map(n => n[0]).join('')}
                </span>
              )}
            </div>
            <div>
              <p style={{ fontSize: '11px', color: '#16a34a', fontWeight: '600',
                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                ✓ Surgeon Booked
              </p>
              <p style={{ fontWeight: '700', fontSize: '15px', color: '#444' }}>
                {surgeon.name}
              </p>
              <p style={{ fontSize: '12px', color: '#8B8B8B' }}>
                {(surgeon.specialty || []).join(', ')} · {surgeon.city}
              </p>
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {submitError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            ❌ {submitError}
          </div>
        )}

        {/* ── FORM ── */}
        <form onSubmit={handleSubmit} noValidate>

          {/* ── SECTION 1: SURGERY DETAILS ── */}
          <div className="card mb-6">
            <h3 className="card-section-title">
              <span className="section-badge">1</span>
              Surgery Details
            </h3>
            <div className="grid grid-cols-2 gap-4">

              <div className="col-span-2">
                <label className="form-label">Procedure Name *</label>
                <input type="text" value={form.procedure}
                  onChange={e => handleChange('procedure', e.target.value)}
                  placeholder="e.g. Laparoscopic Cholecystectomy"
                  className={`input-field ${errors.procedure ? 'input-field-error' : ''}`}
                />
                {errors.procedure && <p className="field-error">{errors.procedure}</p>}
              </div>

              <div className="col-span-2">
                <label className="form-label">Specialty Required *</label>
                {/* Only shows the booked surgeon's specialties */}
                <select value={form.specialty_required}
                  onChange={e => handleChange('specialty_required', e.target.value)}
                  className={`input-field ${errors.specialty_required ? 'input-field-error' : ''}`}
                >
                  <option value="">Select specialty...</option>
                  {(surgeon?.specialty || []).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {errors.specialty_required && <p className="field-error">{errors.specialty_required}</p>}
              </div>

              <div>
                <label className="form-label">Surgery Date *</label>
                <input type="date" value={form.surgery_date}
                  onChange={e => handleChange('surgery_date', e.target.value)}
                  className={`input-field ${errors.surgery_date ? 'input-field-error' : ''}`}
                />
                {errors.surgery_date && <p className="field-error">{errors.surgery_date}</p>}
              </div>

              <div>
                <label className="form-label">Surgery Time *</label>
                <input type="time" value={form.surgery_time}
                  onChange={e => handleChange('surgery_time', e.target.value)}
                  className={`input-field ${errors.surgery_time ? 'input-field-error' : ''}`}
                />
                {errors.surgery_time && <p className="field-error">{errors.surgery_time}</p>}
              </div>

              <div>
                <label className="form-label">Estimated Duration *</label>
                <select value={form.duration_hours}
                  onChange={e => handleChange('duration_hours', e.target.value)}
                  className={`input-field ${errors.duration_hours ? 'input-field-error' : ''}`}
                >
                  <option value="">Select duration...</option>
                  {DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
                {errors.duration_hours && <p className="field-error">{errors.duration_hours}</p>}
              </div>

              <div>
                <label className="form-label">OT Number *</label>
                <input type="text" value={form.ot_number}
                  onChange={e => handleChange('ot_number', e.target.value)}
                  placeholder="e.g. OT-3"
                  className={`input-field ${errors.ot_number ? 'input-field-error' : ''}`}
                />
                {errors.ot_number && <p className="field-error">{errors.ot_number}</p>}
              </div>

            </div>
          </div>

          {/* ── SECTION 2: PATIENT DETAILS ── */}
          <div className="card mb-6">
            <h3 className="card-section-title">
              <span className="section-badge">2</span>
              Patient Details
            </h3>
            <div className="grid grid-cols-2 gap-4">

              <div className="col-span-2">
                <label className="form-label">Patient Name *</label>
                <input type="text" value={form.patient_name}
                  onChange={e => handleChange('patient_name', e.target.value)}
                  placeholder="Full name"
                  className={`input-field ${errors.patient_name ? 'input-field-error' : ''}`}
                />
                {errors.patient_name && <p className="field-error">{errors.patient_name}</p>}
              </div>

              <div>
                <label className="form-label">Patient Age *</label>
                <input type="number" value={form.patient_age}
                  onChange={e => handleChange('patient_age', e.target.value)}
                  placeholder="Age in years" min="1" max="120"
                  className={`input-field ${errors.patient_age ? 'input-field-error' : ''}`}
                />
                {errors.patient_age && <p className="field-error">{errors.patient_age}</p>}
              </div>

              <div>
                <label className="form-label">Patient Gender *</label>
                <select value={form.patient_gender}
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

          {/* ── SECTION 3: FEE BUDGET ── */}
          <div className="card mb-6">
            <h3 className="card-section-title">
              <span className="section-badge">3</span>
              Surgeon Fee Budget
            </h3>
            <div className="grid grid-cols-2 gap-4">

              <div>
                <label className="form-label">Minimum Fee (₹) *</label>
                <input type="number" value={form.fee_min}
                  onChange={e => handleChange('fee_min', e.target.value)}
                  placeholder="e.g. 15000" min="0"
                  className={`input-field ${errors.fee_min ? 'input-field-error' : ''}`}
                />
                {errors.fee_min && <p className="field-error">{errors.fee_min}</p>}
              </div>

              <div>
                <label className="form-label">Maximum Fee (₹) *</label>
                <input type="number" value={form.fee_max}
                  onChange={e => handleChange('fee_max', e.target.value)}
                  placeholder="e.g. 25000" min="0"
                  className={`input-field ${errors.fee_max ? 'input-field-error' : ''}`}
                />
                {errors.fee_max && <p className="field-error">{errors.fee_max}</p>}
              </div>

            </div>
          </div>

          {/* ── SECTION 4: DOCUMENTS ── */}
          <div className="card mb-6">
            <h3 className="card-section-title">
              <span className="section-badge">4</span>
              Clinical Documents
              <span className="ml-2 text-xs font-normal text-muted">(optional)</span>
            </h3>
            <p className="text-sm text-muted mb-4">
              Upload reports, scans, or referral letters. PDF, JPG, PNG · Max 5 MB · Up to {MAX_FILES} files.
            </p>

            {fileError && (
              <div className="mb-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                ❌ {fileError}
              </div>
            )}

            {uploadedFiles.length > 0 && (
              <div className="mb-4 space-y-2">
                {uploadedFiles.map((f, i) => (
                  <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm
                    ${f.status === 'done'      ? 'bg-orange-50 border-orange-200' : ''}
                    ${f.status === 'uploading' ? 'bg-gray-50 border-warm animate-pulse' : ''}
                    ${f.status === 'error'     ? 'bg-red-50 border-red-200' : ''}
                    ${f.status === 'pending'   ? 'bg-gray-50 border-warm' : ''}
                  `}>
                    <span className="text-lg flex-shrink-0">{fileIcon(f.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-body truncate">{f.name}</p>
                      {f.size && <p className="text-xs text-muted">{formatBytes(f.size)}</p>}
                    </div>
                    <div className="flex-shrink-0">
                      {f.status === 'uploading' && <span className="text-xs text-muted">Uploading...</span>}
                      {f.status === 'done'      && <span className="text-xs text-green-600 font-semibold">✓ Uploaded</span>}
                      {f.status === 'error'     && <span className="text-xs text-red-500">Failed</span>}
                    </div>
                    {f.status !== 'uploading' && (
                      <button type="button" onClick={() => handleRemoveFile(i)}
                        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center
                          text-muted hover:text-red-500 hover:bg-red-50 transition-colors">
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {uploadedFiles.length < MAX_FILES && (
              <div>
                <input ref={fileInputRef} type="file" accept={ALLOWED_EXTS} multiple
                  onChange={handleFileSelect} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAny}
                  className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-warm
                    rounded-lg text-sm text-muted hover:border-brand hover:text-brand
                    transition-colors duration-150 disabled:opacity-50 w-full justify-center"
                >
                  <span className="text-lg">📎</span>
                  {uploadingAny ? 'Uploading...' : 'Click to attach files'}
                </button>
                <p className="text-xs text-muted mt-2 text-center">
                  {MAX_FILES - uploadedFiles.length} of {MAX_FILES} files remaining
                </p>
              </div>
            )}
          </div>

          {/* ── SECTION 5: NOTES ── */}
          <div className="card mb-6">
            <h3 className="card-section-title">
              <span className="section-badge">5</span>
              Clinical Notes
              <span className="ml-2 text-xs font-normal text-muted">(optional)</span>
            </h3>
            <textarea value={form.notes}
              onChange={e => handleChange('notes', e.target.value)}
              placeholder="Any relevant clinical information, patient conditions, or requirements..."
              rows={3} maxLength={500}
              className="input-field resize-none"
            />
            <p className="text-muted text-xs mt-1 text-right">{form.notes.length}/500</p>
          </div>

          {/* ── SUBMIT ── */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting || !hospital || uploadingAny}
              className="btn-primary flex-1 py-3 text-base"
            >
              {submitting ? 'Saving...' : 'Save & Continue →'}
            </button>
            <button type="button" onClick={() => navigate('/dashboard')}
              className="btn-secondary px-8">
              Cancel
            </button>
          </div>

          {uploadingAny && (
            <p className="text-center text-xs text-muted mt-3">
              ⏳ Waiting for files to finish uploading...
            </p>
          )}

        </form>
      </div>
    </div>
  );
}