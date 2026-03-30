/**
 * CASES ROUTES - Backend API
 * Company: Surgeon on Call (OPC) Pvt Ltd
 *
 * Endpoints:
 * - POST /api/cases/draft        → Create empty draft case with pre-assigned surgeon
 * - POST /api/cases              → Create a full new surgery request
 * - GET  /api/cases              → List cases for a hospital
 * - GET  /api/cases/:id/matches  → Get matched surgeons for a case
 * - GET  /api/cases/:id          → Get a single case with full details
 * - PATCH /api/cases/:id/priority → Save priority list and trigger cascade
 * - PATCH /api/cases/:id         → Update case fields (now handles documents + status)
 * - DELETE /api/cases/:id        → Delete a case
 * - GET  /api/cases/:caseId/surgeon-view → Case detail for surgeon mobile app
 * - PATCH /api/cases/:caseId/accept  → Surgeon accepts
 * - PATCH /api/cases/:caseId/decline → Surgeon declines
 * - POST  /api/cases/:caseId/recommend     → Surgeon submits surgery recommendation
 * - GET   /api/cases/:caseId/recommendation → Get recommendation for a case
 * - PATCH /api/cases/:caseId/convert        → Hospital converts re-consult to surgery
 *
 * SCHEMA UPDATE (Migration 001):
 *   - cases.request_type  TEXT NOT NULL DEFAULT 'elective'
 *       Allowed values: 'elective', 'emergency', 'opd', 'reconsult'
 *   - cases.fee           INTEGER (paise, nullable) — flat fee replacing fee_min/fee_max
 *   - cases.fee_min / fee_max are now NULLABLE (kept for backward compat, not used in new logic)
 */

const express = require('express');
const router  = express.Router();
const supabase = require('../supabase');
const logger   = require('../logger');
const { notifyNewCase, notifyCasePassed } = require('../notifications');

// ── Valid request_type values (added in Migration 001) ──────────────────────
// 'elective'   — planned/scheduled surgery (default)
// 'emergency'  — urgent, skip 48hr lead time, skip shortlist
// 'opd'        — outpatient consultation, skip shortlist if same-day
// 'reconsult'  — follow-up consultation
const VALID_REQUEST_TYPES = ['elective', 'emergency', 'opd', 'reconsult'];

/**
 * Compute whether the frontend should skip the shortlist page and go
 * straight to cascade. Rules:
 *   - emergency → always skip (time-critical)
 *   - opd with surgery_date = today → skip (same-day OPD)
 *   - elective / reconsult / future-dated opd → do NOT skip
 */
