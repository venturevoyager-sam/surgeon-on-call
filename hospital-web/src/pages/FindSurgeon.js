/**
 * FIND A SURGEON PAGE — Hospital Web App
 * Vaidhya Healthcare Pvt Ltd
 *
 * Allows the hospital SPOC to:
 * 1. Browse all verified surgeons on the platform
 * 2. Filter by specialty, city, availability
 * 3. Search by name
 * 4. View surgeon cards (photo, name, specialty, rating, experience, bio)
 * 5. Click "Book This Surgeon" → creates a draft case with surgeon pre-assigned
 * 6. Redirected to EditCase page to fill in the case details
 *
 * Flow:
 *   POST /api/cases/draft  →  { case_id }  →  navigate to /cases/:id/edit
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

// All specialties available on the platform
const SPECIALTIES = [
  'All Specialties',
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

export default function FindSurgeon() {
  const navigate = useNavigate();

  // ── STATE ──────────────────────────────────────────────────────────────────
  const [hospital,    setHospital]    = useState(null);
  const [surgeons,    setSurgeons]    = useState([]);
  const [filtered,    setFiltered]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [booking,     setBooking]     = useState(null); // surgeon ID being booked

  // Filters
  const [search,       setSearch]      = useState('');
  const [specialty,    setSpecialty]   = useState('All Specialties');
  const [availOnly,    setAvailOnly]   = useState(false);

  // ── LOAD HOSPITAL + SURGEONS ───────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      // DEV MODE
      const devEmail = 'venturevoyager.sam@gmail.com';
      const { data: hosp } = await supabase
        .from('hospitals')
        .select('*')
        .eq('contact_email', devEmail)
        .single();
      setHospital(hosp);

      // Fetch all verified surgeons
      const { data: surgs } = await supabase
        .from('surgeons')
        .select('id, name, specialty, city, rating, experience_years, bio, profile_photo_url, available, verified')
        .eq('verified', true)
        .eq('status', 'active')
        .order('rating', { ascending: false });

      setSurgeons(surgs || []);
      setFiltered(surgs || []);
      setLoading(false);
    };
    load();
  }, []);

  // ── APPLY FILTERS ──────────────────────────────────────────────────────────
  useEffect(() => {
    let result = [...surgeons];

    // Name search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.bio?.toLowerCase().includes(q)
      );
    }

    // Specialty filter
    if (specialty !== 'All Specialties') {
      result = result.filter(s =>
        Array.isArray(s.specialty) && s.specialty.includes(specialty)
      );
    }

    // Available only
    if (availOnly) {
      result = result.filter(s => s.available);
    }

    setFiltered(result);
  }, [search, specialty, availOnly, surgeons]);

  // ── BOOK SURGEON ───────────────────────────────────────────────────────────
  // Creates a draft case with the surgeon pre-assigned.
  // All other fields are empty — hospital fills them in on the EditCase page.
  const handleBook = async (surgeon) => {
    if (!hospital) return;
    setBooking(surgeon.id);

    try {
      const response = await axios.post(`${API_URL}/api/cases/draft`, {
        hospital_id:          hospital.id,
        pre_assigned_surgeon: surgeon.id,
      });

      const caseId = response.data.case.id;
      console.log('Draft case created:', caseId);

      // Navigate to the edit page to fill in case details
      navigate(`/cases/${caseId}/edit`, {
        state: { surgeon }  // pass surgeon info so EditCase can show who was booked
      });

    } catch (err) {
      console.error('Failed to create draft case:', err.message);
      alert('Could not book this surgeon. Please try again.');
    } finally {
      setBooking(null);
    }
  };

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
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/new-request')}
            className="btn-secondary px-4 py-2 text-sm"
          >
            + New Request
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-ghost text-gray-400 hover:text-brand text-sm"
          >
            ← Dashboard
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* ── PAGE HEADING ── */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-body">Find a Surgeon</h2>
          <p className="text-muted text-sm mt-1">
            Browse our verified surgeon network. Book directly and fill in case details later.
          </p>
        </div>

        {/* ── FILTERS ── */}
        <div
          className="bg-white rounded-xl mb-6 p-4"
          style={{ border: '1px solid #E8E0D8', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}
        >
          {/* Search */}
          <div style={{ flex: '1', minWidth: '200px', position: 'relative' }}>
            <span style={{
              position: 'absolute', left: '12px', top: '50%',
              transform: 'translateY(-50%)', color: '#8B8B8B', fontSize: '14px',
            }}>🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or specialty..."
              className="input-field"
              style={{ paddingLeft: '36px', fontSize: '14px' }}
            />
          </div>

          {/* Specialty */}
          <select
            value={specialty}
            onChange={e => setSpecialty(e.target.value)}
            className="input-field"
            style={{ width: 'auto', minWidth: '180px', fontSize: '14px' }}
          >
            {SPECIALTIES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Available only toggle */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: '13px', color: '#444', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            <input
              type="checkbox"
              checked={availOnly}
              onChange={e => setAvailOnly(e.target.checked)}
              style={{ accentColor: '#E56717', width: '16px', height: '16px' }}
            />
            Available now only
          </label>

          {/* Result count */}
          <span style={{ fontSize: '12px', color: '#8B8B8B', whiteSpace: 'nowrap' }}>
            {filtered.length} surgeon{filtered.length !== 1 ? 's' : ''} found
          </span>
        </div>

        {/* ── SURGEON GRID ── */}
        {loading ? (
          <div className="text-center py-20 text-muted">Loading surgeons...</div>

        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">👨‍⚕️</p>
            <p className="font-medium text-body">No surgeons match your filters</p>
            <p className="text-muted text-sm mt-1">Try clearing the specialty filter or search</p>
          </div>

        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px',
          }}>
            {filtered.map(surgeon => (
              <SurgeonCard
                key={surgeon.id}
                surgeon={surgeon}
                booking={booking === surgeon.id}
                onBook={() => handleBook(surgeon)}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

// ── SURGEON CARD ───────────────────────────────────────────────────────────────
function SurgeonCard({ surgeon, booking, onBook }) {
  // Get initials for avatar fallback
  const initials = surgeon.name
    .split(' ').slice(1, 3).map(n => n[0]).join('').toUpperCase();

  return (
    <div style={{
      backgroundColor: '#ffffff',
      border: '1px solid #E8E0D8',
      borderRadius: '14px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      boxShadow: '0 1px 4px rgba(68,44,20,0.06)',
      transition: 'box-shadow 0.15s',
      fontFamily: '"DM Sans", sans-serif',
    }}
    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(68,44,20,0.1)'}
    onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(68,44,20,0.06)'}
    >

      {/* Top row: avatar + name + availability */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>

        {/* Avatar */}
        <div style={{
          width: '52px', height: '52px', borderRadius: '12px',
          backgroundColor: '#444444', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {surgeon.profile_photo_url ? (
            <img
              src={surgeon.profile_photo_url}
              alt={surgeon.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { e.target.style.display = 'none'; }}
            />
          ) : (
            <span style={{ color: '#E56717', fontSize: '16px', fontWeight: '700' }}>
              {initials}
            </span>
          )}
        </div>

        {/* Name + city */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: '700', fontSize: '15px', color: '#444', lineHeight: 1.3 }}>
            {surgeon.name}
          </p>
          <p style={{ fontSize: '12px', color: '#8B8B8B', marginTop: '2px' }}>
            📍 {surgeon.city}
          </p>
        </div>

        {/* Availability dot */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          fontSize: '11px', fontWeight: '600',
          color: surgeon.available ? '#16a34a' : '#8B8B8B',
          flexShrink: 0,
        }}>
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%',
            backgroundColor: surgeon.available ? '#16a34a' : '#D1D5DB',
          }} />
          {surgeon.available ? 'Available' : 'Unavailable'}
        </div>
      </div>

      {/* Specialties */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {(surgeon.specialty || []).map(s => (
          <span key={s} style={{
            padding: '3px 10px',
            backgroundColor: '#FDF8F5',
            border: '1px solid #E8E0D8',
            borderRadius: '999px',
            fontSize: '11px', fontWeight: '600', color: '#E56717',
          }}>
            {s}
          </span>
        ))}
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex', gap: '16px',
        padding: '10px 14px',
        backgroundColor: '#FDF8F5',
        borderRadius: '10px',
        border: '1px solid #E8E0D8',
      }}>
        <Stat label="Rating"     value={`⭐ ${surgeon.rating || '—'}`} />
        <Stat label="Experience" value={`${surgeon.experience_years || 0} yrs`} />
      </div>

      {/* Bio */}
      {surgeon.bio && (
        <p style={{
          fontSize: '12px', color: '#8B8B8B',
          lineHeight: '1.6',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {surgeon.bio}
        </p>
      )}

      {/* Book button */}
      <button
        onClick={onBook}
        disabled={booking}
        style={{
          width: '100%',
          padding: '10px',
          backgroundColor: booking ? '#e8a070' : '#E56717',
          color: '#ffffff',
          fontWeight: '600', fontSize: '14px',
          borderRadius: '10px', border: 'none',
          cursor: booking ? 'not-allowed' : 'pointer',
          fontFamily: '"DM Sans", sans-serif',
          transition: 'background-color 0.15s',
          marginTop: '4px',
        }}
        onMouseEnter={e => { if (!booking) e.target.style.backgroundColor = '#CD4D00'; }}
        onMouseLeave={e => { if (!booking) e.target.style.backgroundColor = '#E56717'; }}
      >
        {booking ? 'Booking...' : 'Book This Surgeon →'}
      </button>

    </div>
  );
}

// Small stat item inside the stats row
function Stat({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
      <span style={{ fontSize: '10px', color: '#8B8B8B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{ fontSize: '13px', fontWeight: '700', color: '#444' }}>
        {value}
      </span>
    </div>
  );
}