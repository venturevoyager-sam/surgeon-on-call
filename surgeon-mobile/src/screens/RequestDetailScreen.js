// surgeon-on-call/surgeon-mobile/src/screens/RequestDetailScreen.js
//
// REQUEST DETAIL SCREEN — Full case details for the surgeon to review
//
// Shows:
// 1. Countdown timer — how long the surgeon has left to respond
// 2. Surgery details — procedure, specialty, date, time, duration, OT
// 3. Patient details — age, gender, clinical notes
// 4. Fee card — offered fee, platform commission (5%), net payout
// 5. Accept / Decline buttons at the bottom
//
// Important:
// - Hospital address is HIDDEN until surgeon accepts (privacy rule)
// - Accepting triggers case status → confirmed
// - Declining triggers cascade → next surgeon gets notified
//
// API calls:
// - GET  /api/cases/:id/surgeon-view  → fetch case details
// - PATCH /api/cases/:id/accept       → surgeon accepts
// - PATCH /api/cases/:id/decline      → surgeon declines

import React, { useState, useEffect } from 'react';
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

export default function RequestDetailScreen({ navigation, route }) {

  // ── GET CASE ID FROM NAVIGATION ────────────────────────────────────────────
  // HomeScreen passes the caseId when navigating here:
  // navigation.navigate('RequestDetail', { caseId: '...' })
  const { caseId, surgeonId } = route.params;

  // ── STATE ──────────────────────────────────────────────────────────────────

  // Full case details fetched from the backend
  const [caseData, setCaseData] = useState(null);

  // Loading state while fetching case details
  const [loading, setLoading] = useState(true);

  // Loading state while submitting accept/decline
  const [submitting, setSubmitting] = useState(false);

  // Error message
  const [error, setError] = useState('');

  // Countdown timer string shown in the header e.g. "01:23:45"
  const [timeLeft, setTimeLeft] = useState('');

  // ── FETCH CASE DETAILS ─────────────────────────────────────────────────────
  // Fetches the surgeon-specific view of the case.
  // Hospital address is hidden in this endpoint until surgeon accepts.
  useEffect(() => {
    const fetchCase = async () => {
      try {
        console.log('RequestDetail: Fetching case:', caseId);

        const response = await axios.get(
          `${CONFIG.API_URL}/api/cases/${caseId}/surgeon-view`,
          { params: { surgeon_id: surgeonId } }
        );
        setCaseData(response.data.case);
        console.log('RequestDetail: Case loaded:', response.data.case.procedure);

      } catch (err) {
        console.error('RequestDetail: Error fetching case:', err.message);
        setError('Could not load case details. Please go back and try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchCase();
  }, [caseId]);

  // ── COUNTDOWN TIMER ────────────────────────────────────────────────────────
  // Updates every second to show how much time the surgeon has left to respond.
  // When it hits zero, the cascade automatically moves to the next surgeon.
  useEffect(() => {
    if (!caseData?.expires_at) return;

    const timer = setInterval(() => {
      const now = new Date();
      const expires = new Date(caseData.expires_at);
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft('00:00:00');
        clearInterval(timer);
        return;
      }

      // Format as HH:MM:SS
      const hours   = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setTimeLeft(
        `${String(hours).padStart(2, '0')}:` +
        `${String(minutes).padStart(2, '0')}:` +
        `${String(seconds).padStart(2, '0')}`
      );
    }, 1000);

    // Clean up timer when screen unmounts
    return () => clearInterval(timer);
  }, [caseData]);

  // ── HANDLE ACCEPT ──────────────────────────────────────────────────────────
  // Called when surgeon taps the Accept button.
  // Shows a confirmation alert first, then calls the backend.
  const handleAccept = () => {
    Alert.alert(
      'Accept this case?',
      `You are confirming to perform ${caseData?.procedure} on ${formatDate(caseData?.surgery_date)}.`,
      [
        // Cancel — do nothing
        { text: 'Cancel', style: 'cancel' },

        // Confirm — call the accept API
        {
          text: 'Yes, Accept',
          style: 'default',
          onPress: async () => {
            setSubmitting(true);
            try {
              console.log('RequestDetail: Accepting case:', caseId);

              await axios.patch(
                `${CONFIG.API_URL}/api/cases/${caseId}/accept`,
                { surgeon_id: surgeonId  }
              );

              console.log('RequestDetail: Case accepted successfully');

              // Show success message and go back to home
              Alert.alert(
                '✅ Case Accepted!',
                'The hospital has been notified. Our associate will contact you shortly.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );

            } catch (err) {
              console.error('RequestDetail: Error accepting case:', err.message);
              Alert.alert('Error', 'Could not accept case. Please try again.');
            } finally {
              setSubmitting(false);
            }
          }
        }
      ]
    );
  };

  // ── HANDLE DECLINE ─────────────────────────────────────────────────────────
  // Called when surgeon taps the Decline button.
  // Shows a confirmation alert first, then calls the backend.
  // The backend will then notify the next surgeon in the priority list.
  const handleDecline = () => {
    Alert.alert(
      'Decline this case?',
      'The request will be passed to the next surgeon in the priority list.',
      [
        // Cancel — do nothing
        { text: 'Cancel', style: 'cancel' },

        // Confirm — call the decline API
        {
          text: 'Yes, Decline',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              console.log('RequestDetail: Declining case:', caseId);

              await axios.patch(
                `${CONFIG.API_URL}/api/cases/${caseId}/decline`,
                { surgeon_id: surgeonId }
              );

              console.log('RequestDetail: Case declined');

              // Go back to home screen
              Alert.alert(
                'Case Declined',
                'The request has been passed to the next surgeon.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );

            } catch (err) {
              console.error('RequestDetail: Error declining case:', err.message);
              Alert.alert('Error', 'Could not decline case. Please try again.');
            } finally {
              setSubmitting(false);
            }
          }
        }
      ]
    );
  };

  // ── FORMAT HELPERS ─────────────────────────────────────────────────────────

  // Format date: "2026-03-10" → "Mon, Mar 10, 2026"
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  // Format fee from paise to rupees: 4500000 → "₹45,000"
  const formatFee = (paise) => {
    if (!paise) return '—';
    return '₹' + (paise / 100).toLocaleString('en-IN');
  };

  // Calculate net payout after 5% platform commission
  const calculateNetPayout = (feePaise) => {
    if (!feePaise) return '—';
    const fee = feePaise / 100;
    const commission = fee * 0.05;
    const net = fee - commission;
    return '₹' + net.toLocaleString('en-IN');
  };

  // ── LOADING STATE ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A56A0" />
        <Text style={styles.loadingText}>Loading case details...</Text>
      </View>
    );
  }

  // ── ERROR STATE ────────────────────────────────────────────────────────────
  if (error || !caseData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{error || 'Case not found'}</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── HEADER WITH COUNTDOWN ── */}
      <View style={styles.header}>

        {/* Back button */}
        <TouchableOpacity
          style={styles.headerBack}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.headerBackText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Surgery Request</Text>

        {/* Countdown timer */}
        {timeLeft ? (
          <View style={styles.timerContainer}>
            <Text style={styles.timerLabel}>Respond within</Text>
            <Text style={styles.timerValue}>{timeLeft}</Text>
          </View>
        ) : null}
      </View>

      {/* ── SCROLLABLE CONTENT ── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >

        {/* ── SURGERY DETAILS CARD ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Surgery Details</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Procedure</Text>
            <Text style={styles.detailValue}>{caseData.procedure}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Specialty</Text>
            <Text style={styles.detailValue}>{caseData.specialty_required}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{formatDate(caseData.surgery_date)}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Time</Text>
            <Text style={styles.detailValue}>{caseData.surgery_time}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Duration</Text>
            <Text style={styles.detailValue}>{caseData.duration_hours} hours (approx)</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>OT Number</Text>
            <Text style={styles.detailValue}>{caseData.ot_number}</Text>
          </View>
          <View style={styles.divider} />

          {/* Hospital location — hidden until accepted */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Location</Text>
            <Text style={styles.detailValue}>
              {caseData.hospital_city || '📍 Revealed after acceptance'}
            </Text>
          </View>
        </View>

        {/* ── PATIENT DETAILS CARD ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Patient Details</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Age</Text>
            <Text style={styles.detailValue}>{caseData.patient_age} years</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Gender</Text>
            <Text style={styles.detailValue}>
              {caseData.patient_gender
                ? caseData.patient_gender.charAt(0).toUpperCase() +
                  caseData.patient_gender.slice(1)
                : '—'}
            </Text>
          </View>

          {/* Clinical notes — only shown if present */}
          {caseData.notes ? (
            <>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Notes</Text>
                <Text style={[styles.detailValue, { flex: 1 }]}>
                  {caseData.notes}
                </Text>
              </View>
            </>
          ) : null}
        </View>

        {/* ── FEE CARD ── */}
        {/* Dark blue card showing the fee breakdown */}
        <View style={styles.feeCard}>
          <Text style={styles.feeCardTitle}>Fee Breakdown</Text>

          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Offered Fee</Text>
            <Text style={styles.feeValue}>{formatFee(caseData.fee_max)}</Text>
          </View>

          <View style={styles.feeDivider} />

          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Platform Commission (5%)</Text>
            <Text style={styles.feeCommission}>
              − ₹{((caseData.fee_max / 100) * 0.05).toLocaleString('en-IN')}
            </Text>
          </View>

          <View style={styles.feeDivider} />

          <View style={styles.feeRow}>
            <Text style={styles.feePayoutLabel}>Your Net Payout</Text>
            <Text style={styles.feePayoutValue}>
              {calculateNetPayout(caseData.fee_max)}
            </Text>
          </View>
        </View>

        {/* Bottom padding so content isn't hidden behind the action bar */}
        <View style={{ height: 100 }} />

      </ScrollView>

      {/* ── FIXED BOTTOM ACTION BAR ── */}
      {/* Decline and Accept buttons always visible at the bottom */}
      <View style={styles.actionBar}>

        {/* Decline button */}
        <TouchableOpacity
          style={styles.declineButton}
          onPress={handleDecline}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#DC2626" />
            : <Text style={styles.declineButtonText}>✕ Decline</Text>
          }
        </TouchableOpacity>

        {/* Accept button — twice as wide as decline */}
        <TouchableOpacity
          style={[styles.acceptButton, submitting && styles.buttonDisabled]}
          onPress={handleAccept}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.acceptButtonText}>✓ Accept Case</Text>
          }
        </TouchableOpacity>

      </View>
    </View>
  );
}

