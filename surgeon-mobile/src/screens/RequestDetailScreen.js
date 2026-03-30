// surgeon-on-call/surgeon-mobile/src/screens/RequestDetailScreen.js
//
// REQUEST DETAIL SCREEN — Full case details for the surgeon to review
//
// Brand colours (matching hospital web app):
//   Primary orange : #E56717
//   Hover orange   : #CD4D00
//   Warm background: #FDF8F5
//   Body text      : #444444
//   Muted text     : #8B8B8B
//   Borders        : #E8E0D8
//   Dark header    : #2C1A0E  (warm dark brown)
//   Success green  : #16a34a
//
// Shows:
// 1. Countdown timer — how long the surgeon has left to respond
// 2. Surgery details — procedure, specialty, date, time, duration, OT
// 3. Patient details — age, gender, clinical notes
// 4. Clinical Documents — uploaded files the hospital attached
// 5. Fee card — offered fee, platform commission (5%), net payout
// 6. Accept / Decline buttons at the bottom

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import axios from 'axios';
import CONFIG from '../lib/config';

// ── BRAND COLOURS ─────────────────────────────────────────────────────────────
const BRAND = {
  orange:     '#E56717',
  orangeHover:'#CD4D00',
  bg:         '#FDF8F5',
  body:       '#444444',
  muted:      '#8B8B8B',
  border:     '#E8E0D8',
  header:     '#2C1A0E',
  headerText: '#FFFFFF',
  card:       '#FFFFFF',
  green:      '#16a34a',
  greenBg:    '#F0FDF4',
  greenBorder:'#BBF7D0',
  red:        '#DC2626',
  redBg:      '#FEF2F2',
};

