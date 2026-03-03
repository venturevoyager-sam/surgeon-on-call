/**
 * SURGEONS ROUTES - Backend API
 * Company: Vaidhya Healthcare Pvt Ltd
 *
 * Handles all API endpoints for the Surgeon Mobile App:
 *
 * GET    /api/surgeons/:id               → Surgeon profile
 * PATCH  /api/surgeons/:id/availability  → Toggle available true/false
 * GET    /api/surgeons/:id/requests      → Incoming + upcoming cases
 * GET    /api/surgeons/:id/earnings      → Earnings history
 * GET    /api/cases/:id/surgeon-view     → Case detail for surgeon
 * PATCH  /api/cases/:id/accept           → Surgeon accepts case
 * PATCH  /api/cases/:id/decline          → Surgeon declines case
 *
 * Database tables used (matching actual Supabase schema):
 * - surgeons: id, name, phone, specialty[], mci_number, verified, available,
 *             city, rating, total_cases, experience_years, status
 * - cases: id, case_number, hospital_id, procedure, specialty_required,
 *          surgery_date, surgery_time, duration_hours, ot_number,
 *          patient_name, patient_age, patient_gender, fee_min, fee_max,
 *          notes, status, confirmed_surgeon_id, payment_status
 * - case_priority_list: id, case_id, surgeon_id, priority_order,
 *                       status, notified_at, expires_at, responded_at
 * - hospitals: id, name, city, contact_email, verified
 */

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const logger = require('../logger');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/surgeons/:id
// Returns full surgeon profile
// Called by: HomeScreen, ProfileScreen
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    logger.info('Fetching surgeon profile', { surgeon_id: id });

    const { data: surgeon, error } = await supabase
      .from('surgeons')
      .select(`
        id,
        name,
        phone,
        specialty,
        mci_number,
        verified,
        available,
        city,
        rating,
        total_cases,
        experience_years,
        status
      `)
      .eq('id', id)
      .single();

    if (error) {
      logger.error('Surgeon not found', { surgeon_id: id, error: error.message });
      return res.status(404).json({ message: 'Surgeon not found' });
    }

    logger.info('Surgeon profile fetched', { name: surgeon.name });
    return res.json({ surgeon });

  } catch (error) {
    logger.error('Error fetching surgeon profile', { error: error.message });
    return res.status(500).json({ message: 'Failed to fetch surgeon profile' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/surgeons/:id/availability
// Toggle surgeon available = true / false
// Called by: HomeScreen availability toggle
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/availability', async (req, res) => {
  try {
    const { id } = req.params;
    const { available } = req.body;

    logger.info('Updating surgeon availability', { surgeon_id: id, available });

    if (typeof available !== 'boolean') {
      return res.status(400).json({ message: 'available must be true or false' });
    }

    const { error } = await supabase
      .from('surgeons')
      .update({ available })
      .eq('id', id);

    if (error) {
      logger.error('Failed to update availability', { error: error.message });
      return res.status(500).json({ message: 'Failed to update availability' });
    }

    logger.info('Availability updated', { surgeon_id: id, available });
    return res.json({ message: 'Availability updated', available });

  } catch (error) {
    logger.error('Error updating availability', { error: error.message });
    return res.status(500).json({ message: 'Failed to update availability' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/surgeons/:id/requests
// Returns:
// - incoming_requests: cases where this surgeon is currently notified
//   (status = 'notified' in case_priority_list)
// - upcoming_cases: cases this surgeon has accepted (status = 'confirmed')
// Called by: HomeScreen
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/requests', async (req, res) => {
  try {
    const { id } = req.params;
    logger.info('Fetching requests for surgeon', { surgeon_id: id });

    // ── INCOMING REQUESTS ─────────────────────────────────────────────────
    // Find all case_priority_list rows where this surgeon is notified
    const { data: notifiedRows, error: notifiedError } = await supabase
      .from('case_priority_list')
      .select(`
        id,
        case_id,
        priority_order,
        status,
        notified_at,
        expires_at
      `)
      .eq('surgeon_id', id)
      .eq('status', 'notified');

    if (notifiedError) {
      logger.error('Failed to fetch notified rows', { error: notifiedError.message });
      throw notifiedError;
    }

    // For each notified row, fetch the case details
    const incomingRequests = [];
    for (const row of notifiedRows || []) {
      const { data: case_ } = await supabase
        .from('cases')
        .select('id, case_number, procedure, specialty_required, surgery_date, surgery_time, fee_min, fee_max, status')
        .eq('id', row.case_id)
        .single();

      if (case_) {
        incomingRequests.push({
          case_id: row.case_id,
          priority_list_id: row.id,
          priority_order: row.priority_order,
          notified_at: row.notified_at,
          expires_at: row.expires_at,
          ...case_,
        });
      }
    }

    // ── UPCOMING CONFIRMED CASES ───────────────────────────────────────────
    // Find cases where this surgeon is confirmed and surgery is in the future
    const today = new Date().toISOString().split('T')[0];

    const { data: upcomingCases, error: upcomingError } = await supabase
      .from('cases')
      .select('id, case_number, procedure, specialty_required, surgery_date, surgery_time, ot_number, fee_min, fee_max')
      .eq('confirmed_surgeon_id', id)
      .in('status', ['confirmed', 'in_progress'])
      .gte('surgery_date', today)
      .order('surgery_date', { ascending: true });

    if (upcomingError) {
      logger.error('Failed to fetch upcoming cases', { error: upcomingError.message });
      throw upcomingError;
    }

    logger.info('Requests fetched', {
      surgeon_id: id,
      incoming: incomingRequests.length,
      upcoming: upcomingCases?.length || 0,
    });

    return res.json({
      incoming_requests: incomingRequests,
      upcoming_cases: upcomingCases || [],
    });

  } catch (error) {
    logger.error('Error fetching surgeon requests', { error: error.message });
    return res.status(500).json({ message: 'Failed to fetch requests' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/surgeons/:id/earnings
// Returns completed cases with payment details for this surgeon
// Called by: EarningsScreen
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/earnings', async (req, res) => {
  try {
    const { id } = req.params;
    logger.info('Fetching earnings for surgeon', { surgeon_id: id });

    // Get all completed cases where this surgeon was confirmed
    const { data: cases, error } = await supabase
      .from('cases')
      .select('id, case_number, procedure, surgery_date, fee_max, payment_status')
      .eq('confirmed_surgeon_id', id)
      .eq('status', 'completed')
      .order('surgery_date', { ascending: false });

    if (error) {
      logger.error('Failed to fetch earnings', { error: error.message });
      throw error;
    }

    // Calculate earnings for each case
    // fee_max is stored in paise. Surgeon gets 95% (5% platform commission).
    const earnings = (cases || []).map(case_ => {
      const grossFee = case_.fee_max || 0;
      const commissionAmount = Math.round(grossFee * 0.05);
      const netPayout = grossFee - commissionAmount;

      return {
        case_id: case_.id,
        case_number: case_.case_number,
        procedure: case_.procedure,
        surgery_date: case_.surgery_date,
        gross_fee: grossFee,
        commission_amount: commissionAmount,
        net_payout: netPayout,
        payment_status: case_.payment_status || 'pending',
      };
    });

    logger.info('Earnings fetched', { surgeon_id: id, cases: earnings.length });
    return res.json({ earnings });

  } catch (error) {
    logger.error('Error fetching earnings', { error: error.message });
    return res.status(500).json({ message: 'Failed to fetch earnings' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cases/:caseId/surgeon-view
// Returns case details for the surgeon.
// Hospital full address is hidden until surgeon accepts.
// Called by: RequestDetailScreen
// ─────────────────────────────────────────────────────────────────────────────
router.get('/cases/:caseId/surgeon-view', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { surgeon_id } = req.query;

    logger.info('Fetching surgeon view for case', { case_id: caseId, surgeon_id });

    // Fetch the case
    const { data: case_, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .single();

    if (caseError || !case_) {
      return res.status(404).json({ message: 'Case not found' });
    }

    // Fetch hospital city only (not full address — hidden until accepted)
    const { data: hospital } = await supabase
      .from('hospitals')
      .select('city')
      .eq('id', case_.hospital_id)
      .single();

    // Fetch this surgeon's priority list row to get expires_at
    let expiresAt = null;
    if (surgeon_id) {
      const { data: priorityRow } = await supabase
        .from('case_priority_list')
        .select('expires_at, status')
        .eq('case_id', caseId)
        .eq('surgeon_id', surgeon_id)
        .single();

      expiresAt = priorityRow?.expires_at || null;
    }

    // Return case with hospital city only (address revealed after acceptance)
    return res.json({
      case: {
        ...case_,
        hospital_city: hospital?.city || null,
        expires_at: expiresAt,
      }
    });

  } catch (error) {
    logger.error('Error fetching surgeon case view', { error: error.message });
    return res.status(500).json({ message: 'Failed to fetch case' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/cases/:caseId/accept
// Surgeon accepts the case.
// - Updates case_priority_list row to 'accepted'
// - Updates case status to 'confirmed'
// - Sets confirmed_surgeon_id on the case
// Called by: RequestDetailScreen
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/cases/:caseId/accept', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { surgeon_id } = req.body;

    logger.info('Surgeon accepting case', { case_id: caseId, surgeon_id });

    if (!surgeon_id) {
      return res.status(400).json({ message: 'surgeon_id required' });
    }

    const now = new Date().toISOString();

    // Update the priority list row to accepted
    const { error: priorityError } = await supabase
      .from('case_priority_list')
      .update({
        status: 'accepted',
        responded_at: now,
      })
      .eq('case_id', caseId)
      .eq('surgeon_id', surgeon_id);

    if (priorityError) {
      logger.error('Failed to update priority list', { error: priorityError.message });
      return res.status(500).json({ message: 'Failed to accept case' });
    }

    // Update case to confirmed with this surgeon
    const { error: caseError } = await supabase
      .from('cases')
      .update({
        status: 'confirmed',
        confirmed_surgeon_id: surgeon_id,
      })
      .eq('id', caseId);

    if (caseError) {
      logger.error('Failed to update case status', { error: caseError.message });
      return res.status(500).json({ message: 'Failed to confirm case' });
    }

    logger.info('Case accepted successfully', { case_id: caseId, surgeon_id });
    return res.json({ message: 'Case accepted successfully' });

  } catch (error) {
    logger.error('Error accepting case', { error: error.message });
    return res.status(500).json({ message: 'Failed to accept case' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/cases/:caseId/decline
// Surgeon declines the case.
// - Updates case_priority_list row to 'declined'
// - Triggers cascade to notify next surgeon
// Called by: RequestDetailScreen
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/cases/:caseId/decline', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { surgeon_id } = req.body;

    logger.info('Surgeon declining case', { case_id: caseId, surgeon_id });

    if (!surgeon_id) {
      return res.status(400).json({ message: 'surgeon_id required' });
    }

    const now = new Date().toISOString();

    // Update this surgeon's row to declined
    const { error: priorityError } = await supabase
      .from('case_priority_list')
      .update({
        status: 'declined',
        responded_at: now,
      })
      .eq('case_id', caseId)
      .eq('surgeon_id', surgeon_id);

    if (priorityError) {
      logger.error('Failed to update priority list', { error: priorityError.message });
      return res.status(500).json({ message: 'Failed to decline case' });
    }

    // Trigger cascade — notify the next surgeon in the list
    await triggerCascade(caseId);

    logger.info('Case declined, cascade triggered', { case_id: caseId });
    return res.json({ message: 'Case declined' });

  } catch (error) {
    logger.error('Error declining case', { error: error.message });
    return res.status(500).json({ message: 'Failed to decline case' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER CASCADE
// Notifies the next pending surgeon in the priority list.
// Called after a surgeon declines.
// Duplicated here from cases.js so surgeons.js is self-contained.
// ─────────────────────────────────────────────────────────────────────────────
async function triggerCascade(caseId) {
  logger.info('Triggering cascade after decline', { case_id: caseId });

  try {
    // Find next pending surgeon
    const { data: nextRow, error } = await supabase
      .from('case_priority_list')
      .select('*, surgeons(name, phone)')
      .eq('case_id', caseId)
      .eq('status', 'pending')
      .order('priority_order', { ascending: true })
      .limit(1)
      .single();

    if (error || !nextRow) {
      logger.warn('No more pending surgeons — case unfilled', { case_id: caseId });
      await supabase
        .from('cases')
        .update({ status: 'unfilled' })
        .eq('id', caseId);
      return;
    }

    // Set expiry 2 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2);

    await supabase
      .from('case_priority_list')
      .update({
        status: 'notified',
        notified_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', nextRow.id);

    logger.info('Cascade: next surgeon notified', {
      surgeon_name: nextRow.surgeons?.name,
      priority_order: nextRow.priority_order,
    });

    // TODO Sprint 5: Send SMS/WhatsApp/Push notification here

  } catch (error) {
    logger.error('Error in cascade', { error: error.message });
  }
}

module.exports = router;