/**
 * SURGEON ON CALL - Backend API Server
 * Company: Vaidhya Healthcare Pvt Ltd
 * 
 * This is the main entry point of the backend server.
 * It sets up the Express web server, connects middleware,
 * loads all routes, and starts listening for incoming API requests.
 * 
 * All three apps (Hospital Web, Surgeon Mobile, Admin Dashboard)
 * talk to this server to read and write data.
 */

// ── DOTENV MUST BE FIRST ──────────────────────────────────────────────────────
// Load environment variables from .env file BEFORE importing anything else
// If dotenv runs after other imports, those imports won't see the env variables
/**
 * SURGEON ON CALL - Backend API Server
 * Company: Vaidhya Healthcare Pvt Ltd
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
const app = express();
const PORT = process.env.PORT || 5000;

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(requestLogger); // Log every request automatically

// ── ROUTES ────────────────────────────────────────────────────────────────────
app.get('/', async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('hospitals')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    res.json({
      status: 'ok',
      message: 'Surgeon on Call API is running',
      company: 'Vaidhya Healthcare Pvt Ltd',
      version: '1.0.0',
      database: 'connected',
      hospitals_count: count
    });

  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message
    });
  }
});


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
    company: 'Vaidhya Healthcare Pvt Ltd',
  });
});