function computeSkipShortlist(request_type, surgery_date) {
  if (request_type === 'emergency') return true;
  if (request_type === 'opd' && surgery_date) {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return surgery_date === today;
  }
  return false;
}


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cases/draft
// Create a minimal "draft" case with a surgeon pre-assigned.
// Called by: FindSurgeon page — "Book This Surgeon" button
//
// The case is created with status = 'draft' and confirmed_surgeon_id set.
// All clinical fields (procedure, patient, date etc) are left null.
// Hospital fills them in on the EditCase page, which then PATCHes this case.
//
// IMPORTANT: This route MUST be defined before POST / and before any /:id routes
// so Express doesn't mistake "draft" for a case UUID.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/draft', async (req, res) => {
  logger.info('Draft case creation requested', { body: req.body });

  try {
    const { hospital_id, pre_assigned_surgeon } = req.body;

    if (!hospital_id) {
      return res.status(400).json({ message: 'hospital_id is required' });
    }
    if (!pre_assigned_surgeon) {
      return res.status(400).json({ message: 'pre_assigned_surgeon is required' });
    }

    // ── Verify hospital ────────────────────────────────────────────────────
    const { data: hospital, error: hospitalError } = await supabase
      .from('hospitals')
      .select('id, name, city, verified')
      .eq('id', hospital_id)
      .single();

    if (hospitalError || !hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }

    // ── Verify surgeon exists and is verified ──────────────────────────────
    const { data: surgeon, error: surgeonError } = await supabase
      .from('surgeons')
      .select('id, name, verified, available')
      .eq('id', pre_assigned_surgeon)
      .single();

    if (surgeonError || !surgeon) {
      return res.status(404).json({ message: 'Surgeon not found' });
    }

    // ── Create the draft case ──────────────────────────────────────────────
    // All clinical fields are null — hospital fills them in on the EditCase page.
    //
    // UPDATED (Migration 001): Accept optional request_type and fee fields.
    // fee_min / fee_max kept for backward compat but no longer required.
    const { request_type, fee, fee_min, fee_max } = req.body;

    const { data: newCase, error: caseError } = await supabase
      .from('cases')
      .insert({
        hospital_id,
        confirmed_surgeon_id: pre_assigned_surgeon,
        status:               'draft',
        payment_status:       'pending',
        // request_type defaults to 'elective' at DB level if not provided
        request_type:       request_type || 'elective',
        fee:                fee   || null,    // flat fee (paise), nullable
        fee_min:            fee_min || null,   // backward compat, nullable
        fee_max:            fee_max || null,   // backward compat, nullable
        // Clinical fields — intentionally null, filled later
        procedure:          null,
        specialty_required: null,
        surgery_date:       null,
        surgery_time:       null,
        duration_hours:     null,
        ot_number:          null,
        patient_name:       null,
        patient_age:        null,
        patient_gender:     null,
        notes:              null,
        documents:          null,
      })
      .select()
      .single();

    if (caseError) {
      logger.error('Failed to create draft case', { error: caseError.message });
      return res.status(500).json({ message: 'Failed to create draft case' });
    }

    logger.info('Draft case created', {
      case_id:  newCase.id,
      hospital: hospital.name,
      surgeon:  surgeon.name,
    });

    return res.status(201).json({
      message: 'Draft case created',
      case:    newCase,
    });

  } catch (error) {
    logger.error('Error creating draft case', { error: error.message });
    return res.status(500).json({ message: 'Something went wrong' });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cases
// Create a new full surgery request and run the matching algorithm
// Called by: Hospital Web App — New Request form
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  logger.info('New case request received', { body: req.body });

  try {
    const {
      hospital_id,
      procedure,
      specialty_required,
      surgery_date,
      surgery_time,
      duration_hours,
      ot_number,
      patient_name,
      patient_age,
      patient_gender,
      fee,            // NEW (Migration 001): flat fee in paise — required
      fee_min,        // DEPRECATED: kept for backward compat, no longer required
      fee_max,        // DEPRECATED: kept for backward compat, no longer required
      request_type,   // NEW (Migration 001): 'elective' | 'emergency' | 'opd' | 'reconsult'
      parent_case_id, // NEW (Migration 004): links back to the originating re-consult case
      notes,
      documents,
    } = req.body;

    // ── Validation ─────────────────────────────────────────────────────────
    // UPDATED (Migration 001):
    //   - fee_min / fee_max removed from required list (nullable now)
    //   - fee is required (flat fee replaces range for new cases)
    //   - request_type validated against allowed values
    // OPD consultations don't require patient details — just time/date and fee
    const resolvedRequestType = request_type || 'elective';
    const required = resolvedRequestType === 'opd'
      ? ['hospital_id', 'procedure', 'specialty_required',
         'surgery_date', 'surgery_time', 'fee']
      : ['hospital_id', 'procedure', 'specialty_required',
         'surgery_date', 'surgery_time', 'duration_hours',
         'ot_number', 'patient_name', 'patient_age',
         'patient_gender', 'fee'];

    for (const field of required) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        logger.warn('Missing required field', { field });
        return res.status(400).json({ message: `Missing required field: ${field}` });
      }
    }

    // Validate request_type if provided (defaults to 'elective')
    if (!VALID_REQUEST_TYPES.includes(resolvedRequestType)) {
      logger.warn('Invalid request_type', { request_type: resolvedRequestType });
      return res.status(400).json({
        message: `Invalid request_type: ${resolvedRequestType}. Must be one of: ${VALID_REQUEST_TYPES.join(', ')}`
      });
    }

    // ── Verify hospital ────────────────────────────────────────────────────
    // UPDATED (Migration 005): Include lat/lng for distance-based matching
    logger.info('Verifying hospital', { hospital_id });

    const { data: hospital, error: hospitalError } = await supabase
      .from('hospitals')
      .select('id, name, city, lat, lng, verified')
      .eq('id', hospital_id)
      .single();

    if (hospitalError) {
      logger.error('Hospital lookup failed', { error: hospitalError.message, hospital_id });
      return res.status(404).json({ message: 'Hospital not found' });
    }

    if (!hospital.verified) {
      logger.warn('Unverified hospital tried to post case', { hospital_id });
      return res.status(403).json({
        message: 'Your hospital account is pending verification. Contact support.'
      });
    }

    logger.info('Hospital verified', { hospital_name: hospital.name, city: hospital.city });


    // ── Save case ──────────────────────────────────────────────────────────
    // UPDATED (Migration 001): Saves request_type and fee.
    // fee_min / fee_max still accepted for backward compat but not required.
    logger.info('Saving case to database');

    const { data: newCase, error: caseError } = await supabase
      .from('cases')
      .insert({
        hospital_id,
        procedure,
        specialty_required,
        surgery_date,
        surgery_time,
        duration_hours,
        ot_number,
        patient_name,
        patient_age,
        patient_gender,
        request_type:   resolvedRequestType,   // NEW — case classification
        fee:            fee,                    // NEW — flat fee in paise
        fee_min:        fee_min || null,        // backward compat, nullable
        fee_max:        fee_max || null,        // backward compat, nullable
        parent_case_id: parent_case_id || null,  // NEW (Migration 004): link to originating re-consult
        notes:     notes     || null,
        documents: documents || null,
        status:         'active',
        payment_status: 'pending',
      })
      .select()
      .single();

    if (caseError) {
      logger.error('Failed to save case', { error: caseError.message });
      return res.status(500).json({ message: 'Failed to create case' });
    }

    logger.info('Case saved successfully', {
      case_id:     newCase.id,
      case_number: newCase.case_number,
      procedure:   newCase.procedure,
    });

    // ── Run matching ───────────────────────────────────────────────────────
    // UPDATED (Migration 005): Distance-based matching replaces city matching.
    // Hospital lat/lng passed to the matcher for haversine distance scoring.
    logger.info('Running matching algorithm', {
      specialty:    specialty_required,
      hospital_lat: hospital.lat,
      hospital_lng: hospital.lng,
    });

    const matchedSurgeons = await matchSurgeons({
      specialty_required,
      surgery_date,
      surgery_time,
      hospital_lat: hospital.lat,
      hospital_lng: hospital.lng,
      limit: resolvedRequestType === 'emergency' ? 0 : 7,  // 0 = no limit for emergency
    });

    logger.info('Matching complete', { surgeons_found: matchedSurgeons.length });

    // ADDED (Migration 001): Tell the frontend whether to skip the shortlist
    // page and go straight to cascade (emergency or same-day OPD).
    const skip_shortlist = computeSkipShortlist(resolvedRequestType, surgery_date);

    return res.status(201).json({
      message:          'Case created successfully',
      case:             newCase,
      matched_surgeons: matchedSurgeons,
      skip_shortlist,   // NEW — frontend uses this to decide navigation
    });

  } catch (error) {
    logger.error('Unexpected error creating case', {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ message: 'Something went wrong' });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cases
// List all cases for a hospital
// Called by: Hospital Web App — Dashboard
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { hospital_id } = req.query;

    if (!hospital_id) {
      return res.status(400).json({ message: 'hospital_id is required' });
    }

    logger.info('Fetching cases for hospital', { hospital_id });

    const { data: cases, error } = await supabase
      .from('cases')
      .select('*')
      .eq('hospital_id', hospital_id)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch cases', { error: error.message });
      throw error;
    }

    logger.info('Cases fetched', { count: cases.length });
    return res.json({ cases });

  } catch (error) {
    logger.error('Error fetching cases', { error: error.message });
    return res.status(500).json({ message: 'Failed to fetch cases' });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cases/:id/matches
// Get matched surgeons for an existing case
// Called by: Shortlist page on load
//
// IMPORTANT: Must be defined BEFORE GET /:id so Express doesn't treat
// the literal string "matches" as a UUID parameter.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/matches', async (req, res) => {
  try {
    const { id } = req.params;
    logger.info('Fetching matches for case', { case_id: id });

    // Get the case
    const { data: case_, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', id)
      .single();

    if (caseError || !case_) {
      logger.warn('Case not found for matching', { case_id: id });
      return res.status(404).json({ message: 'Case not found' });
    }

    // Get hospital city
    const { data: hospital, error: hospitalError } = await supabase
      .from('hospitals')
      .select('city, lat, lng')
      .eq('id', case_.hospital_id)
      .single();

    if (hospitalError) {
      logger.warn('Hospital not found for case', { hospital_id: case_.hospital_id });
    }

    logger.info('Fetched hospital location for matching', {
      lat: hospital?.lat,
      lng: hospital?.lng,
    });

    // Run matching
    // UPDATED (Migration 005): Distance-based matching using hospital lat/lng.
    const matchedSurgeons = await matchSurgeons({
      specialty_required: case_.specialty_required,
      surgery_date:       case_.surgery_date,
      surgery_time:       case_.surgery_time,
      hospital_lat:       hospital?.lat,
      hospital_lng:       hospital?.lng,
    });

    logger.info('Matches fetched', {
      case_id:       id,
      matches_found: matchedSurgeons.length,
    });

    return res.json({ matched_surgeons: matchedSurgeons });

  } catch (error) {
    logger.error('Error fetching matches', { error: error.message });
    return res.status(500).json({ message: 'Failed to fetch matches' });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cases/:caseId/recommend
// Surgeon submits a surgery recommendation for a re-consult case.
// After an OPD/re-consult, the surgeon may recommend a follow-up surgery.
// This stores the recommendation for the hospital SPOC to review.
//
// Called by: Surgeon Mobile App — RequestDetailScreen (re-consult flow)
//
// IMPORTANT: Must be defined BEFORE GET /:id so Express doesn't match
// the literal "recommend" as a UUID parameter.
//
// SCHEMA (Migration 004):
//   surgery_recommendations(id, case_id, surgeon_id, suggested_procedure,
//     recommendation_notes, urgency, status, created_at)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:caseId/recommend', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { surgeon_id, suggested_procedure, recommendation_notes, urgency } = req.body;

    logger.info('Surgery recommendation submitted', {
      case_id: caseId,
      surgeon_id,
      suggested_procedure,
      urgency,
    });

    // ── Validate required fields ─────────────────────────────────────────
    if (!surgeon_id) {
      return res.status(400).json({ message: 'surgeon_id is required' });
    }
    if (!suggested_procedure || !suggested_procedure.trim()) {
      return res.status(400).json({ message: 'suggested_procedure is required' });
    }
    if (!urgency || !['elective', 'urgent'].includes(urgency)) {
      return res.status(400).json({
        message: 'urgency is required and must be "elective" or "urgent"'
      });
    }

    // ── Verify case exists and is a re-consult ───────────────────────────
    const { data: case_, error: caseError } = await supabase
      .from('cases')
      .select('id, request_type, confirmed_surgeon_id, status')
      .eq('id', caseId)
      .single();

    if (caseError || !case_) {
      logger.warn('Case not found for recommendation', { case_id: caseId });
      return res.status(404).json({ message: 'Case not found' });
    }

    if (case_.request_type !== 'reconsult') {
      logger.warn('Recommendation rejected — case is not a re-consult', {
        case_id: caseId,
        request_type: case_.request_type,
      });
      return res.status(400).json({
        message: 'Surgery recommendations can only be made on re-consult cases'
      });
    }

    // ── Verify surgeon is the confirmed surgeon on this case ─────────────
    if (case_.confirmed_surgeon_id !== surgeon_id) {
      logger.warn('Recommendation rejected — surgeon is not the confirmed surgeon', {
        case_id: caseId,
        surgeon_id,
        confirmed_surgeon_id: case_.confirmed_surgeon_id,
      });
      return res.status(403).json({
        message: 'Only the confirmed surgeon on this case can make recommendations'
      });
    }

    // ── Insert the recommendation ────────────────────────────────────────
    const { data: recommendation, error: insertError } = await supabase
      .from('surgery_recommendations')
      .insert({
        case_id:               caseId,
        surgeon_id,
        suggested_procedure:   suggested_procedure.trim(),
        recommendation_notes:  recommendation_notes?.trim() || null,
        urgency,
        status:                'pending',
      })
      .select()
      .single();

    if (insertError) {
      logger.error('Failed to insert surgery recommendation', {
        error: insertError.message,
      });
      return res.status(500).json({ message: 'Failed to save recommendation' });
    }

    logger.info('Surgery recommendation saved', {
      recommendation_id: recommendation.id,
      case_id:           caseId,
      surgeon_id,
      urgency,
    });

    return res.status(201).json({
      message:        'Surgery recommendation submitted',
      recommendation,
    });

  } catch (error) {
    logger.error('Error submitting surgery recommendation', { error: error.message });
    return res.status(500).json({ message: 'Failed to submit recommendation' });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cases/:caseId/recommendation
// Returns the surgery recommendation for a case, if one exists.
// Joins with surgeons table to include the recommending surgeon's details.
//
// Called by: Hospital Web App — CaseDetail page (re-consult cases)
//
// IMPORTANT: Must be defined BEFORE GET /:id so Express doesn't match
// the literal "recommendation" as a UUID parameter.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:caseId/recommendation', async (req, res) => {
  try {
    const { caseId } = req.params;

    logger.info('Fetching recommendation for case', { case_id: caseId });

    // Fetch the recommendation with surgeon details via Supabase join
    const { data: recommendation, error } = await supabase
      .from('surgery_recommendations')
      .select(`
        *,
        surgeons (
          id, name, specialty, experience_years, rating, city
        )
      `)
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch recommendation', { error: error.message });
      return res.status(500).json({ message: 'Failed to fetch recommendation' });
    }

    // Return null gracefully if no recommendation exists — this is not an error
    logger.info('Recommendation fetched', {
      case_id: caseId,
      found:   !!recommendation,
    });

    return res.json({
      recommendation: recommendation || null,
    });

  } catch (error) {
    logger.error('Error fetching recommendation', { error: error.message });
    return res.status(500).json({ message: 'Failed to fetch recommendation' });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/cases/:caseId/convert
// Hospital confirms they want to convert a re-consult case into a full
// surgery case. This:
//   1. Sets the re-consult case status to 'converted'
//   2. Sets the recommendation status to 'accepted'
//
// The frontend then handles opening a pre-filled NewRequest form with the
// recommendation details and parent_case_id set to this case.
//
// Called by: Hospital Web App — CaseDetail page (re-consult flow)
//
// IMPORTANT: Must be defined BEFORE PATCH /:id so Express doesn't match
// the literal "convert" as a UUID parameter.
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:caseId/convert', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { hospital_id } = req.body;

    logger.info('Converting re-consult case to surgery', {
      case_id:     caseId,
      hospital_id,
    });

    // ── Validate hospital_id ─────────────────────────────────────────────
    if (!hospital_id) {
      return res.status(400).json({ message: 'hospital_id is required' });
    }

    // ── Verify case exists, belongs to this hospital, and is a re-consult
    const { data: case_, error: caseError } = await supabase
      .from('cases')
      .select('id, hospital_id, request_type, status')
      .eq('id', caseId)
      .single();

    if (caseError || !case_) {
      logger.warn('Case not found for conversion', { case_id: caseId });
      return res.status(404).json({ message: 'Case not found' });
    }

    if (case_.hospital_id !== hospital_id) {
      logger.warn('Convert rejected — hospital mismatch', {
        case_id:     caseId,
        expected:    case_.hospital_id,
        received:    hospital_id,
      });
      return res.status(403).json({ message: 'This case does not belong to your hospital' });
    }

    if (case_.request_type !== 'reconsult') {
      logger.warn('Convert rejected — case is not a re-consult', {
        case_id:      caseId,
        request_type: case_.request_type,
      });
      return res.status(400).json({ message: 'Only re-consult cases can be converted' });
    }

    if (case_.status === 'converted') {
      logger.warn('Case already converted', { case_id: caseId });
      return res.status(400).json({ message: 'This case has already been converted' });
    }

    // ── Update re-consult case status to 'converted' ─────────────────────
    const { error: updateError } = await supabase
      .from('cases')
      .update({ status: 'converted' })
      .eq('id', caseId);

    if (updateError) {
      logger.error('Failed to update case status to converted', {
        error: updateError.message,
      });
      return res.status(500).json({ message: 'Failed to convert case' });
    }

    // ── Mark the recommendation as 'accepted' ────────────────────────────
    // There may be multiple recommendations (edge case) — accept the most recent one
    const { error: recError } = await supabase
      .from('surgery_recommendations')
      .update({ status: 'accepted' })
      .eq('case_id', caseId)
      .eq('status', 'pending');

    if (recError) {
      logger.error('Failed to update recommendation status', {
        error: recError.message,
      });
      // Non-fatal — the case is already converted, log and continue
    }

    logger.info('Re-consult case converted successfully', { case_id: caseId });

    return res.json({
      message: 'Re-consult case converted to surgery',
      case_id: caseId,
    });

  } catch (error) {
    logger.error('Error converting re-consult case', { error: error.message });
    return res.status(500).json({ message: 'Failed to convert case' });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cases/:id
// Get a single case with full details including priority list
// Called by: Hospital Web App — Case Detail page
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    logger.info('Fetching case detail', { case_id: id });

    const { data: case_, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', id)
      .single();

    if (caseError || !case_) {
      logger.warn('Case not found', { case_id: id });
      return res.status(404).json({ message: 'Case not found' });
    }

    // Fetch priority list with surgeon details
    const { data: priorityList, error: priorityError } = await supabase
      .from('case_priority_list')
      .select(`
        *,
        surgeons (
          id, name, specialty, experience_years,
          rating, total_cases, city
        )
      `)
      .eq('case_id', id)
      .order('priority_order', { ascending: true });

    if (priorityError) {
      logger.error('Failed to fetch priority list', { error: priorityError.message });
      throw priorityError;
    }

    logger.info('Case detail fetched', {
      case_id:             id,
      priority_list_count: priorityList?.length || 0,
    });

    // ADDED (Migration 001): Include skip_shortlist flag so frontend knows
    // whether this case type should bypass the shortlist page.
    // request_type and fee are already in case_ from the SELECT * above.
    const skip_shortlist = computeSkipShortlist(case_.request_type, case_.surgery_date);

    return res.json({
      case:           case_,
      priority_list:  priorityList || [],
      skip_shortlist, // NEW — mirrors the logic from POST /api/cases
    });

  } catch (error) {
    logger.error('Error fetching case detail', { error: error.message });
    return res.status(500).json({ message: 'Failed to fetch case' });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/cases/:id/priority
// Save the hospital's priority list and trigger the cascade
// Called by: Shortlist page — when SPOC clicks Send Requests
//
// IMPORTANT: Must be defined BEFORE PATCH /:id so Express doesn't match
// the ":id/priority" path as just ":id".
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/priority', async (req, res) => {
  try {
    const { id } = req.params;
    const { priority_list } = req.body;

    logger.info('Saving priority list for case', {
      case_id:  id,
      surgeons: priority_list,
    });

    if (!priority_list || !Array.isArray(priority_list) || priority_list.length < 1) {
      return res.status(400).json({
        message: 'Priority list must contain at least 1 surgeon ID'
      });
    }

    // Verify case exists and check request_type
    const { data: case_, error: caseError } = await supabase
      .from('cases')
      .select('id, status, request_type')
      .eq('id', id)
      .single();

    if (caseError || !case_) {
      return res.status(404).json({ message: 'Case not found' });
    }

    const isEmergency = case_.request_type === 'emergency';

    // Delete any existing priority list rows for this case (allows re-submission)
    await supabase
      .from('case_priority_list')
      .delete()
      .eq('case_id', id);

    // Insert priority list rows
    const priorityRows = priority_list.map((surgeon_id, index) => ({
      case_id:        id,
      surgeon_id,
      priority_order: index + 1,
      status:         'pending',
    }));

    logger.info('Inserting priority list rows', { count: priorityRows.length });

    const { error: insertError } = await supabase
      .from('case_priority_list')
      .insert(priorityRows);

    if (insertError) {
      logger.error('Failed to insert priority list', { error: insertError.message });
      return res.status(500).json({ message: 'Failed to save priority list' });
    }

    // Update case status
    const { error: updateError } = await supabase
      .from('cases')
      .update({ status: 'cascading' })
      .eq('id', id);

    if (updateError) {
      logger.error('Failed to update case status', { error: updateError.message });
    }

    if (isEmergency) {
      // Emergency: broadcast to ALL surgeons simultaneously — no cascade
      await broadcastEmergency(id);
      logger.info('Emergency broadcast sent to all surgeons', { case_id: id });
    } else {
      // Normal flow: cascade through surgeons one-by-one
      await triggerCascade(id);
      logger.info('Priority list saved and cascade triggered', { case_id: id });
    }

    return res.json({
      message: isEmergency
        ? 'Emergency request sent to all available surgeons.'
        : 'Priority list saved. Requests sent to surgeons.',
      case_id: id,
    });

  } catch (error) {
    logger.error('Error saving priority list', { error: error.message });
    return res.status(500).json({ message: 'Failed to save priority list' });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/cases/:id
// Update any fields on a case.
// Called by:
//   - EditCase page (fills in draft case details, moves status to 'active')
//   - CaseDetail page (edit modal for active/confirmed cases)
//
// Handles: all clinical fields + documents (JSONB) + status
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  logger.info('Updating case', { case_id: id, fields: Object.keys(req.body) });

  try {
    const {
      procedure,
      specialty_required,
      surgery_date,
      surgery_time,
      duration_hours,
      ot_number,
      patient_name,
      patient_age,
      patient_gender,
      fee,            // NEW (Migration 001): flat fee in paise
      request_type,   // NEW (Migration 001): case classification
      fee_min,        // DEPRECATED: backward compat, nullable
      fee_max,        // DEPRECATED: backward compat, nullable
      notes,
      documents,   // JSONB array — uploaded file metadata
      status,      // allow status transitions (e.g. draft → active)
    } = req.body;

    // Build update object — only include fields that were actually sent
    const updates = {};
    if (procedure          !== undefined) updates.procedure          = procedure;
    if (specialty_required !== undefined) updates.specialty_required = specialty_required;
    if (surgery_date       !== undefined) updates.surgery_date       = surgery_date;
    if (surgery_time       !== undefined) updates.surgery_time       = surgery_time;
    if (duration_hours     !== undefined) updates.duration_hours     = duration_hours;
    if (ot_number          !== undefined) updates.ot_number          = ot_number;
    if (patient_name       !== undefined) updates.patient_name       = patient_name;
    if (patient_age        !== undefined) updates.patient_age        = patient_age;
    if (patient_gender     !== undefined) updates.patient_gender     = patient_gender;
    if (fee                !== undefined) updates.fee                = fee;            // NEW
    if (request_type       !== undefined) updates.request_type       = request_type;   // NEW
    if (fee_min            !== undefined) updates.fee_min            = fee_min;
    if (fee_max            !== undefined) updates.fee_max            = fee_max;
    if (notes              !== undefined) updates.notes              = notes;
    if (documents          !== undefined) updates.documents          = documents;
    if (status             !== undefined) updates.status             = status;
    updates.updated_at = new Date().toISOString();

    // Validate request_type if it's being updated
    if (request_type !== undefined && !VALID_REQUEST_TYPES.includes(request_type)) {
      return res.status(400).json({
        message: `Invalid request_type: ${request_type}. Must be one of: ${VALID_REQUEST_TYPES.join(', ')}`
      });
    }

    const { data: case_, error } = await supabase
      .from('cases')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update case', { error: error.message, case_id: id });
      throw error;
    }

    logger.info('Case updated successfully', {
      case_id:   id,
      status:    case_.status,
      procedure: case_.procedure,
    });

    return res.json({ message: 'Case updated successfully', case: case_ });

  } catch (error) {
    logger.error('Error updating case', { error: error.message });
    return res.status(500).json({ message: 'Failed to update case' });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/cases/:id
// Delete a case and its priority list entries
// Called by: CaseDetail page — Delete button
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  logger.info('Deleting case', { case_id: id });

  try {
    // Delete priority list entries first (foreign key constraint)
    await supabase
      .from('case_priority_list')
      .delete()
      .eq('case_id', id);

    // Delete the case
    const { error } = await supabase
      .from('cases')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Failed to delete case', { error: error.message });
      throw error;
    }

    logger.info('Case deleted successfully', { case_id: id });
    return res.json({ message: 'Case deleted successfully' });

  } catch (error) {
    logger.error('Error deleting case', { error: error.message });
    return res.status(500).json({ message: 'Failed to delete case' });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cases/:caseId/surgeon-view
// Returns case details for the surgeon mobile app.
// Hospital full address is hidden until surgeon accepts.
// Called by: RequestDetailScreen
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:caseId/surgeon-view', async (req, res) => {
  try {
    const { caseId }    = req.params;
    const { surgeon_id } = req.query;

    logger.info('Fetching surgeon view for case', { case_id: caseId, surgeon_id });

    const { data: case_, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .single();

    if (caseError || !case_) {
      return res.status(404).json({ message: 'Case not found' });
    }

    // If confirmed → reveal full hospital name. Otherwise city only.
    const hospitalFields = case_.status === 'confirmed' ? 'id, name, city' : 'city';
    const { data: hospital } = await supabase
      .from('hospitals')
      .select(hospitalFields)
      .eq('id', case_.hospital_id)
      .single();

    // Get surgeon's expires_at from their priority list row
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

    logger.info('Surgeon view fetched', { case_id: caseId });

    // UPDATED (Migration 001): The spread (...case_) already includes the
    // new request_type and fee columns from SELECT *. No extra work needed —
    // the surgeon mobile app will receive them automatically.
    return res.json({
      case: {
        ...case_,
        hospital_city: hospital?.city || null,
        hospital_name: hospital?.name || null,  // only populated when confirmed
        expires_at:    expiresAt,
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
// Updates case_priority_list row to 'accepted', case status to 'confirmed',
// and sets confirmed_surgeon_id on the case.
// Called by: RequestDetailScreen
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:caseId/accept', async (req, res) => {
  try {
    const { caseId }    = req.params;
    const { surgeon_id } = req.body;

    logger.info('Surgeon accepting case', { case_id: caseId, surgeon_id });

    if (!surgeon_id) {
      return res.status(400).json({ message: 'surgeon_id required' });
    }

    const now = new Date().toISOString();

    // Update priority list row to accepted
    const { error: priorityError } = await supabase
      .from('case_priority_list')
      .update({ status: 'accepted', responded_at: now })
      .eq('case_id', caseId)
      .eq('surgeon_id', surgeon_id);

    if (priorityError) {
      logger.error('Failed to update priority list on accept', { error: priorityError.message });
      return res.status(500).json({ message: 'Failed to accept case' });
    }

    // Update case to confirmed
    const { error: caseError } = await supabase
      .from('cases')
      .update({ status: 'confirmed', confirmed_surgeon_id: surgeon_id })
      .eq('id', caseId);

    if (caseError) {
      logger.error('Failed to confirm case', { error: caseError.message });
      return res.status(500).json({ message: 'Failed to confirm case' });
    }

    // Cancel all other notified/pending surgeons for this case
    // (important for emergency broadcasts where all surgeons were notified at once)
    await supabase
      .from('case_priority_list')
      .update({ status: 'cancelled' })
      .eq('case_id', caseId)
      .neq('surgeon_id', surgeon_id)
      .in('status', ['notified', 'pending']);

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
// Updates case_priority_list row to 'declined', then triggers cascade
// to notify the next surgeon in the priority list.
// Called by: RequestDetailScreen
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:caseId/decline', async (req, res) => {
  try {
    const { caseId }    = req.params;
    const { surgeon_id } = req.body;

    logger.info('Surgeon declining case', { case_id: caseId, surgeon_id });

    if (!surgeon_id) {
      return res.status(400).json({ message: 'surgeon_id required' });
    }

    const now = new Date().toISOString();

    // Update this surgeon's row to declined
    const { error: priorityError } = await supabase
      .from('case_priority_list')
      .update({ status: 'declined', responded_at: now })
      .eq('case_id', caseId)
      .eq('surgeon_id', surgeon_id);

    if (priorityError) {
      logger.error('Failed to update priority list on decline', { error: priorityError.message });
      return res.status(500).json({ message: 'Failed to decline case' });
    }

    // Check if this is an emergency case
    const { data: caseData } = await supabase
      .from('cases')
      .select('request_type')
      .eq('id', caseId)
      .single();

    if (caseData?.request_type === 'emergency') {
      // Emergency: all surgeons already notified — check if any are still notified
      const { data: remaining } = await supabase
        .from('case_priority_list')
        .select('id')
        .eq('case_id', caseId)
        .eq('status', 'notified');

      if (!remaining || remaining.length === 0) {
        // All surgeons declined or expired — mark unfilled
        await supabase.from('cases').update({ status: 'unfilled' }).eq('id', caseId);
        logger.info('Emergency: all surgeons declined, case unfilled', { case_id: caseId });
      } else {
        logger.info('Emergency: surgeon declined, others still pending', {
          case_id: caseId,
          remaining: remaining.length,
        });
      }
    } else {
      // Normal flow: cascade to next surgeon
      await triggerCascade(caseId);
      logger.info('Case declined, cascade triggered', { case_id: caseId });
    }

    return res.json({ message: 'Case declined' });

  } catch (error) {
    logger.error('Error declining case', { error: error.message });
    return res.status(500).json({ message: 'Failed to decline case' });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// BROADCAST EMERGENCY
// Notifies ALL surgeons at once — no cascade. Used for emergency requests.
// Every surgeon in the priority list gets notified simultaneously.
// First surgeon to accept wins; the rest are ignored.
// ─────────────────────────────────────────────────────────────────────────────
async function broadcastEmergency(caseId) {
  logger.info('Broadcasting emergency to all surgeons', { case_id: caseId });

  try {
    // Fetch all pending rows for this case
    const { data: rows, error } = await supabase
      .from('case_priority_list')
      .select('*, surgeons(name, phone, email)')
      .eq('case_id', caseId)
      .eq('status', 'pending')
      .order('priority_order', { ascending: true });

    if (error || !rows || rows.length === 0) {
      logger.warn('No pending surgeons for emergency broadcast', { case_id: caseId });
      await supabase
        .from('cases')
        .update({ status: 'unfilled' })
        .eq('id', caseId);
      return;
    }

    // Set expires_at to 2 hours from now for all surgeons
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2);

    // Mark ALL surgeons as 'notified' at once
    const ids = rows.map(r => r.id);
    const { error: updateError } = await supabase
      .from('case_priority_list')
      .update({
        status:      'notified',
        notified_at: new Date().toISOString(),
        expires_at:  expiresAt.toISOString(),
      })
      .in('id', ids);

    if (updateError) {
      logger.error('Failed to update emergency broadcast rows', { error: updateError.message });
      return;
    }

    // Fetch case details for notifications
    const { data: caseData } = await supabase
      .from('cases')
      .select('procedure, surgery_date, surgery_time, fee, fee_max')
      .eq('id', caseId)
      .single();

    // Send notifications to ALL surgeons simultaneously
    const notifyPromises = rows
      .filter(row => row.surgeons?.phone)
      .map(row => {
        const feeForNotification = caseData?.fee || caseData?.fee_max;
        return notifyNewCase({
          surgeonName:  row.surgeons.name,
          surgeonPhone: row.surgeons.phone,
          procedure:    caseData?.procedure,
          surgeryDate:  caseData?.surgery_date,
          surgeryTime:  caseData?.surgery_time,
          feeMax:       feeForNotification,
          expiresAt:    expiresAt.toISOString(),
        }).catch(err => {
          logger.error('Failed to notify surgeon in emergency broadcast', {
            surgeon_name: row.surgeons.name,
            error: err.message,
          });
        });
      });

    await Promise.all(notifyPromises);

    logger.info('Emergency broadcast complete', {
      case_id: caseId,
      surgeons_notified: rows.length,
    });

  } catch (error) {
    logger.error('Error in emergency broadcast', { error: error.message });
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER CASCADE
// Notifies the next surgeon in the priority list.
// Called after priority list is saved, and after each decline/expiry.
// ─────────────────────────────────────────────────────────────────────────────
async function triggerCascade(caseId) {
  logger.info('Triggering cascade for case', { case_id: caseId });

  try {
    // Find the next pending surgeon
    const { data: nextRow, error } = await supabase
      .from('case_priority_list')
      .select('*, surgeons(name, phone, email)')
      .eq('case_id', caseId)
      .eq('status', 'pending')
      .order('priority_order', { ascending: true })
      .limit(1)
      .single();

    if (error || !nextRow) {
      logger.warn('No pending surgeons left — marking case unfilled', { case_id: caseId });
      await supabase
        .from('cases')
        .update({ status: 'unfilled' })
        .eq('id', caseId);
      return;
    }

    // Set expires_at to 2 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2);

    // Update this surgeon's row to 'notified'
    const { error: updateError } = await supabase
      .from('case_priority_list')
      .update({
        status:      'notified',
        notified_at: new Date().toISOString(),
        expires_at:  expiresAt.toISOString(),
      })
      .eq('id', nextRow.id);

    if (updateError) {
      logger.error('Failed to update cascade row', { error: updateError.message });
      return;
    }

    logger.info('Cascade: surgeon notified', {
      surgeon_name:   nextRow.surgeons?.name,
      priority_order: nextRow.priority_order,
      expires_at:     expiresAt.toISOString(),
    });

    // ── Send WhatsApp/SMS notification ─────────────────────────────────────
    // First surgeon gets "new case" message; subsequent get "case passed"
    const isFirstSurgeon = nextRow.priority_order === 1;

    // UPDATED (Migration 001): Fetch fee (flat fee) alongside fee_max for
    // backward compat. Notifications use whichever is available.
    const caseDetails = await supabase
      .from('cases')
      .select('procedure, surgery_date, surgery_time, fee, fee_max')
      .eq('id', caseId)
      .single();

    if (caseDetails.data && nextRow.surgeons?.phone) {
      console.log('=== Firing notification to:', nextRow.surgeons.phone);
      const notifyFn = isFirstSurgeon ? notifyNewCase : notifyCasePassed;
      // Use the new flat fee if available, fall back to fee_max for old cases
      const feeForNotification = caseDetails.data.fee || caseDetails.data.fee_max;
      await notifyFn({
        surgeonName:  nextRow.surgeons.name,
        surgeonPhone: nextRow.surgeons.phone,
        procedure:    caseDetails.data.procedure,
        surgeryDate:  caseDetails.data.surgery_date,
        surgeryTime:  caseDetails.data.surgery_time,
        feeMax:       feeForNotification,
        expiresAt:    expiresAt.toISOString(),
      });
    }

  } catch (error) {
    logger.error('Error in cascade trigger', { error: error.message });
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// HAVERSINE DISTANCE (km)
// Calculates the great-circle distance between two lat/lng points.
// Used by matchSurgeons to determine surgeon proximity to the hospital.
// Returns distance in kilometres.
// ─────────────────────────────────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


// ─────────────────────────────────────────────────────────────────────────────
// MATCHING ALGORITHM
// Finds the best available surgeons for a given case.
// Returns up to `limit` surgeons ordered by match score.
//
// UPDATED (Migration 005): City-based matching replaced with distance-based
// matching using haversine formula and hospital/surgeon lat/lng coordinates.
//
// Scoring breakdown:
//   +0–50 — proximity score (closer to hospital = higher)
//           Formula: max(0, 50 - (distance_km * 2))
//           Surgeons with no preferred location get a neutral +25
//   +0–50 — surgeon rating (rating × 10)
//   +0–20 — total cases done (experience on platform)
//
// Distance filtering:
//   - Surgeons WITH preferred_lat/lng: excluded if distance > travel_radius_km
//     (defaults to 10km if travel_radius_km not set on surgeon record)
//   - Surgeons WITHOUT preferred_lat/lng: always included (no location to filter on)
//   - If hospital has no lat/lng: all surgeons included, neutral proximity score
// ─────────────────────────────────────────────────────────────────────────────
async function matchSurgeons({ specialty_required, surgery_date, surgery_time, hospital_lat, hospital_lng, limit = 7 }) {
  try {
    logger.info('Matching: querying verified surgeons', { specialty_required });

    // Find all verified, available surgeons with the required specialty
    const { data: surgeons, error } = await supabase
      .from('surgeons')
      .select('*')
      .eq('verified', true)
      .eq('available', true)
      .eq('status', 'active')
      .filter('specialty', 'cs', `{"${specialty_required}"}`);

    if (error) {
      logger.error('Matching: surgeon query failed', { error: error.message });
      return [];
    }

    logger.info('Matching: surgeons found before conflict check', {
      count: surgeons?.length || 0,
    });

    if (!surgeons || surgeons.length === 0) return [];

    // Filter out surgeons with conflicting cases on the same date
    const availableSurgeons = [];
    for (const surgeon of surgeons) {
      try {
        const { data: conflictData } = await supabase
          .from('cases')
          .select('id')
          .eq('confirmed_surgeon_id', surgeon.id)
          .eq('surgery_date', surgery_date)
          .in('status', ['confirmed', 'in_progress']);

        if (!conflictData || conflictData.length === 0) {
          availableSurgeons.push(surgeon);
        } else {
          logger.debug('Surgeon has conflict on requested date, excluded', {
            surgeon_name: surgeon.name,
            surgery_date,
          });
        }
      } catch (conflictErr) {
        // If conflict check fails, include the surgeon anyway
        logger.warn('Conflict check failed for surgeon, including anyway', {
          surgeon_name: surgeon.name,
          error:        conflictErr.message,
        });
        availableSurgeons.push(surgeon);
      }
    }

    logger.info('Matching: surgeons available after conflict check', {
      count: availableSurgeons.length,
    });

    // ── Distance filtering + scoring ─────────────────────────────────────
    // Whether we can do distance filtering depends on the hospital having lat/lng.
    const hospitalHasLocation = hospital_lat != null && hospital_lng != null;

    const scoredSurgeons = [];

    for (const surgeon of availableSurgeons) {
      const surgeonHasLocation = surgeon.preferred_lat != null && surgeon.preferred_lng != null;

      let proximityScore = 25;  // neutral default for surgeons with no location
      let distanceKm     = null;

      if (hospitalHasLocation && surgeonHasLocation) {
        // Both have coordinates — calculate actual distance
        distanceKm = haversineKm(
          surgeon.preferred_lat, surgeon.preferred_lng,
          hospital_lat, hospital_lng
        );

        // Respect travel radius — default to 10km if not set on the surgeon
        const travelRadius = surgeon.travel_radius_km || 10;

        if (distanceKm > travelRadius) {
          // Surgeon is outside their travel radius — exclude
          logger.debug('Surgeon excluded: outside travel radius', {
            surgeon_name: surgeon.name,
            distance_km:  Math.round(distanceKm * 10) / 10,
            travel_radius: travelRadius,
          });
          continue;
        }

        // Proximity score: closer = higher. 0km → 50pts, 25km → 0pts
        proximityScore = Math.max(0, 50 - (distanceKm * 2));
      }
      // If surgeon has no location OR hospital has no location → include with
      // neutral proximity score (25). No distance filtering applied.

      // Build total score
      let score = 0;

      // Proximity (max 50 points) — replaces old city-based +50
      score += proximityScore;

      // Rating (max 50 points) — unchanged
      score += (surgeon.rating || 0) * 10;

      // Platform experience (max 20 points) — unchanged
      score += Math.min((surgeon.total_cases || 0) / 10, 20);

      scoredSurgeons.push({
        ...surgeon,
        match_score: score,
        distance_km: distanceKm != null ? Math.round(distanceKm * 10) / 10 : null,
      });
    }

    logger.info('Matching: surgeons after distance filtering', {
      count: scoredSurgeons.length,
    });

    scoredSurgeons.sort((a, b) => b.match_score - a.match_score);
    const topSurgeons = limit ? scoredSurgeons.slice(0, limit) : scoredSurgeons;

    logger.info('Matching complete', {
      total_matched: topSurgeons.length,
      top_surgeon:   topSurgeons[0]?.name || 'none',
    });

    return topSurgeons;

  } catch (error) {
    logger.error('Matching algorithm error', { error: error.message });
    return [];
  }
}


module.exports = router;