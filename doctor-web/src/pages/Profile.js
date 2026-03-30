/**
 * PROFILE PAGE — Doctor Web
 * Four editable sections: Personal, Credentials, Location & Availability, Documents.
 * Password change section at the bottom.
 * Saves via PATCH /api/surgeons/:id/profile.
 */

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getSurgeonId } from '../lib/auth';
import { supabase, STORAGE_BUCKET } from '../lib/supabase';

import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const API_URL = process.env.REACT_APP_API_URL;

function DraggableMarker({ position, onMove }) {
  const ref = useRef(null);
  useMapEvents({ click(e) { onMove(e.latlng.lat, e.latlng.lng); } });
  return <Marker position={position} draggable ref={ref}
    eventHandlers={{ dragend() { const m=ref.current; if(m){const{lat,lng}=m.getLatLng();onMove(lat,lng);} } }} />;
}

export default function Profile() {
  const surgeonId = getSurgeonId();

  const [surgeon, setSurgeon]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saveMsg, setSaveMsg]       = useState('');
  const [specialties, setSpecialties] = useState([]);
  const [specSearch, setSpecSearch] = useState('');

  // Password change
  const [pwForm, setPwForm]     = useState({ current: '', new_pw: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg]       = useState('');

  // Upload states
  const [uploading, setUploading] = useState({});

  // Editable form — populated from fetched surgeon data
  const [form, setForm] = useState({});

  useEffect(() => {
    Promise.all([
      axios.get(`${API_URL}/api/surgeons/${surgeonId}`),
      axios.get(`${API_URL}/api/specialties`),
    ]).then(([profRes, specRes]) => {
      const s = profRes.data.surgeon;
      setSurgeon(s);
      setForm({
        name: s.name || '', city: s.city || '', bio: s.bio || '',
        communication_preference: s.communication_preference || '',
        practice_type: s.practice_type || '',
        hospital_affiliations: s.hospital_affiliations || '',
        experience_years: s.experience_years || '',
        specialty: s.specialty || [],
        mci_number: s.mci_number || '',
        ug_college: s.ug_college || '',
        pg_college: s.pg_college || '',
        highest_qualification: s.highest_qualification || '',
        key_procedures: s.key_procedures || '',
        preferred_lat: s.preferred_lat || 17.385,
        preferred_lng: s.preferred_lng || 78.4867,
        preferred_location_name: s.preferred_location_name || '',
        travel_radius_km: s.travel_radius_km || 10,
        open_to_teleconsultation: s.open_to_teleconsultation || false,
        open_to_emergency: s.open_to_emergency || false,
        open_to_physical_visits: s.open_to_physical_visits || false,
        avg_hourly_rate_rupees: s.avg_hourly_rate ? s.avg_hourly_rate / 100 : '',
        available: s.available || false,
      });
      setSpecialties(specRes.data.specialties || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [surgeonId]);

  const set = (field, value) => setForm(p => ({ ...p, [field]: value }));

  const toggleSpec = (name) => {
    setForm(p => ({
      ...p,
      specialty: p.specialty.includes(name) ? p.specialty.filter(s => s !== name) : [...p.specialty, name],
    }));
  };

  // Save profile
  const handleSave = async () => {
    setSaving(true); setSaveMsg('');
    try {
      await axios.patch(`${API_URL}/api/surgeons/${surgeonId}/profile`, {
        name: form.name, city: form.city, bio: form.bio,
        communication_preference: form.communication_preference,
        practice_type: form.practice_type,
        hospital_affiliations: form.hospital_affiliations,
        experience_years: Number(form.experience_years) || 0,
        specialty: form.specialty,
        mci_number: form.mci_number,
        ug_college: form.ug_college, pg_college: form.pg_college,
        highest_qualification: form.highest_qualification,
        key_procedures: form.key_procedures,
        preferred_lat: form.preferred_lat, preferred_lng: form.preferred_lng,
        preferred_location_name: form.preferred_location_name,
        travel_radius_km: form.travel_radius_km,
        open_to_teleconsultation: form.open_to_teleconsultation,
        open_to_emergency: form.open_to_emergency,
        open_to_physical_visits: form.open_to_physical_visits,
        avg_hourly_rate: form.avg_hourly_rate_rupees ? Number(form.avg_hourly_rate_rupees) * 100 : null,
      });
      setSaveMsg('Profile saved');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveMsg('Failed to save');
    } finally { setSaving(false); }
  };

  // Upload file
  const uploadFile = async (file, field) => {
    setUploading(p => ({ ...p, [field]: true }));
    try {
      const path = `${surgeonId}_${field}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { cacheControl:'3600', upsert:false });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);
      // Save URL to profile immediately
      await axios.patch(`${API_URL}/api/surgeons/${surgeonId}/profile`, { [field]: urlData.publicUrl });
      setForm(p => ({ ...p, [field]: urlData.publicUrl }));
      setSurgeon(p => ({ ...p, [field]: urlData.publicUrl }));
    } catch (err) { console.error(`Upload failed:`, err); }
    finally { setUploading(p => ({ ...p, [field]: false })); }
  };

  // Password change
  const handlePasswordChange = async () => {
    if (!pwForm.current || !pwForm.new_pw) { setPwMsg('Both fields required'); return; }
    setPwSaving(true); setPwMsg('');
    try {
      await axios.patch(`${API_URL}/api/surgeons/${surgeonId}/password`, {
        current_password: pwForm.current, new_password: pwForm.new_pw,
      });
      setPwMsg('Password updated'); setPwForm({ current: '', new_pw: '' });
    } catch (err) {
      setPwMsg(err.response?.data?.message || 'Failed');
    } finally { setPwSaving(false); }
  };

  // Reverse geocode
  useEffect(() => {
    if (!form.preferred_lat) return;
    const ctrl = new AbortController();
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${form.preferred_lat}&lon=${form.preferred_lng}&format=json`,
      { signal: ctrl.signal, headers: { 'Accept-Language': 'en' } })
      .then(r => r.json())
      .then(d => set('preferred_location_name', d.display_name || ''))
      .catch(() => {});
    return () => ctrl.abort();
  }, [form.preferred_lat, form.preferred_lng]);

  if (loading) return <div className="p-8 text-center" style={{ color: '#8B8B8B' }}>Loading...</div>;

  const inputCls = "w-full px-4 py-2.5 rounded-lg text-sm border focus:outline-none focus:border-orange-400";
  const inputStyle = { borderColor: '#E8E0D8', color: '#444444' };
  const labelCls = "block text-xs font-semibold mb-1";
  const labelStyle = { color: '#8B8B8B' };
  const sectionCls = "bg-white rounded-xl p-5 mb-4";
  const sectionStyle = { border: '1px solid #E8E0D8' };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: '#444444' }}>Profile</h1>
        <div className="flex items-center gap-3">
          {saveMsg && <span className="text-sm" style={{ color: saveMsg.includes('Failed') ? '#DC2626' : '#16a34a' }}>{saveMsg}</span>}
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: '#E56717' }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* ── Personal ── */}
      <div className={sectionCls} style={sectionStyle}>
        <h3 className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: '#E56717' }}>Personal</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelCls} style={labelStyle}>Name</label>
            <input className={inputCls} style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>City</label>
            <input className={inputCls} style={inputStyle} value={form.city} onChange={e => set('city', e.target.value)} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Communication Pref</label>
            <select className={inputCls} style={inputStyle} value={form.communication_preference} onChange={e => set('communication_preference', e.target.value)}>
              <option value="">Select...</option>
              {['Phone Call','WhatsApp','Email'].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelCls} style={labelStyle}>Bio</label>
            <textarea className={inputCls} style={{ ...inputStyle, minHeight:'80px' }} value={form.bio} onChange={e => set('bio', e.target.value)} />
          </div>
        </div>
      </div>

      {/* ── Credentials ── */}
      <div className={sectionCls} style={sectionStyle}>
        <h3 className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: '#E56717' }}>Credentials</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls} style={labelStyle}>MCI Number</label>
            <input className={inputCls} style={inputStyle} value={form.mci_number} onChange={e => set('mci_number', e.target.value)} /></div>
          <div><label className={labelCls} style={labelStyle}>Highest Qualification</label>
            <input className={inputCls} style={inputStyle} value={form.highest_qualification} onChange={e => set('highest_qualification', e.target.value)} /></div>
          <div><label className={labelCls} style={labelStyle}>UG College</label>
            <input className={inputCls} style={inputStyle} value={form.ug_college} onChange={e => set('ug_college', e.target.value)} /></div>
          <div><label className={labelCls} style={labelStyle}>PG College</label>
            <input className={inputCls} style={inputStyle} value={form.pg_college} onChange={e => set('pg_college', e.target.value)} /></div>
          <div><label className={labelCls} style={labelStyle}>Experience (years)</label>
            <input className={inputCls} style={inputStyle} type="number" value={form.experience_years} onChange={e => set('experience_years', e.target.value)} /></div>
          <div><label className={labelCls} style={labelStyle}>Practice Type</label>
            <select className={inputCls} style={inputStyle} value={form.practice_type} onChange={e => set('practice_type', e.target.value)}>
              <option value="">Select...</option>
              {['Full-time Consultant','Visiting Consultant','Freelance','Independent','Academic','Other'].map(t => <option key={t}>{t}</option>)}
            </select></div>
        </div>
        {/* Specialty multi-select */}
        <div className="mt-3">
          <label className={labelCls} style={labelStyle}>Specialties</label>
          <input className={inputCls} style={inputStyle} placeholder="Search..." value={specSearch} onChange={e => setSpecSearch(e.target.value)} />
          <div className="flex flex-wrap gap-1.5 mt-2 max-h-32 overflow-y-auto">
            {specialties.filter(s => s.name.toLowerCase().includes(specSearch.toLowerCase())).map(s => (
              <button key={s.id} type="button" onClick={() => toggleSpec(s.name)}
                className="px-3 py-1 rounded-full text-xs border"
                style={{ borderColor: form.specialty.includes(s.name)?'#E56717':'#E8E0D8',
                  backgroundColor: form.specialty.includes(s.name)?'#E56717':'#fff',
                  color: form.specialty.includes(s.name)?'#fff':'#444' }}>
                {s.name}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <label className={labelCls} style={labelStyle}>Key Procedures</label>
          <textarea className={inputCls} style={{ ...inputStyle, minHeight:'60px' }} value={form.key_procedures} onChange={e => set('key_procedures', e.target.value)} />
        </div>
      </div>

      {/* ── Location & Availability ── */}
      <div className={sectionCls} style={sectionStyle}>
        <h3 className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: '#E56717' }}>Location & Availability</h3>
        <div style={{ borderRadius:'10px', overflow:'hidden', border:'1px solid #E8E0D8', height:'180px', marginBottom:'10px' }}>
          <MapContainer center={[form.preferred_lat, form.preferred_lng]} zoom={12} style={{ height:'100%', width:'100%' }} scrollWheelZoom>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <DraggableMarker position={[form.preferred_lat, form.preferred_lng]}
              onMove={(lat,lng) => { set('preferred_lat',lat); set('preferred_lng',lng); }} />
          </MapContainer>
        </div>
        {form.preferred_location_name && <p className="text-xs mb-3" style={{ color:'#8B8B8B' }}>{form.preferred_location_name}</p>}

        <label className={labelCls} style={labelStyle}>Travel Radius: {form.travel_radius_km} km</label>
        <input type="range" min="1" max="100" value={form.travel_radius_km} onChange={e => set('travel_radius_km', Number(e.target.value))}
          className="w-full mb-3" style={{ accentColor:'#E56717' }} />

        {[['open_to_teleconsultation','Teleconsultation'],['open_to_emergency','Emergency calls'],['open_to_physical_visits','Physical visits']].map(([f,l]) => (
          <div key={f} className="flex items-center justify-between py-2" style={{ borderBottom:'1px solid #E8E0D8' }}>
            <span className="text-sm" style={{ color:'#444' }}>{l}</span>
            <button type="button" onClick={() => set(f, !form[f])} className="w-11 h-6 rounded-full relative"
              style={{ backgroundColor: form[f]?'#E56717':'#E8E0D8' }}>
              <span className="block w-5 h-5 bg-white rounded-full absolute top-0.5" style={{ left: form[f]?'22px':'2px' }} />
            </button>
          </div>
        ))}

        <div className="mt-3">
          <label className={labelCls} style={labelStyle}>Preferred Fee (₹/hr)</label>
          <input className={inputCls} style={inputStyle} type="number" value={form.avg_hourly_rate_rupees}
            onChange={e => set('avg_hourly_rate_rupees', e.target.value)} placeholder="e.g. 5000" />
        </div>
      </div>

      {/* ── Documents ── */}
      <div className={sectionCls} style={sectionStyle}>
        <h3 className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: '#E56717' }}>Documents</h3>
        {[['profile_photo_url','Profile Photo'],['certificate_url','Certificate'],['government_id_url','Government ID'],['resume_url','Resume/CV']].map(([field,label]) => (
          <div key={field} className="mb-3">
            <label className={labelCls} style={labelStyle}>{label}</label>
            {surgeon?.[field] && (
              <a href={surgeon[field]} target="_blank" rel="noopener noreferrer" className="text-xs block mb-1" style={{ color:'#E56717' }}>
                View current ↗
              </a>
            )}
            <input type="file" accept={field.includes('photo')?"image/*":".pdf,.jpg,.jpeg,.png"}
              onChange={e => { if(e.target.files[0]) uploadFile(e.target.files[0], field); }}
              className="text-sm" style={{ color:'#444' }} />
            {uploading[field] && <p className="text-xs" style={{ color:'#E56717' }}>Uploading...</p>}
          </div>
        ))}
      </div>

      {/* ── Password Change ── */}
      <div className={sectionCls} style={sectionStyle}>
        <h3 className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: '#E56717' }}>Change Password</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls} style={labelStyle}>Current Password</label>
            <input className={inputCls} style={inputStyle} type="password" value={pwForm.current}
              onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} /></div>
          <div><label className={labelCls} style={labelStyle}>New Password</label>
            <input className={inputCls} style={inputStyle} type="password" value={pwForm.new_pw}
              onChange={e => setPwForm(p => ({ ...p, new_pw: e.target.value }))} /></div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button onClick={handlePasswordChange} disabled={pwSaving}
            className="px-5 py-2 rounded-lg text-sm font-semibold border disabled:opacity-50"
            style={{ borderColor:'#E8E0D8', color:'#444' }}>
            {pwSaving ? 'Updating...' : 'Update Password'}
          </button>
          {pwMsg && <span className="text-sm" style={{ color: pwMsg.includes('Failed')||pwMsg.includes('required')?'#DC2626':'#16a34a' }}>{pwMsg}</span>}
        </div>
      </div>
    </div>
  );
}
