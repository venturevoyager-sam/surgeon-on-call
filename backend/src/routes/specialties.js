/**
 * SPECIALTIES ROUTES - Backend API
 * Company: Vaidhya Healthcare Pvt Ltd
 *
 * Endpoints:
 * - GET /api/specialties → List all active specialties
 *
 * The specialties table is a reference/lookup table that stores the canonical
 * list of surgical specialties available on the platform. Each specialty has
 * an `active` boolean so specialties can be retired without deletion.
 *
 * Used by: Doctor Web signup (specialty multi-select), Hospital Web new request
 * (specialty dropdown), and anywhere else the app needs the official list.
 */

const express  = require('express');
const router   = express.Router();
const supabase = require('../supabase');
const logger   = require('../logger');


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/specialties
// Returns all active specialties, ordered alphabetically by name.
//
// Response: { specialties: [{ id, name, active, ... }, ...] }
//
// Called by: Doctor Web signup, Hospital Web new request form, admin dashboard
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    logger.info('Fetching active specialties');

    const { data: specialties, error } = await supabase
      .from('specialties')
      .select('*')
      .eq('active', true)
      .order('name', { ascending: true });

    if (error) {
      logger.error('Failed to fetch specialties', { error: error.message });
      return res.status(500).json({ message: 'Failed to fetch specialties' });
    }

    logger.info('Specialties fetched', { count: specialties?.length || 0 });
    return res.json({ specialties: specialties || [] });

  } catch (error) {
    logger.error('Error fetching specialties', { error: error.message });
    return res.status(500).json({ message: 'Something went wrong' });
  }
});


module.exports = router;
