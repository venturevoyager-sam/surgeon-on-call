/**
 * surgeon-on-call/surgeon-mobile/src/screens/ProfileScreen.js
 *
 * PROFILE SCREEN — Surgeon profile with 3 tabs
 *
 * Tabs:
 *   1. Personal  — name, city, bio, experience, photo upload, change password
 *   2. Credentials — specialty, MCI number, UG/PG college
 *   3. Documents — certificate upload, verification status
 *
 * Verification flow:
 *   - Surgeon fills in profile + uploads credentials
 *   - Status shows "Pending Verification" until admin approves
 *   - Admin verifies from the admin dashboard
 *   - Once verified, surgeon becomes available for cases
 *
 * API calls:
 *   GET   /api/surgeons/:id          → fetch profile
 *   PATCH /api/surgeons/:id/profile  → save profile updates
 *   PATCH /api/surgeons/:id/password → change password
 *   Supabase Storage                 → upload photo/certificate
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

// ── SPECIALTY OPTIONS ──────────────────────────────────────────────────────────
// Multi-select options for the credentials tab
const SPECIALTY_OPTIONS = [
  'General Surgery',
  'Laparoscopic Surgery',
  'Orthopedic Surgery',
  'Cardiac Surgery',
  'Neurosurgery',
  'Plastic Surgery',
  'Urological Surgery',
  'Vascular Surgery',
  'Thoracic Surgery',
  'Pediatric Surgery',
  'Gynecological Surgery',
  'ENT Surgery',
  'Ophthalmology',
  'Oncological Surgery',
  'Transplant Surgery',
];

export default function ProfileScreen({ onLogout, surgeonId }) {
  console.log('=== ProfileScreen rendered, surgeonId:', surgeonId); // ADD THIS

  // ── STATE ──────────────────────────────────────────────────────────────────
  const [surgeon, setSurgeon]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [error, setError]             = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  // Which tab is active: 'personal', 'credentials', 'documents'
  const [activeTab, setActiveTab] = useState('personal');

  // ── PERSONAL TAB FIELDS ───────────────────────────────────────────────────
  const [name, setName]                     = useState('');
  const [city, setCity]                     = useState('');
  const [bio, setBio]                       = useState('');
  const [experienceYears, setExperienceYears] = useState('');

  // ── CREDENTIALS TAB FIELDS ────────────────────────────────────────────────
  const [selectedSpecialties, setSelectedSpecialties] = useState([]);
  const [mciNumber, setMciNumber]   = useState('');
  const [ugCollege, setUgCollege]   = useState('');
  const [pgCollege, setPgCollege]   = useState('');

  // ── PASSWORD CHANGE ────────────────────────────────────────────────────────
  const [showPasswordForm, setShowPasswordForm]   = useState(false);
  const [currentPassword, setCurrentPassword]     = useState('');
  const [newPassword, setNewPassword]             = useState('');
  const [confirmPassword, setConfirmPassword]     = useState('');
  const [passwordError, setPasswordError]         = useState('');
  const [passwordSuccess, setPasswordSuccess]     = useState('');

  // ── FETCH PROFILE ──────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    console.log('=== ProfileScreen surgeonId:', surgeonId); // ADD THIS
    try {
      console.log('ProfileScreen: Fetching profile for:', surgeonId);
      const response = await axios.get(`${CONFIG.API_URL}/api/surgeons/${surgeonId}`);
      const s = response.data.surgeon;
      setSurgeon(s);
      console.log('=== profile_photo_url:', s.profile_photo_url);

      // Populate form fields with existing data
      setName(s.name || '');
      setCity(s.city || '');
      setBio(s.bio || '');
      setExperienceYears(s.experience_years ? String(s.experience_years) : '');
      setSelectedSpecialties(s.specialty || []);
      setMciNumber(s.mci_number || '');
      setUgCollege(s.ug_college || '');
      setPgCollege(s.pg_college || '');

    } catch (err) {
      console.error('ProfileScreen: Error fetching profile:', err.message);
      setError('Could not load profile. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [surgeonId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // ── SAVE PROFILE ───────────────────────────────────────────────────────────
  // Saves whichever tab is currently active
  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess('');
    setError('');

    try {
      let payload = {};

      if (activeTab === 'personal') {
        payload = {
          name:             name.trim(),
          city:             city.trim(),
          bio:              bio.trim(),
          experience_years: parseInt(experienceYears) || 0,
        };
      } else if (activeTab === 'credentials') {
        payload = {
          specialty:  selectedSpecialties,
          mci_number: mciNumber.trim(),
          ug_college: ugCollege.trim(),
          pg_college: pgCollege.trim(),
        };
      }

      await axios.patch(
        `${CONFIG.API_URL}/api/surgeons/${surgeonId}/profile`,
        payload
      );

      setSaveSuccess('Saved successfully!');
      fetchProfile(); // Refresh data
      setTimeout(() => setSaveSuccess(''), 3000);
      console.log('ProfileScreen: Profile saved');

    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save. Try again.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  // ── CHANGE PASSWORD ────────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (newPassword.length < 4) {
      setPasswordError('New password must be at least 4 characters');
      return;
    }

    setSaving(true);
    try {
      await axios.patch(
        `${CONFIG.API_URL}/api/surgeons/${surgeonId}/password`,
        { current_password: currentPassword, new_password: newPassword }
      );

      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);

    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  // ── UPLOAD IMAGE ───────────────────────────────────────────────────────────
  // Picks an image from the gallery and uploads to Supabase Storage
  const handleUpload = async (type) => {
    // type: 'photo' or 'certificate'
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photo library.');
        return;
      }

      // Open image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled) return;

      setUploading(true);
      const asset = result.assets[0];
      const fileExt = asset.uri.split('.').pop();
      const fileName = `${surgeonId}_${type}_${Date.now()}.${fileExt}`;

      // React Native requires ArrayBuffer upload, not blob
      // fetch the file as arrayBuffer for Supabase Storage
      const fetchResponse = await fetch(asset.uri);
      const arrayBuffer = await fetchResponse.arrayBuffer();

      
      console.log('=== Uploading to bucket, fileName:', fileName);
      console.log('=== Supabase URL:', CONFIG.SUPABASE_URL);
      console.log('=== Bucket: surgeon-documents');

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('surgeon-documents')
        .upload(fileName, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: true,
  });

      console.log('=== Upload result:', JSON.stringify(uploadData));
      console.log('=== Upload error:', JSON.stringify(uploadError));

      if (uploadError) {
        console.log('=== Upload error details:', JSON.stringify(uploadError));
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('surgeon-documents')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // Save URL to surgeon profile
      const field = type === 'photo' ? 'profile_photo_url' : 'certificate_url';
      await axios.patch(
        `${CONFIG.API_URL}/api/surgeons/${surgeonId}/profile`,
        { [field]: publicUrl }
      );

      await fetchProfile();
      Alert.alert('Success', type === 'photo' ? 'Profile photo updated!' : 'Certificate uploaded!');

    } catch (err) {
      console.error('Upload error:', err.message);
      Alert.alert('Upload failed', err.message);
    } finally {
      setUploading(false);
    }
  };

  // ── TOGGLE SPECIALTY ───────────────────────────────────────────────────────
  const toggleSpecialty = (specialty) => {
    setSelectedSpecialties(prev =>
      prev.includes(specialty)
        ? prev.filter(s => s !== specialty)
        : [...prev, specialty]
    );
  };

  // ── HANDLE LOGOUT ──────────────────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out', style: 'destructive',
        onPress: () => onLogout(),
      }
    ]);
  };

  // ── FORMAT HELPERS ─────────────────────────────────────────────────────────
  const formatSpecialty = (specialty) => {
    if (!specialty) return 'Not set';
    if (Array.isArray(specialty)) return specialty.join(', ') || 'Not set';
    return specialty;
  };

  const getInitials = (name) => {
    if (!name) return 'DR';
    return name.split(' ').slice(-2).map(n => n[0]).join('').toUpperCase();
  };

  // ── LOADING STATE ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1A56A0" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── HEADER ── */}
      <View style={styles.header}>

        {/* Profile photo or initials avatar */}
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={() => handleUpload('photo')}
        >
          {surgeon?.profile_photo_url ? (
            <Image
              source={{ uri: surgeon.profile_photo_url }}
              style={styles.avatarImage}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(surgeon?.name)}</Text>
            </View>
          )}
          {/* Camera icon overlay */}
          <View style={styles.avatarEditBadge}>
            <Text style={styles.avatarEditIcon}>📷</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.surgeonName}>{surgeon?.name || 'Your Name'}</Text>
        <Text style={styles.surgeonSpecialty}>{formatSpecialty(surgeon?.specialty)}</Text>

        {/* Verification status badge */}
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
              {tab === 'personal'    ? 'Personal' :
               tab === 'credentials' ? 'Credentials' : 'Documents'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── TAB CONTENT ── */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* Success / Error banners */}
        {saveSuccess ? (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>✓ {saveSuccess}</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        ) : null}

        {/* ── PERSONAL TAB ── */}
        {activeTab === 'personal' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Personal Information</Text>

              <Field label="Full Name">
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Dr. Full Name"
                  placeholderTextColor="#94A3B8"
                />
              </Field>

              <Field label="City">
                <TextInput
                  style={styles.input}
                  value={city}
                  onChangeText={setCity}
                  placeholder="e.g. Hyderabad"
                  placeholderTextColor="#94A3B8"
                />
              </Field>

              <Field label="Experience (years)">
                <TextInput
                  style={styles.input}
                  value={experienceYears}
                  onChangeText={setExperienceYears}
                  placeholder="e.g. 10"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                />
              </Field>

              <Field label="Bio / About" last>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Brief professional summary..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={4}
                />
              </Field>
            </View>

            {/* ── CHANGE PASSWORD ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Security</Text>

              <TouchableOpacity
                style={styles.changePasswordBtn}
                onPress={() => setShowPasswordForm(!showPasswordForm)}
              >
                <Text style={styles.changePasswordBtnText}>
                  {showPasswordForm ? '↑ Cancel' : '🔒 Change Password'}
                </Text>
              </TouchableOpacity>

              {showPasswordForm && (
                <View style={styles.passwordForm}>
                  {passwordError ? (
                    <Text style={styles.passwordError}>{passwordError}</Text>
                  ) : null}
                  {passwordSuccess ? (
                    <Text style={styles.passwordSuccessText}>{passwordSuccess}</Text>
                  ) : null}

                  <TextInput
                    style={styles.input}
                    placeholder="Current password"
                    placeholderTextColor="#94A3B8"
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    secureTextEntry
                  />
                  <TextInput
                    style={[styles.input, { marginTop: 10 }]}
                    placeholder="New password"
                    placeholderTextColor="#94A3B8"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                  />
                  <TextInput
                    style={[styles.input, { marginTop: 10 }]}
                    placeholder="Confirm new password"
                    placeholderTextColor="#94A3B8"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                  <TouchableOpacity
                    style={[styles.saveBtn, { marginTop: 14 }]}
                    onPress={handleChangePassword}
                    disabled={saving}
                  >
                    {saving
                      ? <ActivityIndicator color="#FFF" />
                      : <Text style={styles.saveBtnText}>Update Password</Text>
                    }
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Save button */}
            <SaveButton onPress={handleSave} saving={saving} />
          </View>
        )}

        {/* ── CREDENTIALS TAB ── */}
        {activeTab === 'credentials' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Medical Registration</Text>

              <Field label="MCI Number">
                <TextInput
                  style={styles.input}
                  value={mciNumber}
                  onChangeText={setMciNumber}
                  placeholder="e.g. MCI-12345"
                  placeholderTextColor="#94A3B8"
                />
              </Field>

              <Field label="UG College">
                <TextInput
                  style={styles.input}
                  value={ugCollege}
                  onChangeText={setUgCollege}
                  placeholder="MBBS college name"
                  placeholderTextColor="#94A3B8"
                />
              </Field>

              <Field label="PG College" last>
                <TextInput
                  style={styles.input}
                  value={pgCollege}
                  onChangeText={setPgCollege}
                  placeholder="MS/MD college name"
                  placeholderTextColor="#94A3B8"
                />
              </Field>
            </View>

            {/* Specialty multi-select */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Specialties</Text>
              <Text style={styles.cardSubtitle}>Select all that apply</Text>

              <View style={styles.specialtyGrid}>
                {SPECIALTY_OPTIONS.map(specialty => (
                  <TouchableOpacity
                    key={specialty}
                    style={[
                      styles.specialtyChip,
                      selectedSpecialties.includes(specialty) && styles.specialtyChipSelected
                    ]}
                    onPress={() => toggleSpecialty(specialty)}
                  >
                    <Text style={[
                      styles.specialtyChipText,
                      selectedSpecialties.includes(specialty) && styles.specialtyChipTextSelected
                    ]}>
                      {specialty}
                    </Text>
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

            {/* Verification status card */}
            <View style={[styles.card, surgeon?.verified ? styles.verifiedCard : styles.pendingCard]}>
              <Text style={styles.verificationTitle}>
                {surgeon?.verified ? '✅ Account Verified' : '⏳ Pending Verification'}
              </Text>
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
                  <Image
                    source={{ uri: surgeon.profile_photo_url }}
                    style={styles.uploadedImage}
                  />
                  <TouchableOpacity
                    style={styles.reuploadBtn}
                    onPress={() => handleUpload('photo')}
                  >
                    <Text style={styles.reuploadBtnText}>Change Photo</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.uploadBtn}
                  onPress={() => handleUpload('photo')}
                  disabled={uploading}
                >
                  {uploading
                    ? <ActivityIndicator color="#1A56A0" />
                    : <>
                        <Text style={styles.uploadBtnIcon}>📷</Text>
                        <Text style={styles.uploadBtnText}>Upload Profile Photo</Text>
                        <Text style={styles.uploadBtnHint}>JPG or PNG</Text>
                      </>
                  }
                </TouchableOpacity>
              )}
            </View>

            {/* Certificate upload */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Medical Certificate</Text>
              <Text style={styles.cardSubtitle}>MCI registration certificate or degree</Text>

              {surgeon?.certificate_url ? (
                <View style={styles.uploadedContainer}>
                  <View style={styles.uploadedFile}>
                    <Text style={styles.uploadedFileIcon}>📄</Text>
                    <Text style={styles.uploadedFileText}>Certificate uploaded ✓</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.reuploadBtn}
                    onPress={() => handleUpload('certificate')}
                  >
                    <Text style={styles.reuploadBtnText}>Replace</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.uploadBtn}
                  onPress={() => handleUpload('certificate')}
                  disabled={uploading}
                >
                  {uploading
                    ? <ActivityIndicator color="#1A56A0" />
                    : <>
                        <Text style={styles.uploadBtnIcon}>📄</Text>
                        <Text style={styles.uploadBtnText}>Upload Certificate</Text>
                        <Text style={styles.uploadBtnHint}>JPG or PNG of your certificate</Text>
                      </>
                  }
                </TouchableOpacity>
              )}
            </View>

            {/* Stats card — read only */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Platform Stats</Text>
              <Row label="Rating"       value={`⭐ ${surgeon?.rating || '—'}`} />
              <Row label="Cases Done"   value={String(surgeon?.total_cases || 0)} />
              <Row label="Commission"   value="5% per case" last />
            </View>
          </View>
        )}

        {/* ── LOGOUT BUTTON ── */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ── HELPER COMPONENTS ──────────────────────────────────────────────────────────

function Field({ label, children, last }) {
  return (
    <View style={{ marginBottom: last ? 0 : 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, last }) {
  return (
    <>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
      {!last && <View style={styles.rowDivider} />}
    </>
  );
}

function SaveButton({ onPress, saving }) {
  return (
    <TouchableOpacity
      style={styles.saveBtn}
      onPress={onPress}
      disabled={saving}
    >
      {saving
        ? <ActivityIndicator color="#FFFFFF" />
        : <Text style={styles.saveBtnText}>Save Changes</Text>
      }
    </TouchableOpacity>
  );
}

// ── STYLES ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 14,
  },

  // ── HEADER ──
  header: {
    backgroundColor: '#0B1F3A',
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1A56A0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#2D5A8E',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#2D5A8E',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#1A56A0',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditIcon: {
    fontSize: 12,
  },
  surgeonName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  surgeonSpecialty: {
    color: '#60A5FA',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  verifiedBadge: {
    backgroundColor: '#065F46',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginTop: 10,
  },
  verifiedBadgeText: {
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '700',
  },
  pendingBadge: {
    backgroundColor: '#78350F',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginTop: 10,
  },
  pendingBadgeText: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '700',
  },

  // ── TAB BAR ──
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#1A56A0',
  },
  tabText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#1A56A0',
    fontWeight: '700',
  },

  // ── SCROLL ──
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // ── BANNERS ──
  successBanner: {
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#059669',
  },
  successText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
  },

  // ── CARDS ──
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  verifiedCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7',
  },
  pendingCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0B1F3A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: -10,
    marginBottom: 14,
  },

  // ── FORM FIELDS ──
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },

  // ── SPECIALTY CHIPS ──
  specialtyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specialtyChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  specialtyChipSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#1A56A0',
  },
  specialtyChipText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  specialtyChipTextSelected: {
    color: '#1A56A0',
    fontWeight: '700',
  },

  // ── UPLOAD ──
  uploadBtn: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  uploadBtnIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  uploadBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A56A0',
  },
  uploadBtnHint: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  uploadedContainer: {
    gap: 10,
  },
  uploadedImage: {
    width: '100%',
    height: 160,
    borderRadius: 10,
  },
  uploadedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0FDF4',
    padding: 14,
    borderRadius: 10,
  },
  uploadedFileIcon: {
    fontSize: 24,
  },
  uploadedFileText: {
    fontSize: 14,
    color: '#065F46',
    fontWeight: '600',
  },
  reuploadBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  reuploadBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },

  // ── VERIFICATION CARD ──
  verificationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0B1F3A',
    marginBottom: 8,
  },
  verificationSubtext: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
  },

  // ── PASSWORD FORM ──
  changePasswordBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  changePasswordBtnText: {
    color: '#1A56A0',
    fontSize: 14,
    fontWeight: '700',
  },
  passwordForm: {
    marginTop: 14,
  },
  passwordError: {
    color: '#EF4444',
    fontSize: 13,
    marginBottom: 10,
  },
  passwordSuccessText: {
    color: '#059669',
    fontSize: 13,
    marginBottom: 10,
    fontWeight: '600',
  },

  // ── ROW (documents tab stats) ──
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  rowLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  rowValue: {
    fontSize: 14,
    color: '#0B1F3A',
    fontWeight: '600',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },

  // ── SAVE BUTTON ──
  saveBtn: {
    backgroundColor: '#1A56A0',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 4,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // ── LOGOUT ──
  logoutButton: {
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 8,
  },
  logoutButtonText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '700',
  },
});