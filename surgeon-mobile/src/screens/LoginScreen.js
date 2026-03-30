/**
 * surgeon-on-call/surgeon-mobile/src/screens/LoginScreen.js
 * LOGIN SCREEN — Phone + password authentication
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import axios from 'axios';
import CONFIG from '../lib/config';

const DEV_MODE = true;

// ── BRAND COLOURS ──────────────────────────────────────────────────────────────
const B = {
  orange: '#E56717', orangeHover: '#CD4D00',
  bg: '#FDF8F5', body: '#444444', muted: '#8B8B8B', border: '#E8E0D8',
  header: '#2C1A0E', card: '#FFFFFF', red: '#DC2626',
};

export default function LoginScreen({ onLogin }) {
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleLogin = async () => {
    setError('');
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) { setError('Please enter a valid 10-digit phone number'); return; }
    if (password.length < 4)    { setError('Password must be at least 4 characters'); return; }
    setLoading(true);
    try {
      const response = await axios.post(`${CONFIG.API_URL}/api/surgeons/login`,
        { phone: cleanPhone, password }, { timeout: 10000 });
      onLogin({ surgeon_id: response.data.surgeon_id, name: response.data.name, phone: response.data.phone });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not connect. Check your internet.');
    } finally { setLoading(false); }
  };

  const handleDevLogin = () => {
    onLogin({ surgeon_id: CONFIG.DEV_SURGEON_ID, name: 'Dr. Samdhathri Dontaraju', phone: '8686269480' });
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* ── HEADER ── */}
        <View style={styles.header}>
          <Text style={styles.logo}>🏥</Text>
          <Text style={styles.appName}>Surgeon on Call</Text>
          <Text style={styles.company}>Surgeon on Call</Text>
          <Text style={styles.tagline}>Sign in to your surgeon account</Text>
        </View>

        {/* ── FORM CARD ── */}
        <View style={styles.card}>
          <Text style={styles.label}>Mobile Number</Text>
          <View style={styles.phoneRow}>
            <View style={styles.countryCode}>
              <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              placeholder="10-digit mobile number"
              placeholderTextColor={B.muted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
              autoFocus
            />
          </View>

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.passwordInput}
            placeholder="Enter your password"
            placeholderTextColor={B.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.buttonText}>Sign In →</Text>
            }
          </TouchableOpacity>

          <Text style={styles.hint}>
            New to the platform? Enter your phone and create a password to register automatically.
          </Text>
        </View>

        {/* DEV skip button */}
        {DEV_MODE && (
          <TouchableOpacity style={styles.devButton} onPress={handleDevLogin}>
            <Text style={styles.devButtonText}>🛠 DEV: Skip Login as Dr. Samdhathri Dontaraju</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: B.header },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },

  // Header
  header:   { alignItems: 'center', marginBottom: 32 },
  logo:     { fontSize: 56, marginBottom: 12 },
  appName:  { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  company:  { fontSize: 13, color: B.orange, marginTop: 4 },
  tagline:  { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 12, textAlign: 'center' },

  // Card
  card: {
    backgroundColor: B.card,
    borderRadius:    20,
    padding:         24,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.15,
    shadowRadius:    12,
    elevation:       8,
  },
  label: {
    fontSize:      11,
    fontWeight:    '700',
    color:         B.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom:  8,
  },

  // Phone row
  phoneRow:        { flexDirection: 'row', gap: 8, marginBottom: 20 },
  countryCode:     { backgroundColor: B.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 14, justifyContent: 'center', borderWidth: 1, borderColor: B.border },
  countryCodeText: { fontSize: 15, color: B.body, fontWeight: '600' },
  phoneInput: {
    flex: 1, backgroundColor: B.bg, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 18, color: B.body,
    borderWidth: 1, borderColor: B.border, letterSpacing: 1,
  },
  passwordInput: {
    backgroundColor: B.bg, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: B.body,
    borderWidth: 1, borderColor: B.border, marginBottom: 16,
  },
  error: { color: B.red, fontSize: 13, marginBottom: 12 },

  // Button
  button: {
    backgroundColor: B.orange,
    borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText:     { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  hint: { fontSize: 12, color: B.muted, textAlign: 'center', lineHeight: 18 },

  // Dev button
  devButton: {
    marginTop:       24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius:    12,
    paddingVertical: 14,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.15)',
  },
  devButtonText: { color: B.orange, fontSize: 13, fontWeight: '600' },
});