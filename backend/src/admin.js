/**
 * surgeon-on-call/backend/src/routes/admin.js
 *
 * ADMIN ROUTES - Backend API
 * Company: Vaidhya Healthcare Pvt Ltd
 */

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const logger = require('../logger');

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  logger.info('Admin: fetching platform stats');
  try {
    const { data: allCases, error: casesError } = await supabase
      .from('cases').select('id, status, hospital_id');
    if (casesError) throw casesError;

    const { data: allSurgeons, error: surgeonsError } = await supabase
      .from('surgeons').select('id, available, verified');
    if (surgeonsError) throw surgeonsError;

    const { data: allHospitals, error: hospitalsError } = await supabase
      .from('hospitals').select('id, name, verified');
    if (hospitalsError) throw hospitalsError;

    const confirmedCases = allCases.filter(c => c.status === 'confirmed').length;
    const cascadingCases = allCases.filter(c => c.status === 'cascading').length;
    const unfilledCases  = allCases.filter(c => c.status === 'unfilled').length;
    const everCascaded   = confirmedCases + unfilledCases + cascadingCases;
    const fillRate       = everCascaded > 0 ? Math.round((confirmedCases / everCascaded) * 100) : 0;

    const hospitalBreakdown = allHospitals.map(hospital => {
      const hc = allCases.filter(c => c.hospital_id === hospital.id);
      return {
        id: hospital.id, name: hospital.name, verified: hospital.verified,
        total:     hc.length,
        active:    hc.filter(c => c.status === 'active').length,
        cascading: hc.filter(c => c.status === 'cascading').length,
        confirmed: hc.filter(c => c.status === 'confirmed').length,
        completed: hc.filter(c => c.status === 'completed').length,
        unfilled:  hc.filter(c => c.status === 'unfilled').length,
      };
    });

    return res.json({
      stats: {
        total_cases:     allCases.length,
        active_cases:    allCases.filter(c => c.status === 'active').length + cascadingCases,
        completed_cases: allCases.filter(c => c.status === 'completed').length,
        unfilled_cases:  unfilledCases,
        fill_rate:       fillRate,
        total_surgeons:  allSurgeons.filter(s => s.verified).length,
        available_now:   allSurgeons.filter(s => s.verified && s.available).length,
        total_hospitals: allHospitals.length,
      },
      hospital_breakdown: hospitalBreakdown,
    });
  } catch (error) {
    logger.error('Admin stats error', { error: error.message });
    return res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

// GET /api/admin/cases
router.get('/cases', async (req, res) => {
  const { status, search } = req.query;
  try {
    let query = supabase
      .from('cases')
      .select(`*, hospitals(id,name,city), surgeons!cases_confirmed_surgeon_id_fkey(id,name,specialty)`)
      .order('created_at', { ascending: false });
    if (status && status !== 'all') query = query.eq('status', status);

    const { data: cases, error } = await query;
    if (error) throw error;

    let result = cases;
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      result = cases.filter(c =>
        c.procedure?.toLowerCase().includes(term) ||
        c.patient_name?.toLowerCase().includes(term) ||
        c.case_number?.toLowerCase().includes(term) ||
        c.hospitals?.name?.toLowerCase().includes(term)
      );
    }
    return res.json({ cases: result });
  } catch (error) {
    logger.error('Admin cases error', { error: error.message });
    return res.status(500).json({ message: 'Failed to fetch cases' });
  }
});

// GET /api/admin/surgeons
router.get('/surgeons', async (req, res) => {
  const { available, search } = req.query;
  try {
    let query = supabase.from('surgeons').select('*').order('created_at', { ascending: false });
    if (available === 'true')  query = query.eq('available', true);
    if (available === 'false') query = query.eq('available', false);

    const { data: surgeons, error } = await query;
    if (error) throw error;

    let result = surgeons;
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      result = surgeons.filter(s =>
        s.name?.toLowerCase().includes(term) ||
        s.city?.toLowerCase().includes(term) ||
        (Array.isArray(s.specialty)
          ? s.specialty.some(sp => sp.toLowerCase().includes(term))
          : s.specialty?.toLowerCase().includes(term))
      );
    }
    return res.json({ surgeons: result });
  } catch (error) {
    logger.error('Admin surgeons error', { error: error.message });
    return res.status(500).json({ message: 'Failed to fetch surgeons' });
  }
});

// GET /api/admin/hospitals
router.get('/hospitals', async (req, res) => {
  try {
    const { data: hospitals, error: hErr } = await supabase
      .from('hospitals').select('*').order('created_at', { ascending: false });
    if (hErr) throw hErr;

    const { data: caseCounts } = await supabase.from('cases').select('hospital_id, status');

    const countMap = {};
    if (caseCounts) {
      for (const c of caseCounts) {
        if (!countMap[c.hospital_id])
          countMap[c.hospital_id] = { total:0, active:0, confirmed:0, completed:0, unfilled:0, cascading:0 };
        countMap[c.hospital_id].total++;
        if (countMap[c.hospital_id][c.status] !== undefined) countMap[c.hospital_id][c.status]++;
      }
    }

    return res.json({
      hospitals: hospitals.map(h => ({
        ...h,
        case_counts: countMap[h.id] || { total:0, active:0, confirmed:0, completed:0, unfilled:0, cascading:0 },
      }))
    });
  } catch (error) {
    logger.error('Admin hospitals error', { error: error.message });
    return res.status(500).json({ message: 'Failed to fetch hospitals' });
  }
});

// PATCH /api/admin/cases/:id/override
router.patch('/cases/:id/override', async (req, res) => {
  const { id } = req.params;
  const { surgeon_id } = req.body;
  if (!surgeon_id) return res.status(400).json({ message: 'surgeon_id is required' });

  try {
    const { data: case_, error: caseError } = await supabase
      .from('cases').select('id, status, procedure').eq('id', id).single();
    if (caseError || !case_) return res.status(404).json({ message: 'Case not found' });

    if (!['active', 'cascading', 'unfilled'].includes(case_.status)) {
      return res.status(400).json({ message: `Cannot override a case with status: ${case_.status}` });
    }

    const { data: surgeon, error: surgeonError } = await supabase
      .from('surgeons').select('id, name, verified').eq('id', surgeon_id).single();
    if (surgeonError || !surgeon) return res.status(404).json({ message: 'Surgeon not found' });
    if (!surgeon.verified) return res.status(400).json({ message: 'Surgeon is not verified' });

    // Cancel cascade
    await supabase.from('case_priority_list')
      .update({ status: 'cancelled' })
      .eq('case_id', id)
      .in('status', ['pending', 'notified']);

    // Insert override row
    const now = new Date().toISOString();
    await supabase.from('case_priority_list').upsert({
      case_id: id, surgeon_id, priority_order: 99,
      status: 'accepted', notified_at: now, responded_at: now,
    }, { onConflict: 'case_id,surgeon_id' });

    // Confirm the case
    await supabase.from('cases')
      .update({ status: 'confirmed', confirmed_surgeon_id: surgeon_id })
      .eq('id', id);

    logger.info('Admin override success', { case_id: id, surgeon_name: surgeon.name });
    return res.json({ message: `Case assigned to Dr. ${surgeon.name}`, case_id: id, surgeon_name: surgeon.name });

  } catch (error) {
    logger.error('Admin override error', { error: error.message });
    return res.status(500).json({ message: 'Something went wrong during override' });
  }
});

module.exports = router;