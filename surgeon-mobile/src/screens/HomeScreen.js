// surgeon-on-call/surgeon-mobile/src/screens/HomeScreen.js
// HOME SCREEN — Main screen the surgeon sees after logging in

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, RefreshControl, ActivityIndicator, Platform, Image,
} from 'react-native';
import axios from 'axios';
import CONFIG from '../lib/config';

const DEV_MODE = true;

// ── BRAND COLOURS ──────────────────────────────────────────────────────────────
const B = {
  orange: '#E56717', orangeHover: '#CD4D00',
  bg: '#FDF8F5', body: '#444444', muted: '#8B8B8B', border: '#E8E0D8',
  card: '#FFFFFF', header: '#2C1A0E', headerInner: '#3D2410',
  green: '#16a34a', red: '#DC2626',
  amber: '#D97706', amberBg: '#FFFBEB', amberBorder: '#FCD34D',
};

export default function HomeScreen({ navigation, surgeonId }) {
  const [surgeon,          setSurgeon]          = useState(null);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [upcomingCases,    setUpcomingCases]    = useState([]);
  const [available,        setAvailable]        = useState(true);
  const [loading,          setLoading]          = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);
  const [error,            setError]            = useState('');

  const fetchData = useCallback(async () => {
    try {
      const profileRes  = await axios.get(`${CONFIG.API_URL}/api/surgeons/${surgeonId}`);
      const surgeonData = profileRes.data.surgeon;
      setSurgeon(surgeonData);
      setAvailable(surgeonData.available);

      const requestsRes = await axios.get(`${CONFIG.API_URL}/api/surgeons/${surgeonId}/requests`);

      // ── Sort incoming requests by urgency ────────────────────────────────
      // 1. Emergency cases always pinned to top
      // 2. Non-emergency sorted by expires_at ascending (soonest deadline first)
      // 3. Requests with no expires_at sink to the bottom
      const sorted = [...(requestsRes.data.incoming_requests || [])].sort((a, b) => {
        const aEmergency = a.request_type === 'emergency';
        const bEmergency = b.request_type === 'emergency';

        // Emergency cases always come first
        if (aEmergency && !bEmergency) return -1;
        if (!aEmergency && bEmergency) return 1;

        // Within the same group, sort by soonest expires_at
        const aExp = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
        const bExp = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
        return aExp - bExp;
      });

      setIncomingRequests(sorted);
      setUpcomingCases(requestsRes.data.upcoming_cases || []);
      setError('');
    } catch (err) {
      setError('Could not load data. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [surgeonId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => { setRefreshing(true); fetchData(); };

  const handleToggleAvailability = async (newValue) => {
    setAvailable(newValue);
    try {
      await axios.patch(`${CONFIG.API_URL}/api/surgeons/${surgeonId}/availability`, { available: newValue });
    } catch { setAvailable(!newValue); }
  };

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  const formatFee = (p) => p ? '₹' + (p / 100).toLocaleString('en-IN') : '—';

  const getTimeRemaining = (expiresAt) => {
    if (!expiresAt) return '';
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return 'Expired';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={B.orange} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {/* Avatar + name */}
          <View style={styles.surgeonInfo}>
            {surgeon?.profile_photo_url ? (
              <Image source={{ uri: surgeon.profile_photo_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {surgeon?.name ? surgeon.name.split(' ').slice(-2).map(n => n[0]).join('') : 'DR'}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.greeting}>Good morning 👋</Text>
              <Text style={styles.surgeonName}>{surgeon?.name || 'Dr. Loading...'}</Text>
              <Text style={styles.surgeonSpecialty}>
                {Array.isArray(surgeon?.specialty) ? surgeon.specialty[0] : surgeon?.specialty || 'Surgeon'}
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
              trackColor={{ false: B.border, true: '#F5C9A8' }}
              thumbColor={available ? B.orange : B.muted}
            />
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatItem value={surgeon?.total_cases || 0} label="Total Cases" />
          <View style={styles.statDivider} />
          <StatItem value={`⭐ ${surgeon?.rating || '—'}`} label="Rating" />
          <View style={styles.statDivider} />
          <StatItem value={incomingRequests.length} label="Pending" highlight={incomingRequests.length > 0} />
        </View>
      </View>

      {/* ── SCROLL BODY ── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={B.orange} />}
      >
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        ) : null}

        {/* ── INCOMING REQUESTS ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Incoming Requests
            {incomingRequests.length > 0 && (
              <Text style={styles.sectionBadge}> {incomingRequests.length}</Text>
            )}
          </Text>

          {incomingRequests.length === 0 ? (
            <EmptyState icon="📭" title="No pending requests" subtitle="New surgery requests will appear here" />
          ) : (
            incomingRequests.map((req) => (
              <TouchableOpacity
                key={req.case_id}
                style={styles.requestCard}
                onPress={() => navigation.navigate('RequestDetail', { caseId: req.case_id, surgeonId })}
              >
                {/* Amber urgency bar */}
                <View style={styles.requestCardHeader}>
                  <Text style={styles.requestCardHeaderText}>⚡ Response needed</Text>
                  <Text style={styles.requestCardTimer}>{getTimeRemaining(req.expires_at)}</Text>
                </View>
                <View style={styles.requestCardBody}>
                  <Text style={styles.requestProcedure}>{req.procedure}</Text>
                  <Text style={styles.requestSpecialty}>{req.specialty_required}</Text>
                  <View style={styles.requestMeta}>
                    <Text style={styles.requestMetaItem}>📅 {formatDate(req.surgery_date)}</Text>
                    <Text style={styles.requestMetaItem}>🕐 {req.surgery_time}</Text>
                    <Text style={styles.requestMetaItem}>💰 {formatFee(req.fee_max)}</Text>
                  </View>
                  <Text style={styles.viewDetails}>View Details & Respond →</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* ── UPCOMING CASES ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Cases</Text>

          {upcomingCases.length === 0 ? (
            <EmptyState icon="📅" title="No upcoming cases" subtitle="Confirmed cases will appear here" />
          ) : (
            upcomingCases.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.upcomingCard}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('AcceptedCase', { caseId: c.id })}
              >
                <View style={styles.upcomingDate}>
                  <Text style={styles.upcomingDateDay}>{new Date(c.surgery_date).getDate()}</Text>
                  <Text style={styles.upcomingDateMonth}>
                    {new Date(c.surgery_date).toLocaleDateString('en-IN', { month: 'short' })}
                  </Text>
                </View>
                <View style={styles.upcomingInfo}>
                  <Text style={styles.upcomingProcedure}>{c.procedure}</Text>
                  <Text style={styles.upcomingMeta}>🕐 {c.surgery_time} · OT {c.ot_number}</Text>
                  <Text style={styles.upcomingFee}>{formatFee(c.fee_max)} confirmed</Text>
                  <Text style={styles.viewDetails}>View Details →</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

// ── SMALL HELPERS ─────────────────────────────────────────────────────────────
function StatItem({ value, label, highlight }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, highlight && { color: B.orange }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ icon, title, subtitle }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyText}>{title}</Text>
      <Text style={styles.emptySubtext}>{subtitle}</Text>
    </View>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: B.bg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: B.bg, gap: 16 },
  loadingText:      { color: B.muted, fontSize: 14 },

  // Header
  header: {
    backgroundColor:   B.header,
    paddingTop:        Platform.OS === 'ios' ? 56 : 48,
    paddingHorizontal: 20,
    paddingBottom:     20,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },

  surgeonInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: B.orange,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText:       { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  greeting:         { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  surgeonName:      { color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginTop: 2 },
  surgeonSpecialty: { color: B.orange, fontSize: 12, marginTop: 2 },

  availabilityToggle: { alignItems: 'flex-end', gap: 4 },
  availabilityLabel:  { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600' },

  // Stats row — slightly lighter warm dark
  statsRow: {
    flexDirection:  'row',
    backgroundColor:'rgba(255,255,255,0.08)',
    borderRadius:    14,
    padding:         16,
    justifyContent: 'space-around',
    alignItems:     'center',
    borderWidth:     1,
    borderColor:    'rgba(255,255,255,0.1)',
  },
  statItem:    { alignItems: 'center' },
  statValue:   { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  statLabel:   { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.12)' },

  // Scroll
  scrollView:    { flex: 1 },
  scrollContent: { padding: 16 },

  // Error
  errorBanner: {
    backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12,
    marginBottom: 16, borderLeftWidth: 4, borderLeftColor: B.red,
  },
  errorText: { color: B.red, fontSize: 13 },

  // Sections
  section:      { marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: B.body, marginBottom: 12 },
  sectionBadge: { color: B.orange },

  // Empty states
  emptyState: {
    backgroundColor: B.card, borderRadius: 16, padding: 32,
    alignItems: 'center', borderWidth: 1, borderColor: B.border,
  },
  emptyIcon:    { fontSize: 36, marginBottom: 8 },
  emptyText:    { fontSize: 15, fontWeight: '600', color: B.muted },
  emptySubtext: { fontSize: 13, color: B.muted, marginTop: 4, textAlign: 'center' },

  // Incoming request cards
  requestCard: {
    backgroundColor: B.card, borderRadius: 16, marginBottom: 12,
    overflow: 'hidden', borderWidth: 1, borderColor: B.amberBorder,
    shadowColor: '#442200', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  requestCardHeader: {
    backgroundColor: B.amberBg, paddingHorizontal: 16, paddingVertical: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: B.amberBorder,
  },
  requestCardHeaderText: { color: '#92400E', fontSize: 12, fontWeight: '700' },
  requestCardTimer: {
    color: B.amber, fontSize: 12, fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  requestCardBody:  { padding: 16 },
  requestProcedure: { fontSize: 16, fontWeight: '700', color: B.body },
  requestSpecialty: { fontSize: 13, color: B.muted, marginTop: 2, marginBottom: 10 },
  requestMeta:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  requestMetaItem:  { fontSize: 13, color: B.body },
  viewDetails:      { color: B.orange, fontSize: 14, fontWeight: '700' },

  // Upcoming case cards
  upcomingCard: {
    backgroundColor: B.card, borderRadius: 16, padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 16,
    borderWidth: 1, borderColor: B.border,
    shadowColor: '#442200', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  upcomingDate: {
    width: 52, height: 52, backgroundColor: '#FFF3EB',
    borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    flexShrink: 0, borderWidth: 1, borderColor: '#F5C9A8',
  },
  upcomingDateDay:   { fontSize: 20, fontWeight: '800', color: B.orange, lineHeight: 22 },
  upcomingDateMonth: { fontSize: 11, color: B.orange, fontWeight: '600', textTransform: 'uppercase' },
  upcomingInfo:      { flex: 1 },
  upcomingProcedure: { fontSize: 15, fontWeight: '700', color: B.body },
  upcomingMeta:      { fontSize: 13, color: B.muted, marginTop: 3 },
  upcomingFee:       { fontSize: 13, color: '#16a34a', fontWeight: '600', marginTop: 3 },
});