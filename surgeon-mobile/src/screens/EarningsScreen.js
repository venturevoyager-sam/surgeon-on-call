// surgeon-on-call/surgeon-mobile/src/screens/EarningsScreen.js
// EARNINGS SCREEN — Shows the surgeon's payment history

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator, Platform,
} from 'react-native';
import axios from 'axios';
import CONFIG from '../lib/config';

// ── BRAND COLOURS ──────────────────────────────────────────────────────────────
const B = {
  orange: '#E56717',
  bg: '#FDF8F5', body: '#444444', muted: '#8B8B8B', border: '#E8E0D8',
  card: '#FFFFFF', header: '#2C1A0E',
  green: '#16a34a', red: '#DC2626',
};

export default function EarningsScreen() {
  const [earnings,   setEarnings]   = useState([]);
  const [summary,    setSummary]    = useState({ thisMonth: 0, allTime: 0, pending: 0 });
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  const fetchEarnings = useCallback(async () => {
    try {
      const response = await axios.get(`${CONFIG.API_URL}/api/surgeons/${CONFIG.DEV_SURGEON_ID}/earnings`);
      const data = response.data.earnings || [];
      setEarnings(data);

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      let thisMonth = 0, allTime = 0, pending = 0;
      data.forEach(e => {
        const net = e.net_payout || 0;
        allTime += net;
        if (new Date(e.surgery_date) >= thisMonthStart) thisMonth += net;
        if (e.payment_status === 'pending') pending += net;
      });
      setSummary({ thisMonth, allTime, pending });
      setError('');
    } catch (err) {
      setError('Could not load earnings. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchEarnings(); }, [fetchEarnings]);
  const handleRefresh = () => { setRefreshing(true); fetchEarnings(); };

  const formatFee = (p) => (p || p === 0) ? '₹' + (p / 100).toLocaleString('en-IN') : '—';
  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  const statusStyle = (s) => {
    if (s === 'released') return { badge: styles.statusReleased, text: styles.statusReleasedText, label: '✓ Released' };
    if (s === 'disputed') return { badge: styles.statusDisputed, text: styles.statusDisputedText, label: '⚠ Disputed' };
    return { badge: styles.statusPending, text: styles.statusPendingText, label: '⏳ Pending' };
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={B.orange} />
        <Text style={styles.loadingText}>Loading earnings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Earnings</Text>
        <Text style={styles.headerSubtitle}>Surgeon on Call</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={B.orange} />}
      >
        {/* ── SUMMARY CARDS ── */}
        <View style={styles.summaryRow}>
          <SummaryCard label="This Month" value={formatFee(summary.thisMonth)} color={B.orange} />
          <SummaryCard label="All Time"   value={formatFee(summary.allTime)}   color={B.header} />
          <SummaryCard label="Pending"    value={formatFee(summary.pending)}   color='#D97706' />
        </View>

        {/* Commission note */}
        <View style={styles.commissionNote}>
          <Text style={styles.commissionNoteText}>
            💡 All amounts shown are after 5% platform commission deduction
          </Text>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        ) : null}

        {/* ── PAYMENT HISTORY ── */}
        <Text style={styles.sectionTitle}>Payment History</Text>

        {earnings.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💰</Text>
            <Text style={styles.emptyText}>No earnings yet</Text>
            <Text style={styles.emptySubtext}>Completed cases will appear here once payment is processed</Text>
          </View>
        ) : (
          earnings.map((e) => {
            const ss = statusStyle(e.payment_status);
            return (
              <View key={e.case_id} style={styles.earningCard}>
                <View style={styles.earningCardTop}>
                  <Text style={styles.earningProcedure} numberOfLines={1}>{e.procedure}</Text>
                  <View style={[styles.statusBadge, ss.badge]}>
                    <Text style={ss.text}>{ss.label}</Text>
                  </View>
                </View>
                <Text style={styles.earningDate}>📅 {formatDate(e.surgery_date)}</Text>
                <View style={styles.feeBreakdown}>
                  <FeeItem label="Gross Fee"   value={formatFee(e.gross_fee)} />
                  <View style={styles.feeDivider} />
                  <FeeItem label="Commission"  value={`− ${formatFee(e.commission_amount)}`} red />
                  <View style={styles.feeDivider} />
                  <FeeItem label="Net Payout"  value={formatFee(e.net_payout)} orange />
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <View style={[styles.summaryCard, { backgroundColor: color }]}>
      <Text style={styles.summaryCardLabel}>{label}</Text>
      <Text style={styles.summaryCardValue}>{value}</Text>
    </View>
  );
}

function FeeItem({ label, value, red, orange }) {
  return (
    <View style={styles.feeBreakdownItem}>
      <Text style={styles.feeBreakdownLabel}>{label}</Text>
      <Text style={[
        styles.feeBreakdownValue,
        red    && { color: '#DC2626' },
        orange && { color: B.orange },
      ]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: B.bg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: B.bg, gap: 16 },
  loadingText:      { color: B.muted, fontSize: 14 },

  // Header
  header: {
    backgroundColor: B.header,
    paddingTop: Platform.OS === 'ios' ? 56 : 48,
    paddingHorizontal: 20, paddingBottom: 24,
  },
  headerTitle:    { color: '#FFFFFF', fontSize: 26, fontWeight: '800' },
  headerSubtitle: { color: B.orange, fontSize: 13, marginTop: 4 },

  scrollView:    { flex: 1 },
  scrollContent: { padding: 16 },

  // Summary cards
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  summaryCard: {
    flex: 1, borderRadius: 14, padding: 14, alignItems: 'center',
  },
  summaryCardLabel: {
    color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6,
  },
  summaryCardValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  // Commission note
  commissionNote: {
    backgroundColor: '#FFF3EB', borderRadius: 10, padding: 12,
    marginBottom: 20, borderLeftWidth: 3, borderLeftColor: B.orange,
  },
  commissionNoteText: { color: B.body, fontSize: 12, lineHeight: 18 },

  errorBanner: {
    backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12,
    marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#DC2626',
  },
  errorText: { color: '#DC2626', fontSize: 13 },

  sectionTitle: { fontSize: 17, fontWeight: '700', color: B.body, marginBottom: 12 },

  emptyState: {
    backgroundColor: B.card, borderRadius: 16, padding: 40,
    alignItems: 'center', borderWidth: 1, borderColor: B.border,
  },
  emptyIcon:    { fontSize: 40, marginBottom: 12 },
  emptyText:    { fontSize: 16, fontWeight: '600', color: B.muted },
  emptySubtext: { fontSize: 13, color: B.muted, marginTop: 6, textAlign: 'center', lineHeight: 20 },

  // Earning cards
  earningCard: {
    backgroundColor: B.card, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: B.border,
    shadowColor: '#442200', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  earningCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 },
  earningProcedure: { fontSize: 15, fontWeight: '700', color: B.body, flex: 1 },
  earningDate:      { fontSize: 13, color: B.muted, marginBottom: 14 },

  statusBadge:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, flexShrink: 0 },
  statusPending:      { backgroundColor: '#FEF3C7' },
  statusPendingText:  { color: '#92400E', fontSize: 12, fontWeight: '600' },
  statusReleased:     { backgroundColor: '#D1FAE5' },
  statusReleasedText: { color: '#065F46', fontSize: 12, fontWeight: '600' },
  statusDisputed:     { backgroundColor: '#FEE2E2' },
  statusDisputedText: { color: '#991B1B', fontSize: 12, fontWeight: '600' },

  // Fee breakdown
  feeBreakdown: {
    flexDirection: 'row', backgroundColor: B.bg,
    borderRadius: 10, padding: 12, gap: 8,
    borderWidth: 1, borderColor: B.border,
  },
  feeBreakdownItem:  { flex: 1, alignItems: 'center' },
  feeDivider:        { width: 1, backgroundColor: B.border },
  feeBreakdownLabel: {
    fontSize: 11, color: B.muted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4,
  },
  feeBreakdownValue: { fontSize: 13, color: B.body, fontWeight: '700' },
});