// surgeon-on-call/surgeon-mobile/src/screens/HomeScreen.js
//
// HOME SCREEN — Main screen the surgeon sees after logging in
//
// Shows:
// 1. Header with surgeon name, specialty and availability toggle
// 2. Stats row: total cases, rating, pending requests
// 3. Incoming Requests section: cases where this surgeon has been notified
//    and needs to accept or decline
// 4. Upcoming Confirmed Cases: cases already accepted, coming up soon
//
// Data is fetched from our backend API:
// - GET /api/surgeons/:id         → surgeon profile + stats
// - GET /api/surgeons/:id/requests → incoming + upcoming cases
//
// The screen auto-refreshes every 60 seconds to pick up new requests.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';

import axios from 'axios';
import CONFIG from '../lib/config';

// ── DEV MODE ───────────────────────────────────────────────────────────────────
// When true, uses the hardcoded test surgeon ID instead of a real logged-in user
const DEV_MODE = true;

export default function HomeScreen({ navigation, surgeonId }) {

  // ── STATE ──────────────────────────────────────────────────────────────────

  // Surgeon profile data fetched from the database
  const [surgeon, setSurgeon] = useState(null);

  // List of incoming requests (cases where this surgeon is notified)
  const [incomingRequests, setIncomingRequests] = useState([]);

  // List of upcoming confirmed cases (already accepted)
  const [upcomingCases, setUpcomingCases] = useState([]);

  // Whether the surgeon is currently available to take new cases
  // Controls the toggle switch in the header
  const [available, setAvailable] = useState(true);

  // Loading state for the initial data fetch
  const [loading, setLoading] = useState(true);

  // Pull-to-refresh loading state
  const [refreshing, setRefreshing] = useState(false);

  // Error message if data fetch fails
  const [error, setError] = useState('');

  // ── GET SURGEON ID ─────────────────────────────────────────────────────────
  // In DEV_MODE, use the hardcoded test surgeon ID.
  // In production, this would come from Supabase auth session.
  // const surgeonId = CONFIG.DEV_SURGEON_ID;

  // ── FETCH DATA ─────────────────────────────────────────────────────────────
  // Fetches surgeon profile and their incoming/upcoming cases from the backend.
  // Called on first load and every 60 seconds automatically.
  const fetchData = useCallback(async () => {
    try {
      console.log('HomeScreen: Fetching data for surgeon:', surgeonId);

      // Fetch surgeon profile (name, specialty, rating, etc.)
      const profileResponse = await axios.get(
        `${CONFIG.API_URL}/api/surgeons/${surgeonId}`
      );
      const surgeonData = profileResponse.data.surgeon;
      setSurgeon(surgeonData);

      // Sync the availability toggle with what's stored in the database
      setAvailable(surgeonData.available);

      // Fetch incoming requests and upcoming confirmed cases
      const requestsResponse = await axios.get(
        `${CONFIG.API_URL}/api/surgeons/${surgeonId}/requests`
      );
      setIncomingRequests(requestsResponse.data.incoming_requests || []);
      setUpcomingCases(requestsResponse.data.upcoming_cases || []);

      console.log('HomeScreen: Data fetched successfully');
      setError('');

    } catch (err) {
      console.error('HomeScreen: Error fetching data:', err.message);
      setError('Could not load data. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [surgeonId]);

  // ── INITIAL LOAD ───────────────────────────────────────────────────────────
  // Fetch data when screen first loads
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── AUTO REFRESH ───────────────────────────────────────────────────────────
  // Refresh data every 60 seconds to pick up new incoming requests
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('HomeScreen: Auto-refreshing data...');
      fetchData();
    }, 60000); // 60 seconds

    // Clear the interval when the screen is unmounted
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── PULL TO REFRESH ────────────────────────────────────────────────────────
  // Called when surgeon pulls down on the scroll view
  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // ── TOGGLE AVAILABILITY ────────────────────────────────────────────────────
  // Called when surgeon toggles the availability switch
  // Updates the database so the matching algorithm knows whether to include them
  const handleToggleAvailability = async (newValue) => {
    // Update UI immediately (optimistic update)
    setAvailable(newValue);
    console.log('HomeScreen: Toggling availability to:', newValue);

    try {
      await axios.patch(
        `${CONFIG.API_URL}/api/surgeons/${surgeonId}/availability`,
        { available: newValue }
      );
      console.log('HomeScreen: Availability updated successfully');
    } catch (err) {
      // If the API call fails, revert the toggle
      console.error('HomeScreen: Failed to update availability:', err.message);
      setAvailable(!newValue);
    }
  };

  // ── FORMAT HELPERS ─────────────────────────────────────────────────────────

  // Format date: "2026-03-10" → "Mar 10, 2026"
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  // Format fee from paise to rupees: 4500000 → "₹45,000"
  const formatFee = (paise) => {
    if (!paise) return '—';
    return '₹' + (paise / 100).toLocaleString('en-IN');
  };

  // Calculate time remaining until a timestamp expires
  // Returns a string like "1h 23m remaining" or "Expired"
  const getTimeRemaining = (expiresAt) => {
    if (!expiresAt) return '';
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires - now;

    if (diff <= 0) return 'Expired';

    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);

    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  // ── LOADING STATE ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A56A0" />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── HEADER ── */}
      {/* Dark navy header with surgeon info and availability toggle */}
      <View style={styles.header}>
        <View style={styles.headerTop}>

          {/* Surgeon avatar (initials) + name + specialty */}
          <View style={styles.surgeonInfo}>
            {surgeon?.profile_photo_url ? (
              <Image
                source={{ uri: surgeon.profile_photo_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {surgeon?.name
                    ? surgeon.name.split(' ').slice(-2).map(n => n[0]).join('')
                    : 'DR'}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.greeting}>Good morning 👋</Text>
              <Text style={styles.surgeonName}>
                {surgeon?.name || 'Dr. Loading...'}
              </Text>
              <Text style={styles.surgeonSpecialty}>
                {Array.isArray(surgeon?.specialty)
                  ? surgeon.specialty[0]
                  : surgeon?.specialty || 'Surgeon'}
              </Text>
            </View>
          </View>

          {/* Availability toggle */}
          <View style={styles.availabilityToggle}>
            <Text style={styles.availabilityLabel}>
              {available ? '🟢 Available' : '🔴 Unavailable'}
            </Text>
            <Switch
              value={available}
              onValueChange={handleToggleAvailability}
              trackColor={{ false: '#CBD5E1', true: '#BFDBFE' }}
              thumbColor={available ? '#1A56A0' : '#94A3B8'}
            />
          </View>
        </View>

        {/* ── STATS ROW ── */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{surgeon?.total_cases || 0}</Text>
            <Text style={styles.statLabel}>Total Cases</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>⭐ {surgeon?.rating || '—'}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{incomingRequests.length}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>
      </View>

      {/* ── SCROLLABLE CONTENT ── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          // Pull to refresh
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#1A56A0"
          />
        }
      >

        {/* Error message */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        ) : null}

        {/* ── INCOMING REQUESTS SECTION ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Incoming Requests
            {incomingRequests.length > 0 && (
              <Text style={styles.sectionBadge}> {incomingRequests.length}</Text>
            )}
          </Text>

          {incomingRequests.length === 0 ? (
            // Empty state
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No pending requests</Text>
              <Text style={styles.emptySubtext}>
                New surgery requests will appear here
              </Text>
            </View>
          ) : (
            // Request cards
            incomingRequests.map((request) => (
              <TouchableOpacity
                key={request.case_id}
                style={styles.requestCard}
                onPress={() => navigation.navigate('RequestDetail', {caseId: request.case_id,surgeonId})}
              >
                {/* Urgent amber top bar */}
                <View style={styles.requestCardHeader}>
                  <Text style={styles.requestCardHeaderText}>
                    ⚡ Response needed
                  </Text>
                  <Text style={styles.requestCardTimer}>
                    {getTimeRemaining(request.expires_at)}
                  </Text>
                </View>

                <View style={styles.requestCardBody}>
                  {/* Procedure and specialty */}
                  <Text style={styles.requestProcedure}>
                    {request.procedure}
                  </Text>
                  <Text style={styles.requestSpecialty}>
                    {request.specialty_required}
                  </Text>

                  {/* Date, time and fee row */}
                  <View style={styles.requestMeta}>
                    <Text style={styles.requestMetaItem}>
                      📅 {formatDate(request.surgery_date)}
                    </Text>
                    <Text style={styles.requestMetaItem}>
                      🕐 {request.surgery_time}
                    </Text>
                    <Text style={styles.requestMetaItem}>
                      💰 {formatFee(request.fee_max)}
                    </Text>
                  </View>

                  {/* View details link */}
                  <Text style={styles.viewDetails}>
                    View Details & Respond →
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* ── UPCOMING CONFIRMED CASES SECTION ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Cases</Text>

          {upcomingCases.length === 0 ? (
            // Empty state
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyText}>No upcoming cases</Text>
              <Text style={styles.emptySubtext}>
                Confirmed cases will appear here
              </Text>
            </View>
          ) : (
            // Upcoming case cards
            upcomingCases.map((case_) => (
              <TouchableOpacity
                key={case_.id}
                style={styles.upcomingCard}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('AcceptedCase', { caseId: case_.id })}
              >
                {/* Date column */}
                <View style={styles.upcomingDate}>
                  <Text style={styles.upcomingDateDay}>
                    {new Date(case_.surgery_date).getDate()}
                  </Text>
                  <Text style={styles.upcomingDateMonth}>
                    {new Date(case_.surgery_date).toLocaleDateString('en-IN', { month: 'short' })}
                  </Text>
                </View>

                {/* Case info */}
                <View style={styles.upcomingInfo}>
                  <Text style={styles.upcomingProcedure}>{case_.procedure}</Text>
                  <Text style={styles.upcomingMeta}>
                    🕐 {case_.surgery_time} · OT {case_.ot_number}
                  </Text>
                  <Text style={styles.upcomingFee}>
                    {formatFee(case_.fee_max)} confirmed
                  </Text>
                  {/* View details link */}
                  <Text style={styles.viewDetails}>View Details →</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Bottom padding so last item isn't hidden behind tab bar */}
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

  // ── LOADING ──
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
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  surgeonInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#1A56A0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  greeting: {
    color: '#94A3B8',
    fontSize: 12,
  },
  surgeonName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  surgeonSpecialty: {
    color: '#60A5FA',
    fontSize: 12,
    marginTop: 2,
  },

  // Availability toggle
  availabilityToggle: {
    alignItems: 'flex-end',
    gap: 4,
  },
  availabilityLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },

  // Stats row inside header
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#1E3A5F',
    borderRadius: 14,
    padding: 16,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#2D4F7C',
  },

  // ── SCROLL VIEW ──
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

  // ── SECTIONS ──
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0B1F3A',
    marginBottom: 12,
  },
  sectionBadge: {
    color: '#1A56A0',
  },

  // Empty state
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },

  // ── INCOMING REQUEST CARDS ──
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FCD34D',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  requestCardHeader: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FCD34D',
  },
  requestCardHeaderText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '700',
  },
  requestCardTimer: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  requestCardBody: {
    padding: 16,
  },
  requestProcedure: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0B1F3A',
  },
  requestSpecialty: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 10,
  },
  requestMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  requestMetaItem: {
    fontSize: 13,
    color: '#475569',
  },
  viewDetails: {
    color: '#1A56A0',
    fontSize: 14,
    fontWeight: '700',
  },

  // ── UPCOMING CASE CARDS ──
  upcomingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  upcomingDate: {
    width: 52,
    height: 52,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  upcomingDateDay: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A56A0',
    lineHeight: 22,
  },
  upcomingDateMonth: {
    fontSize: 11,
    color: '#1A56A0',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  upcomingInfo: {
    flex: 1,
  },
  upcomingProcedure: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0B1F3A',
  },
  upcomingMeta: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
  },
  upcomingFee: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
    marginTop: 3,
  },
});