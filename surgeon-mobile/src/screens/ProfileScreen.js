// surgeon-on-call/surgeon-mobile/src/screens/ProfileScreen.js
//
// PROFILE SCREEN — Shows the surgeon's profile details
//
// Shows:
// 1. Header with avatar, name, specialty and verified badge
// 2. Profile details card:
//    - MCI registration number
//    - Years of experience
//    - City
//    - Rating
//    - Total cases completed on platform
// 3. Logout button
//
// API call:
// - GET /api/surgeons/:id → surgeon profile data

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import axios from 'axios';
import CONFIG from '../lib/config';
import { supabase } from '../lib/supabase';

export default function ProfileScreen({ onLogout }) {

  // ── STATE ──────────────────────────────────────────────────────────────────

  // Surgeon profile data fetched from the backend
  const [surgeon, setSurgeon] = useState(null);

  // Loading state for initial fetch
  const [loading, setLoading] = useState(true);

  // Error message if fetch fails
  const [error, setError] = useState('');

  // ── FETCH PROFILE ──────────────────────────────────────────────────────────
  // Fetches the surgeon's full profile from the backend
  const fetchProfile = useCallback(async () => {
    try {
      console.log('ProfileScreen: Fetching profile for:', CONFIG.DEV_SURGEON_ID);

      const response = await axios.get(
        `${CONFIG.API_URL}/api/surgeons/${CONFIG.DEV_SURGEON_ID}`
      );

      setSurgeon(response.data.surgeon);
      setError('');
      console.log('ProfileScreen: Profile loaded:', response.data.surgeon.name);

    } catch (err) {
      console.error('ProfileScreen: Error fetching profile:', err.message);
      setError('Could not load profile. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── INITIAL LOAD ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // ── HANDLE LOGOUT ──────────────────────────────────────────────────────────
  // Shows a confirmation alert, then signs out of Supabase
  // and calls onLogout() which is passed down from App.js via navigation.js
  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('ProfileScreen: Logging out...');
              await supabase.auth.signOut();
              onLogout();
            } catch (err) {
              console.error('ProfileScreen: Logout error:', err.message);
              // Even if Supabase signOut fails, still call onLogout
              // to clear the local state
              onLogout();
            }
          }
        }
      ]
    );
  };

  // ── FORMAT HELPERS ─────────────────────────────────────────────────────────

  // Format specialty array to string: ["General Surgery", "Laparoscopic"] → "General Surgery, Laparoscopic"
  const formatSpecialty = (specialty) => {
    if (!specialty) return '—';
    if (Array.isArray(specialty)) return specialty.join(', ');
    return specialty;
  };

  // ── LOADING STATE ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A56A0" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── HEADER ── */}
      {/* Dark navy header with avatar, name, specialty and verified badge */}
      <View style={styles.header}>

        {/* Avatar with initials */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {surgeon?.name
              ? surgeon.name.split(' ').slice(-2).map(n => n[0]).join('')
              : 'DR'}
          </Text>
        </View>

        {/* Name */}
        <Text style={styles.surgeonName}>
          {surgeon?.name || 'Loading...'}
        </Text>

        {/* Specialty */}
        <Text style={styles.surgeonSpecialty}>
          {formatSpecialty(surgeon?.specialty)}
        </Text>

        {/* Verified badge — only shown if surgeon is verified */}
        {surgeon?.verified && (
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedBadgeText}>✅ Verified Surgeon</Text>
          </View>
        )}

      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >

        {/* Error message */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        ) : null}

        {/* ── STATS ROW ── */}
        {/* Quick stats shown prominently */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>⭐ {surgeon?.rating || '—'}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{surgeon?.total_cases || 0}</Text>
            <Text style={styles.statLabel}>Cases Done</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{surgeon?.experience_years || 0}yr</Text>
            <Text style={styles.statLabel}>Experience</Text>
          </View>
        </View>

        {/* ── PROFILE DETAILS CARD ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profile Details</Text>

          {/* MCI Number */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>MCI Number</Text>
            <Text style={styles.detailValue}>
              {surgeon?.mci_number || '—'}
            </Text>
          </View>
          <View style={styles.divider} />

          {/* Specialty */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Specialty</Text>
            <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]}>
              {formatSpecialty(surgeon?.specialty)}
            </Text>
          </View>
          <View style={styles.divider} />

          {/* Experience */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Experience</Text>
            <Text style={styles.detailValue}>
              {surgeon?.experience_years
                ? `${surgeon.experience_years} years`
                : '—'}
            </Text>
          </View>
          <View style={styles.divider} />

          {/* City */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>City</Text>
            <Text style={styles.detailValue}>
              {surgeon?.city || '—'}
            </Text>
          </View>
          <View style={styles.divider} />

          {/* Phone */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phone</Text>
            <Text style={styles.detailValue}>
              {surgeon?.phone || '—'}
            </Text>
          </View>

        </View>

        {/* ── PLATFORM INFO CARD ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Platform Info</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Platform</Text>
            <Text style={styles.detailValue}>Surgeon on Call</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Company</Text>
            <Text style={styles.detailValue}>Vaidhya Healthcare Pvt Ltd</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Commission</Text>
            <Text style={styles.detailValue}>5% per case</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>App Version</Text>
            <Text style={styles.detailValue}>1.0.0 (Beta)</Text>
          </View>

        </View>

        {/* ── LOGOUT BUTTON ── */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>

        {/* Bottom padding */}
        <View style={{ height: 24 }} />

      </ScrollView>
    </View>
  );
}

// ── STYLES ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    gap: 16,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 14,
  },

  // ── HEADER ──
  header: {
    backgroundColor: '#0B1F3A',
    paddingTop: Platform.OS === 'ios' ? 56 : 48,
    paddingHorizontal: 20,
    paddingBottom: 28,
    alignItems: 'center',
  },

  // Circle avatar with initials
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#1A56A0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 3,
    borderColor: '#2D5A8E',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  surgeonName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  surgeonSpecialty: {
    color: '#60A5FA',
    fontSize: 14,
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

  // ── SCROLL ──
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // Error banner
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
  },

  // ── STATS ROW ──
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    justifyContent: 'space-around',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0B1F3A',
  },
  statLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E2E8F0',
  },

  // ── CARDS ──
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 16,
  },
  detailLabel: {
    fontSize: 14,
    color: '#64748B',
    width: 110,
    flexShrink: 0,
  },
  detailValue: {
    fontSize: 14,
    color: '#0B1F3A',
    fontWeight: '600',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },

  // ── LOGOUT BUTTON ──
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