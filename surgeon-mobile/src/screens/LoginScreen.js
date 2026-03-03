// surgeon-on-call/surgeon-mobile/src/screens/LoginScreen.js
//
// LOGIN SCREEN — Surgeon authentication
//
// Flow:
// 1. Surgeon enters their phone number
// 2. App sends OTP via Supabase (SMS to their phone)
// 3. Surgeon enters the 6-digit OTP
// 4. App verifies OTP with Supabase
// 5. On success → calls onLogin() → App.js switches to main tab bar
//
// DEV MODE: A "Skip Login" button appears at the bottom so we don't
// have to go through OTP every time during development.

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { supabase } from '../lib/supabase';
import CONFIG from '../lib/config';

// ── DEV MODE ───────────────────────────────────────────────────────────────────
// Set to true to show the "Skip Login" button during development
const DEV_MODE = true;

export default function LoginScreen({ onLogin }) {

  // ── STATE ──────────────────────────────────────────────────────────────────

  // Which step we are on: 'phone' (enter number) or 'otp' (enter code)
  const [step, setStep] = useState('phone');

  // The phone number the surgeon types in
  const [phone, setPhone] = useState('');

  // The 6-digit OTP the surgeon types in
  const [otp, setOtp] = useState('');

  // Loading spinner while waiting for API response
  const [loading, setLoading] = useState(false);

  // Error message shown below the input
  const [error, setError] = useState('');

  // ── SEND OTP ───────────────────────────────────────────────────────────────
  // Called when surgeon taps "Send OTP" button
  // Sends a one-time password SMS to the surgeon's phone via Supabase
  const handleSendOtp = async () => {
    setError('');

    // Basic validation — phone number must be at least 10 digits
    const cleanPhone = phone.replace(/\D/g, ''); // Remove non-digits
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      // Format as Indian mobile number: +91XXXXXXXXXX
      const formattedPhone = `+91${cleanPhone.slice(-10)}`;
      console.log('Sending OTP to:', formattedPhone);

      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (error) throw error;

      // OTP sent successfully — move to OTP entry step
      console.log('OTP sent successfully');
      setStep('otp');

    } catch (err) {
      console.error('Error sending OTP:', err.message);
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── VERIFY OTP ─────────────────────────────────────────────────────────────
  // Called when surgeon taps "Verify" button
  // Checks the OTP with Supabase and logs the surgeon in
  const handleVerifyOtp = async () => {
    setError('');

    // OTP must be exactly 6 digits
    if (otp.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const formattedPhone = `+91${cleanPhone.slice(-10)}`;
      console.log('Verifying OTP for:', formattedPhone);

      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: 'sms',
      });

      if (error) throw error;

      // OTP verified — surgeon is now logged in
      console.log('OTP verified, surgeon logged in:', data.user?.id);
      onLogin(data.user);

    } catch (err) {
      console.error('Error verifying OTP:', err.message);
      setError(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── DEV MODE SKIP LOGIN ────────────────────────────────────────────────────
  // Bypasses the entire OTP flow and logs in as Dr. Arjun Mehta directly.
  // Only visible when DEV_MODE = true.
  const handleDevSkip = () => {
    console.log('DEV MODE: Skipping login as Dr. Arjun Mehta');
    onLogin({ id: CONFIG.DEV_SURGEON_ID, dev: true });
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    // KeyboardAvoidingView: pushes the form up when the keyboard appears
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── LOGO / HEADER ── */}
        <View style={styles.header}>
          <Text style={styles.logo}>🏥</Text>
          <Text style={styles.appName}>Surgeon on Call</Text>
          <Text style={styles.company}>Vaidhya Healthcare Pvt Ltd</Text>
          <Text style={styles.tagline}>
            {step === 'phone'
              ? 'Enter your mobile number to continue'
              : 'Enter the OTP sent to your phone'}
          </Text>
        </View>

        {/* ── FORM CARD ── */}
        <View style={styles.card}>

          {step === 'phone' ? (
            // ── STEP 1: PHONE NUMBER INPUT ──
            <>
              <Text style={styles.label}>Mobile Number</Text>

              {/* Phone number input with +91 prefix */}
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

              {/* Error message */}
              {error ? <Text style={styles.error}>{error}</Text> : null}

              {/* Send OTP button */}
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSendOtp}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.buttonText}>Send OTP →</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            // ── STEP 2: OTP INPUT ──
            <>
              <Text style={styles.label}>Enter OTP</Text>
              <Text style={styles.otpHint}>
                Sent to +91 {phone.slice(-10)}
              </Text>

              {/* OTP input */}
              <TextInput
                style={styles.otpInput}
                placeholder="6-digit code"
                placeholderTextColor="#94A3B8"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />

              {/* Error message */}
              {error ? <Text style={styles.error}>{error}</Text> : null}

              {/* Verify button */}
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleVerifyOtp}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.buttonText}>Verify & Login →</Text>
                }
              </TouchableOpacity>

              {/* Go back to change phone number */}
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => { setStep('phone'); setOtp(''); setError(''); }}
              >
                <Text style={styles.backButtonText}>← Change number</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ── DEV MODE SKIP BUTTON ── */}
        {/* Only shown during development — remove before production */}
        {DEV_MODE && (
          <TouchableOpacity style={styles.devButton} onPress={handleDevSkip}>
            <Text style={styles.devButtonText}>
              🛠 DEV: Skip Login as Dr. Arjun Mehta
            </Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── STYLES ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  // Full screen dark navy background
  container: {
    flex: 1,
    backgroundColor: '#0B1F3A',
  },

  // Centers content vertically and horizontally
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },

  // Logo + title section at the top
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

  // White card that contains the form
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

  // Row containing +91 prefix and phone input
  phoneRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
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

  // Hint text below OTP label
  otpHint: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 12,
  },

  // Large OTP input — centered text, big font
  otpInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 28,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 16,
  },

  // Red error message
  error: {
    color: '#EF4444',
    fontSize: 13,
    marginBottom: 12,
  },

  // Primary action button (blue)
  button: {
    backgroundColor: '#1A56A0',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // "Change number" back link
  backButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  backButtonText: {
    color: '#64748B',
    fontSize: 14,
  },

  // DEV MODE skip button at the bottom
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