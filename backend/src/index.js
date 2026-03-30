/**
 * SURGEON ON CALL — Backend API Server
 * Company: Surgeon on Call (OPC) Pvt Ltd
 *
 * Main entry point. Sets up Express, middleware, routes, and cron jobs.
 *
 * ── PORT ─────────────────────────────────────────────────────────────────────
 * Reads from process.env.PORT (set in .env or by hosting platform).
 * Falls back to 5000 for local development.
 *
 * ── CORS ALLOWED ORIGINS ─────────────────────────────────────────────────────
 * Development:
 *   http://localhost:3000  — Hospital Web
 *   http://localhost:3001  — Admin Web
 *   http://localhost:3002  — Onboarding Web
 *   http://localhost:3003  — Doctor Web
 *
 * Production:
 *   https://surgeononcall.in             — Main / Onboarding
 *   https://hospital.surgeononcall.in    — Hospital Web
 *   https://doctor.surgeononcall.in      — Doctor Web
 *   https://admin.surgeononcall.in       — Admin Web
 *
 * ── APPS THAT CONNECT ────────────────────────────────────────────────────────
 * Hospital Web, Doctor Web, Admin Web, Onboarding Web, Surgeon Mobile App
 * — all talk to this server for data.
 */

// ── DOTENV MUST BE FIRST ──────────────────────────────────────────────────────
// Load .env variables BEFORE importing anything else
const dotenv = require('dotenv');
dotenv.config();

// ── IMPORTS ───────────────────────────────────────────────────────────────────
const express = require('express');
const cors = require('cors');
const supabase = require('./supabase');
const logger = require('./logger');
const requestLogger = require('./middleware/requestLogger');
const cron = require('node-cron');
const { notifySurgeryReminder } = require('./notifications');

// ── ROUTE IMPORTS ─────────────────────────────────────────────────────────────
const casesRouter       = require('./routes/cases');
const surgeonsRouter    = require('./routes/surgeons');
const adminRouter       = require('./routes/admin');
const hospitalsRouter   = require('./routes/hospitals');
const specialtiesRouter = require('./routes/specialties');

// ── CONFIGURATION ─────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 5000;

// ── CORS — restrict to known frontend origins ────────────────────────────────
// In development: localhost ports for each app.
// In production: subdomain-based origins on surgeononcall.in.
const ALLOWED_ORIGINS = [
  // Development
  'http://localhost:3000',   // Hospital Web
  'http://localhost:3001',   // Admin Web
  'http://localhost:3002',   // Onboarding Web
  'http://localhost:3003',   // Doctor Web
  // Production
  'https://surgeononcall.in',
  'https://hospital.surgeononcall.in',
  'https://doctor.surgeononcall.in',
  'https://admin.surgeononcall.in',
];

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}));

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(requestLogger); // Log every request automatically

// ── HEALTH CHECK ─────────────────────────────────────────────────────────────
// Simple ping endpoint for load balancers and uptime monitors.
// Does NOT query the database — returns immediately.
app.get('/', (req, res) => {
  res.json({
    status:    'ok',
    service:   'Surgeon on Call API',
    timestamp: new Date(),
  });
});

// ── ROUTES ────────────────────────────────────────────────────────────────────
app.use('/api/surgeons',     surgeonsRouter);
app.use('/api/cases',        casesRouter);
app.use('/api/admin',        adminRouter);
app.use('/api/hospitals',    hospitalsRouter);
app.use('/api/specialties',  specialtiesRouter);

// ── GLOBAL ERROR HANDLER ──────────────────────────────────────────────────────
// Catches any unhandled errors thrown anywhere in the app
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });
  res.status(500).json({ message: 'Internal server error' });
});

// ── DAILY REMINDER CRON JOB ───────────────────────────────────────────────────
// Runs every day at 9:00 AM IST (3:30 AM UTC)
// Sends WhatsApp/SMS reminders to surgeons with confirmed cases tomorrow
cron.schedule('30 3 * * *', async () => {
  logger.info('Cron: Running daily surgery reminder job');

  try {
    // Get tomorrow's date range
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Find all confirmed cases scheduled for tomorrow
    const { data: cases, error } = await supabase
      .from('cases')
      .select(`
        id,
        procedure,
        surgery_date,
        surgery_time,
        surgeons!cases_confirmed_surgeon_id_fkey (
          id, name, phone
        ),
        hospitals (
          city
        )
      `)
      .eq('status', 'confirmed')
      .eq('surgery_date', tomorrowStr);

    if (error) {
      logger.error('Cron: Failed to fetch tomorrow cases', { error: error.message });
      return;
    }

    logger.info('Cron: Found confirmed cases for tomorrow', { count: cases?.length || 0 });

    // Send reminder to each confirmed surgeon
    for (const case_ of cases || []) {
      if (case_.surgeons?.phone) {
        await notifySurgeryReminder({
          surgeonName:  case_.surgeons.name,
          surgeonPhone: case_.surgeons.phone,
          procedure:    case_.procedure,
          surgeryDate:  case_.surgery_date,
          surgeryTime:  case_.surgery_time,
          hospitalCity: case_.hospitals?.city,
        });
        logger.info('Cron: Reminder sent', { surgeon: case_.surgeons.name, case_id: case_.id });
      }
    }

  } catch (err) {
    logger.error('Cron: Unexpected error in reminder job', { error: err.message });
  }
}, {
  timezone: 'Asia/Kolkata',
});

logger.info('Daily reminder cron job scheduled — runs at 9:00 AM IST');

// ── SERVER START ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info('Surgeon on Call API started', {
    port: PORT,
    company: 'Surgeon on Call (OPC) Pvt Ltd',
  });
});
