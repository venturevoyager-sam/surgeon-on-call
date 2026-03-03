/**
 * surgeon-on-call/surgeon-mobile/src/screens/AcceptedCaseScreen.js
 *
 * ACCEPTED CASE SCREEN — Full details of a confirmed surgery case
 *
 * Shown when a surgeon taps "View Details" on an upcoming confirmed case.
 * Unlike RequestDetailScreen (which hides the hospital address),
 * this screen shows FULL hospital details since the surgeon is confirmed.
 *
 * Shows:
 *   1. Green confirmed status banner
 *   2. Surgery details — procedure, date, time, duration, OT number
 *   3. Hospital details — full name and city (address revealed post-acceptance)
 *   4. Patient details — age, gender, notes
 *   5. Fee breakdown — confirmed fee + net payout after 5% commission
 *
 * Navigation:
 *   Called from HomeScreen → Upcoming Cases → "View Details →"
 *   Also called from RequestDetailScreen after successful acceptance
 *
 * API:
 *   GET /api/cases/:id/surgeon-view?surgeon_id=<id>
 *   (reuses the same endpoint, hospital address is shown since case is confirmed)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import axios from 'axios';
import CONFIG from '../lib/config';

export default function AcceptedCaseScreen({ navigation, route }) {

  // ── PARAMS ─────────────────────────────────────────────────────────────────
  // caseId passed from HomeScreen or RequestDetailScreen
  const { caseId } = route.params;
  console.log('AcceptedCase: caseId received:', caseId); // ADD THIS


  // ── STATE ──────────────────────────────────────────────────────────────────
  const [caseData, setCaseData]   = useState(null);
 // const [hospital, setHospital]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  // ── FETCH CASE DETAILS ─────────────────────────────────────────────────────
  // Fetches full case details. Since status is 'confirmed', the backend
  // will include the hospital name and city.
  useEffect(() => {
    const fetchCase = async () => {
        try {
        console.log('=== AcceptedCase: START ===');
        console.log('=== caseId:', caseId);
        console.log('=== API_URL:', CONFIG.API_URL);
        console.log('=== surgeon_id:', CONFIG.DEV_SURGEON_ID);

        const url = `${CONFIG.API_URL}/api/cases/${caseId}/surgeon-view`;
        console.log('=== Calling URL:', url);

        const response = await axios.get(url, {
            params: { surgeon_id: CONFIG.DEV_SURGEON_ID },
            timeout: 10000, // 10 second timeout so it doesn't hang forever
        });

        console.log('=== Response received:', JSON.stringify(response.data));
        setCaseData(response.data.case);

        } catch (err) {
        console.log('=== ERROR:', err.message);
        console.log('=== ERROR CODE:', err.code);
        setError('Error: ' + err.message);
        } finally {
        console.log('=== FINALLY: setting loading false');
        setLoading(false);
        }
    };

    fetchCase();
    }, [caseId]);

  // ── FORMAT HELPERS ─────────────────────────────────────────────────────────

  // "2026-03-10" → "Monday, Mar 10, 2026"
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  // 4500000 (paise) → "₹45,000"
  const formatFee = (paise) => {
    if (!paise && paise !== 0) return '—';
    return '₹' + (paise / 100).toLocaleString('en-IN');
  };

  // Net payout after 5% platform commission
  const netPayout = (paise) => {
    if (!paise) return '—';
    const fee = paise / 100;
    return '₹' + (fee - fee * 0.05).toLocaleString('en-IN');
  };

  // ── LOADING STATE ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1A56A0" />
        <Text style={styles.loadingText}>Loading case details...</Text>
      </View>
    );
  }

  // ── ERROR STATE ────────────────────────────────────────────────────────────
  if (error || !caseData) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error || 'Case not found'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Text style={styles.headerBackText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Case Details</Text>
        {/* Confirmed badge */}
        <View style={styles.confirmedBadge}>
          <Text style={styles.confirmedBadgeText}>✓ Confirmed</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ── CONFIRMED BANNER ──────────────────────────────────────────────── */}
        <View style={styles.confirmedBanner}>
          <Text style={styles.confirmedBannerIcon}>✅</Text>
          <View>
            <Text style={styles.confirmedBannerTitle}>You're confirmed for this surgery</Text>
            <Text style={styles.confirmedBannerSub}>
              {formatDate(caseData.surgery_date)} at {caseData.surgery_time}
            </Text>
          </View>
        </View>

        {/* ── SURGERY DETAILS CARD ──────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔪 Surgery Details</Text>

          <Row label="Procedure"  value={caseData.procedure} highlight />
          <Row label="Specialty"  value={caseData.specialty_required} />
          <Row label="Date"       value={formatDate(caseData.surgery_date)} />
          <Row label="Time"       value={caseData.surgery_time} />
          <Row label="Duration"   value={`${caseData.duration_hours} hours (approx)`} />
          <Row label="OT Number"  value={`OT ${caseData.ot_number}`} />
          <Row label="Case No."   value={caseData.case_number || '—'} last />
        </View>

        {/* ── HOSPITAL DETAILS CARD ─────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏥 Hospital</Text>

          {/* Hospital name — fetched from the join if available */}
            <Row
                label="Hospital"
                value={caseData.hospital_name || 'Details shared by coordinator'}
            />
            <Row
                label="City"
                value={caseData.hospital_city || '—'}
                last
            />
        </View>

        {/* ── PATIENT DETAILS CARD ──────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🧑‍⚕️ Patient</Text>

          <Row label="Age"    value={`${caseData.patient_age} years`} />
          <Row label="Gender" value={
            caseData.patient_gender === 'male'   ? '♂ Male' :
            caseData.patient_gender === 'female' ? '♀ Female' : 'Other'
          } />
          <Row
            label="Notes"
            value={caseData.notes || 'No additional notes'}
            last
          />
        </View>

        {/* ── FEE BREAKDOWN CARD ────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💰 Fee Breakdown</Text>

          <Row label="Offered Fee"       value={formatFee(caseData.fee_max)} />
          <Row label="Platform Fee (5%)" value={`− ₹${((caseData.fee_max / 100) * 0.05).toLocaleString('en-IN')}`} />

          {/* Net payout highlighted in green */}
          <View style={[styles.row, styles.lastRow, styles.netPayoutRow]}>
            <Text style={styles.netPayoutLabel}>Your Net Payout</Text>
            <Text style={styles.netPayoutValue}>{netPayout(caseData.fee_max)}</Text>
          </View>
        </View>

        {/* ── CONTACT NOTE ──────────────────────────────────────────────────── */}
        <View style={styles.noteCard}>
          <Text style={styles.noteText}>
            📞 Our associate will contact you 24 hours before the surgery with
            full hospital address and reporting instructions.
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ── HELPER COMPONENT ───────────────────────────────────────────────────────────
// Renders a label-value row inside a card
function Row({ label, value, highlight, last }) {
  return (
    <>
      <View style={[styles.row, last && styles.lastRow]}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, highlight && styles.rowValueHighlight]}>
          {value}
        </Text>
      </View>
      {!last && <View style={styles.rowDivider} />}
    </>
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
    padding: 24,
    gap: 16,
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

  // ── HEADER ──
  header: {
    backgroundColor: '#0B1F3A',
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerBack: {
    paddingVertical: 4,
    paddingRight: 12,
  },

  headerBackText: {
    color: '#94A3B8',
    fontSize: 14,
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },

  confirmedBadge: {
    backgroundColor: '#065F46',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },

  confirmedBadgeText: {
    color: '#6EE7B7',
    fontSize: 11,
    fontWeight: '700',
  },

  // ── SCROLL ──
  scroll: {
    flex: 1,
  },

  scrollContent: {
    padding: 16,
  },

  // ── CONFIRMED BANNER ──
  confirmedBanner: {
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },

  confirmedBannerIcon: {
    fontSize: 28,
  },

  confirmedBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065F46',
  },

  confirmedBannerSub: {
    fontSize: 13,
    color: '#059669',
    marginTop: 2,
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

  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B1F3A',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── ROWS ──
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },

  lastRow: {
    paddingBottom: 0,
  },

  rowDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },

  rowLabel: {
    fontSize: 13,
    color: '#64748B',
    flex: 1,
  },

  rowValue: {
    fontSize: 14,
    color: '#0B1F3A',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },

  rowValueHighlight: {
    color: '#1A56A0',
    fontWeight: '700',
    fontSize: 15,
  },

  // ── NET PAYOUT ROW ──
  netPayoutRow: {
    backgroundColor: '#F0FDF4',
    marginHorizontal: -16,
    paddingHorizontal: 16,
    marginBottom: -16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingVertical: 14,
  },

  netPayoutLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065F46',
    flex: 1,
  },

  netPayoutValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#059669',
  },

  // ── NOTE CARD ──
  noteCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 8,
  },

  noteText: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 20,
  },

  // ── BACK BUTTON (error state) ──
  backBtn: {
    backgroundColor: '#1A56A0',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },

  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});