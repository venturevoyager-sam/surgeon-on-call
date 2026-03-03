// surgeon-on-call/surgeon-mobile/src/screens/EarningsScreen.js
//
// EARNINGS SCREEN — Shows the surgeon's payment history
//
// Shows:
// 1. Summary cards at the top:
//    - This month's earnings
//    - All time total earnings
//    - Pending (not yet released) amount
// 2. Payment history list — one card per completed case showing:
//    - Procedure name and date
//    - Gross fee, platform commission (5%), net payout
//    - Payment status: pending / released / disputed
//
// API call:
// - GET /api/surgeons/:id/earnings → list of completed cases with payment info

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import axios from 'axios';
import CONFIG from '../lib/config';

export default function EarningsScreen() {

  // ── STATE ──────────────────────────────────────────────────────────────────

  // List of earnings records fetched from the backend
  const [earnings, setEarnings] = useState([]);

  // Summary totals calculated from the earnings list
  const [summary, setSummary] = useState({
    thisMonth: 0,   // Earnings in the current calendar month
    allTime: 0,     // Total earnings ever
    pending: 0,     // Amount not yet released to bank
  });

  // Loading state for initial fetch
  const [loading, setLoading] = useState(true);

  // Pull-to-refresh loading state
  const [refreshing, setRefreshing] = useState(false);

  // Error message if fetch fails
  const [error, setError] = useState('');

  // ── FETCH EARNINGS ─────────────────────────────────────────────────────────
  // Fetches the surgeon's earnings history from the backend.
  // Each record represents one completed surgery with payment details.
  const fetchEarnings = useCallback(async () => {
    try {
      console.log('EarningsScreen: Fetching earnings for:', CONFIG.DEV_SURGEON_ID);

      const response = await axios.get(
        `${CONFIG.API_URL}/api/surgeons/${CONFIG.DEV_SURGEON_ID}/earnings`
      );

      const earningsData = response.data.earnings || [];
      setEarnings(earningsData);

      // ── CALCULATE SUMMARY TOTALS ──────────────────────────────────────────
      // Loop through all earnings to calculate the three summary numbers
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      let thisMonth = 0;
      let allTime = 0;
      let pending = 0;

      earningsData.forEach(earning => {
        // Net payout = fee minus 5% commission
        const netPayout = earning.net_payout || 0;

        // Add to all-time total
        allTime += netPayout;

        // Add to this month if surgery was this month
        const surgeryDate = new Date(earning.surgery_date);
        if (surgeryDate >= thisMonthStart) {
          thisMonth += netPayout;
        }

        // Add to pending if payment not yet released
        if (earning.payment_status === 'pending') {
          pending += netPayout;
        }
      });

      setSummary({ thisMonth, allTime, pending });
      setError('');
      console.log('EarningsScreen: Loaded', earningsData.length, 'earnings records');

    } catch (err) {
      console.error('EarningsScreen: Error fetching earnings:', err.message);
      setError('Could not load earnings. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── INITIAL LOAD ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  // ── PULL TO REFRESH ────────────────────────────────────────────────────────
  const handleRefresh = () => {
    setRefreshing(true);
    fetchEarnings();
  };

  // ── FORMAT HELPERS ─────────────────────────────────────────────────────────

  // Format paise to rupees: 4500000 → "₹45,000"
  const formatFee = (paise) => {
    if (!paise && paise !== 0) return '—';
    return '₹' + (paise / 100).toLocaleString('en-IN');
  };

  // Format date: "2026-03-10" → "Mar 10, 2026"
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  // Returns styles for the payment status badge
  // pending = amber, released = green, disputed = red
  const getStatusStyle = (status) => {
    switch (status) {
      case 'released':
        return { badge: styles.statusReleased, text: styles.statusReleasedText };
      case 'disputed':
        return { badge: styles.statusDisputed, text: styles.statusDisputedText };
      default: // pending
        return { badge: styles.statusPending, text: styles.statusPendingText };
    }
  };

  // Returns a human-readable label for each payment status
  const getStatusLabel = (status) => {
    switch (status) {
      case 'released': return '✓ Released';
      case 'disputed': return '⚠ Disputed';
      default: return '⏳ Pending';
    }
  };

  // ── LOADING STATE ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A56A0" />
        <Text style={styles.loadingText}>Loading earnings...</Text>
      </View>
    );
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Earnings</Text>
        <Text style={styles.headerSubtitle}>Vaidhya Healthcare Pvt Ltd</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#1A56A0"
          />
        }
      >

        {/* ── SUMMARY CARDS ROW ── */}
        <View style={styles.summaryRow}>

          {/* This month */}
          <View style={[styles.summaryCard, styles.summaryCardBlue]}>
            <Text style={styles.summaryCardLabel}>This Month</Text>
            <Text style={styles.summaryCardValue}>
              {formatFee(summary.thisMonth)}
            </Text>
          </View>

          {/* All time */}
          <View style={[styles.summaryCard, styles.summaryCardNavy]}>
            <Text style={styles.summaryCardLabel}>All Time</Text>
            <Text style={styles.summaryCardValue}>
              {formatFee(summary.allTime)}
            </Text>
          </View>

          {/* Pending release */}
          <View style={[styles.summaryCard, styles.summaryCardAmber]}>
            <Text style={styles.summaryCardLabel}>Pending</Text>
            <Text style={styles.summaryCardValue}>
              {formatFee(summary.pending)}
            </Text>
          </View>

        </View>

        {/* Commission note */}
        <View style={styles.commissionNote}>
          <Text style={styles.commissionNoteText}>
            💡 All amounts shown are after 5% platform commission deduction
          </Text>
        </View>

        {/* Error message */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        ) : null}

        {/* ── PAYMENT HISTORY ── */}
        <Text style={styles.sectionTitle}>Payment History</Text>

        {earnings.length === 0 ? (
          // Empty state
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💰</Text>
            <Text style={styles.emptyText}>No earnings yet</Text>
            <Text style={styles.emptySubtext}>
              Completed cases will appear here once payment is processed
            </Text>
          </View>
        ) : (
          // Earnings cards
          earnings.map((earning) => {
            const statusStyle = getStatusStyle(earning.payment_status);
            return (
              <View key={earning.case_id} style={styles.earningCard}>

                {/* Top row: procedure name + status badge */}
                <View style={styles.earningCardTop}>
                  <Text style={styles.earningProcedure} numberOfLines={1}>
                    {earning.procedure}
                  </Text>
                  <View style={[styles.statusBadge, statusStyle.badge]}>
                    <Text style={statusStyle.text}>
                      {getStatusLabel(earning.payment_status)}
                    </Text>
                  </View>
                </View>

                {/* Date */}
                <Text style={styles.earningDate}>
                  📅 {formatDate(earning.surgery_date)}
                </Text>

                {/* Fee breakdown */}
                <View style={styles.feeBreakdown}>
                  <View style={styles.feeBreakdownItem}>
                    <Text style={styles.feeBreakdownLabel}>Gross Fee</Text>
                    <Text style={styles.feeBreakdownValue}>
                      {formatFee(earning.gross_fee)}
                    </Text>
                  </View>
                  <View style={styles.feeBreakdownDivider} />
                  <View style={styles.feeBreakdownItem}>
                    <Text style={styles.feeBreakdownLabel}>Commission</Text>
                    <Text style={styles.feeBreakdownCommission}>
                      − {formatFee(earning.commission_amount)}
                    </Text>
                  </View>
                  <View style={styles.feeBreakdownDivider} />
                  <View style={styles.feeBreakdownItem}>
                    <Text style={styles.feeBreakdownLabel}>Net Payout</Text>
                    <Text style={styles.feeBreakdownNet}>
                      {formatFee(earning.net_payout)}
                    </Text>
                  </View>
                </View>

              </View>
            );
          })
        )}

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
    paddingBottom: 24,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#60A5FA',
    fontSize: 13,
    marginTop: 4,
  },

  // ── SCROLL ──
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // ── SUMMARY CARDS ──
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  summaryCardBlue: {
    backgroundColor: '#1A56A0',
  },
  summaryCardNavy: {
    backgroundColor: '#0B1F3A',
  },
  summaryCardAmber: {
    backgroundColor: '#D97706',
  },
  summaryCardLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  summaryCardValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  // Commission note
  commissionNote: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#1A56A0',
  },
  commissionNoteText: {
    color: '#1E3A5F',
    fontSize: 12,
    lineHeight: 18,
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

  // Section title
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0B1F3A',
    marginBottom: 12,
  },

  // Empty state
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── EARNING CARDS ──
  earningCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  earningCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  earningProcedure: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0B1F3A',
    flex: 1,
  },
  earningDate: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 14,
  },

  // Status badges
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    flexShrink: 0,
  },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusPendingText: { color: '#92400E', fontSize: 12, fontWeight: '600' },
  statusReleased: { backgroundColor: '#D1FAE5' },
  statusReleasedText: { color: '#065F46', fontSize: 12, fontWeight: '600' },
  statusDisputed: { backgroundColor: '#FEE2E2' },
  statusDisputedText: { color: '#991B1B', fontSize: 12, fontWeight: '600' },

  // Fee breakdown row inside each earning card
  feeBreakdown: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  feeBreakdownItem: {
    flex: 1,
    alignItems: 'center',
  },
  feeBreakdownDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
  },
  feeBreakdownLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  feeBreakdownValue: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '700',
  },
  feeBreakdownCommission: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '700',
  },
  feeBreakdownNet: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '800',
  },
});