// ── STYLES ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Loading / error states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    gap: 16,
    padding: 24,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 14,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 8,
  },
  backButtonText: {
    color: '#1A56A0',
    fontSize: 15,
    fontWeight: '600',
  },

  // ── HEADER ──
  header: {
    backgroundColor: '#0B1F3A',
    paddingTop: Platform.OS === 'ios' ? 56 : 48,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerBack: {
    marginBottom: 8,
  },
  headerBackText: {
    color: '#60A5FA',
    fontSize: 14,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
  },

  // Countdown timer in header
  timerContainer: {
    backgroundColor: '#D97706',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timerLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  timerValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  // ── SCROLL VIEW ──
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // ── INFO CARDS ──
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
    alignItems: 'flex-start',
    paddingVertical: 10,
    gap: 16,
  },
  detailLabel: {
    fontSize: 14,
    color: '#64748B',
    width: 100,
    flexShrink: 0,
  },
  detailValue: {
    fontSize: 14,
    color: '#0B1F3A',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },

  // ── FEE CARD ──
  feeCard: {
    backgroundColor: '#0B1F3A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  feeCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#60A5FA',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  feeLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  feeValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  feeCommission: {
    fontSize: 14,
    color: '#F87171',
    fontWeight: '600',
  },
  feeDivider: {
    height: 1,
    backgroundColor: '#1E3A5F',
  },
  feePayoutLabel: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  feePayoutValue: {
    fontSize: 20,
    color: '#34D399',
    fontWeight: '800',
  },

  // ── ACTION BAR ──
  actionBar: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  declineButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#DC2626',
  },
  declineButtonText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '700',
  },
  acceptButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});