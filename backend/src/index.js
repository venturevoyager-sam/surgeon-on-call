/**
 * SURGEON ON CALL - Backend API Server
 * Company: Vaidhya Healthcare Pvt Ltd
 * 
 * This is the main entry point of the backend server.
 * It sets up the Express web server, connects middleware,
 * and starts listening for incoming API requests.
 * 
 * All three apps (Hospital Web, Surgeon Mobile, Admin Dashboard)
 * talk to this server to read and write data.
 */

// ── IMPORTS ──────────────────────────────────────────────────────────────────

// express: the web framework that handles incoming HTTP requests
const express = require('express');

// cors: allows our frontend apps (running on different URLs) to talk to this server
// Without this, browsers block requests from different origins for security reasons
const cors = require('cors');

// dotenv: loads environment variables from the .env file
// This keeps sensitive info (like API keys) out of the code
const dotenv = require('dotenv');

// ── CONFIGURATION ─────────────────────────────────────────────────────────────

// Load all variables from .env file into process.env
// Must be called before accessing any process.env values
dotenv.config();

// Create the Express application instance
const app = express();

// Port the server will listen on
// Uses the value from .env file, or defaults to 3000 if not set
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
// Middleware are functions that run on every request before it reaches our routes

// Enable CORS for all routes
// This allows our React and React Native apps to make requests to this server
app.use(cors());

// Parse incoming requests with JSON bodies
// This lets us read req.body when hospitals or surgeons send data to the API
app.use(express.json());

// ── ROUTES ────────────────────────────────────────────────────────────────────
// Routes define what happens when someone calls a specific URL on our server

/**
 * GET /
 * Health check endpoint
 * Used to verify the server is running correctly
 * Called by: deployment systems, developers during testing
 */
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Surgeon on Call API is running',
    company: 'Vaidhya Healthcare Pvt Ltd',
    version: '1.0.0'
  });
});

// ── SERVER START ──────────────────────────────────────────────────────────────

/**
 * Start the server and listen for incoming requests on the specified PORT
 * The callback function runs once the server is successfully started
 */
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Visit: http://localhost:${PORT}`);
  console.log(`🏥 Surgeon on Call API — Vaidhya Healthcare Pvt Ltd`);
});
