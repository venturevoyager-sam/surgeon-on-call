/**
 * surgeon-on-call/surgeon-mobile/src/screens/LoginScreen.js
 *
 * LOGIN SCREEN — Phone + password authentication
 *
 * Flow:
 *   1. Surgeon enters 10-digit phone number + password
 *   2. App calls POST /api/surgeons/login
 *   3. If existing surgeon → password verified → logged in
 *   4. If new surgeon → account auto-created → logged in
 *   5. onLogin(surgeon) called → App.js saves session → main app shown
 *
 * DEV MODE: Quick login button shown at bottom for testing.
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import axios from 'axios';
import CONFIG from '../lib/config';

// Set to false before going to production
const DEV_MODE = true;

export default function LoginScreen({ onLogin }) {

  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // ── HANDLE LOGIN ───────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setError('');

    // Validate phone
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    // Validate password
    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }

    setLoading(true);
    try {
      console.log('LoginScreen: Attempting login for phone:', cleanPhone);

      const response = await axios.post(
        `${CONFIG.API_URL}/api/surgeons/login`,
        { phone: cleanPhone, password },
        { timeout: 10000 }
      );

      console.log('LoginScreen: Login successful:', response.data.name);

      // Pass surgeon data up to App.js to save session
      onLogin({
        surgeon_id: response.data.surgeon_id,
        name:       response.data.name,
        phone:      response.data.phone,
      });

    } catch (err) {
      const msg = err.response?.data?.message || 'Could not connect. Check your internet.';
      console.error('LoginScreen: Login failed:', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── DEV MODE QUICK LOGIN ───────────────────────────────────────────────────
  // Logs in directly as Dr. Arjun Mehta without going through the API.
  // Remove before production.
  const handleDevLogin = () => {
    console.log('DEV: Logging in as Dr. Arjun Mehta');
    onLogin({
      surgeon_id: CONFIG.DEV_SURGEON_ID,
      name:       'Dr. Arjun Mehta',
      phone:      '9999999999',
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── HEADER ── */}
        <View style={styles.header}>
          <Text style={styles.logo}>🏥</Text>
          <Text style={styles.appName}>Surgeon on Call</Text>
          <Text style={styles.company}>Vaidhya Healthcare Pvt Ltd</Text>
          <Text style={styles.tagline}>Sign in to your surgeon account</Text>
        </View>

        {/* ── FORM CARD ── */}
        <View style={styles.card}>

          {/* Phone input */}
          <Text style={styles.label}>Mobile Number</Text>
          <View style={styles.phoneRow}>
            <View style={styles.countryCode}>
              <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              placeholder="10-digit mobile number"
              placeholderTextColor="#94A3B8"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
              autoFocus
            />
          </View>

          {/* Password input */}
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.passwordInput}
            placeholder="Enter your password"
            placeholderTextColor="#94A3B8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          {/* Error message */}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Login button */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.buttonText}>Login →</Text>
            }
          </TouchableOpacity>

          {/* New user hint */}
          <Text style={styles.hint}>
            New to the platform? Enter your phone and create a password to register automatically.
          </Text>
        </View>

        {/* ── DEV MODE BUTTON ── */}
        {DEV_MODE && (
          <TouchableOpacity style={styles.devButton} onPress={handleDevLogin}>
            <Text style={styles.devButtonText}>
              🛠 DEV: Skip Login as Dr. Arjun Mehta
            </Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1F3A',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 56,
    marginBottom: 12,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  company: {
    fontSize: 13,
    color: '#60A5FA',
    marginTop: 4,
  },
  tagline: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 12,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  countryCode: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  countryCodeText: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    letterSpacing: 1,
  },
  passwordInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  error: {
    color: '#EF4444',
    fontSize: 13,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#1A56A0',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  devButton: {
    marginTop: 24,
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D5A8E',
  },
  devButtonText: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '600',
  },
});