export default function RequestDetailScreen({ navigation, route }) {
  const { caseId, surgeonId } = route.params;

  const [caseData,   setCaseData]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const [timeLeft,   setTimeLeft]   = useState('');

  // ── SURGERY RECOMMENDATION STATE (Migration 004) ──────────────────────────
  // These power the "Recommend Surgery" section for confirmed re-consult cases.
  // - existingRec: fetched on load — if non-null, the surgeon already submitted
  // - showRecForm: toggles the form open/closed
  // - recForm: controlled form fields
  // - recSubmitting / recError: form submission state
  const [existingRec,   setExistingRec]   = useState(null);
  const [recLoading,    setRecLoading]    = useState(false);
  const [showRecForm,   setShowRecForm]   = useState(false);
  const [recSubmitting, setRecSubmitting] = useState(false);
  const [recError,      setRecError]      = useState('');
  const [recForm, setRecForm] = useState({
    suggested_procedure:    '',
    recommendation_notes:   '',
    urgency:                'elective',
  });

  // ── FETCH CASE DETAILS ─────────────────────────────────────────────────────
  useEffect(() => {
    const fetchCase = async () => {
      try {
        const response = await axios.get(
          `${CONFIG.API_URL}/api/cases/${caseId}/surgeon-view`,
          { params: { surgeon_id: surgeonId } }
        );
        setCaseData(response.data.case);
      } catch (err) {
        setError('Could not load case details. Please go back and try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchCase();
  }, [caseId]);

  // ── FETCH EXISTING RECOMMENDATION (Migration 004) ─────────────────────────
  // For confirmed re-consult cases, check if the surgeon already submitted a
  // surgery recommendation. If yes, we show the submitted summary instead of
  // the form. This prevents duplicate submissions.
  useEffect(() => {
    if (!caseData) return;
    if (caseData.request_type !== 'reconsult') return;
    if (caseData.status !== 'confirmed') return;

    const fetchRecommendation = async () => {
      setRecLoading(true);
      try {
        const res = await axios.get(
          `${CONFIG.API_URL}/api/cases/${caseId}/recommendation`
        );
        if (res.data.recommendation) {
          setExistingRec(res.data.recommendation);
        }
      } catch (err) {
        // Non-fatal — if the fetch fails, we just show the form
        console.log('Could not fetch existing recommendation:', err.message);
      } finally {
        setRecLoading(false);
      }
    };

    fetchRecommendation();
  }, [caseData?.request_type, caseData?.status, caseId]);

  // ── COUNTDOWN TIMER ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!caseData?.expires_at) return;
    const timer = setInterval(() => {
      const diff = new Date(caseData.expires_at) - new Date();
      if (diff <= 0) { setTimeLeft('00:00:00'); clearInterval(timer); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [caseData]);

  // ── ACCEPT / DECLINE ───────────────────────────────────────────────────────
  const handleAccept = () => {
    Alert.alert(
      'Accept this case?',
      `Confirm to perform ${caseData?.procedure} on ${formatDate(caseData?.surgery_date)}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, Accept', onPress: async () => {
          setSubmitting(true);
          try {
            await axios.patch(`${CONFIG.API_URL}/api/cases/${caseId}/accept`, { surgeon_id: surgeonId });
            Alert.alert('✅ Case Accepted!', 'The hospital has been notified. Our associate will contact you shortly.',
              [{ text: 'OK', onPress: () => navigation.goBack() }]);
          } catch { Alert.alert('Error', 'Could not accept case. Please try again.'); }
          finally { setSubmitting(false); }
        }},
      ]
    );
  };

  const handleDecline = () => {
    Alert.alert(
      'Decline this case?',
      'The request will be passed to the next surgeon.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, Decline', style: 'destructive', onPress: async () => {
          setSubmitting(true);
          try {
            await axios.patch(`${CONFIG.API_URL}/api/cases/${caseId}/decline`, { surgeon_id: surgeonId });
            Alert.alert('Case Declined', 'The request has been passed to the next surgeon.',
              [{ text: 'OK', onPress: () => navigation.goBack() }]);
          } catch { Alert.alert('Error', 'Could not decline case. Please try again.'); }
          finally { setSubmitting(false); }
        }},
      ]
    );
  };

  // ── SUBMIT SURGERY RECOMMENDATION (Migration 004) ─────────────────────────
  // Posts the surgeon's recommendation to the backend. On success, stores the
  // returned recommendation in existingRec so the form is replaced with the
  // confirmation summary.
  const handleSubmitRecommendation = async () => {
    // Validate required field
    if (!recForm.suggested_procedure.trim()) {
      setRecError('Please enter the suggested procedure name');
      return;
    }

    setRecSubmitting(true);
    setRecError('');

    try {
      const res = await axios.post(
        `${CONFIG.API_URL}/api/cases/${caseId}/recommend`,
        {
          surgeon_id:           surgeonId,
          suggested_procedure:  recForm.suggested_procedure.trim(),
          recommendation_notes: recForm.recommendation_notes.trim() || null,
          urgency:              recForm.urgency,
        }
      );

      // Store the returned recommendation — this switches the UI from
      // form → confirmation summary
      setExistingRec(res.data.recommendation);
      setShowRecForm(false);

      Alert.alert(
        'Recommendation Submitted',
        'The hospital has been notified of your surgery recommendation.'
      );

    } catch (err) {
      const msg = err.response?.data?.message || 'Could not submit recommendation. Please try again.';
      setRecError(msg);
    } finally {
      setRecSubmitting(false);
    }
  };

  // ── OPEN DOCUMENT ──────────────────────────────────────────────────────────
  const openDocument = async (url) => {
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Cannot open file', 'Unable to open this document on your device.');
      }
    } catch { Alert.alert('Error', 'Could not open the document.'); }
  };

  // ── HELPERS ────────────────────────────────────────────────────────────────
  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' })
    : '—';

  const formatFee = (p) => p ? '₹' + (p / 100).toLocaleString('en-IN') : '—';

  const netPayout = (p) => {
    if (!p) return '—';
    return '₹' + ((p / 100) * 0.95).toLocaleString('en-IN');
  };

  const fileIcon = (type) => {
    if (!type) return '📎';
    if (type === 'application/pdf') return '📄';
    if (type.startsWith('image/')) return '🖼️';
    return '📎';
  };

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={BRAND.orange} />
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

  const hasDocuments = Array.isArray(caseData.documents) && caseData.documents.length > 0;

  // True when this is a confirmed re-consult — the surgeon can recommend surgery
  const isConfirmedReconsult = caseData.request_type === 'reconsult' && caseData.status === 'confirmed';

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Text style={styles.headerBackText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Surgery Request</Text>

        {/* Countdown timer — orange pill */}
        {timeLeft ? (
          <View style={styles.timerPill}>
            <Text style={styles.timerLabel}>Respond within</Text>
            <Text style={styles.timerValue}>{timeLeft}</Text>
          </View>
        ) : null}
      </View>

      {/* ── SCROLL BODY ── */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ── SURGERY DETAILS ── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Surgery Details</Text>
          <Row label="Procedure"  value={caseData.procedure} />
          <Row label="Specialty"  value={caseData.specialty_required} />
          <Row label="Date"       value={formatDate(caseData.surgery_date)} />
          <Row label="Time"       value={caseData.surgery_time} />
          <Row label="Duration"   value={`${caseData.duration_hours} hrs (approx)`} />
          <Row label="OT Number"  value={caseData.ot_number} />
          <Row label="Location"   value={caseData.hospital_city || '📍 Revealed after acceptance'} last />
        </View>

        {/* ── PATIENT DETAILS ── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Patient Details</Text>
          <Row label="Age"    value={`${caseData.patient_age} years`} />
          <Row label="Gender" value={
            caseData.patient_gender
              ? caseData.patient_gender.charAt(0).toUpperCase() + caseData.patient_gender.slice(1)
              : '—'
          } last={!caseData.notes} />
          {caseData.notes ? <Row label="Notes" value={caseData.notes} last /> : null}
        </View>

        {/* ── CLINICAL DOCUMENTS ── */}
        {hasDocuments && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Clinical Documents</Text>
            <Text style={styles.docsHint}>Tap a file to open it</Text>
            {caseData.documents.map((doc, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.docRow, i === caseData.documents.length - 1 && styles.docRowLast]}
                onPress={() => openDocument(doc.url)}
                activeOpacity={0.7}
              >
                <Text style={styles.docIcon}>{fileIcon(doc.type)}</Text>
                <Text style={styles.docName} numberOfLines={1} ellipsizeMode="middle">
                  {doc.name}
                </Text>
                <Text style={styles.docOpen}>Open ↗</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── FEE BREAKDOWN ── */}
        {/* Orange-accented card instead of dark navy — fits warm brand */}
        <View style={styles.feeCard}>
          <Text style={styles.feeCardLabel}>Fee Breakdown</Text>

          <View style={styles.feeRow}>
            <Text style={styles.feeLabelText}>Offered Fee</Text>
            <Text style={styles.feeValueText}>{formatFee((caseData.fee || caseData.fee_max))}</Text>
          </View>
          <View style={styles.feeDivider} />

          <View style={styles.feeRow}>
            <Text style={styles.feeLabelText}>Platform Commission (5%)</Text>
            <Text style={styles.feeCommission}>
              − ₹{(((caseData.fee || caseData.fee_max) / 100) * 0.05).toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.feeDivider} />

          <View style={styles.feeRow}>
            <Text style={styles.feeNetLabel}>Your Net Payout</Text>
            <Text style={styles.feeNetValue}>{netPayout((caseData.fee || caseData.fee_max))}</Text>
          </View>
        </View>

        {/* ════════════════════════════════════════════════════════════════════
            SURGERY RECOMMENDATION SECTION (Migration 004)
            Only shown for confirmed re-consult cases. Three states:
            1. Loading — spinner while we check for existing recommendation
            2. Existing recommendation — read-only summary of what was submitted
            3. No recommendation yet — "Recommend Surgery" button → expandable form
        ════════════════════════════════════════════════════════════════════ */}
        {isConfirmedReconsult && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Surgery Recommendation</Text>

            {/* State 1: Loading existing recommendation */}
            {recLoading && (
              <View style={styles.recLoadingWrap}>
                <ActivityIndicator size="small" color={BRAND.orange} />
                <Text style={styles.recLoadingText}>Checking for existing recommendation...</Text>
              </View>
            )}

            {/* State 2: Existing recommendation — read-only summary */}
            {!recLoading && existingRec && (
              <View style={styles.recSummary}>
                <View style={styles.recSummaryBadge}>
                  <Text style={styles.recSummaryBadgeText}>Submitted</Text>
                </View>

                <Row label="Procedure"  value={existingRec.suggested_procedure} />
                <Row label="Urgency"    value={existingRec.urgency === 'urgent' ? 'Urgent' : 'Elective'} />
                {existingRec.recommendation_notes && (
                  <Row label="Notes" value={existingRec.recommendation_notes} last />
                )}
                {!existingRec.recommendation_notes && (
                  <View style={styles.recNoNotes}>
                    <Text style={styles.recNoNotesText}>No additional notes</Text>
                  </View>
                )}

                <Text style={styles.recSummaryHint}>
                  The hospital has been notified and will review your recommendation.
                </Text>
              </View>
            )}

            {/* State 3: No recommendation yet — button or form */}
            {!recLoading && !existingRec && !showRecForm && (
              <TouchableOpacity
                style={styles.recOpenBtn}
                onPress={() => setShowRecForm(true)}
              >
                <Text style={styles.recOpenBtnText}>Recommend Surgery</Text>
              </TouchableOpacity>
            )}

            {/* Expandable recommendation form */}
            {!recLoading && !existingRec && showRecForm && (
              <View style={styles.recForm}>

                {/* Error message */}
                {recError ? (
                  <View style={styles.recErrorWrap}>
                    <Text style={styles.recErrorText}>{recError}</Text>
                  </View>
                ) : null}

                {/* Suggested Procedure (required) */}
                <Text style={styles.recFieldLabel}>Suggested Procedure *</Text>
                <TextInput
                  style={styles.recInput}
                  value={recForm.suggested_procedure}
                  onChangeText={(t) => {
                    setRecForm(prev => ({ ...prev, suggested_procedure: t }));
                    if (recError) setRecError('');
                  }}
                  placeholder="e.g. Laparoscopic Cholecystectomy"
                  placeholderTextColor={BRAND.muted}
                />

                {/* Recommendation Notes (optional, multiline) */}
                <Text style={styles.recFieldLabel}>Clinical Notes (optional)</Text>
                <TextInput
                  style={[styles.recInput, styles.recTextArea]}
                  value={recForm.recommendation_notes}
                  onChangeText={(t) => setRecForm(prev => ({ ...prev, recommendation_notes: t }))}
                  placeholder="Findings, rationale, patient condition..."
                  placeholderTextColor={BRAND.muted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                {/* Urgency selector — two toggle buttons */}
                <Text style={styles.recFieldLabel}>Urgency *</Text>
                <View style={styles.urgencyRow}>
                  <TouchableOpacity
                    style={[
                      styles.urgencyBtn,
                      recForm.urgency === 'elective' && styles.urgencyBtnActive,
                    ]}
                    onPress={() => setRecForm(prev => ({ ...prev, urgency: 'elective' }))}
                  >
                    <Text style={[
                      styles.urgencyBtnText,
                      recForm.urgency === 'elective' && styles.urgencyBtnTextActive,
                    ]}>
                      Elective
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.urgencyBtn,
                      recForm.urgency === 'urgent' && styles.urgencyBtnUrgentActive,
                    ]}
                    onPress={() => setRecForm(prev => ({ ...prev, urgency: 'urgent' }))}
                  >
                    <Text style={[
                      styles.urgencyBtnText,
                      recForm.urgency === 'urgent' && styles.urgencyBtnUrgentTextActive,
                    ]}>
                      Urgent
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Submit / Cancel buttons */}
                <View style={styles.recFormActions}>
                  <TouchableOpacity
                    style={styles.recCancelBtn}
                    onPress={() => {
                      setShowRecForm(false);
                      setRecError('');
                    }}
                    disabled={recSubmitting}
                  >
                    <Text style={styles.recCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.recSubmitBtn, recSubmitting && { opacity: 0.6 }]}
                    onPress={handleSubmitRecommendation}
                    disabled={recSubmitting}
                  >
                    {recSubmitting
                      ? <ActivityIndicator color="#FFFFFF" size="small" />
                      : <Text style={styles.recSubmitBtnText}>Submit Recommendation</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── BOTTOM ACTION BAR ── */}
      <View style={styles.actionBar}>
        {/* Decline — outlined red */}
        <TouchableOpacity
          style={styles.declineBtn}
          onPress={handleDecline}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color={BRAND.red} />
            : <Text style={styles.declineBtnText}>✕  Decline</Text>
          }
        </TouchableOpacity>

        {/* Accept — solid orange */}
        <TouchableOpacity
          style={[styles.acceptBtn, submitting && { opacity: 0.6 }]}
          onPress={handleAccept}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.acceptBtnText}>✓  Accept Case</Text>
          }
        </TouchableOpacity>
      </View>

    </View>
  );
}

// ── REUSABLE ROW ──────────────────────────────────────────────────────────────
function Row({ label, value, last }) {
  return (
    <>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, { flex: 1 }]}>{value || '—'}</Text>
      </View>
      {!last && <View style={styles.rowDivider} />}
    </>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },

  // Loading / error
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BRAND.bg,
    gap: 16,
    padding: 24,
  },
  loadingText: { color: BRAND.muted, fontSize: 14 },
  errorText:   { color: BRAND.red,   fontSize: 14, textAlign: 'center' },
  backBtn:     { marginTop: 8 },
  backBtnText: { color: BRAND.orange, fontSize: 15, fontWeight: '600' },

  // ── HEADER ──
  // Warm dark brown — consistent with brand, warmer than cold navy
  header: {
    backgroundColor: BRAND.header,
    paddingTop:        Platform.OS === 'ios' ? 56 : 48,
    paddingHorizontal: 20,
    paddingBottom:     20,
  },
  headerBack:     { marginBottom: 6 },
  headerBackText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  headerTitle:    { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginBottom: 14 },

  // Countdown timer pill — brand orange
  timerPill: {
    backgroundColor: BRAND.orange,
    borderRadius:    12,
    paddingHorizontal: 16,
    paddingVertical:   10,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
  },
  timerLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  timerValue: {
    color:      '#FFFFFF',
    fontSize:   22,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  // ── SCROLL ──
  scroll:        { flex: 1 },
  scrollContent: { padding: 16 },

  // ── CARDS ──
  card: {
    backgroundColor: BRAND.card,
    borderRadius:    14,
    padding:         18,
    marginBottom:    14,
    borderWidth:     1,
    borderColor:     BRAND.border,
    shadowColor:     '#442200',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.05,
    shadowRadius:    4,
    elevation:       2,
  },
  cardLabel: {
    fontSize:      11,
    fontWeight:    '700',
    color:         BRAND.orange,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom:  14,
  },

  // Detail rows
  row: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    paddingVertical: 10,
    gap:            16,
  },
  rowLabel: {
    fontSize:   14,
    color:      BRAND.muted,
    width:      110,
    flexShrink: 0,
  },
  rowValue: {
    fontSize:   14,
    color:      BRAND.body,
    fontWeight: '600',
    textAlign:  'right',
  },
  rowDivider: {
    height:          1,
    backgroundColor: BRAND.border,
    opacity:         0.5,
  },

  // ── DOCUMENTS ──
  docsHint: {
    fontSize:     12,
    color:        BRAND.muted,
    marginTop:    -8,
    marginBottom: 10,
  },
  docRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    gap: 10,
  },
  docRowLast: { borderBottomWidth: 0 },
  docIcon:    { fontSize: 20, width: 28, textAlign: 'center' },
  docName: {
    flex:       1,
    fontSize:   14,
    color:      BRAND.body,
    fontWeight: '500',
  },
  docOpen: {
    fontSize:   13,
    color:      BRAND.orange,
    fontWeight: '700',
  },

  // ── FEE CARD ──
  // Warm cream with orange accent — matches brand better than cold dark navy
  feeCard: {
    backgroundColor: '#FFF7F0',
    borderRadius:    14,
    padding:         18,
    marginBottom:    14,
    borderWidth:     1,
    borderColor:     '#F5D9C0',
  },
  feeCardLabel: {
    fontSize:      11,
    fontWeight:    '700',
    color:         BRAND.orange,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom:  14,
  },
  feeRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingVertical: 10,
  },
  feeLabelText: { fontSize: 14, color: BRAND.body },
  feeValueText: { fontSize: 14, color: BRAND.body, fontWeight: '600' },
  feeCommission:{ fontSize: 14, color: BRAND.red,  fontWeight: '600' },
  feeDivider:   { height: 1, backgroundColor: '#F5D9C0' },
  feeNetLabel:  { fontSize: 15, color: BRAND.body,  fontWeight: '700' },
  feeNetValue:  { fontSize: 20, color: BRAND.orange, fontWeight: '800' },

  // ── ACTION BAR ──
  actionBar: {
    flexDirection:   'row',
    padding:         16,
    paddingBottom:   Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth:  1,
    borderTopColor:  BRAND.border,
    gap:             12,
  },
  declineBtn: {
    flex:            1,
    paddingVertical: 16,
    borderRadius:    12,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     2,
    borderColor:     BRAND.red,
    backgroundColor: BRAND.redBg,
  },
  declineBtnText: { color: BRAND.red, fontSize: 15, fontWeight: '700' },

  acceptBtn: {
    flex:            2,
    paddingVertical: 16,
    borderRadius:    12,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: BRAND.orange,
  },
  acceptBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  // ── SURGERY RECOMMENDATION STYLES (Migration 004) ─────────────────────────

  // Loading state while fetching existing recommendation
  recLoadingWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    paddingVertical: 8,
  },
  recLoadingText: {
    fontSize: 13,
    color:    BRAND.muted,
  },

  // Submitted recommendation summary — green-tinted card
  recSummary: {
    backgroundColor: BRAND.greenBg,
    borderRadius:    10,
    padding:         14,
    borderWidth:     1,
    borderColor:     BRAND.greenBorder,
  },
  recSummaryBadge: {
    alignSelf:       'flex-start',
    backgroundColor: BRAND.green,
    borderRadius:    6,
    paddingHorizontal: 10,
    paddingVertical:   4,
    marginBottom:    12,
  },
  recSummaryBadgeText: {
    color:      '#FFFFFF',
    fontSize:   11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recSummaryHint: {
    fontSize:    12,
    color:       BRAND.green,
    marginTop:   12,
    fontStyle:   'italic',
  },
  recNoNotes: {
    paddingVertical: 6,
  },
  recNoNotesText: {
    fontSize: 13,
    color:    BRAND.muted,
    fontStyle: 'italic',
  },

  // "Recommend Surgery" button — brand orange, outlined
  recOpenBtn: {
    borderWidth:       2,
    borderColor:       BRAND.orange,
    borderRadius:      10,
    paddingVertical:   14,
    alignItems:        'center',
  },
  recOpenBtnText: {
    color:      BRAND.orange,
    fontSize:   15,
    fontWeight: '700',
  },

  // Recommendation form
  recForm: {
    gap: 4,
  },
  recFieldLabel: {
    fontSize:    13,
    fontWeight:  '600',
    color:       BRAND.body,
    marginTop:   10,
    marginBottom: 6,
  },
  recInput: {
    backgroundColor: BRAND.bg,
    borderWidth:     1,
    borderColor:     BRAND.border,
    borderRadius:    10,
    paddingHorizontal: 14,
    paddingVertical:   12,
    fontSize:        14,
    color:           BRAND.body,
  },
  recTextArea: {
    minHeight:       80,
    textAlignVertical: 'top',
  },

  // Urgency toggle buttons
  urgencyRow: {
    flexDirection: 'row',
    gap:           10,
    marginTop:     2,
  },
  urgencyBtn: {
    flex:            1,
    paddingVertical: 12,
    borderRadius:    10,
    alignItems:      'center',
    borderWidth:     2,
    borderColor:     BRAND.border,
    backgroundColor: '#FFFFFF',
  },
  urgencyBtnText: {
    fontSize:   14,
    fontWeight: '600',
    color:      BRAND.muted,
  },
  // Elective selected — brand orange
  urgencyBtnActive: {
    borderColor:     BRAND.orange,
    backgroundColor: '#FFF7F0',
  },
  urgencyBtnTextActive: {
    color: BRAND.orange,
  },
  // Urgent selected — red
  urgencyBtnUrgentActive: {
    borderColor:     BRAND.red,
    backgroundColor: BRAND.redBg,
  },
  urgencyBtnUrgentTextActive: {
    color: BRAND.red,
  },

  // Form action buttons
  recFormActions: {
    flexDirection: 'row',
    gap:           10,
    marginTop:     16,
  },
  recCancelBtn: {
    flex:            1,
    paddingVertical: 14,
    borderRadius:    10,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     BRAND.border,
  },
  recCancelBtnText: {
    color:      BRAND.muted,
    fontSize:   14,
    fontWeight: '600',
  },
  recSubmitBtn: {
    flex:            2,
    paddingVertical: 14,
    borderRadius:    10,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: BRAND.orange,
  },
  recSubmitBtnText: {
    color:      '#FFFFFF',
    fontSize:   14,
    fontWeight: '700',
  },

  // Error message inside the form
  recErrorWrap: {
    backgroundColor: BRAND.redBg,
    borderRadius:    8,
    padding:         10,
    marginBottom:    4,
  },
  recErrorText: {
    color:    BRAND.red,
    fontSize: 13,
  },
});