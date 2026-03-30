/**
 * HOSPITALS ROUTES - Backend API
 * Company: Surgeon on Call (OPC) Pvt Ltd
 *
 * Endpoints:
 * - POST  /api/hospitals/register    → New hospital self-registration
 * - POST  /api/hospitals/login       → Email + password login
 * - PATCH /api/hospitals/:id/password → Change password
 *
 * Auth uses custom hospital_auth table + bcrypt — same pattern as surgeon auth.
 * No Supabase Auth dependency. Admin verification required before hospital
 * can post cases.
 *
 * Database tables used:
 * - hospitals: id, name, address, city, contact_email, verified, status, ...
 * - hospital_auth: id, hospital_id, email, password_hash
 *
 * DEV_MODE: No auth middleware — endpoints are open.
 */

const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const supabase = require('../supabase');
const logger   = require('../logger');
const { sendAdminNotification } = require('../email');


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/hospitals/register
// New hospital self-registration.
//
// Flow:
//   1. Validate required fields
//   2. Check for duplicate email
//   3. Hash password with bcrypt (salt rounds: 10)
//   4. Insert into hospitals table (verified: false)
//   5. Insert into hospital_auth table (email + password_hash)
//   6. Send email notification to admin team
//   7. Return 201
//
// Called by: Hospital Web App — HospitalSignup page
// ─────────────────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const {
    name, address, city, lat, lng, bed_count, hospital_type,
    contact_name, contact_email, contact_phone, password,
  } = req.body;

  logger.info('Hospital registration attempt', { name, city, contact_email });

  // ── Validate required fields ─────────────────────────────────────────────
  const required = ['name', 'address', 'city', 'contact_name', 'contact_email', 'contact_phone', 'password'];
  for (const field of required) {
    if (!req.body[field] || !String(req.body[field]).trim()) {
      logger.warn('Hospital registration: missing field', { field });
      return res.status(400).json({ message: `Missing required field: ${field}` });
    }
  }

  const cleanEmail = contact_email.trim().toLowerCase();

  try {
    // ── Check for duplicate email ────────────────────────────────────────
    const { data: existing } = await supabase
      .from('hospitals')
      .select('id')
      .eq('contact_email', cleanEmail)
      .single();

    if (existing) {
      logger.warn('Hospital registration: duplicate email', { contact_email: cleanEmail });
      return res.status(409).json({ message: 'A hospital with this email already exists' });
    }

    // ── Hash password with bcrypt ────────────────────────────────────────
    // Salt rounds: 10 (matches surgeon auth pattern)
    const passwordHash = await bcrypt.hash(password, 10);

    // ── Insert hospital record ───────────────────────────────────────────
    const { data: hospital, error: insertError } = await supabase
      .from('hospitals')
      .insert({
        name:           name.trim(),
        address:        address.trim(),
        city:           city.trim(),
        lat:            lat || null,
        lng:            lng || null,
        bed_count:      bed_count || null,
        hospital_type:  hospital_type || null,
        contact_name:   contact_name.trim(),
        contact_email:  cleanEmail,
        contact_phone:  contact_phone.trim(),
        verified:       false,
        status:         'active',
      })
      .select()
      .single();

    if (insertError) {
      logger.error('Hospital registration: insert failed', { error: insertError.message });
      return res.status(500).json({ message: 'Failed to register hospital' });
    }

    // ── Create auth record in hospital_auth table ────────────────────────
    // Same pattern as surgeon_auth — stores email + bcrypt hash.
    const { error: authError } = await supabase
      .from('hospital_auth')
      .insert({
        hospital_id:   hospital.id,
        email:         cleanEmail,
        password_hash: passwordHash,
      });

    if (authError) {
      logger.error('Hospital registration: auth record failed', { error: authError.message });
      // Hospital record was created — auth can be fixed manually or via re-registration
    }

    logger.info('Hospital registered successfully', {
      hospital_id: hospital.id,
      name:        hospital.name,
      city:        hospital.city,
    });

    // ── Send email notification to admin team ────────────────────────────
    sendAdminNotification(
      `New hospital registered: ${name.trim()}`,
      `
        <h2>New Hospital Registration</h2>
        <table style="border-collapse: collapse; font-family: sans-serif;">
          <tr><td style="padding: 6px 12px; color: #888;">Name</td>           <td style="padding: 6px 12px; font-weight: 600;">${name}</td></tr>
          <tr><td style="padding: 6px 12px; color: #888;">Address</td>        <td style="padding: 6px 12px;">${address}</td></tr>
          <tr><td style="padding: 6px 12px; color: #888;">City</td>           <td style="padding: 6px 12px;">${city}</td></tr>
          <tr><td style="padding: 6px 12px; color: #888;">Type</td>           <td style="padding: 6px 12px;">${hospital_type || '—'}</td></tr>
          <tr><td style="padding: 6px 12px; color: #888;">Bed Count</td>      <td style="padding: 6px 12px;">${bed_count || '—'}</td></tr>
          <tr><td style="padding: 6px 12px; color: #888;">Location</td>       <td style="padding: 6px 12px;">${lat && lng ? `${lat}, ${lng}` : 'Not provided'}</td></tr>
          <tr><td style="padding: 6px 12px; color: #888;">Contact Name</td>   <td style="padding: 6px 12px;">${contact_name}</td></tr>
          <tr><td style="padding: 6px 12px; color: #888;">Contact Email</td>  <td style="padding: 6px 12px;">${cleanEmail}</td></tr>
          <tr><td style="padding: 6px 12px; color: #888;">Contact Phone</td>  <td style="padding: 6px 12px;">${contact_phone}</td></tr>
        </table>
        <p style="margin-top: 16px; color: #888; font-size: 13px;">
          This hospital needs to be verified in the admin dashboard before they can post cases.
        </p>
      `
    ).catch(err => logger.error('Hospital registration email failed', { error: err.message }));

    return res.status(201).json({
      message:  'Hospital registered successfully. Pending verification.',
      hospital: {
        id:     hospital.id,
        name:   hospital.name,
        city:   hospital.city,
        status: hospital.status,
      },
    });

  } catch (error) {
    logger.error('Hospital registration: unexpected error', { error: error.message });
    return res.status(500).json({ message: 'Something went wrong' });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/hospitals/login
// Email + password login for the hospital web app.
//
// Flow:
//   1. Validate inputs
//   2. Look up hospital_auth record by email
//   3. Verify password with bcrypt.compare
//   4. Return hospital_id, name, contact_email, verified
//
// Same pattern as POST /api/surgeons/login (surgeon_auth table + bcrypt).
// Called by: Hospital Web App — Login.js
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  logger.info('Hospital login attempt', { email });

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    // ── Look up auth record by email ─────────────────────────────────────
    const { data: authRecord, error: authError } = await supabase
      .from('hospital_auth')
      .select('id, hospital_id, email, password_hash')
      .eq('email', cleanEmail)
      .single();

    if (authError || !authRecord) {
      logger.warn('Hospital login: no auth record found', { email: cleanEmail });
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // ── Verify password ──────────────────────────────────────────────────
    const passwordMatch = await bcrypt.compare(password, authRecord.password_hash);

    if (!passwordMatch) {
      logger.warn('Hospital login: incorrect password', { email: cleanEmail });
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // ── Fetch hospital record ────────────────────────────────────────────
    const { data: hospital, error: hospitalError } = await supabase
      .from('hospitals')
      .select('id, name, contact_email, verified, status')
      .eq('id', authRecord.hospital_id)
      .single();

    if (hospitalError || !hospital) {
      logger.error('Hospital login: hospital record not found', { hospital_id: authRecord.hospital_id });
      return res.status(500).json({ message: 'Hospital record not found' });
    }

    logger.info('Hospital login successful', {
      hospital_id: hospital.id,
      name:        hospital.name,
      verified:    hospital.verified,
    });

    return res.json({
      message:       'Login successful',
      hospital_id:   hospital.id,
      hospital_name: hospital.name,
      contact_email: hospital.contact_email,
      verified:      hospital.verified,
    });

  } catch (error) {
    logger.error('Hospital login: unexpected error', { error: error.message });
    return res.status(500).json({ message: 'Something went wrong' });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/hospitals/:id/password
// Change hospital password. Requires current password verification.
//
// Same pattern as PATCH /api/surgeons/:id/password.
// Called by: Hospital Web App — settings/profile
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/password', async (req, res) => {
  const { id } = req.params;
  const { current_password, new_password } = req.body;

  logger.info('Hospital password change requested', { hospital_id: id });

  if (!current_password || !new_password) {
    return res.status(400).json({ message: 'Current and new password are required' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters' });
  }

  try {
    // ── Fetch auth record ────────────────────────────────────────────────
    const { data: authRecord, error: fetchError } = await supabase
      .from('hospital_auth')
      .select('id, password_hash')
      .eq('hospital_id', id)
      .single();

    if (fetchError || !authRecord) {
      return res.status(404).json({ message: 'Auth record not found' });
    }

    // ── Verify current password ──────────────────────────────────────────
    const passwordMatch = await bcrypt.compare(current_password, authRecord.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // ── Hash and save new password ───────────────────────────────────────
    const newHash = await bcrypt.hash(new_password, 10);
    const { error: updateError } = await supabase
      .from('hospital_auth')
      .update({ password_hash: newHash })
      .eq('id', authRecord.id);

    if (updateError) {
      logger.error('Failed to update hospital password', { error: updateError.message });
      return res.status(500).json({ message: 'Failed to update password' });
    }

    logger.info('Hospital password updated successfully', { hospital_id: id });
    return res.json({ message: 'Password updated successfully' });

  } catch (error) {
    logger.error('Error changing hospital password', { error: error.message });
    return res.status(500).json({ message: 'Something went wrong' });
  }
});


module.exports = router;
