/**
 * SIGNUP PAGE — Doctor Web
 * 6-section multi-step registration form for new surgeons.
 * Submits to POST /api/surgeons/register.
 *
 * Sections:
 *   1. Basic Details (name, phone, email, city, communication pref)
 *   2. Professional Details (specialty, qualification, experience, practice type)
 *   3. Practice & Availability (location pin, radius, toggles, fee)
 *   4. Verification & Credentialing (MCI, document uploads)
 *   5. Profile Building (bio, key procedures, photo)
 *   6. Declaration (checkbox, submit)
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { supabase, STORAGE_BUCKET } from '../lib/supabase';

// Leaflet for location picker
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const API_URL = process.env.REACT_APP_API_URL;

// Practice type options
const PRACTICE_TYPES = [
  'Full-time Consultant', 'Visiting Consultant', 'Freelance',
  'Independent', 'Academic', 'Other'
];

// Draggable marker for location picker
function DraggableMarker({ position, onMove }) {
  const ref = useRef(null);
  useMapEvents({ click(e) { onMove(e.latlng.lat, e.latlng.lng); } });
  return (
    <Marker position={position} draggable ref={ref}
      eventHandlers={{ dragend() { const m = ref.current; if(m) { const {lat,lng} = m.getLatLng(); onMove(lat,lng); } } }} />
  );
}

export default function Signup() {
  const navigate = useNavigate();

  // ── Current section (1-6) ──
  const [step, setStep] = useState(1);

  // ── Form data across all sections ──
  const [form, setForm] = useState({
    name: '', phone: '', email: '', city: '',
    communication_preference: 'WhatsApp',
    specialty: [], highest_qualification: '', experience_years: '',
    practice_type: '', hospital_affiliations: '',
    travel_radius_km: 10,
    preferred_lat: 17.385, preferred_lng: 78.4867, preferred_location_name: '',
    open_to_teleconsultation: false, open_to_emergency: false, open_to_physical_visits: false,
    avg_hourly_rate_rupees: '',
    mci_number: '',
    certificate_url: null, government_id_url: null, resume_url: null, degree_url: null,
    bio: '', key_procedures: '', profile_photo_url: null,
    declaration_agreed: false,
  });

  // ── Specialties from API ──
  const [specialties, setSpecialties]   = useState([]);
  const [specSearch, setSpecSearch]     = useState('');

  // ── Upload + submission state ──
  const [uploading, setUploading]   = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState(false);
  const [locationName, setLocationName] = useState('');

  // Fetch specialties
  useEffect(() => {
    axios.get(`${API_URL}/api/specialties`)
      .then(res => setSpecialties(res.data.specialties || []))
      .catch(() => {});
  }, []);

  // Reverse geocode when lat/lng changes
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${form.preferred_lat}&lon=${form.preferred_lng}&format=json`,
      { signal: ctrl.signal, headers: { 'Accept-Language': 'en' } })
      .then(r => r.json())
      .then(d => {
        const name = d.display_name || '';
        setLocationName(name);
        setForm(p => ({ ...p, preferred_location_name: name }));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [form.preferred_lat, form.preferred_lng]);

  // ── Helpers ──
  const set = (field, value) => setForm(p => ({ ...p, [field]: value }));

  const toggleSpecialty = (name) => {
    setForm(p => ({
      ...p,
      specialty: p.specialty.includes(name)
        ? p.specialty.filter(s => s !== name)
        : [...p.specialty, name],
    }));
  };

  // Upload file to Supabase Storage
  const uploadFile = async (file, field) => {
    setUploading(p => ({ ...p, [field]: true }));
    try {
      const path = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { data, error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);
      set(field, urlData.publicUrl);
    } catch (err) {
      console.error(`Upload failed for ${field}:`, err);
    } finally {
      setUploading(p => ({ ...p, [field]: false }));
    }
  };

  // ── Per-step validation ──
  const validateStep = (s) => {
    if (s === 1) {
      if (!form.name.trim()) return 'Full name is required';
      if (!form.phone.trim()) return 'Mobile number is required';
      if (!form.city.trim()) return 'Current city is required';
    }
    if (s === 2) {
      if (form.specialty.length === 0) return 'Please select at least one specialty';
    }
    if (s === 4) {
      if (!form.mci_number.trim()) return 'MCI registration number is required';
    }
    if (s === 6) {
      if (!form.declaration_agreed) return 'Please agree to the declaration';
    }
    return '';
  };

  const handleNext = () => {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError('');
    setStep(s => s + 1);
  };

  // ── Submit ──
  const handleSubmit = async () => {
    // Re-run all validations as a final safeguard
    for (let s = 1; s <= 6; s++) {
      const err = validateStep(s);
      if (err) { setStep(s); setError(err); return; }
    }

    setSubmitting(true); setError('');
    try {
      await axios.post(`${API_URL}/api/surgeons/register`, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        specialty: form.specialty,
        city: form.city.trim(),
        communication_preference: form.communication_preference,
        highest_qualification: form.highest_qualification.trim() || null,
        experience_years: Number(form.experience_years) || 0,
        practice_type: form.practice_type || null,
        hospital_affiliations: form.hospital_affiliations.trim() || null,
        preferred_lat: form.preferred_lat,
        preferred_lng: form.preferred_lng,
        preferred_location_name: form.preferred_location_name || null,
        travel_radius_km: form.travel_radius_km,
        open_to_teleconsultation: form.open_to_teleconsultation,
        open_to_emergency: form.open_to_emergency,
        open_to_physical_visits: form.open_to_physical_visits,
        avg_hourly_rate: form.avg_hourly_rate_rupees ? Number(form.avg_hourly_rate_rupees) * 100 : null,
        mci_number: form.mci_number.trim(),
        bio: form.bio.trim() || null,
        key_procedures: form.key_procedures.trim() || null,
        profile_photo_url: form.profile_photo_url,
        certificate_url: form.certificate_url,
        government_id_url: form.government_id_url,
        resume_url: form.resume_url,
        declaration_agreed: true,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally { setSubmitting(false); }
  };

  // ── SUCCESS ──
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6"
        style={{ backgroundColor: '#FDF8F5', fontFamily: '"DM Sans", sans-serif' }}>
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold mb-3" style={{ color: '#444444' }}>
            Thank you for registering with Surgeon On Call
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: '#8B8B8B' }}>
            Our team will review your profile and complete the verification process.
            You will be contacted shortly regarding the next steps.
            <br /><br />— Team SOC
          </p>
          <button onClick={() => navigate('/login')}
            className="mt-6 px-8 py-3 rounded-lg text-white font-semibold text-sm"
            style={{ backgroundColor: '#E56717' }}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // ── Shared styles ──
  const inputCls = "w-full px-4 py-3 rounded-lg text-sm border focus:outline-none focus:border-orange-400";
  const inputStyle = { borderColor: '#E8E0D8', color: '#444444' };
  const labelCls = "block text-xs font-semibold mb-1.5";
  const labelStyle = { color: '#8B8B8B' };

  // ── RENDER ──
  return (
    <div className="min-h-screen px-6 py-10"
      style={{ backgroundColor: '#FDF8F5', fontFamily: '"DM Sans", sans-serif' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold">
            <span style={{ color: '#444444' }}>Surgeon </span>
            <span style={{ color: '#E56717' }}>on Call</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: '#8B8B8B' }}>Doctor Registration</p>
        </div>

        {/* Progress indicator */}
        <div className="flex gap-1.5 mb-8">
          {[1,2,3,4,5,6].map(s => (
            <div key={s} className="flex-1 h-1.5 rounded-full transition"
              style={{ backgroundColor: s <= step ? '#E56717' : '#E8E0D8' }} />
          ))}
        </div>
        <p className="text-xs text-center mb-6" style={{ color: '#8B8B8B' }}>Step {step} of 6</p>

        {error && (
          <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
            {error}
          </div>
        )}

        {/* ═══ SECTION 1: Basic Details ═══ */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-bold mb-4" style={{ color: '#444444' }}>Basic Details</h2>
            <div style={{ marginBottom: '14px' }}>
              <label className={labelCls} style={labelStyle}>Full Name *</label>
              <input className={inputCls} style={inputStyle} value={form.name}
                onChange={e => set('name', e.target.value)} placeholder="Dr. Full Name" />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className={labelCls} style={labelStyle}>Mobile Number (WhatsApp-enabled) *</label>
              <input className={inputCls} style={inputStyle} value={form.phone} type="tel"
                onChange={e => set('phone', e.target.value)} placeholder="10-digit number" />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className={labelCls} style={labelStyle}>Email</label>
              <input className={inputCls} style={inputStyle} value={form.email} type="email"
                onChange={e => set('email', e.target.value)} placeholder="doctor@email.com" />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className={labelCls} style={labelStyle}>Current City *</label>
              <input className={inputCls} style={inputStyle} value={form.city}
                onChange={e => set('city', e.target.value)} placeholder="e.g. Hyderabad" />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className={labelCls} style={labelStyle}>Preferred Mode of Communication</label>
              <div className="flex gap-2 mt-1">
                {['Phone Call', 'WhatsApp', 'Email'].map(opt => (
                  <button key={opt} type="button"
                    onClick={() => set('communication_preference', opt)}
                    className="px-4 py-2 rounded-lg text-sm border transition"
                    style={{
                      borderColor: form.communication_preference === opt ? '#E56717' : '#E8E0D8',
                      backgroundColor: form.communication_preference === opt ? '#FFF7F0' : '#fff',
                      color: form.communication_preference === opt ? '#E56717' : '#8B8B8B',
                      fontWeight: form.communication_preference === opt ? '600' : '400',
                    }}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ SECTION 2: Professional Details ═══ */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-bold mb-4" style={{ color: '#444444' }}>Professional Details</h2>

            {/* Specialty multi-select with search */}
            <div style={{ marginBottom: '14px' }}>
              <label className={labelCls} style={labelStyle}>Primary Specialty *</label>
              <input className={inputCls} style={inputStyle} value={specSearch}
                onChange={e => setSpecSearch(e.target.value)} placeholder="Search specialties..." />
              <div className="flex flex-wrap gap-1.5 mt-2 max-h-36 overflow-y-auto">
                {specialties
                  .filter(s => s.name.toLowerCase().includes(specSearch.toLowerCase()))
                  .map(s => (
                    <button key={s.id} type="button" onClick={() => toggleSpecialty(s.name)}
                      className="px-3 py-1 rounded-full text-xs border transition"
                      style={{
                        borderColor: form.specialty.includes(s.name) ? '#E56717' : '#E8E0D8',
                        backgroundColor: form.specialty.includes(s.name) ? '#E56717' : '#fff',
                        color: form.specialty.includes(s.name) ? '#fff' : '#444444',
                      }}>
                      {s.name}
                    </button>
                  ))}
              </div>
              {form.specialty.length > 0 && (
                <p className="text-xs mt-1" style={{ color: '#E56717' }}>
                  Selected: {form.specialty.join(', ')}
                </p>
              )}
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className={labelCls} style={labelStyle}>Highest Qualification</label>
              <input className={inputCls} style={inputStyle} value={form.highest_qualification}
                onChange={e => set('highest_qualification', e.target.value)} placeholder="e.g. MS, MCh, DNB" />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className={labelCls} style={labelStyle}>Years of Experience (post-PG)</label>
              <input className={inputCls} style={inputStyle} value={form.experience_years} type="number"
                onChange={e => set('experience_years', e.target.value)} placeholder="e.g. 12" min="0" />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className={labelCls} style={labelStyle}>Current Practice Type</label>
              <select className={inputCls} style={inputStyle} value={form.practice_type}
                onChange={e => set('practice_type', e.target.value)}>
                <option value="">Select...</option>
                {PRACTICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className={labelCls} style={labelStyle}>Current Hospital Affiliations</label>
              <input className={inputCls} style={inputStyle} value={form.hospital_affiliations}
                onChange={e => set('hospital_affiliations', e.target.value)} placeholder="Hospital names" />
            </div>
          </div>
        )}

        {/* ═══ SECTION 3: Practice & Availability ═══ */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-bold mb-4" style={{ color: '#444444' }}>Practice & Availability</h2>

            {/* Travel radius */}
            <div style={{ marginBottom: '14px' }}>
              <label className={labelCls} style={labelStyle}>
                Preferred Working Radius: {form.travel_radius_km} km
              </label>
              <input type="range" min="1" max="100" value={form.travel_radius_km}
                onChange={e => set('travel_radius_km', Number(e.target.value))}
                className="w-full" style={{ accentColor: '#E56717' }} />
            </div>

            {/* Location map */}
            <div style={{ marginBottom: '14px' }}>
              <label className={labelCls} style={labelStyle}>Preferred Location (drag pin or use current location)</label>
              <button
                type="button"
                onClick={() => {
                  if (!navigator.geolocation) return;
                  navigator.geolocation.getCurrentPosition(
                    (pos) => { set('preferred_lat', pos.coords.latitude); set('preferred_lng', pos.coords.longitude); },
                    () => {},
                    { enableHighAccuracy: true, timeout: 10000 }
                  );
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', marginBottom: '8px',
                  backgroundColor: '#FFFFFF', border: '1px solid #E8E0D8', borderRadius: '8px',
                  fontSize: '13px', fontWeight: '500', color: '#E56717', cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '16px' }}>📍</span> Use my current location
              </button>
              <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #E8E0D8', height: '200px' }}>
                <MapContainer center={[form.preferred_lat, form.preferred_lng]} zoom={12}
                  style={{ height: '100%', width: '100%' }} scrollWheelZoom>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <DraggableMarker position={[form.preferred_lat, form.preferred_lng]}
                    onMove={(lat, lng) => { set('preferred_lat', lat); set('preferred_lng', lng); }} />
                </MapContainer>
              </div>
              {locationName && <p className="text-xs mt-1" style={{ color: '#8B8B8B' }}>{locationName}</p>}
            </div>

            {/* Toggles */}
            {[
              ['open_to_teleconsultation', 'Open to teleconsultation'],
              ['open_to_emergency', 'Open to emergency calls'],
              ['open_to_physical_visits', 'Open to physical visits at nearby hospitals'],
            ].map(([field, label]) => (
              <div key={field} className="flex items-center justify-between py-2.5"
                style={{ borderBottom: '1px solid #E8E0D8' }}>
                <span className="text-sm" style={{ color: '#444444' }}>{label}</span>
                <button type="button"
                  onClick={() => set(field, !form[field])}
                  className="w-11 h-6 rounded-full transition-colors relative"
                  style={{ backgroundColor: form[field] ? '#E56717' : '#E8E0D8' }}>
                  <span className="block w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all"
                    style={{ left: form[field] ? '22px' : '2px' }} />
                </button>
              </div>
            ))}

            {/* Fee */}
            <div style={{ marginTop: '14px' }}>
              <label className={labelCls} style={labelStyle}>Preferred Consultation Fee (₹ per hour)</label>
              <input className={inputCls} style={inputStyle} value={form.avg_hourly_rate_rupees}
                type="number" onChange={e => set('avg_hourly_rate_rupees', e.target.value)}
                placeholder="e.g. 5000" min="0" />
            </div>
          </div>
        )}

        {/* ═══ SECTION 4: Verification & Credentialing ═══ */}
        {step === 4 && (
          <div>
            <h2 className="text-lg font-bold mb-4" style={{ color: '#444444' }}>Verification & Credentialing</h2>
            <div style={{ marginBottom: '14px' }}>
              <label className={labelCls} style={labelStyle}>MCI Registration Number *</label>
              <input className={inputCls} style={inputStyle} value={form.mci_number}
                onChange={e => set('mci_number', e.target.value)} placeholder="e.g. MCI-AP-12345" />
            </div>

            {/* Document uploads */}
            {[
              ['certificate_url', 'Medical Registration Certificate'],
              ['degree_url', 'Degree Certificates'],
              ['government_id_url', 'Government ID Proof'],
              ['resume_url', 'Resume / CV'],
            ].map(([field, label]) => (
              <div key={field} style={{ marginBottom: '14px' }}>
                <label className={labelCls} style={labelStyle}>{label}</label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                  onChange={e => { if (e.target.files[0]) uploadFile(e.target.files[0], field); }}
                  className="text-sm" style={{ color: '#444444' }} />
                {uploading[field] && <p className="text-xs mt-1" style={{ color: '#E56717' }}>Uploading...</p>}
                {form[field] && <p className="text-xs mt-1" style={{ color: '#16a34a' }}>Uploaded ✓</p>}
              </div>
            ))}
          </div>
        )}

        {/* ═══ SECTION 5: Profile Building ═══ */}
        {step === 5 && (
          <div>
            <h2 className="text-lg font-bold mb-4" style={{ color: '#444444' }}>Profile Building</h2>
            <div style={{ marginBottom: '14px' }}>
              <label className={labelCls} style={labelStyle}>Professional Bio (100-150 words recommended)</label>
              <textarea className={inputCls} style={{ ...inputStyle, minHeight: '100px' }} value={form.bio}
                onChange={e => set('bio', e.target.value)}
                placeholder="Tell hospitals about your experience, specializations, and approach..." />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className={labelCls} style={labelStyle}>Key Procedures / Areas of Expertise</label>
              <textarea className={inputCls} style={{ ...inputStyle, minHeight: '80px' }} value={form.key_procedures}
                onChange={e => set('key_procedures', e.target.value)}
                placeholder="e.g. Laparoscopic Cholecystectomy, Hernia Repair, Appendectomy..." />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className={labelCls} style={labelStyle}>Professional Photo</label>
              <input type="file" accept="image/*"
                onChange={e => { if (e.target.files[0]) uploadFile(e.target.files[0], 'profile_photo_url'); }}
                className="text-sm" style={{ color: '#444444' }} />
              {uploading.profile_photo_url && <p className="text-xs mt-1" style={{ color: '#E56717' }}>Uploading...</p>}
              {form.profile_photo_url && <p className="text-xs mt-1" style={{ color: '#16a34a' }}>Uploaded ✓</p>}
            </div>
          </div>
        )}

        {/* ═══ SECTION 6: Declaration ═══ */}
        {step === 6 && (
          <div>
            <h2 className="text-lg font-bold mb-4" style={{ color: '#444444' }}>Declaration</h2>
            <label className="flex items-start gap-3 cursor-pointer p-4 rounded-lg"
              style={{ border: '1px solid #E8E0D8', backgroundColor: form.declaration_agreed ? '#FFF7F0' : '#fff' }}>
              <input type="checkbox" checked={form.declaration_agreed}
                onChange={e => set('declaration_agreed', e.target.checked)}
                className="mt-1" style={{ accentColor: '#E56717', width: '18px', height: '18px' }} />
              <span className="text-sm leading-relaxed" style={{ color: '#444444' }}>
                I confirm that the information provided is true and accurate. I agree to be contacted by
                Surgeon On Call for onboarding and professional opportunities.
              </span>
            </label>
          </div>
        )}

        {/* ── Navigation buttons ── */}
        <div className="flex gap-3 mt-8">
          {step > 1 && (
            <button type="button" onClick={() => { setStep(s => s - 1); setError(''); }}
              className="flex-1 py-3 rounded-lg text-sm font-semibold border"
              style={{ borderColor: '#E8E0D8', color: '#8B8B8B' }}>
              ← Back
            </button>
          )}
          {step < 6 ? (
            <button type="button" onClick={handleNext}
              className="flex-1 py-3 rounded-lg text-white text-sm font-semibold"
              style={{ backgroundColor: '#E56717' }}>
              Next →
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={submitting}
              className="flex-1 py-3 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: '#E56717' }}>
              {submitting ? 'Submitting...' : 'Submit Registration'}
            </button>
          )}
        </div>

        {/* Back to login */}
        <p className="text-center text-sm mt-6" style={{ color: '#8B8B8B' }}>
          Already registered?{' '}
          <span onClick={() => navigate('/login')} className="cursor-pointer font-semibold"
            style={{ color: '#E56717' }}>Sign in</span>
        </p>
      </div>
    </div>
  );
}
