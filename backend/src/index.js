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

const dotenv = require('dotenv');
dotenv.config();

// ── IMPORTS ───────────────────────────────────────────────────────────────────

// express: the web framework that handles incoming HTTP requests
const express = require('express');

// cors: allows our frontend apps (running on different URLs) to talk to this server
const cors = require('cors');

// Our Supabase client — used to test the database connection on startup
// Imported AFTER dotenv.config() so it can read SUPABASE_URL and SUPABASE_ANON_KEY
const supabase = require('./supabase');

// ── CONFIGURATION ─────────────────────────────────────────────────────────────

// Create the Express application instance
const app = express();

// Port the server will listen on
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────

// Enable CORS — allows React and React Native apps to call this API
app.use(cors());

// Parse JSON request bodies — lets us read req.body in our routes
app.use(express.json());

// ── ROUTES ────────────────────────────────────────────────────────────────────

/**
 * GET /
 * Health check endpoint — confirms server and database are running
 */
app.get('/', async (req, res) => {
  try {
    // Test database connection by counting hospitals
    // If this succeeds, Supabase is connected and working
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
    // If database connection fails, return an error response
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// ── SERVER START ──────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Visit: http://localhost:${PORT}`);
  console.log(`🏥 Surgeon on Call API — Vaidhya Healthcare Pvt Ltd`);
});