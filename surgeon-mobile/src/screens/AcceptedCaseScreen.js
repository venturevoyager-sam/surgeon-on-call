/**
 * surgeon-on-call/surgeon-mobile/src/screens/AcceptedCaseScreen.js
 *
 * ACCEPTED CASE SCREEN — Full details of a confirmed surgery case
 * Brand colours applied: warm dark header, orange accents throughout
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import axios from 'axios';
import CONFIG from '../lib/config';

// ── BRAND COLOURS ──────────────────────────────────────────────────────────────
const B = {
  orange: '#E56717',
  bg: '#FDF8F5', body: '#444444', muted: '#8B8B8B', border: '#E8E0D8',
  card: '#FFFFFF', header: '#2C1A0E',
  green: '#16a34a', greenBg: '#F0FDF4', greenBorder: '#BBF7D0',
  red: '#DC2626',
};

export default function AcceptedCaseScreen({ navigation, route }) {
  const { caseId } = route.params;

  const [caseData, setCaseData] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    const fetchCase = async () => {
      try {
        const response = await axios.get(
          `${CONFIG.API_URL}/api/cases/${caseId}/surgeon-view`,
          { params: { surgeon_id: CONFIG.DEV_SURGEON_ID }, timeout: 10000 }
        );
        setCaseData(response.data.case);
      } catch (err) {
        setError('Error: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCase();
  }, [caseId]);

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  const formatFee = (p) => (p || p === 0) ? '₹' + (p / 100).toLocaleString('en-IN') : '—';

  const netPayout = (p) => {
    if (!p) return '—';
    return '₹' + ((p / 100) * 0.95).toLocaleString('en-IN');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={B.orange} />
        <Text style={styles.loadingText}>Loading case details...</Text>
      </View>
    );
  }

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

  return (
    <View style={styles.container}>

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Text style={styles.headerBackText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Case Details</Text>
        <View style={styles.confirmedBadge}>
          <Text style={styles.confirmedBadgeText}>✓ Confirmed</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ── CONFIRMED BANNER ── */}
        <View style={styles.confirmedBanner}>
          <Text style={styles.confirmedBannerIcon}>✅</Text>
          <View>
            <Text style={styles.confirmedBannerTitle}>You're confirmed for this surgery</Text>
            <Text style={styles.confirmedBannerSub}>
              {formatDate(caseData.surgery_date)} at {caseData.surgery_time}
            </Text>
          </View>
        </View>

        {/* ── SURGERY DETAILS ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Surgery Details</Text>
          <Row label="Procedure"  value={caseData.procedure} highlight />
          <Row label="Specialty"  value={caseData.specialty_required} />
          <Row label="Date"       value={formatDate(caseData.surgery_date)} />
          <Row label="Time"       value={caseData.surgery_time} />
          <Row label="Duration"   value={`${caseData.duration_hours} hours (approx)`} />
          <Row label="OT Number"  value={`OT ${caseData.ot_number}`} />
          <Row label="Case No."   value={caseData.case_number || '—'} last />
        </View>

        {/* ── HOSPITAL DETAILS ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hospital</Text>
          <Row label="Hospital" value={caseData.hospital_name || 'Details shared by coordinator'} />
          <Row label="City"     value={caseData.hospital_city || '—'} last />
        </View>

        {/* ── PATIENT DETAILS ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Patient</Text>
          <Row label="Age"    value={`${caseData.patient_age} years`} />
          <Row label="Gender" value={
            caseData.patient_gender === 'male'   ? '♂ Male' :
            caseData.patient_gender === 'female' ? '♀ Female' : 'Other'
          } />
          <Row label="Notes" value={caseData.notes || 'No additional notes'} last />
        </View>

        {/* ── FEE BREAKDOWN ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fee Breakdown</Text>
          <Row label="Offered Fee"       value={formatFee(caseData.fee_max)} />
          <Row label="Platform Fee (5%)" value={`− ₹${((caseData.fee_max / 100) * 0.05).toLocaleString('en-IN')}`} />
          {/* Net payout — orange accent at bottom of card */}
          <View style={styles.netPayoutRow}>
            <Text style={styles.netPayoutLabel}>Your Net Payout</Text>
            <Text style={styles.netPayoutValue}>{netPayout(caseData.fee_max)}</Text>
          </View>
        </View>

        {/* ── CONTACT NOTE ── */}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: B.bg },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16, backgroundColor: B.bg },
  loadingText: { color: B.muted, fontSize: 14 },
  errorText:   { color: B.red, fontSize: 14, textAlign: 'center' },

  // Header — warm dark brown
  header: {
    backgroundColor:   B.header,
    paddingTop:        Platform.OS === 'ios' ? 56 : 40,
    paddingBottom:     16,
    paddingHorizontal: 20,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
  },
  headerBack:     { paddingVertical: 4, paddingRight: 12 },
  headerBackText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  headerTitle:    { color: '#FFFFFF', fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },

  // Confirmed badge in header — green
  confirmedBadge:     { backgroundColor: '#065F46', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  confirmedBadgeText: { color: '#6EE7B7', fontSize: 11, fontWeight: '700' },

  scroll:        { flex: 1 },
  scrollContent: { padding: 16 },

  // Confirmed banner — green tint (keep green for confirmed status)
  confirmedBanner: {
    backgroundColor: B.greenBg,
    borderRadius:    14,
    padding:         16,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    marginBottom:    16,
    borderWidth:     1,
    borderColor:     B.greenBorder,
  },
  confirmedBannerIcon:  { fontSize: 28 },
  confirmedBannerTitle: { fontSize: 15, fontWeight: '700', color: '#065F46' },
  confirmedBannerSub:   { fontSize: 13, color: B.green, marginTop: 2 },

  // Cards
  card: {
    backgroundColor: B.card,
    borderRadius:    16,
    padding:         16,
    marginBottom:    14,
    borderWidth:     1,
    borderColor:     B.border,
    shadowColor:     '#442200',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.04,
    shadowRadius:    4,
    elevation:       2,
  },
  cardTitle: {
    fontSize:      11,
    fontWeight:    '700',
    color:         B.orange,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom:  14,
  },

  // Rows
  row:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10 },
  lastRow:    { paddingBottom: 0 },
  rowDivider: { height: 1, backgroundColor: B.border, opacity: 0.6 },
  rowLabel:   { fontSize: 13, color: B.muted, flex: 1 },
  rowValue:   { fontSize: 14, color: B.body, fontWeight: '500', flex: 2, textAlign: 'right' },
  rowValueHighlight: { color: B.orange, fontWeight: '700', fontSize: 15 },

  // Net payout row — orange accent at bottom of fee card
  netPayoutRow: {
    backgroundColor:     '#FFF3EB',
    marginHorizontal:    -16,
    paddingHorizontal:   16,
    marginBottom:        -16,
    borderBottomLeftRadius:  16,
    borderBottomRightRadius: 16,
    paddingVertical:     14,
    flexDirection:       'row',
    justifyContent:      'space-between',
    alignItems:          'center',
    borderTopWidth:      1,
    borderTopColor:      '#F5C9A8',
    marginTop:           10,
  },
  netPayoutLabel: { fontSize: 14, fontWeight: '700', color: B.body, flex: 1 },
  netPayoutValue: { fontSize: 18, fontWeight: '800', color: B.orange },

  // Contact note — warm orange tint instead of cold blue
  noteCard: {
    backgroundColor: '#FFF3EB',
    borderRadius:    12,
    padding:         14,
    borderWidth:     1,
    borderColor:     '#F5C9A8',
    marginBottom:    8,
  },
  noteText: { fontSize: 13, color: B.body, lineHeight: 20 },

  // Back button (error state)
  backBtn:     { backgroundColor: B.orange, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  backBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
});