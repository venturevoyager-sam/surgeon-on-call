/**
 * HOSPITAL SIGNUP PAGE - Hospital Web App
 * Surgeon on Call (OPC) Pvt Ltd
 *
 * Self-registration form for new hospitals to join the platform.
 * Submits to POST /api/hospitals/register which creates:
 *   - A Supabase Auth user (email + password) for login
 *   - A hospitals table row (verified: false, pending admin approval)
 *   - An email notification to the admin team
 *
 * Includes an embedded OpenStreetMap + Leaflet map with a draggable marker
 * for capturing the hospital's lat/lng. Uses Nominatim reverse geocoding
 * (free, no API key) to display the location name.
 *
 * Layout matches Login.js: split panel on desktop, single column on mobile.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../lib/config';

// ── Leaflet imports for the location picker map ──────────────────────────────
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ── Fix Leaflet default marker icon (broken in React bundlers) ───────────────
// Without this fix, the default marker icon doesn't load because Webpack
// doesn't resolve Leaflet's internal icon URL correctly.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Hospital type options ────────────────────────────────────────────────────
const HOSPITAL_TYPES = [
  { value: 'private',      label: 'Private' },
  { value: 'corporate',    label: 'Corporate' },
  { value: 'nursing_home', label: 'Nursing Home' },
  { value: 'clinic',       label: 'Clinic' },
];

// ── Default map center: Hyderabad ────────────────────────────────────────────
const DEFAULT_LAT = 17.385;
const DEFAULT_LNG = 78.4867;


// ── DRAGGABLE MARKER COMPONENT ───────────────────────────────────────────────
// Renders a draggable Leaflet marker. On drag end and on map click, updates
// the parent's lat/lng via the onPositionChange callback.
function DraggableMarker({ position, onPositionChange }) {
  const markerRef = useRef(null);

  // Listen for map clicks to reposition the marker
  useMapEvents({
    click(e) {
      onPositionChange(e.latlng.lat, e.latlng.lng);
    },
  });

  return (
    <Marker
      position={position}
      draggable
      ref={markerRef}
      eventHandlers={{
        dragend() {
          const marker = markerRef.current;
          if (marker) {
            const { lat, lng } = marker.getLatLng();
            onPositionChange(lat, lng);
          }
        },
      }}
    />
  );
}


// ── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function HospitalSignup() {
  const navigate = useNavigate();

  // ── STATE ──────────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    name:          '',
    address:       '',
    city:          '',
    bed_count:     '',
    hospital_type: '',
    contact_name:  '',
    contact_email: '',
    contact_phone: '',
    password:      '',
  });

  // Map / location state
  const [lat, setLat]                   = useState(DEFAULT_LAT);
  const [lng, setLng]                   = useState(DEFAULT_LNG);
  const [locationName, setLocationName] = useState('');

  // Geolocation state — for the "Use my current location" button
  const [geoLoading, setGeoLoading] = useState(false);  // true while fetching position
  const [geoError, setGeoError]     = useState('');      // error message if geolocation fails

  // Form submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]          = useState('');
  const [success, setSuccess]      = useState(false);

  // Field-level errors
  const [fieldErrors, setFieldErrors] = useState({});

  // ── REVERSE GEOCODE — fetch location name when pin moves ──────────────────
  // Uses Nominatim (free, no API key required). Debounced slightly via
  // useEffect dependency — fires whenever lat/lng changes.
  useEffect(() => {
    const controller = new AbortController();

    const fetchLocationName = async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
          {
            signal: controller.signal,
            headers: { 'Accept-Language': 'en' },
          }
        );
        const data = await res.json();
        setLocationName(data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setLocationName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
      }
    };

    fetchLocationName();
    return () => controller.abort();
  }, [lat, lng]);

  // ── FORM HANDLERS ──────────────────────────────────────────────────────────
  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // ── USE MY CURRENT LOCATION ─────────────────────────────────────────────
  // Calls the browser's Geolocation API to detect the user's current position.
  // On success: moves the map marker to the detected coordinates, which triggers
  // the existing useEffect to reverse-geocode the location name via Nominatim.
  // On failure: shows a subtle error message prompting manual pin placement.
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser. Please pin manually.');
      return;
    }

    setGeoLoading(true);
    setGeoError('');

    navigator.geolocation.getCurrentPosition(
      // Success callback — browser provided coordinates
      (position) => {
        const { latitude, longitude } = position.coords;
        setLat(latitude);
        setLng(longitude);
        // The useEffect on [lat, lng] will automatically trigger
        // Nominatim reverse geocoding to resolve the location name.
        setGeoLoading(false);
      },
      // Error callback — user denied or browser failed
      (err) => {
        console.error('Geolocation error:', err.message);
        setGeoError('Could not detect location. Please pin manually.');
        setGeoLoading(false);
      },
      // Options — timeout after 10 seconds, request high accuracy
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handlePinMove = (newLat, newLng) => {
    setLat(newLat);
    setLng(newLng);
  };

  // ── VALIDATION ─────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.name.trim())          e.name          = 'Hospital name is required';
    if (!form.address.trim())       e.address       = 'Address is required';
    if (!form.city.trim())          e.city          = 'City is required';
    if (!form.bed_count || Number(form.bed_count) < 1)
                                    e.bed_count     = 'Enter a valid bed count';
    if (!form.hospital_type)        e.hospital_type = 'Select a hospital type';
    if (!form.contact_name.trim())  e.contact_name  = 'Contact name is required';
    if (!form.contact_email.trim()) e.contact_email = 'Contact email is required';
    if (!form.contact_phone.trim()) e.contact_phone = 'Contact phone is required';
    if (!form.password || form.password.length < 6)
                                    e.password      = 'Password must be at least 6 characters';
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── SUBMIT ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validate()) return;

    setSubmitting(true);

    try {
      await axios.post(`${API_URL}/api/hospitals/register`, {
        name:          form.name.trim(),
        address:       form.address.trim(),
        city:          form.city.trim(),
        lat,
        lng,
        bed_count:     Number(form.bed_count),
        hospital_type: form.hospital_type,
        contact_name:  form.contact_name.trim(),
        contact_email: form.contact_email.trim(),
        contact_phone: form.contact_phone.trim(),
        password:      form.password,
      });

      setSuccess(true);

    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };


  // ── SUCCESS STATE ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ backgroundColor: '#FDF8F5', fontFamily: '"DM Sans", ui-sans-serif, sans-serif' }}
      >
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">✅</div>
          <h2 style={{ color: '#444444', fontSize: '22px', fontWeight: '700', marginBottom: '12px' }}>
            Registration Submitted
          </h2>
          <p style={{ color: '#8B8B8B', fontSize: '14px', lineHeight: '1.7' }}>
            Our team will verify your account within 24 hours.
            For queries contact{' '}
            <a
              href="mailto:shivatadakamalla.soc@gmail.com"
              style={{ color: '#E56717', fontWeight: '600' }}
            >
              shivatadakamalla.soc@gmail.com
            </a>
          </p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary mt-6"
            style={{ padding: '12px 32px', fontSize: '14px' }}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }


  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex min-h-screen"
      style={{ fontFamily: '"DM Sans", ui-sans-serif, sans-serif' }}
    >

      {/* ════════════════════════════════════════════════════════════════════
          LEFT PANEL — Brand identity (matches Login.js exactly)
      ════════════════════════════════════════════════════════════════════ */}
      <div
        className="hidden md:flex flex-col justify-between"
        style={{
          width: '42%',
          background: 'linear-gradient(145deg, #3d3330 0%, #444444 55%, #3a3a3a 100%)',
          padding: '48px 44px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative circles */}
        <div style={{
          position: 'absolute', top: '-80px', right: '-80px',
          width: '280px', height: '280px', borderRadius: '50%',
          backgroundColor: 'rgba(229,103,23,0.08)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-60px', left: '-60px',
          width: '200px', height: '200px', borderRadius: '50%',
          backgroundColor: 'rgba(229,103,23,0.06)', pointerEvents: 'none',
        }} />

        {/* Logo + company */}
        <div>
          <img
            src="/logo.png"
            alt="Surgeon on Call"
            style={{ height: '52px', width: 'auto', objectFit: 'contain' }}
            onError={(e) => {
              e.target.style.display = 'none';
              document.getElementById('left-brand-fallback-signup').style.display = 'block';
            }}
          />
          <h1
            id="left-brand-fallback-signup"
            style={{ display: 'none', color: '#fff', fontSize: '22px', fontWeight: '700' }}
          >
            Surgeon <span style={{ color: '#E56717' }}>on Call</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '10px' }}>
            Surgeon on Call
          </p>
        </div>

        {/* Tagline */}
        <div>
          <h2 style={{
            color: '#ffffff', fontSize: '26px', fontWeight: '700',
            lineHeight: '1.35', letterSpacing: '-0.02em', marginBottom: '14px',
          }}>
            Register your hospital<br />
            <span style={{ color: '#E56717' }}>and start posting cases.</span>
          </h2>
          <p style={{
            color: 'rgba(255,255,255,0.45)', fontSize: '14px',
            lineHeight: '1.7', maxWidth: '280px',
          }}>
            Join our network of hospitals and get matched with
            verified surgeons in minutes.
          </p>
        </div>

        {/* Trust signals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            'Free registration, no setup fees',
            'Verified surgeon credentials',
            'Dedicated ops team support',
          ].map((text) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                backgroundColor: 'rgba(229,103,23,0.2)',
                color: '#E56717', fontSize: '11px', fontWeight: '700',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✓</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                {text}
              </span>
            </div>
          ))}
        </div>
      </div>


      {/* ════════════════════════════════════════════════════════════════════
          RIGHT PANEL — Registration form
          Warm cream background, scrollable
      ════════════════════════════════════════════════════════════════════ */}
      <div
        className="flex-1 overflow-y-auto px-8 py-12"
        style={{ backgroundColor: '#FDF8F5' }}
      >
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>

          {/* Mobile-only logo */}
          <div className="flex justify-center mb-8 md:hidden">
            <img
              src="/logo.png"
              alt="Surgeon on Call"
              style={{ height: '44px', width: 'auto', objectFit: 'contain' }}
              onError={(e) => e.target.style.display = 'none'}
            />
          </div>

          {/* Heading */}
          <div style={{ marginBottom: '28px' }}>
            <h1 style={{
              fontSize: '24px', fontWeight: '700',
              color: '#444444', letterSpacing: '-0.02em', marginBottom: '6px',
            }}>
              Hospital Registration
            </h1>
            <p style={{ color: '#8B8B8B', fontSize: '14px' }}>
              Fill in your details below. We'll verify your account within 24 hours.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              marginBottom: '18px', padding: '11px 14px',
              backgroundColor: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: '8px', color: '#DC2626', fontSize: '13px',
            }}>
              {error}
            </div>
          )}

          {/* ── FORM ── */}
          <form onSubmit={handleSubmit} noValidate>

            {/* Hospital Name */}
            <FormField label="Hospital Name *" error={fieldErrors.name}>
              <input
                type="text"
                value={form.name}
                onChange={e => handleChange('name', e.target.value)}
                placeholder="e.g. Apollo Hospital, Jubilee Hills"
                className="input-field"
                style={{ fontSize: '14px' }}
              />
            </FormField>

            {/* Address */}
            <FormField label="Address *" error={fieldErrors.address}>
              <input
                type="text"
                value={form.address}
                onChange={e => handleChange('address', e.target.value)}
                placeholder="Full street address"
                className="input-field"
                style={{ fontSize: '14px' }}
              />
            </FormField>

            {/* City + Bed Count (side by side) */}
            <div className="grid grid-cols-2 gap-4">
              <FormField label="City *" error={fieldErrors.city}>
                <input
                  type="text"
                  value={form.city}
                  onChange={e => handleChange('city', e.target.value)}
                  placeholder="e.g. Hyderabad"
                  className="input-field"
                  style={{ fontSize: '14px' }}
                />
              </FormField>

              <FormField label="Bed Count *" error={fieldErrors.bed_count}>
                <input
                  type="number"
                  value={form.bed_count}
                  onChange={e => handleChange('bed_count', e.target.value)}
                  placeholder="e.g. 200"
                  min="1"
                  className="input-field"
                  style={{ fontSize: '14px' }}
                />
              </FormField>
            </div>

            {/* Hospital Type */}
            <FormField label="Hospital Type *" error={fieldErrors.hospital_type}>
              <select
                value={form.hospital_type}
                onChange={e => handleChange('hospital_type', e.target.value)}
                className="input-field"
                style={{ fontSize: '14px' }}
              >
                <option value="">Select type...</option>
                {HOSPITAL_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </FormField>

            {/* ── Location Map ────────────────────────────────────────────────
                OpenStreetMap + Leaflet with a draggable pin.
                Click or drag to set the hospital's exact location.
                Reverse geocoded name shown below the map.
            ──────────────────────────────────────────────────────────────── */}
            <div style={{ marginBottom: '18px' }}>
              <label className="form-label">Hospital Location (drag pin or click map)</label>

              {/* ── "Use my current location" button ──────────────────────────
                  Calls browser Geolocation API to auto-detect coordinates.
                  Shows loading state while detecting, error if denied/failed.
              ──────────────────────────────────────────────────────────────── */}
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={geoLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  marginBottom: '8px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E8E0D8',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: geoLoading ? '#8B8B8B' : '#E56717',
                  cursor: geoLoading ? 'wait' : 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => { if (!geoLoading) e.currentTarget.style.borderColor = '#E56717'; }}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#E8E0D8'}
              >
                <span style={{ fontSize: '16px' }}>{geoLoading ? '...' : '📍'}</span>
                {geoLoading ? 'Detecting location...' : 'Use my current location'}
              </button>

              {/* Geolocation error message — shown when detection fails */}
              {geoError && (
                <p style={{ color: '#DC2626', fontSize: '12px', marginBottom: '6px' }}>
                  {geoError}
                </p>
              )}

              <div
                style={{
                  borderRadius: '10px',
                  overflow: 'hidden',
                  border: '1px solid #E8E0D8',
                  height: '220px',
                }}
              >
                <MapContainer
                  center={[lat, lng]}
                  zoom={12}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <DraggableMarker
                    position={[lat, lng]}
                    onPositionChange={handlePinMove}
                  />
                </MapContainer>
              </div>
              {/* Show resolved location name below the map */}
              {locationName && (
                <p style={{ color: '#8B8B8B', fontSize: '12px', marginTop: '6px' }}>
                  {locationName}
                </p>
              )}
            </div>

            {/* ── Contact Details Section ── */}
            <div style={{
              marginTop: '8px', marginBottom: '8px', paddingTop: '16px',
              borderTop: '1px solid #E8E0D8',
            }}>
              <p style={{
                fontSize: '11px', fontWeight: '700', color: '#8B8B8B',
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px',
              }}>
                Contact Person
              </p>
            </div>

            {/* Contact Name */}
            <FormField label="Name *" error={fieldErrors.contact_name}>
              <input
                type="text"
                value={form.contact_name}
                onChange={e => handleChange('contact_name', e.target.value)}
                placeholder="Hospital SPOC name"
                className="input-field"
                style={{ fontSize: '14px' }}
              />
            </FormField>

            {/* Contact Email + Phone (side by side) */}
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Email *" error={fieldErrors.contact_email}>
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={e => handleChange('contact_email', e.target.value)}
                  placeholder="spoc@hospital.com"
                  className="input-field"
                  style={{ fontSize: '14px' }}
                />
              </FormField>

              <FormField label="Phone *" error={fieldErrors.contact_phone}>
                <input
                  type="tel"
                  value={form.contact_phone}
                  onChange={e => handleChange('contact_phone', e.target.value)}
                  placeholder="10-digit number"
                  className="input-field"
                  style={{ fontSize: '14px' }}
                />
              </FormField>
            </div>

            {/* Password */}
            <FormField label="Password *" error={fieldErrors.password}>
              <input
                type="password"
                value={form.password}
                onChange={e => handleChange('password', e.target.value)}
                placeholder="Min 6 characters"
                className="input-field"
                style={{ fontSize: '14px' }}
              />
            </FormField>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full"
              style={{ padding: '13px', fontSize: '15px', marginTop: '8px' }}
            >
              {submitting ? 'Submitting...' : 'Register Hospital'}
            </button>

          </form>

          {/* Back to login link */}
          <p style={{
            marginTop: '24px', textAlign: 'center',
            fontSize: '14px', color: '#8B8B8B',
          }}>
            Already registered?{' '}
            <span
              onClick={() => navigate('/')}
              style={{ color: '#E56717', fontWeight: '600', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
              onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
            >
              Sign in
            </span>
          </p>

        </div>
      </div>

    </div>
  );
}


// ── REUSABLE FORM FIELD WRAPPER ──────────────────────────────────────────────
// Renders a label + children (input/select) + optional error message.
// Matches the spacing pattern used in Login.js.
function FormField({ label, error, children }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label className="form-label">{label}</label>
      {children}
      {error && (
        <p style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px' }}>
          {error}
        </p>
      )}
    </div>
  );
}
