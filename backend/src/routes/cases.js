/**
 * CASES ROUTES - Backend API
 * Company: Vaidhya Healthcare Pvt Ltd
 *
 * Handles all API endpoints related to surgery cases:
 * - POST /api/cases              → Create a new surgery request
 * - GET  /api/cases              → List cases for a hospital
 * - GET  /api/cases/:id          → Get a single case with full details
 * - GET  /api/cases/:id/matches  → Get matched surgeons for a case
 * - PATCH /api/cases/:id/priority → Save priority list and trigger cascade
 */

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const logger = require('../logger');
const { notifyNewCase, notifyCasePassed } = require('../notifications');
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cases
// Create a new surgery request and run the matching algorithm
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
      fee_min,
      fee_max,
      notes,
    } = req.body;

    // ── VALIDATION ────────────────────────────────────────────────────────────
    const required = [
      'hospital_id', 'procedure', 'specialty_required',
      'surgery_date', 'surgery_time', 'duration_hours',
      'ot_number', 'patient_name', 'patient_age',
      'patient_gender', 'fee_min', 'fee_max'
    ];

    for (const field of required) {
      if (!req.body[field]) {
        logger.warn('Missing required field', { field });
        return res.status(400).json({ message: `Missing required field: ${field}` });
      }
    }

    // ── VERIFY HOSPITAL ───────────────────────────────────────────────────────
    logger.info('Verifying hospital', { hospital_id });

    const { data: hospital, error: hospitalError } = await supabase
      .from('hospitals')
      .select('id, name, city, verified')
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

    // ── SAVE CASE ─────────────────────────────────────────────────────────────
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
        fee_min,
        fee_max,
        notes: notes || null,
        status: 'active',
        payment_status: 'pending',
      })
      .select()
      .single();

    if (caseError) {
      logger.error('Failed to save case', { error: caseError.message });
      return res.status(500).json({ message: 'Failed to create case' });
    }

    logger.info('Case saved successfully', {
      case_id: newCase.id,
      case_number: newCase.case_number,
      procedure: newCase.procedure,
    });

    // ── RUN MATCHING ──────────────────────────────────────────────────────────
    logger.info('Running matching algorithm', {
      specialty: specialty_required,
      city: hospital.city,
    });

    const matchedSurgeons = await matchSurgeons({
      specialty_required,
      surgery_date,
      surgery_time,
      city: hospital.city,
      fee_min,
      fee_max,
    });

    logger.info('Matching complete', { surgeons_found: matchedSurgeons.length });

    return res.status(201).json({
      message: 'Case created successfully',
      case: newCase,
      matched_surgeons: matchedSurgeons,
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
// IMPORTANT: This route must be defined BEFORE GET /:id
// because Express reads routes top to bottom —
// if /:id is first, it will capture /matches as the id parameter
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/matches', async (req, res) => {
  try {
    const { id } = req.params;
    logger.info('Fetching matches for case', { case_id: id });

    // Step 1: Get the case details
    const { data: case_, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', id)
      .single();

    if (caseError || !case_) {
      logger.warn('Case not found for matching', { case_id: id });
      return res.status(404).json({ message: 'Case not found' });
    }

    // Step 2: Get the hospital city separately
    const { data: hospital, error: hospitalError } = await supabase
      .from('hospitals')
      .select('city')
      .eq('id', case_.hospital_id)
      .single();

    if (hospitalError) {
      logger.warn('Hospital not found for case', { hospital_id: case_.hospital_id });
    }

    const city = hospital?.city || '';
    logger.info('Fetched hospital city for matching', { city });

    // Step 3: Run matching algorithm with case details
    const matchedSurgeons = await matchSurgeons({
      specialty_required: case_.specialty_required,
      surgery_date:       case_.surgery_date,
      surgery_time:       case_.surgery_time,
      city,
      fee_min:            case_.fee_min,
      fee_max:            case_.fee_max,
    });

    logger.info('Matches fetched', {
      case_id: id,
      matches_found: matchedSurgeons.length
    });

    return res.json({ matched_surgeons: matchedSurgeons });

  } catch (error) {
    logger.error('Error fetching matches', { error: error.message });
    return res.status(500).json({ message: 'Failed to fetch matches' });
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

    // Fetch the case
    const { data: case_, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', id)
      .single();

    if (caseError || !case_) {
      logger.warn('Case not found', { case_id: id });
      return res.status(404).json({ message: 'Case not found' });
    }

    // Fetch the priority list for this case with surgeon details
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
      case_id: id,
      priority_list_count: priorityList?.length || 0
    });

    return res.json({
      case: case_,
      priority_list: priorityList || [],
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
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/priority', async (req, res) => {
  try {
    const { id } = req.params;
    const { priority_list } = req.body;

    logger.info('Saving priority list for case', {
      case_id: id,
      surgeons: priority_list
    });

    // Validate priority list
    if (!priority_list || !Array.isArray(priority_list) || priority_list.length < 1) {
      return res.status(400).json({
        message: 'Priority list must contain at least 1 surgeon IDs'
      });
    }

    if (priority_list.length > 5) {
      return res.status(400).json({
        message: 'Priority list cannot have more than 5 surgeons'
      });
    }

    // Verify case exists
    const { data: case_, error: caseError } = await supabase
      .from('cases')
      .select('id, status')
      .eq('id', id)
      .single();

    if (caseError || !case_) {
      return res.status(404).json({ message: 'Case not found' });
    }

    // Insert each surgeon into case_priority_list table
    // with their priority order number
    const priorityRows = priority_list.map((surgeon_id, index) => ({
      case_id:        id,
      surgeon_id:     surgeon_id,
      priority_order: index + 1,  // 1-based (1 = highest priority)
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

    // Update case status to 'cascading'
    const { error: updateError } = await supabase
      .from('cases')
      .update({ status: 'cascading' })
      .eq('id', id);

    if (updateError) {
      logger.error('Failed to update case status', { error: updateError.message });
    }

    // Trigger cascade — notify the first surgeon
    await triggerCascade(id);

    logger.info('Priority list saved and cascade triggered', { case_id: id });

    return res.json({
      message: 'Priority list saved. Requests sent to surgeons.',
      case_id: id,
    });

  } catch (error) {
    logger.error('Error saving priority list', { error: error.message });
    return res.status(500).json({ message: 'Failed to save priority list' });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/cases/:id
// Update case details — works for all case statuses
// Called by: CaseDetail page — Edit modal
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    procedure, specialty_required, surgery_date, surgery_time,
    duration_hours, ot_number, fee_min, fee_max,
    patient_name, patient_age, patient_gender, notes,
  } = req.body;

  logger.info('Updating case', { case_id: id });

  try {
    // Build update object — only include fields that were sent
    const updates = {};
    if (procedure          !== undefined) updates.procedure          = procedure;
    if (specialty_required !== undefined) updates.specialty_required = specialty_required;
    if (surgery_date       !== undefined) updates.surgery_date       = surgery_date;
    if (surgery_time       !== undefined) updates.surgery_time       = surgery_time;
    if (duration_hours     !== undefined) updates.duration_hours     = duration_hours;
    if (ot_number          !== undefined) updates.ot_number          = ot_number;
    if (fee_min            !== undefined) updates.fee_min            = fee_min;
    if (fee_max            !== undefined) updates.fee_max            = fee_max;
    if (patient_name       !== undefined) updates.patient_name       = patient_name;
    if (patient_age        !== undefined) updates.patient_age        = patient_age;
    if (patient_gender     !== undefined) updates.patient_gender     = patient_gender;
    if (notes              !== undefined) updates.notes              = notes;
    updates.updated_at = new Date().toISOString();

    const { data: case_, error } = await supabase
      .from('cases')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update case', { error: error.message });
      throw error;
    }

    logger.info('Case updated successfully', { case_id: id });
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
// TRIGGER CASCADE
// Notifies the next surgeon in the priority list
// Called after priority list is saved, and after each decline/expiry
// ─────────────────────────────────────────────────────────────────────────────
async function triggerCascade(caseId) {
  logger.info('Triggering cascade for case', { case_id: caseId });

  try {
    // Find the next pending surgeon in the priority list
    const { data: nextRow, error } = await supabase
      .from('case_priority_list')
      .select('*, surgeons(name, phone, email)')
      .eq('case_id', caseId)
      .eq('status', 'pending')
      .order('priority_order', { ascending: true })
      .limit(1)
      .single();

    if (error || !nextRow) {
      logger.warn('No pending surgeons left in cascade', { case_id: caseId });
      // Update case to unfilled
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
        status:       'notified',
        notified_at:  new Date().toISOString(),
        expires_at:   expiresAt.toISOString(),
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

    // ── Send WhatsApp/SMS notification to the surgeon ──────────────────────────
    // First surgeon in cascade gets "new case" message,
    // subsequent surgeons get "case passed" message
    const isFirstSurgeon = nextRow.priority_order === 1;

    const caseDetails = await supabase
      .from('cases')
      .select('procedure, surgery_date, surgery_time, fee_max')
      .eq('id', caseId)
      .single();

    if (caseDetails.data && nextRow.surgeons?.phone) {
      console.log('=== Firing notification to:', nextRow.surgeons.phone); // ADD THIS
      const notifyFn = isFirstSurgeon ? notifyNewCase : notifyCasePassed;
      await notifyFn({
        surgeonName:  nextRow.surgeons.name,
        surgeonPhone: nextRow.surgeons.phone,
        procedure:    caseDetails.data.procedure,
        surgeryDate:  caseDetails.data.surgery_date,
        surgeryTime:  caseDetails.data.surgery_time,
        feeMax:       caseDetails.data.fee_max,
        expiresAt:    expiresAt.toISOString(),
      });
    }

  } catch (error) {
    logger.error('Error in cascade trigger', { error: error.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCHING ALGORITHM
// Finds best available surgeons for a given case
// Returns up to 7 surgeons ordered by best match score
// ─────────────────────────────────────────────────────────────────────────────
async function matchSurgeons({ specialty_required, surgery_date, surgery_time, city, fee_min, fee_max }) {
  try {
    logger.info('Matching: querying verified surgeons', { specialty_required });

    // Find all verified, available surgeons with the required specialty
    // Uses PostgREST 'cs' (contains) operator for array column matching
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

    // Filter out surgeons with conflicting confirmed cases on the same date
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
          error: conflictErr.message,
        });
        availableSurgeons.push(surgeon);
      }
    }

    logger.info('Matching: surgeons available after conflict check', {
      count: availableSurgeons.length,
    });

    // Score each surgeon based on matching criteria
    const scoredSurgeons = availableSurgeons.map(surgeon => {
      let score = 0;

      // City match: same city as hospital gets big boost
      if (surgeon.city && city && surgeon.city.toLowerCase() === city.toLowerCase()) {
        score += 50;
      }

      // Rating: higher rating = higher score (max 50 points)
      score += (surgeon.rating || 0) * 10;

      // Experience on platform: more cases = slight boost (max 20 points)
      score += Math.min((surgeon.total_cases || 0) / 10, 20);

      return { ...surgeon, match_score: score };
    });

    // Sort by score highest first, return top 7
    scoredSurgeons.sort((a, b) => b.match_score - a.match_score);
    const topSurgeons = scoredSurgeons.slice(0, 7);

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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cases/:caseId/surgeon-view
// Returns case details for the surgeon mobile app.
// Hospital full address is hidden until surgeon accepts.
// Called by: RequestDetailScreen
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:caseId/surgeon-view', async (req, res) => {
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

   // If case is confirmed, reveal full hospital name + city
  // If still pending, only show city to protect privacy
    const hospitalFields = case_.status === 'confirmed' ? 'id, name, city' : 'city';
    const { data: hospital } = await supabase
      .from('hospitals')
      .select(hospitalFields)
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

    logger.info('Surgeon view fetched', { case_id: caseId });

    return res.json({
      case: {
        ...case_,
        hospital_city:  hospital?.city || null,
        hospital_name:  hospital?.name || null,  // only set when confirmed
        expires_at:     expiresAt,
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
    const { caseId } = req.params;
    const { surgeon_id } = req.body;

    logger.info('Surgeon accepting case', { case_id: caseId, surgeon_id });

    if (!surgeon_id) {
      return res.status(400).json({ message: 'surgeon_id required' });
    }

    const now = new Date().toISOString();

    // Update priority list row to accepted
    const { error: priorityError } = await supabase
      .from('case_priority_list')
      .update({
        status: 'accepted',
        responded_at: now,
      })
      .eq('case_id', caseId)
      .eq('surgeon_id', surgeon_id);

    if (priorityError) {
      logger.error('Failed to update priority list on accept', { error: priorityError.message });
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
      logger.error('Failed to confirm case', { error: caseError.message });
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
// Updates case_priority_list row to 'declined', then triggers cascade
// to notify the next surgeon in the priority list.
// Called by: RequestDetailScreen
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:caseId/decline', async (req, res) => {
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
      logger.error('Failed to update priority list on decline', { error: priorityError.message });
      return res.status(500).json({ message: 'Failed to decline case' });
    }

    // Trigger cascade — notify next surgeon in the list
    await triggerCascade(caseId);

    logger.info('Case declined, cascade triggered', { case_id: caseId });
    return res.json({ message: 'Case declined' });

  } catch (error) {
    logger.error('Error declining case', { error: error.message });
    return res.status(500).json({ message: 'Failed to decline case' });
  }
});



module.exports = router;
