/**
 * CENTRAL CONFIG — Hospital Web App
 * Surgeon on Call (OPC) Pvt Ltd
 *
 * Single source of truth for the backend API URL.
 * All page components import API_URL from here instead of reading
 * process.env directly — keeps the config in one place.
 *
 * ── Environment variable: REACT_APP_API_URL ──────────────────────────────────
 * - In production (Vercel): set to https://api.surgeononcall.in
 * - In development: set in .env to http://localhost:5000
 * - Fallback: http://localhost:5000 (so local dev works without .env)
 */

export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
