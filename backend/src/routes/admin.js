/**
 * ADMIN ROUTES - Backend API
 * Company: Vaidhya Healthcare Pvt Ltd
 *
 * Handles all API endpoints for the Admin Dashboard.
 * These routes give the platform admin a global view across all hospitals,
 * surgeons, and cases — plus the ability to manually override cascade assignments.
 *
 * Endpoints:
 *   GET  /api/admin/stats           → Platform-wide stats cards + hospital breakdown
 *   GET  /api/admin/cases           → All cases across all hospitals (filterable)
 *   GET  /api/admin/surgeons        → All verified surgeons (filterable)
 *   GET  /api/admin/hospitals       → All hospitals with status and case counts
 *   PATCH /api/admin/cases/:id/override → Manually assign a surgeon to a case
 *
 * DEV_MODE: No auth required — all routes are open during development.
 * PRODUCTION TODO: Lock all admin routes behind admin JWT or session auth.
 */

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');   // Shared Supabase client
const logger = require('../logger');       // Winston logger

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/stats
// Returns 8 platform-wide stat cards + per-hospital case breakdown.
// Called by: Admin Dashboard — Stats tab
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  logger.info('Admin: fetching platform stats');

  try {
    // ── Fetch all cases ───────────────────────────────────────────────────────
    // We pull all cases once and compute all counts from memory,
    // which is more efficient than running 6 separate count queries.
    const { data: allCases, error: casesError } = await supabase
      .from('cases')
      .select('id, status, hospital_id');

    if (casesError) {
      logger.error('Admin stats: failed to fetch cases', { error: casesError.message });
      throw casesError;
    }

    // ── Fetch all surgeons ────────────────────────────────────────────────────
    const { data: allSurgeons, error: surgeonsError } = await supabase
      .from('surgeons')
      .select('id, available, verified');

    if (surgeonsError) {
      logger.error('Admin stats: failed to fetch surgeons', { error: surgeonsError.message });
      throw surgeonsError;
    }

    // ── Fetch all hospitals ───────────────────────────────────────────────────
    const { data: allHospitals, error: hospitalsError } = await supabase
      .from('hospitals')
      .select('id, name, verified');

    if (hospitalsError) {
      logger.error('Admin stats: failed to fetch hospitals', { error: hospitalsError.message });
      throw hospitalsError;
    }

    // ── Compute global stats from the fetched data ────────────────────────────
    const totalCases      = allCases.length;
    const activeCases     = allCases.filter(c => c.status === 'active').length;
    const cascadingCases  = allCases.filter(c => c.status === 'cascading').length;
    const completedCases  = allCases.filter(c => c.status === 'completed').length;
    const confirmedCases  = allCases.filter(c => c.status === 'confirmed').length;
    const unfilledCases   = allCases.filter(c => c.status === 'unfilled').length;

    // Fill rate = cases that got a confirmed surgeon / total cases that had cascade
    // Denominator: anything that was ever cascaded (confirmed + unfilled + cascading)
    const everCascaded = confirmedCases + unfilledCases + cascadingCases;
    const fillRate = everCascaded > 0
      ? Math.round((confirmedCases / everCascaded) * 100)
      : 0;

    const totalSurgeons     = allSurgeons.filter(s => s.verified).length;
    const availableSurgeons = allSurgeons.filter(s => s.verified && s.available).length;
    const totalHospitals    = allHospitals.length;

    // ── Hospital-wise breakdown ───────────────────────────────────────────────
    // For each hospital, count how many cases it has by status
    const hospitalBreakdown = allHospitals.map(hospital => {
      const hospitalCases = allCases.filter(c => c.hospital_id === hospital.id);
      return {
        id:           hospital.id,
        name:         hospital.name,
        verified:     hospital.verified,
        total:        hospitalCases.length,
        active:       hospitalCases.filter(c => c.status === 'active').length,
        cascading:    hospitalCases.filter(c => c.status === 'cascading').length,
        confirmed:    hospitalCases.filter(c => c.status === 'confirmed').length,
        completed:    hospitalCases.filter(c => c.status === 'completed').length,
        unfilled:     hospitalCases.filter(c => c.status === 'unfilled').length,
      };
    });

    logger.info('Admin stats computed', {
      total_cases: totalCases,
      total_surgeons: totalSurgeons,
      fill_rate: `${fillRate}%`,
    });

    return res.json({
      stats: {
        total_cases:        totalCases,
        active_cases:       activeCases + cascadingCases,  // "active" for display = active + cascading
        completed_cases:    completedCases,
        unfilled_cases:     unfilledCases,
        fill_rate:          fillRate,
        total_surgeons:     totalSurgeons,
        available_now:      availableSurgeons,
        total_hospitals:    totalHospitals,
      },
      hospital_breakdown: hospitalBreakdown,
    });

  } catch (error) {
    logger.error('Admin stats: unexpected error', { error: error.message });
    return res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/cases
// Returns ALL cases across all hospitals.
// Supports optional query params:
//   ?status=active|cascading|confirmed|completed|unfilled
//   ?search=<text>  (matches on procedure or patient_name, case-insensitive)
// Called by: Admin Dashboard — Cases tab
// ─────────────────────────────────────────────────────────────────────────────
router.get('/cases', async (req, res) => {
  const { status, search } = req.query;
  logger.info('Admin: fetching all cases', { status, search });

  try {
    // Base query: fetch all cases with hospital name and confirmed surgeon name
    let query = supabase
      .from('cases')
      .select(`
        *,
        hospitals (
          id,
          name,
          city
        ),
        surgeons!cases_confirmed_surgeon_id_fkey (
          id,
          name,
          specialty
        )
      `)
      .order('created_at', { ascending: false });

    // Filter by status if provided
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: cases, error } = await query;

    if (error) {
      logger.error('Admin cases: query failed', { error: error.message });
      throw error;
    }

    // Apply client-side search filter if provided
    // Supabase doesn't support full-text search on multiple columns easily,
    // so we filter in memory after fetching
    let filteredCases = cases;
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      filteredCases = cases.filter(c =>
        c.procedure?.toLowerCase().includes(term) ||
        c.patient_name?.toLowerCase().includes(term) ||
        c.case_number?.toLowerCase().includes(term) ||
        c.hospitals?.name?.toLowerCase().includes(term)
      );
    }

    logger.info('Admin cases fetched', {
      total: cases.length,
      after_filter: filteredCases.length,
    });

    return res.json({ cases: filteredCases });

  } catch (error) {
    logger.error('Admin cases: unexpected error', { error: error.message });
    return res.status(500).json({ message: 'Failed to fetch cases' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/surgeons
// Returns ALL surgeons (verified and unverified).
// Supports optional query params:
//   ?available=true|false
//   ?search=<text>  (matches name, specialty, city)
// Called by: Admin Dashboard — Surgeons tab
// ─────────────────────────────────────────────────────────────────────────────
router.get('/surgeons', async (req, res) => {
  const { available, search } = req.query;
  logger.info('Admin: fetching all surgeons', { available, search });

  try {
    let query = supabase
      .from('surgeons')
      .select('*')
      .order('created_at', { ascending: false });

    // Filter by availability if specified
    if (available === 'true') {
      query = query.eq('available', true);
    } else if (available === 'false') {
      query = query.eq('available', false);
    }

    const { data: surgeons, error } = await query;

    if (error) {
      logger.error('Admin surgeons: query failed', { error: error.message });
      throw error;
    }

    // Apply search filter in memory
    let filteredSurgeons = surgeons;
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      filteredSurgeons = surgeons.filter(s =>
        s.name?.toLowerCase().includes(term) ||
        s.city?.toLowerCase().includes(term) ||
        (Array.isArray(s.specialty)
          ? s.specialty.some(sp => sp.toLowerCase().includes(term))
          : s.specialty?.toLowerCase().includes(term))
      );
    }

    logger.info('Admin surgeons fetched', {
      total: surgeons.length,
      after_filter: filteredSurgeons.length,
    });

    return res.json({ surgeons: filteredSurgeons });

  } catch (error) {
    logger.error('Admin surgeons: unexpected error', { error: error.message });
    return res.status(500).json({ message: 'Failed to fetch surgeons' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/hospitals
// Returns ALL hospitals with their case count.
// Called by: Admin Dashboard — Hospitals tab
// ─────────────────────────────────────────────────────────────────────────────
router.get('/hospitals', async (req, res) => {
  logger.info('Admin: fetching all hospitals');

  try {
    // Fetch hospitals
    const { data: hospitals, error: hospitalsError } = await supabase
      .from('hospitals')
      .select('*')
      .order('created_at', { ascending: false });

    if (hospitalsError) {
      logger.error('Admin hospitals: query failed', { error: hospitalsError.message });
      throw hospitalsError;
    }

    // Fetch case counts per hospital in one query
    // We group by hospital_id in memory after fetching all cases
    const { data: caseCounts, error: countError } = await supabase
      .from('cases')
      .select('hospital_id, status');

    if (countError) {
      logger.error('Admin hospitals: case count query failed', { error: countError.message });
      // Don't throw — just return hospitals without counts
    }

    // Build a map of hospital_id → { total, by_status }
    const countMap = {};
    if (caseCounts) {
      for (const c of caseCounts) {
        if (!countMap[c.hospital_id]) {
          countMap[c.hospital_id] = { total: 0, active: 0, confirmed: 0, completed: 0, unfilled: 0, cascading: 0 };
        }
        countMap[c.hospital_id].total++;
        if (countMap[c.hospital_id][c.status] !== undefined) {
          countMap[c.hospital_id][c.status]++;
        }
      }
    }

    // Attach counts to each hospital object
    const hospitalsWithCounts = hospitals.map(h => ({
      ...h,
      case_counts: countMap[h.id] || { total: 0, active: 0, confirmed: 0, completed: 0, unfilled: 0, cascading: 0 },
    }));

    logger.info('Admin hospitals fetched', { count: hospitals.length });

    return res.json({ hospitals: hospitalsWithCounts });

  } catch (error) {
    logger.error('Admin hospitals: unexpected error', { error: error.message });
    return res.status(500).json({ message: 'Failed to fetch hospitals' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/cases/:id/override
// Manually assigns a surgeon to a case, bypassing the cascade.
//
// Steps:
//   1. Validate the case is overridable (status: active, cascading, or unfilled)
//   2. Cancel all pending/notified rows in case_priority_list for this case
//   3. Upsert a new row in case_priority_list for the chosen surgeon (status: accepted)
//   4. Set confirmed_surgeon_id on the case and update status to 'confirmed'
//
// Called by: Admin Dashboard — Override modal
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/cases/:id/override', async (req, res) => {
  const { id } = req.params;
  const { surgeon_id, admin_note } = req.body;

  logger.info('Admin: override requested', { case_id: id, surgeon_id, admin_note });

  // Validate required field
  if (!surgeon_id) {
    return res.status(400).json({ message: 'surgeon_id is required' });
  }

  try {
    // ── Step 1: Fetch the case and verify it can be overridden ─────────────────
    const { data: case_, error: caseError } = await supabase
      .from('cases')
      .select('id, status, procedure, hospital_id')
      .eq('id', id)
      .single();

    if (caseError || !case_) {
      logger.warn('Admin override: case not found', { case_id: id });
      return res.status(404).json({ message: 'Case not found' });
    }

    // Only allow override on cases that haven't already been completed/cancelled
    const overridableStatuses = ['active', 'cascading', 'unfilled'];
    if (!overridableStatuses.includes(case_.status)) {
      logger.warn('Admin override: case not in overridable status', {
        case_id: id,
        status: case_.status,
      });
      return res.status(400).json({
        message: `Cannot override a case with status: ${case_.status}. Only active, cascading, or unfilled cases can be overridden.`
      });
    }

    // ── Step 2: Verify the chosen surgeon exists ───────────────────────────────
    const { data: surgeon, error: surgeonError } = await supabase
      .from('surgeons')
      .select('id, name, verified')
      .eq('id', surgeon_id)
      .single();

    if (surgeonError || !surgeon) {
      logger.warn('Admin override: surgeon not found', { surgeon_id });
      return res.status(404).json({ message: 'Surgeon not found' });
    }

    if (!surgeon.verified) {
      logger.warn('Admin override: surgeon not verified', { surgeon_id });
      return res.status(400).json({ message: 'Surgeon is not verified' });
    }

    // ── Step 3: Cancel all pending/notified rows in the priority list ──────────
    // This stops the cascade from continuing for this case
    const { error: cancelError } = await supabase
      .from('case_priority_list')
      .update({
        status: 'cancelled',       // Mark as cancelled by admin override
      })
      .eq('case_id', id)
      .in('status', ['pending', 'notified']);   // Only cancel rows that haven't been resolved

    if (cancelError) {
      logger.error('Admin override: failed to cancel priority list rows', {
        error: cancelError.message,
      });
      return res.status(500).json({ message: 'Failed to cancel existing cascade' });
    }

    logger.info('Admin override: existing cascade rows cancelled', { case_id: id });

    // ── Step 4: Insert the override surgeon into case_priority_list ────────────
    // We insert a new row with status 'accepted' so the history is preserved.
    // If this surgeon was already in the list, we update their row instead.
    const now = new Date().toISOString();

    const { error: insertError } = await supabase
      .from('case_priority_list')
      .upsert({
        case_id:        id,
        surgeon_id:     surgeon_id,
        priority_order: 99,           // 99 indicates admin override, not organic cascade
        status:         'accepted',
        notified_at:    now,
        responded_at:   now,
        // Note: expires_at left null — admin override doesn't expire
      }, {
        onConflict: 'case_id,surgeon_id',   // If surgeon is already in the list, update them
      });

    if (insertError) {
      logger.error('Admin override: failed to insert override row', {
        error: insertError.message,
      });
      return res.status(500).json({ message: 'Failed to record override in priority list' });
    }

    // ── Step 5: Update the case to confirmed with the chosen surgeon ───────────
    const { error: updateError } = await supabase
      .from('cases')
      .update({
        status:               'confirmed',
        confirmed_surgeon_id: surgeon_id,
      })
      .eq('id', id);

    if (updateError) {
      logger.error('Admin override: failed to update case', { error: updateError.message });
      return res.status(500).json({ message: 'Failed to confirm case with override surgeon' });
    }

    logger.info('Admin override: case confirmed successfully', {
      case_id:      id,
      surgeon_id:   surgeon_id,
      surgeon_name: surgeon.name,
      procedure:    case_.procedure,
    });

    return res.json({
      message: `Case successfully assigned to Dr. ${surgeon.name}`,
      case_id:      id,
      surgeon_id:   surgeon_id,
      surgeon_name: surgeon.name,
    });

  } catch (error) {
    logger.error('Admin override: unexpected error', {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ message: 'Something went wrong during override' });
  }
});

// DUPLICATE REMOVED: A second GET /api/admin/surgeons route was here (lines 469-492
// of the original file). It was less complete than the first definition at the top
// of this file (which has search filtering and availability filtering). Removed to
// prevent Express route shadowing.

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/surgeons/:id/verify
// Verify or reject a surgeon registration
// Body: { action: 'verify' | 'reject' }
// Called by: Admin Dashboard — Surgeons tab
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/surgeons/:id/verify', async (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'verify' or 'reject'

  logger.info('Admin: surgeon verification action', { surgeon_id: id, action });

  try {
    const updates = action === 'verify'
      ? { verified: true, status: 'active', available: true }
      : { verified: false, status: 'rejected' };

    const { data: surgeon, error } = await supabase
      .from('surgeons')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    logger.info('Admin: surgeon verification updated', { surgeon_id: id, action });
    return res.json({ message: `Surgeon ${action}ed successfully`, surgeon });
  } catch (error) {
    logger.error('Admin: failed to verify surgeon', { error: error.message });
    return res.status(500).json({ message: 'Failed to update surgeon' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/surgeons/:id/suspend
// Suspend or reactivate a surgeon
// Body: { action: 'suspend' | 'reactivate' }
// Called by: Admin Dashboard — Surgeons tab
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/surgeons/:id/suspend', async (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'suspend' or 'reactivate'

  logger.info('Admin: surgeon suspend action', { surgeon_id: id, action });

  try {
    const updates = action === 'suspend'
      ? { status: 'suspended', available: false }
      : { status: 'active', available: true };

    const { data: surgeon, error } = await supabase
      .from('surgeons')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    logger.info('Admin: surgeon suspend updated', { surgeon_id: id, action });
    return res.json({ message: `Surgeon ${action}d successfully`, surgeon });
  } catch (error) {
    logger.error('Admin: failed to suspend surgeon', { error: error.message });
    return res.status(500).json({ message: 'Failed to update surgeon' });
  }
});

// DUPLICATE REMOVED: A second GET /api/admin/cases route was here (lines 567-592
// of the original file). It was less complete than the first definition at the top
// of this file (which has search filtering and hospital/surgeon joins). Removed to
// prevent Express route shadowing.

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/cases/:id/status
// Update case status — mark complete, cancel, etc.
// Body: { status: 'completed' | 'cancelled' }
// Called by: Admin Dashboard — Cases tab
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/cases/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const allowed = ['completed', 'cancelled', 'active', 'cascading'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: `Invalid status. Allowed: ${allowed.join(', ')}` });
  }

  logger.info('Admin: updating case status', { case_id: id, status });

  try {
    const { data: case_, error } = await supabase
      .from('cases')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    logger.info('Admin: case status updated', { case_id: id, status });
    return res.json({ message: 'Case status updated', case: case_ });
  } catch (error) {
    logger.error('Admin: failed to update case status', { error: error.message });
    return res.status(500).json({ message: 'Failed to update case status' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/cases/:id/reassign
// Manually reassign a confirmed case to a different surgeon
// Body: { surgeon_id: '...' }
// Called by: Admin Dashboard — Cases tab (reassign modal)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/cases/:id/reassign', async (req, res) => {
  const { id } = req.params;
  const { surgeon_id } = req.body;

  if (!surgeon_id) return res.status(400).json({ message: 'surgeon_id required' });

  logger.info('Admin: reassigning case', { case_id: id, surgeon_id });

  try {
    // Update case confirmed surgeon
    const { data: case_, error: caseError } = await supabase
      .from('cases')
      .update({ confirmed_surgeon_id: surgeon_id, status: 'confirmed' })
      .eq('id', id)
      .select()
      .single();

    if (caseError) throw caseError;

    // Update case_priority_list — mark previous accepted as overridden,
    // insert new row for reassigned surgeon as accepted
    await supabase
      .from('case_priority_list')
      .update({ status: 'overridden' })
      .eq('case_id', id)
      .eq('status', 'accepted');

    // Check if surgeon already has a row in priority list
    const { data: existingRow } = await supabase
      .from('case_priority_list')
      .select('id')
      .eq('case_id', id)
      .eq('surgeon_id', surgeon_id)
      .single();

    if (existingRow) {
      // Update existing row
      await supabase
        .from('case_priority_list')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', existingRow.id);
    } else {
      // Insert new row for manually assigned surgeon
      await supabase
        .from('case_priority_list')
        .insert({
          case_id:        id,
          surgeon_id,
          priority_order: 99, // Manual override — appears at bottom
          status:         'accepted',
          notified_at:    new Date().toISOString(),
          responded_at:   new Date().toISOString(),
        });
    }

    logger.info('Admin: case reassigned', { case_id: id, surgeon_id });
    return res.json({ message: 'Case reassigned successfully', case: case_ });
  } catch (error) {
    logger.error('Admin: failed to reassign case', { error: error.message });
    return res.status(500).json({ message: 'Failed to reassign case' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/cases/:id/cascade
// Manually trigger cascade on a stuck case
// Resets current notified surgeon to pending and triggers next
// Called by: Admin Dashboard — Cases tab
// ─────────────────────────────────────────────────────────────────────────────
router.post('/cases/:id/cascade', async (req, res) => {
  const { id } = req.params;
  logger.info('Admin: manually triggering cascade', { case_id: id });

  try {
    // Reset any 'notified' rows back to 'pending' so cascade can re-notify
    await supabase
      .from('case_priority_list')
      .update({ status: 'pending', notified_at: null, expires_at: null })
      .eq('case_id', id)
      .eq('status', 'notified');

    // Ensure case is in cascading status
    await supabase
      .from('cases')
      .update({ status: 'cascading' })
      .eq('id', id);

    // Import and run triggerCascade
    const casesRouter = require('./cases');
    // Since triggerCascade is not exported, call the cascade endpoint directly
    // by fetching next pending surgeon and notifying them
    const { notifyCasePassed } = require('../notifications');

    const { data: nextRow } = await supabase
      .from('case_priority_list')
      .select('*, surgeons(name, phone)')
      .eq('case_id', id)
      .eq('status', 'pending')
      .order('priority_order', { ascending: true })
      .limit(1)
      .single();

    if (!nextRow) {
      return res.status(400).json({ message: 'No pending surgeons left in priority list' });
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2);

    await supabase
      .from('case_priority_list')
      .update({
        status:      'notified',
        notified_at: new Date().toISOString(),
        expires_at:  expiresAt.toISOString(),
      })
      .eq('id', nextRow.id);

    // Get case details for notification
    const { data: caseData } = await supabase
      .from('cases')
      .select('procedure, surgery_date, surgery_time, fee_max')
      .eq('id', id)
      .single();

    if (caseData && nextRow.surgeons?.phone) {
      await notifyCasePassed({
        surgeonName:  nextRow.surgeons.name,
        surgeonPhone: nextRow.surgeons.phone,
        procedure:    caseData.procedure,
        surgeryDate:  caseData.surgery_date,
        surgeryTime:  caseData.surgery_time,
        feeMax:       caseData.fee_max,
      });
    }

    logger.info('Admin: cascade triggered manually', {
      case_id: id,
      notified_surgeon: nextRow.surgeons?.name,
    });

    return res.json({ message: `Cascade triggered — ${nextRow.surgeons?.name} notified` });
  } catch (error) {
    logger.error('Admin: failed to trigger cascade', { error: error.message });
    return res.status(500).json({ message: 'Failed to trigger cascade' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/earnings
// Returns earnings/commission report
// Called by: Admin Dashboard — Earnings tab
// ─────────────────────────────────────────────────────────────────────────────
router.get('/earnings', async (req, res) => {
  logger.info('Admin: fetching earnings report');

  try {
    // Fetch all completed and confirmed cases with fee data
    const { data: cases, error } = await supabase
      .from('cases')
      .select(`
        id, case_number, procedure, surgery_date, fee_max, status,
        hospitals ( name, city ),
        surgeons!cases_confirmed_surgeon_id_fkey ( name )
      `)
      .in('status', ['confirmed', 'completed'])
      .order('surgery_date', { ascending: false });

    if (error) throw error;

    // Calculate commission for each case
    // Platform takes 5% from hospital + 5% from surgeon = 10% total
    const earningsData = cases.map(c => ({
      ...c,
      surgeon_fee:          c.fee_max,
      hospital_commission:  Math.round(c.fee_max * 0.05),  // 5% from hospital
      surgeon_commission:   Math.round(c.fee_max * 0.05),  // 5% from surgeon
      total_commission:     Math.round(c.fee_max * 0.10),  // 10% total
    }));

    // Summary totals
    const summary = {
      total_cases:          earningsData.length,
      completed_cases:      earningsData.filter(c => c.status === 'completed').length,
      confirmed_cases:      earningsData.filter(c => c.status === 'confirmed').length,
      total_commission:     earningsData.reduce((sum, c) => sum + c.total_commission, 0),
      hospital_commission:  earningsData.reduce((sum, c) => sum + c.hospital_commission, 0),
      surgeon_commission:   earningsData.reduce((sum, c) => sum + c.surgeon_commission, 0),
    };

    logger.info('Admin: earnings fetched', { total_cases: summary.total_cases });
    return res.json({ earnings: earningsData, summary });
  } catch (error) {
    logger.error('Admin: failed to fetch earnings', { error: error.message });
    return res.status(500).json({ message: 'Failed to fetch earnings' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/hospitals/:id/verify
// Verify or unverify a hospital registration.
// Body: { verified: true | false }
// When verified = true:  hospital can log in and post cases.
// When verified = false: hospital is blocked from posting new cases.
//
// Follows the same pattern as PATCH /api/admin/surgeons/:id/verify.
// Called by: Admin Dashboard — Hospitals tab
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/hospitals/:id/verify', async (req, res) => {
  const { id } = req.params;
  const { verified } = req.body;

  logger.info('Admin: hospital verification action', { hospital_id: id, verified });

  if (verified === undefined || typeof verified !== 'boolean') {
    return res.status(400).json({ message: 'verified (boolean) is required' });
  }

  try {
    const { data: hospital, error } = await supabase
      .from('hospitals')
      .update({ verified })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    logger.info('Admin: hospital verification updated', {
      hospital_id: id,
      name: hospital.name,
      verified,
    });

    return res.json({
      message: `Hospital ${verified ? 'verified' : 'unverified'} successfully`,
      hospital,
    });

  } catch (error) {
    logger.error('Admin: failed to verify hospital', { error: error.message });
    return res.status(500).json({ message: 'Failed to update hospital' });
  }
});


module.exports = router;
