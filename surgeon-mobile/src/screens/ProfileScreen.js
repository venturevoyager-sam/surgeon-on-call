/**
 * surgeon-on-call/surgeon-mobile/src/screens/ProfileScreen.js
 * PROFILE SCREEN — Surgeon profile with 3 tabs (Personal, Credentials, Documents)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform, TextInput, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import CONFIG from '../lib/config';
import { supabase } from '../lib/supabase';

// ── BRAND COLOURS ──────────────────────────────────────────────────────────────
const B = {
  orange: '#E56717', orangeHover: '#CD4D00',
  bg: '#FDF8F5', body: '#444444', muted: '#8B8B8B', border: '#E8E0D8',
  card: '#FFFFFF', header: '#2C1A0E',
  green: '#16a34a', greenBg: '#F0FDF4', greenBorder: '#BBF7D0',
  red: '#DC2626', redBg: '#FEF2F2',
};

const SPECIALTY_OPTIONS = [
  'General Surgery', 'Laparoscopic Surgery', 'Orthopedic Surgery',
  'Cardiac Surgery', 'Neurosurgery', 'Plastic Surgery',
  'Urological Surgery', 'Vascular Surgery', 'Thoracic Surgery',
  'Pediatric Surgery', 'Gynecological Surgery', 'ENT Surgery',
  'Ophthalmology', 'Oncological Surgery', 'Transplant Surgery',
];

export default function ProfileScreen({ onLogout, surgeonId }) {
  const [surgeon,    setSurgeon]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [error,      setError]      = useState('');
  const [saveSuccess,setSaveSuccess]= useState('');
  const [activeTab,  setActiveTab]  = useState('personal');

  // Personal fields
  const [name,            setName]           = useState('');
  const [city,            setCity]           = useState('');
  const [bio,             setBio]            = useState('');
  const [experienceYears, setExperienceYears]= useState('');
  // Credentials fields
  const [selectedSpecialties, setSelectedSpecialties] = useState([]);
  const [mciNumber, setMciNumber] = useState('');
  const [ugCollege, setUgCollege] = useState('');
  const [pgCollege, setPgCollege] = useState('');
  // Password fields
  const [showPasswordForm,  setShowPasswordForm]  = useState(false);
  const [currentPassword,   setCurrentPassword]   = useState('');
  const [newPassword,       setNewPassword]       = useState('');
  const [confirmPassword,   setConfirmPassword]   = useState('');
  const [passwordError,     setPasswordError]     = useState('');
  const [passwordSuccess,   setPasswordSuccess]   = useState('');

  const fetchProfile = useCallback(async () => {
    try {
      const res = await axios.get(`${CONFIG.API_URL}/api/surgeons/${surgeonId}`);
      const s = res.data.surgeon;
      setSurgeon(s);
      setName(s.name || '');
      setCity(s.city || '');
      setBio(s.bio || '');
      setExperienceYears(s.experience_years ? String(s.experience_years) : '');
      setSelectedSpecialties(s.specialty || []);
      setMciNumber(s.mci_number || '');
      setUgCollege(s.ug_college || '');
      setPgCollege(s.pg_college || '');
    } catch (err) {
      setError('Could not load profile. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [surgeonId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleSave = async () => {
    setSaving(true); setSaveSuccess(''); setError('');
    try {
      let payload = {};
      if (activeTab === 'personal') {
        payload = { name: name.trim(), city: city.trim(), bio: bio.trim(), experience_years: parseInt(experienceYears) || 0 };
      } else if (activeTab === 'credentials') {
        payload = { specialty: selectedSpecialties, mci_number: mciNumber.trim(), ug_college: ugCollege.trim(), pg_college: pgCollege.trim() };
      }
      await axios.patch(`${CONFIG.API_URL}/api/surgeons/${surgeonId}/profile`, payload);
      setSaveSuccess('Saved successfully!');
      fetchProfile();
      setTimeout(() => setSaveSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save. Try again.');
    } finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    setPasswordError(''); setPasswordSuccess('');
    if (!currentPassword || !newPassword || !confirmPassword) { setPasswordError('All fields are required'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('New passwords do not match'); return; }
    if (newPassword.length < 4) { setPasswordError('New password must be at least 4 characters'); return; }
    setSaving(true);
    try {
      await axios.patch(`${CONFIG.API_URL}/api/surgeons/${surgeonId}/password`,
        { current_password: currentPassword, new_password: newPassword });
      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Failed to change password');
    } finally { setSaving(false); }
  };

  const handleUpload = async (type) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow access to your photo library.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
      if (result.canceled) return;
      setUploading(true);
      const asset    = result.assets[0];
      const fileExt  = asset.uri.split('.').pop();
      const fileName = `${surgeonId}_${type}_${Date.now()}.${fileExt}`;
      const fetchRes = await fetch(asset.uri);
      const arrayBuffer = await fetchRes.arrayBuffer();
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('surgeon-documents').upload(fileName, arrayBuffer, { contentType: `image/${fileExt}`, upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('surgeon-documents').getPublicUrl(fileName);
      const field = type === 'photo' ? 'profile_photo_url' : 'certificate_url';
      await axios.patch(`${CONFIG.API_URL}/api/surgeons/${surgeonId}/profile`, { [field]: urlData.publicUrl });
      await fetchProfile();
      Alert.alert('Success', type === 'photo' ? 'Profile photo updated!' : 'Certificate uploaded!');
    } catch (err) {
      Alert.alert('Upload failed', err.message);
    } finally { setUploading(false); }
  };

  const toggleSpecialty = (s) => {
    setSelectedSpecialties(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => onLogout() },
    ]);
  };

  const getInitials = (n) => n ? n.split(' ').slice(-2).map(x => x[0]).join('').toUpperCase() : 'DR';

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={B.orange} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.avatarContainer} onPress={() => handleUpload('photo')}>
          {surgeon?.profile_photo_url ? (
            <Image source={{ uri: surgeon.profile_photo_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(surgeon?.name)}</Text>
            </View>
          )}
          <View style={styles.avatarEditBadge}>
            <Text style={styles.avatarEditIcon}>📷</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.surgeonName}>{surgeon?.name || 'Your Name'}</Text>
        <Text style={styles.surgeonSpecialty}>
          {Array.isArray(surgeon?.specialty) ? surgeon.specialty.join(', ') || 'Not set' : surgeon?.specialty || 'Not set'}
        </Text>

        {surgeon?.verified ? (
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedBadgeText}>✅ Verified Surgeon</Text>
          </View>
        ) : (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>⏳ Pending Verification</Text>
          </View>
        )}
      </View>

      {/* ── TAB BAR ── */}
      <View style={styles.tabBar}>
        {['personal', 'credentials', 'documents'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => { setActiveTab(tab); setError(''); setSaveSuccess(''); }}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'personal' ? 'Personal' : tab === 'credentials' ? 'Credentials' : 'Documents'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── TAB CONTENT ── */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {saveSuccess ? (
          <View style={styles.successBanner}><Text style={styles.successText}>✓ {saveSuccess}</Text></View>
        ) : null}
        {error ? (
          <View style={styles.errorBanner}><Text style={styles.errorText}>⚠️ {error}</Text></View>
        ) : null}

        {/* ── PERSONAL TAB ── */}
        {activeTab === 'personal' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Personal Information</Text>
              <Field label="Full Name">
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Dr. Full Name" placeholderTextColor={B.muted} />
              </Field>
              <Field label="City">
                <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="e.g. Hyderabad" placeholderTextColor={B.muted} />
              </Field>
              <Field label="Experience (years)">
                <TextInput style={styles.input} value={experienceYears} onChangeText={setExperienceYears} placeholder="e.g. 10" placeholderTextColor={B.muted} keyboardType="number-pad" />
              </Field>
              <Field label="Bio / About" last>
                <TextInput style={[styles.input, styles.textArea]} value={bio} onChangeText={setBio} placeholder="Brief professional summary..." placeholderTextColor={B.muted} multiline numberOfLines={4} />
              </Field>
            </View>

            {/* Password */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Security</Text>
              <TouchableOpacity style={styles.changePasswordBtn} onPress={() => setShowPasswordForm(!showPasswordForm)}>
                <Text style={styles.changePasswordBtnText}>{showPasswordForm ? '↑ Cancel' : '🔒 Change Password'}</Text>
              </TouchableOpacity>
              {showPasswordForm && (
                <View style={styles.passwordForm}>
                  {passwordError ? <Text style={styles.passwordError}>{passwordError}</Text> : null}
                  {passwordSuccess ? <Text style={styles.passwordSuccessText}>{passwordSuccess}</Text> : null}
                  <TextInput style={styles.input} placeholder="Current password" placeholderTextColor={B.muted} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
                  <TextInput style={[styles.input, { marginTop: 10 }]} placeholder="New password" placeholderTextColor={B.muted} value={newPassword} onChangeText={setNewPassword} secureTextEntry />
                  <TextInput style={[styles.input, { marginTop: 10 }]} placeholder="Confirm new password" placeholderTextColor={B.muted} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
                  <TouchableOpacity style={[styles.saveBtn, { marginTop: 14 }]} onPress={handleChangePassword} disabled={saving}>
                    {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Update Password</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <SaveButton onPress={handleSave} saving={saving} />
          </View>
        )}

        {/* ── CREDENTIALS TAB ── */}
        {activeTab === 'credentials' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Medical Registration</Text>
              <Field label="MCI Number">
                <TextInput style={styles.input} value={mciNumber} onChangeText={setMciNumber} placeholder="e.g. MCI-12345" placeholderTextColor={B.muted} />
              </Field>
              <Field label="UG College">
                <TextInput style={styles.input} value={ugCollege} onChangeText={setUgCollege} placeholder="MBBS college name" placeholderTextColor={B.muted} />
              </Field>
              <Field label="PG College" last>
                <TextInput style={styles.input} value={pgCollege} onChangeText={setPgCollege} placeholder="MS/MD college name" placeholderTextColor={B.muted} />
              </Field>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Specialties</Text>
              <Text style={styles.cardSubtitle}>Select all that apply</Text>
              <View style={styles.specialtyGrid}>
                {SPECIALTY_OPTIONS.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.specialtyChip, selectedSpecialties.includes(s) && styles.specialtyChipSelected]}
                    onPress={() => toggleSpecialty(s)}
                  >
                    <Text style={[styles.specialtyChipText, selectedSpecialties.includes(s) && styles.specialtyChipTextSelected]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <SaveButton onPress={handleSave} saving={saving} />
          </View>
        )}

        {/* ── DOCUMENTS TAB ── */}
        {activeTab === 'documents' && (
          <View>
            <View style={[styles.card, surgeon?.verified ? styles.verifiedCard : styles.pendingCard]}>
              <Text style={styles.verificationTitle}>{surgeon?.verified ? '✅ Account Verified' : '⏳ Pending Verification'}</Text>
              <Text style={styles.verificationSubtext}>
                {surgeon?.verified
                  ? 'Your account has been verified by the Vaidhya Healthcare team. You are eligible to receive surgery requests.'
                  : 'Upload your documents below. Our team will verify your credentials within 24-48 hours.'}
              </Text>
            </View>

            {/* Profile photo */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Profile Photo</Text>
              {surgeon?.profile_photo_url ? (
                <View style={styles.uploadedContainer}>
                  <Image source={{ uri: surgeon.profile_photo_url }} style={styles.uploadedImage} />
                  <TouchableOpacity style={styles.reuploadBtn} onPress={() => handleUpload('photo')}>
                    <Text style={styles.reuploadBtnText}>Change Photo</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.uploadBtn} onPress={() => handleUpload('photo')} disabled={uploading}>
                  {uploading ? <ActivityIndicator color={B.orange} /> : (
                    <><Text style={styles.uploadBtnIcon}>📷</Text><Text style={styles.uploadBtnText}>Upload Profile Photo</Text><Text style={styles.uploadBtnHint}>JPG or PNG</Text></>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Certificate */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Medical Certificate</Text>
              <Text style={styles.cardSubtitle}>MCI registration certificate or degree</Text>
              {surgeon?.certificate_url ? (
                <View style={styles.uploadedContainer}>
                  <View style={styles.uploadedFile}>
                    <Text style={styles.uploadedFileIcon}>📄</Text>
                    <Text style={styles.uploadedFileText}>Certificate uploaded ✓</Text>
                  </View>
                  <TouchableOpacity style={styles.reuploadBtn} onPress={() => handleUpload('certificate')}>
                    <Text style={styles.reuploadBtnText}>Replace</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.uploadBtn} onPress={() => handleUpload('certificate')} disabled={uploading}>
                  {uploading ? <ActivityIndicator color={B.orange} /> : (
                    <><Text style={styles.uploadBtnIcon}>📄</Text><Text style={styles.uploadBtnText}>Upload Certificate</Text><Text style={styles.uploadBtnHint}>JPG or PNG of your certificate</Text></>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Stats */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Platform Stats</Text>
              <StatsRow label="Rating"     value={`⭐ ${surgeon?.rating || '—'}`} />
              <StatsRow label="Cases Done" value={String(surgeon?.total_cases || 0)} />
              <StatsRow label="Commission" value="5% per case" last />
            </View>
          </View>
        )}

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function Field({ label, children, last }) {
  return <View style={{ marginBottom: last ? 0 : 14 }}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>;
}

function StatsRow({ label, value, last }) {
  return (
    <>
      <View style={styles.statsRow}>
        <Text style={styles.statsLabel}>{label}</Text>
        <Text style={styles.statsValue}>{value}</Text>
      </View>
      {!last && <View style={styles.rowDivider} />}
    </>
  );
}

function SaveButton({ onPress, saving }) {
  return (
    <TouchableOpacity style={styles.saveBtn} onPress={onPress} disabled={saving}>
      {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: B.bg },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, backgroundColor: B.bg },
  loadingText: { color: B.muted, fontSize: 14 },

  // Header
  header: {
    backgroundColor: B.header,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 24, paddingHorizontal: 20, alignItems: 'center',
  },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: B.orange,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarImage: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarText: { color: '#FFFFFF', fontSize: 28, fontWeight: '800' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: B.orange, borderRadius: 12,
    width: 24, height: 24, justifyContent: 'center', alignItems: 'center',
  },
  avatarEditIcon: { fontSize: 12 },
  surgeonName:      { color: '#FFFFFF', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  surgeonSpecialty: { color: B.orange, fontSize: 13, marginTop: 4, textAlign: 'center' },
  verifiedBadge:    { backgroundColor: '#065F46', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginTop: 10 },
  verifiedBadgeText:{ color: '#D1FAE5', fontSize: 12, fontWeight: '700' },
  pendingBadge:     { backgroundColor: 'rgba(229,103,23,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginTop: 10 },
  pendingBadgeText: { color: '#FDE68A', fontSize: 12, fontWeight: '700' },

  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: B.card, borderBottomWidth: 1, borderBottomColor: B.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:     { borderBottomColor: B.orange },
  tabText:       { fontSize: 13, color: B.muted, fontWeight: '600' },
  tabTextActive: { color: B.orange, fontWeight: '700' },

  scroll:        { flex: 1 },
  scrollContent: { padding: 16 },

  // Banners
  successBanner: { backgroundColor: B.greenBg, borderRadius: 10, padding: 12, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: B.green },
  successText:   { color: '#065F46', fontSize: 13, fontWeight: '600' },
  errorBanner:   { backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: B.red },
  errorText:     { color: B.red, fontSize: 13 },

  // Cards
  card: {
    backgroundColor: B.card, borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: B.border,
    shadowColor: '#442200', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  verifiedCard: { backgroundColor: B.greenBg, borderColor: B.greenBorder },
  pendingCard:  { backgroundColor: '#FFFBEB', borderColor: '#FCD34D' },
  cardTitle: {
    fontSize: 11, fontWeight: '700', color: B.orange,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14,
  },
  cardSubtitle: { fontSize: 12, color: B.muted, marginTop: -10, marginBottom: 14 },

  // Form
  fieldLabel: { fontSize: 11, fontWeight: '700', color: B.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: {
    backgroundColor: B.bg, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: B.body, borderWidth: 1, borderColor: B.border,
  },
  textArea: { height: 100, textAlignVertical: 'top' },

  // Specialty chips
  specialtyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  specialtyChip: {
    backgroundColor: B.bg, borderRadius: 20, paddingHorizontal: 12,
    paddingVertical: 7, borderWidth: 1, borderColor: B.border,
  },
  specialtyChipSelected:     { backgroundColor: '#FFF3EB', borderColor: B.orange },
  specialtyChipText:         { fontSize: 13, color: B.muted, fontWeight: '500' },
  specialtyChipTextSelected: { color: B.orange, fontWeight: '700' },

  // Upload
  uploadBtn: {
    backgroundColor: B.bg, borderRadius: 12, padding: 20, alignItems: 'center',
    borderWidth: 2, borderColor: B.border, borderStyle: 'dashed',
  },
  uploadBtnIcon: { fontSize: 32, marginBottom: 8 },
  uploadBtnText: { fontSize: 15, fontWeight: '700', color: B.orange },
  uploadBtnHint: { fontSize: 12, color: B.muted, marginTop: 4 },
  uploadedContainer: { gap: 10 },
  uploadedImage: { width: '100%', height: 160, borderRadius: 10 },
  uploadedFile: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: B.greenBg, padding: 14, borderRadius: 10 },
  uploadedFileIcon: { fontSize: 24 },
  uploadedFileText: { fontSize: 14, color: '#065F46', fontWeight: '600' },
  reuploadBtn: { backgroundColor: B.bg, borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: B.border },
  reuploadBtnText: { color: B.muted, fontSize: 13, fontWeight: '600' },

  // Verification
  verificationTitle:   { fontSize: 15, fontWeight: '700', color: B.body, marginBottom: 8 },
  verificationSubtext: { fontSize: 13, color: B.body, lineHeight: 20 },

  // Password
  changePasswordBtn: { backgroundColor: B.bg, borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: B.border },
  changePasswordBtnText: { color: B.orange, fontSize: 14, fontWeight: '700' },
  passwordForm:        { marginTop: 14 },
  passwordError:       { color: B.red, fontSize: 13, marginBottom: 10 },
  passwordSuccessText: { color: B.green, fontSize: 13, marginBottom: 10, fontWeight: '600' },

  // Stats rows
  statsRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  statsLabel: { fontSize: 13, color: B.muted },
  statsValue: { fontSize: 14, color: B.body, fontWeight: '600' },
  rowDivider: { height: 1, backgroundColor: B.border },

  // Save button
  saveBtn: {
    backgroundColor: B.orange, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginBottom: 14, marginTop: 4,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  // Logout
  logoutButton: {
    backgroundColor: '#FEF2F2', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#FECACA', marginBottom: 8,
  },
  logoutButtonText: { color: B.red, fontSize: 15, fontWeight: '700' },
});