/**
 * SURGEONS ROUTES - Backend API
 * Company: Vaidhya Healthcare Pvt Ltd
 *
 * Handles all API endpoints for the Surgeon Mobile App:
 *
 * POST   /api/surgeons/register           → New surgeon self-registration
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
 *             city, rating, total_cases, experience_years, status,
 *             preferred_lat, preferred_lng, preferred_location_name,
 *             communication_preference, practice_type, hospital_affiliations,
 *             open_to_teleconsultation, open_to_emergency, open_to_physical_visits,
 *             key_procedures, declaration_agreed, highest_qualification,
 *             avg_hourly_rate, profile_photo_url, certificate_url,
 *             government_id_url, resume_url
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
const { notifyCasePassed } = require('../notifications');

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
        email,
        specialty,
        mci_number,
        experience_years,
        city,
        bio,
        verified,
        available,
        rating,
        total_cases,
        status,
        ug_college,
        pg_college,
        profile_photo_url,
        certificate_url,
        created_at
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
        .select('id, case_number, procedure, specialty_required, surgery_date, surgery_time, fee_min, fee_max, fee, status, request_type')
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

    // Send WhatsApp/SMS notification to the next surgeon
    const caseDetails = await supabase
      .from('cases')
      .select('procedure, surgery_date, surgery_time, fee_max')
      .eq('id', caseId)
      .single();

    if (caseDetails.data && nextRow.surgeons?.phone) {
      await notifyCasePassed({
        surgeonName:  nextRow.surgeons.name,
        surgeonPhone: nextRow.surgeons.phone,
        procedure:    caseDetails.data.procedure,
        surgeryDate:  caseDetails.data.surgery_date,
        surgeryTime:  caseDetails.data.surgery_time,
        feeMax:       caseDetails.data.fee_max,
      });
    }

  } catch (error) {
    logger.error('Error in cascade', { error: error.message });
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/surgeons/:id/profile
// Updates surgeon profile details.
// Called by: ProfileScreen — Personal and Credentials tabs
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/profile', async (req, res) => {
  const { id } = req.params;
  const {
    // Core profile fields (existing)
    name, city, bio, experience_years,
    specialty, mci_number, ug_college, pg_college,
    profile_photo_url, certificate_url,
    // Location fields (Migration 005)
    preferred_lat, preferred_lng, preferred_location_name,
    // New practice preference fields
    communication_preference,
    practice_type,
    hospital_affiliations,
    open_to_teleconsultation,
    open_to_emergency,
    open_to_physical_visits,
    key_procedures,
    declaration_agreed,
    highest_qualification,
    avg_hourly_rate,
    // New document URLs — uploaded by frontend, URL string saved here
    government_id_url,
    resume_url,
  } = req.body;

  logger.info('Updating surgeon profile', { surgeon_id: id });

  try {
    // Build update object — only include fields that were actually sent.
    // This allows partial updates: the frontend can send just the fields
    // it wants to change without overwriting others.
    const updates = {};

    // Core profile fields
    if (name             !== undefined) updates.name             = name;
    if (city             !== undefined) updates.city             = city;
    if (bio              !== undefined) updates.bio              = bio;
    if (experience_years !== undefined) updates.experience_years = experience_years;
    if (specialty        !== undefined) updates.specialty        = specialty;
    if (mci_number       !== undefined) updates.mci_number       = mci_number;
    if (ug_college       !== undefined) updates.ug_college       = ug_college;
    if (pg_college       !== undefined) updates.pg_college       = pg_college;
    if (highest_qualification !== undefined) updates.highest_qualification = highest_qualification;
    if (avg_hourly_rate  !== undefined) updates.avg_hourly_rate  = avg_hourly_rate;

    // Location fields
    if (preferred_lat           !== undefined) updates.preferred_lat           = preferred_lat;
    if (preferred_lng           !== undefined) updates.preferred_lng           = preferred_lng;
    if (preferred_location_name !== undefined) updates.preferred_location_name = preferred_location_name;

    // Practice preferences
    if (communication_preference  !== undefined) updates.communication_preference  = communication_preference;
    if (practice_type             !== undefined) updates.practice_type             = practice_type;
    if (hospital_affiliations     !== undefined) updates.hospital_affiliations     = hospital_affiliations;
    if (open_to_teleconsultation  !== undefined) updates.open_to_teleconsultation  = open_to_teleconsultation;
    if (open_to_emergency         !== undefined) updates.open_to_emergency         = open_to_emergency;
    if (open_to_physical_visits   !== undefined) updates.open_to_physical_visits   = open_to_physical_visits;
    if (key_procedures            !== undefined) updates.key_procedures            = key_procedures;
    if (declaration_agreed        !== undefined) updates.declaration_agreed         = declaration_agreed;

    // Document URLs — profile photo, certificate, government ID, resume
    if (profile_photo_url !== undefined) updates.profile_photo_url = profile_photo_url;
    if (certificate_url   !== undefined) updates.certificate_url   = certificate_url;
    if (government_id_url !== undefined) updates.government_id_url = government_id_url;
    if (resume_url        !== undefined) updates.resume_url        = resume_url;

    updates.updated_at = new Date().toISOString();

    const { data: surgeon, error } = await supabase
      .from('surgeons')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update surgeon profile', { error: error.message });
      throw error;
    }

    logger.info('Surgeon profile updated', { surgeon_id: id });
    return res.json({ message: 'Profile updated successfully', surgeon });

  } catch (error) {
    logger.error('Error updating surgeon profile', { error: error.message });
    return res.status(500).json({ message: 'Failed to update profile' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/surgeons/:id/password
// Updates surgeon password.
// Requires current password for verification before allowing change.
// Called by: ProfileScreen — change password flow
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/password', async (req, res) => {
  const { id } = req.params;
  const { current_password, new_password } = req.body;

  logger.info('Password change requested', { surgeon_id: id });

  if (!current_password || !new_password) {
    return res.status(400).json({ message: 'Current and new password are required' });
  }

  if (new_password.length < 4) {
    return res.status(400).json({ message: 'New password must be at least 4 characters' });
  }

  try {
    const bcrypt = require('bcryptjs');

    // Fetch auth record for this surgeon
    const { data: authRecord, error: fetchError } = await supabase
      .from('surgeon_auth')
      .select('id, password_hash')
      .eq('surgeon_id', id)
      .single();

    if (fetchError || !authRecord) {
      return res.status(404).json({ message: 'Auth record not found' });
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(current_password, authRecord.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password and save
    const newHash = await bcrypt.hash(new_password, 10);
    const { error: updateError } = await supabase
      .from('surgeon_auth')
      .update({ password_hash: newHash })
      .eq('id', authRecord.id);

    if (updateError) {
      logger.error('Failed to update password', { error: updateError.message });
      return res.status(500).json({ message: 'Failed to update password' });
    }

    logger.info('Password updated successfully', { surgeon_id: id });
    return res.json({ message: 'Password updated successfully' });

  } catch (error) {
    logger.error('Error changing password', { error: error.message });
    return res.status(500).json({ message: 'Something went wrong' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/surgeons/register
// New surgeon self-registration from the Doctor Web app signup form.
//
// Inserts into surgeons table with verified: false (admin must approve).
// Creates a surgeon_auth record with a default password ('password') hashed
// via bcrypt. Sends an email notification to the admin team.
//
// Called by: Doctor Web — Signup page
// ─────────────────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const bcrypt = require('bcryptjs');
  const { sendAdminNotification } = require('../email');

  const {
    // Core fields (existing)
    name, phone, email, specialty, city,
    preferred_lat, preferred_lng, preferred_location_name,
    experience_years, ug_college, pg_college, mci_number, bio,
    // New fields — practice preferences and documents
    communication_preference,    // 'whatsapp' | 'call' | 'email' — how surgeon prefers to be contacted
    practice_type,               // 'independent' | 'hospital_attached' | 'both'
    hospital_affiliations,       // free text — names of hospitals the surgeon is affiliated with
    open_to_teleconsultation,    // boolean — willing to do video consultations
    open_to_emergency,           // boolean — willing to take emergency cases
    open_to_physical_visits,     // boolean — willing to travel to hospital
    key_procedures,              // text[] or string — surgeon's main procedures
    declaration_agreed,          // boolean — must be true to register (legal/compliance)
    highest_qualification,       // text — e.g. 'MS', 'MCh', 'DNB', 'DM'
    avg_hourly_rate,             // integer in paise — surgeon's typical hourly rate
    // Document URLs — uploaded by frontend to Supabase Storage, URL saved here
    profile_photo_url,           // public URL of profile photo
    certificate_url,             // public URL of medical certificate
    government_id_url,           // public URL of government-issued ID (Aadhaar, PAN, etc.)
    resume_url,                  // public URL of CV/resume
  } = req.body;

  logger.info('Surgeon registration attempt', { name, phone, city });

  // ── Validate required fields ─────────────────────────────────────────────
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Name is required' });
  }
  if (!phone || phone.replace(/\D/g, '').length < 10) {
    return res.status(400).json({ message: 'Valid 10-digit phone number is required' });
  }
  if (!mci_number || !mci_number.trim()) {
    return res.status(400).json({ message: 'MCI number is required' });
  }
  if (!city || !city.trim()) {
    return res.status(400).json({ message: 'City is required' });
  }
  // declaration_agreed is required when provided — legal compliance.
  // If the frontend sends it, it must be true. If the frontend doesn't send it
  // (e.g. older frontend version or before migration), registration proceeds
  // without it for backward compatibility.
  if (declaration_agreed !== undefined && declaration_agreed !== true) {
    return res.status(400).json({ message: 'You must agree to the declaration to register' });
  }

  const cleanPhone = phone.replace(/\D/g, '').slice(-10);

  try {
    // ── Check for duplicate phone ──────────────────────────────────────────
    const { data: existingPhone } = await supabase
      .from('surgeons')
      .select('id')
      .eq('phone', cleanPhone)
      .single();

    if (existingPhone) {
      logger.warn('Surgeon registration: duplicate phone', { phone: cleanPhone });
      return res.status(409).json({ message: 'A surgeon with this phone number already exists' });
    }

    // ── Hash default password ──────────────────────────────────────────────
    // Default password is 'password' — surgeon will be prompted to change it
    // after first login. Salt rounds: 10 (matches existing login pattern).
    const passwordHash = await bcrypt.hash('password', 10);

    // ── Insert into surgeons table ─────────────────────────────────────────
    // Build the insert object with core fields first, then conditionally add
    // new fields only if they were provided. This prevents Supabase from
    // rejecting unknown column names if the migration hasn't been run yet.
    const insertData = {
      // Core profile fields — always included
      name:                    name.trim(),
      phone:                   cleanPhone,
      email:                   email?.trim() || null,
      specialty:               Array.isArray(specialty) ? specialty : [],
      city:                    city.trim(),
      preferred_lat:           preferred_lat || null,
      preferred_lng:           preferred_lng || null,
      preferred_location_name: preferred_location_name?.trim() || null,
      experience_years:        experience_years || 0,
      ug_college:              ug_college?.trim() || null,
      pg_college:              pg_college?.trim() || null,
      mci_number:              mci_number.trim(),
      bio:                     bio?.trim() || null,
      // System defaults
      verified:                false,
      status:                  'active',
      available:               true,
      rating:                  0,
      total_cases:             0,
    };

    // New fields — only add to insert if provided. This keeps backward
    // compatibility: registration works even before the new columns are
    // added to the database. Once the migration is run, these columns
    // will be saved automatically.
    if (highest_qualification   !== undefined) insertData.highest_qualification   = highest_qualification?.trim() || null;
    if (avg_hourly_rate         !== undefined) insertData.avg_hourly_rate         = avg_hourly_rate || null;
    if (communication_preference !== undefined) insertData.communication_preference = communication_preference?.trim() || null;
    if (practice_type           !== undefined) insertData.practice_type           = practice_type?.trim() || null;
    if (hospital_affiliations   !== undefined) insertData.hospital_affiliations   = hospital_affiliations?.trim() || null;
    if (open_to_teleconsultation !== undefined) insertData.open_to_teleconsultation = open_to_teleconsultation;
    if (open_to_emergency       !== undefined) insertData.open_to_emergency       = open_to_emergency;
    if (open_to_physical_visits !== undefined) insertData.open_to_physical_visits = open_to_physical_visits;
    if (key_procedures          !== undefined) insertData.key_procedures          = key_procedures;
    if (declaration_agreed       !== undefined) insertData.declaration_agreed       = declaration_agreed;
    // Document URLs — uploaded by frontend to Supabase Storage, URL string saved here
    if (profile_photo_url       !== undefined) insertData.profile_photo_url       = profile_photo_url?.trim() || null;
    if (certificate_url         !== undefined) insertData.certificate_url         = certificate_url?.trim() || null;
    if (government_id_url       !== undefined) insertData.government_id_url       = government_id_url?.trim() || null;
    if (resume_url              !== undefined) insertData.resume_url              = resume_url?.trim() || null;

    const { data: surgeon, error: surgeonError } = await supabase
      .from('surgeons')
      .insert(insertData)
      .select()
      .single();

    if (surgeonError) {
      logger.error('Surgeon registration: insert failed', { error: surgeonError.message });
      return res.status(500).json({ message: surgeonError.message });
    }

    // ── Create auth record ─────────────────────────────────────────────────
    const { error: authError } = await supabase
      .from('surgeon_auth')
      .insert({
        surgeon_id:    surgeon.id,
        phone:         cleanPhone,
        password_hash: passwordHash,
      });

    if (authError) {
      logger.error('Surgeon registration: auth record failed', { error: authError.message });
      // Surgeon was created but auth failed — log but don't fail the whole request
      // Admin can fix this manually or surgeon can use /login which auto-creates auth
    }

    logger.info('Surgeon registered successfully', {
      surgeon_id: surgeon.id,
      name:       surgeon.name,
      city:       surgeon.city,
    });

    // ── Send email notification to admin team ────────────────────────────
    sendAdminNotification(
      `New surgeon registered: ${name.trim()}`,
      `
        <h2>New Surgeon Registration</h2>
        <table style="border-collapse: collapse; font-family: sans-serif;">
          <tr><td style="padding: 6px 12px; color: #888;">Name</td>           <td style="padding: 6px 12px; font-weight: 600;">${name}</td></tr>
          <tr><td style="padding: 6px 12px; color: #888;">Phone</td>          <td style="padding: 6px 12px;">${cleanPhone}</td></tr>
          <tr><td style="padding: 6px 12px; color: #888;">Email</td>          <td style="padding: 6px 12px;">${email || '—'}</td></tr>
          <tr><td style="padding: 6px 12px; color: #888;">Specialty</td>      <td style="padding: 6px 12px;">${Array.isArray(specialty) ? specialty.join(', ') : '—'}</td></tr>
          <tr><td style="padding: 6px 12px; color: #888;">City</td>           <td style="padding: 6px 12px;">${city}</td></tr>
          <tr><td style="padding: 6px 12px; color: #888;">Experience</td>     <td style="padding: 6px 12px;">${experience_years || 0} years</td></tr>
          <tr><td style="padding: 6px 12px; color: #888;">MCI Number</td>     <td style="padding: 6px 12px;">${mci_number}</td></tr>
          <tr><td style="padding: 6px 12px; color: #888;">UG College</td>     <td style="padding: 6px 12px;">${ug_college || '—'}</td></tr>
          <tr><td style="padding: 6px 12px; color: #888;">PG College</td>     <td style="padding: 6px 12px;">${pg_college || '—'}</td></tr>
          <tr><td style="padding: 6px 12px; color: #888;">Location</td>       <td style="padding: 6px 12px;">${preferred_location_name || (preferred_lat ? `${preferred_lat}, ${preferred_lng}` : 'Not provided')}</td></tr>
          <tr><td style="padding: 6px 12px; color: #888;">Bio</td>            <td style="padding: 6px 12px;">${bio || '—'}</td></tr>
        </table>
        <p style="margin-top: 16px; color: #888; font-size: 13px;">
          This surgeon needs to be verified in the admin dashboard before they receive case requests.
        </p>
      `
    ).catch(err => logger.error('Surgeon registration email failed', { error: err.message }));

    return res.status(201).json({
      message:    'Registration submitted. Pending verification.',
      surgeon_id: surgeon.id,
      name:       surgeon.name,
      phone:      cleanPhone,
      verified:   surgeon.verified,
    });

  } catch (error) {
    logger.error('Surgeon registration: unexpected error', { error: error.message });
    return res.status(500).json({ message: 'Something went wrong' });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/surgeons/login
// Phone + password login for the surgeon mobile app.
//
// Flow:
//   1. Check if phone exists in surgeon_auth table
//   2. If found → verify password using bcrypt
//   3. If not found → auto-create surgeon + auth record
//   4. Return surgeon_id, name, phone on success
//
// Called by: LoginScreen
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { phone, password } = req.body;

  logger.info('Surgeon login attempt', { phone });

  // ── Validate inputs ────────────────────────────────────────────────────────
  if (!phone || !password) {
    return res.status(400).json({ message: 'Phone and password are required' });
  }

  // Clean phone — strip everything except digits, keep last 10
  const cleanPhone = phone.replace(/\D/g, '').slice(-10);
  if (cleanPhone.length !== 10) {
    return res.status(400).json({ message: 'Enter a valid 10-digit phone number' });
  }

  try {
    const bcrypt = require('bcryptjs');

    // ── Check if surgeon already has an auth record ────────────────────────
    const { data: authRecord, error: authError } = await supabase
      .from('surgeon_auth')
      .select('*, surgeons(id, name, phone, specialty, verified, available)')
      .eq('phone', cleanPhone)
      .single();

    if (authRecord) {
      // ── EXISTING SURGEON: verify password ─────────────────────────────────
      const passwordMatch = await bcrypt.compare(password, authRecord.password_hash);

      if (!passwordMatch) {
        logger.warn('Surgeon login: wrong password', { phone: cleanPhone });
        return res.status(401).json({ message: 'Incorrect password' });
      }

      logger.info('Surgeon login: success', {
        surgeon_id: authRecord.surgeon_id,
        name: authRecord.surgeons?.name,
      });

      return res.json({
        message: 'Login successful',
        surgeon_id: authRecord.surgeon_id,
        name:       authRecord.surgeons?.name,
        phone:      cleanPhone,
        verified:   authRecord.surgeons?.verified,
        available:  authRecord.surgeons?.available,
      });

    } else {
      // ── NO AUTH RECORD FOUND ───────────────────────────────────────────────
      // Either brand new surgeon, or existing surgeon without auth record.
      // Check if surgeon already exists in surgeons table by phone.
      logger.info('Surgeon login: no auth record, checking surgeons table', { phone: cleanPhone });

      const passwordHash = await bcrypt.hash(password, 10);

      const { data: existingSurgeon } = await supabase
        .from('surgeons')
        .select('id, name, phone, verified, available')
        .eq('phone', cleanPhone)
        .single();

      let surgeonRecord;

      if (existingSurgeon) {
        // ── EXISTING SURGEON: just create auth record ──────────────────────
        logger.info('Surgeon login: existing surgeon found, creating auth record', {
          name: existingSurgeon.name,
        });
        surgeonRecord = existingSurgeon;

      } else {
        // ── BRAND NEW SURGEON: create surgeon + auth record ────────────────
        logger.info('Surgeon login: new surgeon, auto-registering', { phone: cleanPhone });

        const { data: newSurgeon, error: surgeonCreateError } = await supabase
          .from('surgeons')
          .insert({
            name:             `Dr. (${cleanPhone})`,
            phone:            cleanPhone,
            specialty:        [],
            verified:         false,
            available:        false,
            rating:           0,
            total_cases:      0,
            experience_years: 0,
            mci_number:       'PENDING',
            city:             'Not set',
            bio:              '',
          })
          .select()
          .single();

        if (surgeonCreateError) {
          logger.error('Surgeon login: failed to create surgeon', { error: surgeonCreateError.message });
          return res.status(500).json({ message: surgeonCreateError.message });
        }

        surgeonRecord = newSurgeon;
      }

      // Create auth record for either existing or new surgeon
      const { error: authCreateError } = await supabase
        .from('surgeon_auth')
        .insert({
          surgeon_id:    surgeonRecord.id,
          phone:         cleanPhone,
          password_hash: passwordHash,
        });

      if (authCreateError) {
        logger.error('Surgeon login: failed to create auth record', { error: authCreateError.message });
        return res.status(500).json({ message: 'Failed to create account' });
      }

      logger.info('Surgeon login: auth record created', {
        surgeon_id: surgeonRecord.id,
        name:       surgeonRecord.name,
      });

      return res.status(201).json({
        message:    'Account created successfully',
        surgeon_id: surgeonRecord.id,
        name:       surgeonRecord.name,
        phone:      cleanPhone,
        verified:   surgeonRecord.verified,
        available:  surgeonRecord.available,
      });
    }

  } catch (error) {
    logger.error('Surgeon login: unexpected error', { error: error.message });
    return res.status(500).json({ message: 'Something went wrong' });
  }
});


module.exports = router;