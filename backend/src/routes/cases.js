/**
 * CASES ROUTES - Backend API
 * Company: Vaidhya Healthcare Pvt Ltd
 *
 * Handles all API endpoints related to surgery cases:
 * - POST /api/cases     → Create a new surgery request
 * - GET  /api/cases     → List cases for a hospital
 * - GET  /api/cases/:id → Get a single case with full details
 */

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const logger = require('../logger');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cases
// Create a new surgery request and run the matching algorithm
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
// GET /api/cases/:id
// Get a single case with priority list
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
// MATCHING ALGORITHM
// Finds best available surgeons for a given case
// ─────────────────────────────────────────────────────────────────────────────
async function matchSurgeons({ specialty_required, surgery_date, surgery_time, city, fee_min, fee_max }) {
  try {
    logger.info('Matching: querying verified surgeons', { specialty_required });

    // Find all verified, available surgeons with the required specialty
    const { data: surgeons, error } = await supabase
      .from('surgeons')
      .select('*')
      .eq('verified', true)
      .eq('available', true)
      .eq('status', 'active')
      .contains('specialty', [specialty_required]);

    if (error) {
      logger.error('Matching: surgeon query failed', { error: error.message });
      return [];
    }

    logger.info('Matching: surgeons found before conflict check', {
      count: surgeons?.length || 0
    });

    if (!surgeons || surgeons.length === 0) return [];

    // Filter out surgeons with conflicting cases on same date
    const availableSurgeons = [];
    for (const surgeon of surgeons) {
      const { data: conflicts } = await supabase
        .from('cases')
        .select('id')
        .eq('confirmed_surgeon_id', surgeon.id)
        .eq('surgery_date', surgery_date)
        .in('status', ['confirmed', 'in_progress']);

      if (!conflicts || conflicts.length === 0) {
        availableSurgeons.push(surgeon);
      } else {
        logger.debug('Surgeon has conflict, excluded', {
          surgeon_id: surgeon.id,
          surgeon_name: surgeon.name,
        });
      }
    }

    logger.info('Matching: surgeons available after conflict check', {
      count: availableSurgeons.length
    });

    // Score and rank surgeons
    const scoredSurgeons = availableSurgeons.map(surgeon => {
      let score = 0;
      if (surgeon.city.toLowerCase() === city.toLowerCase()) score += 50;
      score += (surgeon.rating || 0) * 10;
      score += Math.min(surgeon.total_cases / 10, 20);
      return { ...surgeon, match_score: score };
    });

    scoredSurgeons.sort((a, b) => b.match_score - a.match_score);
    const topSurgeons = scoredSurgeons.slice(0, 7);

    logger.info('Matching complete', {
      total_matched: topSurgeons.length,
      top_surgeon: topSurgeons[0]?.name || 'none',
    });

    return topSurgeons;

  } catch (error) {
    logger.error('Matching algorithm error', { error: error.message });
    return [];
  }
}

module.exports = router;