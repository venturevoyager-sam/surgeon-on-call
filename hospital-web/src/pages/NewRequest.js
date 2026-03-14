/**
 * NEW SURGERY REQUEST PAGE - Hospital Web App
 *
 * This is where the hospital SPOC fills in details of a surgery
 * and submits it to the platform. On submission:
 * 1. Case is saved to the database
 * 2. Platform runs matching algorithm to find surgeons
 * 3. SPOC is redirected to the Shortlist page to pick priority order
 *
 * Fields collected:
 * - Procedure name and specialty
 * - Surgery date, time, duration, OT number
 * - Patient details (name, age, gender)
 * - Surgeon fee budget (min and max)
 * - Clinical notes (optional)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import axios from 'axios';

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

// List of surgical specialties available on the platform
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

// Surgery duration options
const DURATIONS = [
  { label: '1 – 2 hours', value: 1.5 },
  { label: '2 – 3 hours', value: 2.5 },
  { label: '3 – 4 hours', value: 3.5 },
  { label: '4+ hours',    value: 5.0 },
];

// Backend API URL from environment variables
const API_URL = process.env.REACT_APP_API_URL;
console.log('API URL being used:', API_URL);


export default function NewRequest() {
  const navigate = useNavigate();

  // ── STATE ────────────────────────────────────────────────────────────────────

  // The logged in hospital SPOC's details
  const [hospital, setHospital] = useState(null);

  // Form field values — one state object for all fields
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

  // Form validation errors — shown below each field
  const [errors, setErrors] = useState({});

  // Loading state while submitting
  const [submitting, setSubmitting] = useState(false);

  // General error message shown at the top
  const [submitError, setSubmitError] = useState('');

  // ── EFFECTS ──────────────────────────────────────────────────────────────────

  /**
   * On load: get the current user and find their hospital record
   * We need the hospital ID to attach to the case when saving
   */
  useEffect(() => {
  const getHospital = async () => {
    // Get the real logged-in user from Supabase Auth
    const { data: { session } } = await supabase.auth.getSession();

    // If no session, send back to login
    if (!session) {
      console.log('No session found, redirecting to login');
      navigate('/');
      return;
    }

    const email = session.user.email;
    console.log('Logged in as:', email);

    // Find hospital record by SPOC email
    const { data: hospital, error } = await supabase
      .from('hospitals')
      .select('*')
      .eq('contact_email', email)
      .single();

    console.log('Hospital found:', hospital);
    console.log('Hospital error:', error);

    if (error || !hospital) {
      console.error('Hospital not found for email:', email);
      navigate('/dashboard');
      return;
    }

    setHospital(hospital);
    console.log('Hospital state set successfully:', hospital.name);
  };

  getHospital();
}, [navigate]);

  // ── FORM HANDLERS ─────────────────────────────────────────────────────────────

  /**
   * Update a single form field value
   * Called by every input's onChange handler
   */
  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear the error for this field as soon as user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  /**
   * Validate all form fields before submission
   * Returns true if valid, false if any errors found
   */
  const validate = () => {
    const newErrors = {};

    if (!form.procedure.trim())
      newErrors.procedure = 'Please enter the procedure name';

    if (!form.specialty_required)
      newErrors.specialty_required = 'Please select a specialty';

    if (!form.surgery_date)
      newErrors.surgery_date = 'Please select a surgery date';
    else {
      // Surgery must be at least 48 hours from now
      const surgeryDate = new Date(form.surgery_date);
      const minDate = new Date();
      minDate.setHours(minDate.getHours() + 6);
      if (surgeryDate < minDate)
        newErrors.surgery_date = 'Surgery date must be at least 6 hours from now';
    }

    if (!form.surgery_time)
      newErrors.surgery_time = 'Please select a surgery time';

    if (!form.duration_hours)
      newErrors.duration_hours = 'Please select estimated duration';

    if (!form.ot_number.trim())
      newErrors.ot_number = 'Please enter the OT number';

    if (!form.patient_name.trim())
      newErrors.patient_name = 'Please enter patient name';

    if (!form.patient_age || form.patient_age < 1 || form.patient_age > 120)
      newErrors.patient_age = 'Please enter a valid patient age (1-120)';

    if (!form.patient_gender)
      newErrors.patient_gender = 'Please select patient gender';

    if (!form.fee_min || Number(form.fee_min) <= 0)
      newErrors.fee_min = 'Please enter minimum fee';

    if (!form.fee_max || Number(form.fee_max) <= 0)
      newErrors.fee_max = 'Please enter maximum fee';

    if (Number(form.fee_max) <= Number(form.fee_min))
      newErrors.fee_max = 'Maximum fee must be greater than minimum fee';

    setErrors(newErrors);
    // Return true only if no errors were found
    return Object.keys(newErrors).length === 0;
  };

  // ── FORM SUBMISSION ───────────────────────────────────────────────────────────

  /**
   * Submit the surgery request to the backend API
   * On success: redirect to shortlist page with the new case ID
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    console.log('Form submitted');
    console.log('Validation result:', validate());
    
    // Stop if validation fails
    if (!validate()) {
        console.log('Validation failed', errors);
        return;
    }

    console.log('Validation passed, calling API at:', `${API_URL}/api/cases`);
    console.log('Payload being sent:', {
        hospital_id: hospital.id,
        procedure: form.procedure,
        specialty_required: form.specialty_required,
        surgery_date: form.surgery_date,
        surgery_time: form.surgery_time,
        duration_hours: Number(form.duration_hours),
        ot_number: form.ot_number,
        patient_name: form.patient_name,
        patient_age: Number(form.patient_age),
        patient_gender: form.patient_gender,
        fee_min: Number(form.fee_min) * 100,
        fee_max: Number(form.fee_max) * 100,
        notes: form.notes,
    });

    setSubmitting(true);

    try {
      // Send case data to our backend API
      // Backend will save to DB and run the matching algorithm
      const response = await axios.post(`${API_URL}/api/cases`, {
        hospital_id:        hospital.id,
        procedure:          form.procedure,
        specialty_required: form.specialty_required,
        surgery_date:       form.surgery_date,
        surgery_time:       form.surgery_time,
        duration_hours:     Number(form.duration_hours),
        ot_number:          form.ot_number,
        patient_name:       form.patient_name,
        patient_age:        Number(form.patient_age),
        patient_gender:     form.patient_gender,
        // Convert rupees to paise (multiply by 100) for storage
        fee_min:            Number(form.fee_min) * 100,
        fee_max:            Number(form.fee_max) * 100,
        notes:              form.notes,
      });

      // Redirect to shortlist page with the new case ID
        console.log('API response received:', response.data);

        navigate(`/cases/${response.data.case.id}/shortlist`);

    } catch (error) {
        console.log('API call failed');
        console.log('Error message:', error.message);
        console.log('Error response:', error.response?.data);
        console.log('Error status:', error.response?.status);

      setSubmitError(
        error.response?.data?.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── RENDER ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── TOP NAVIGATION ── */}
      <nav className="bg-blue-900 px-8 py-4 flex items-center justify-between">
        <h1 className="text-white font-bold text-xl">
          Surgeon <span className="text-blue-300">on Call</span>
        </h1>
        <button
          onClick={() => navigate('/dashboard')}
          className="text-blue-300 hover:text-white text-sm transition"
        >
          ← Back to Dashboard
        </button>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* ── PAGE HEADING ── */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-blue-900">New Surgery Request</h2>
          <p className="text-gray-500 text-sm mt-1">
            Fill in the details below. We will match you with the best available surgeons.
          </p>
        </div>

        {/* ── SUBMIT ERROR ── */}
        {submitError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            ❌ {submitError}
          </div>
        )}

        {/* ── FORM ── */}
        <form onSubmit={handleSubmit}>

          {/* ── SECTION 1: SURGERY DETAILS ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">1</span>
              Surgery Details
            </h3>

            <div className="grid grid-cols-2 gap-4">

              {/* Procedure Name */}
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Procedure Name *
                </label>
                <input
                  type="text"
                  value={form.procedure}
                  onChange={e => handleChange('procedure', e.target.value)}
                  placeholder="e.g. Laparoscopic Cholecystectomy"
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    errors.procedure ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
                {errors.procedure && <p className="text-red-500 text-xs mt-1">{errors.procedure}</p>}
              </div>

              {/* Specialty */}
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Specialty Required *
                </label>
                <select
                  value={form.specialty_required}
                  onChange={e => handleChange('specialty_required', e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    errors.specialty_required ? 'border-red-400' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select specialty</option>
                  {SPECIALTIES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {errors.specialty_required && <p className="text-red-500 text-xs mt-1">{errors.specialty_required}</p>}
              </div>

              {/* Surgery Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Surgery Date *
                </label>
                <input
                  type="date"
                  value={form.surgery_date}
                  onChange={e => handleChange('surgery_date', e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    errors.surgery_date ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
                {errors.surgery_date && <p className="text-red-500 text-xs mt-1">{errors.surgery_date}</p>}
              </div>

              {/* Surgery Time */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Surgery Time *
                </label>
                <input
                  type="time"
                  value={form.surgery_time}
                  onChange={e => handleChange('surgery_time', e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    errors.surgery_time ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
                {errors.surgery_time && <p className="text-red-500 text-xs mt-1">{errors.surgery_time}</p>}
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Estimated Duration *
                </label>
                <select
                  value={form.duration_hours}
                  onChange={e => handleChange('duration_hours', e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    errors.duration_hours ? 'border-red-400' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select duration</option>
                  {DURATIONS.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
                {errors.duration_hours && <p className="text-red-500 text-xs mt-1">{errors.duration_hours}</p>}
              </div>

              {/* OT Number */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  OT Number *
                </label>
                <input
                  type="text"
                  value={form.ot_number}
                  onChange={e => handleChange('ot_number', e.target.value)}
                  placeholder="e.g. OT-3"
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    errors.ot_number ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
                {errors.ot_number && <p className="text-red-500 text-xs mt-1">{errors.ot_number}</p>}
              </div>

            </div>
          </div>

          {/* ── SECTION 2: PATIENT DETAILS ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">2</span>
              Patient Details
            </h3>

            <div className="grid grid-cols-2 gap-4">

              {/* Patient Name */}
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Patient Name *
                </label>
                <input
                  type="text"
                  value={form.patient_name}
                  onChange={e => handleChange('patient_name', e.target.value)}
                  placeholder="Full name"
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    errors.patient_name ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
                {errors.patient_name && <p className="text-red-500 text-xs mt-1">{errors.patient_name}</p>}
              </div>

              {/* Patient Age */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Patient Age *
                </label>
                <input
                  type="number"
                  value={form.patient_age}
                  onChange={e => handleChange('patient_age', e.target.value)}
                  placeholder="Age in years"
                  min="1" max="120"
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    errors.patient_age ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
                {errors.patient_age && <p className="text-red-500 text-xs mt-1">{errors.patient_age}</p>}
              </div>

              {/* Patient Gender */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Patient Gender *
                </label>
                <select
                  value={form.patient_gender}
                  onChange={e => handleChange('patient_gender', e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    errors.patient_gender ? 'border-red-400' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                {errors.patient_gender && <p className="text-red-500 text-xs mt-1">{errors.patient_gender}</p>}
              </div>

            </div>
          </div>

          {/* ── SECTION 3: FEE & NOTES ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">3</span>
              Fee Budget & Notes
            </h3>

            <div className="grid grid-cols-2 gap-4">

              {/* Fee Min */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Minimum Fee (₹) *
                </label>
                <input
                  type="number"
                  value={form.fee_min}
                  onChange={e => handleChange('fee_min', e.target.value)}
                  placeholder="e.g. 45000"
                  min="0"
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    errors.fee_min ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
                {errors.fee_min && <p className="text-red-500 text-xs mt-1">{errors.fee_min}</p>}
              </div>

              {/* Fee Max */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Maximum Fee (₹) *
                </label>
                <input
                  type="number"
                  value={form.fee_max}
                  onChange={e => handleChange('fee_max', e.target.value)}
                  placeholder="e.g. 60000"
                  min="0"
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    errors.fee_max ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
                {errors.fee_max && <p className="text-red-500 text-xs mt-1">{errors.fee_max}</p>}
              </div>

              {/* Notes */}
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Clinical Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => handleChange('notes', e.target.value)}
                  placeholder="Any relevant clinical information, patient conditions, or surgeon requirements..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
                <p className="text-gray-400 text-xs mt-1 text-right">
                  {form.notes.length}/500
                </p>
              </div>

            </div>
          </div>

          {/* ── SUBMIT BUTTON ── */}
          <div className="flex gap-3">
            {console.log('Hospital state at render:', hospital, 'Submitting:', submitting)}

            <button
              type="submit"
              disabled={submitting || !hospital}
              className="flex-1 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Finding Surgeons...' : '🔍 Find Matching Surgeons'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg transition text-sm font-medium"
            >
              Cancel
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}