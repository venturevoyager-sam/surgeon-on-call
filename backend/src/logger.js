/**
 * LOGGER - Backend API
 * Company: Surgeon on Call (OPC) Pvt Ltd
 *
 * Centralised logging for the entire backend.
 * Every API request, response, error, and key event is logged here.
 *
 * Logs are written to:
 * - Console (visible in terminal during development)
 * - logs/combined.log (every log)
 * - logs/error.log (errors only)
 *
 * Log levels (in order of severity):
 * error > warn > info > debug
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// ── CREATE LOGS DIRECTORY ─────────────────────────────────────────────────────
// Create the logs folder if it doesn't exist yet
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ── LOG FORMAT ────────────────────────────────────────────────────────────────
// How each log line looks:
// [2026-03-02 10:30:00] INFO: Hospital logged in | {"email":"spoc@hospital.com"}

const logFormat = winston.format.combine(
  // Add timestamp to every log
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  // Custom format: [timestamp] LEVEL: message | metadata
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let log = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    // If there is extra data (like request body), append it as JSON
    if (Object.keys(metadata).length > 0) {
      log += ` | ${JSON.stringify(metadata)}`;
    }
    return log;
  })
);

// ── CREATE LOGGER ─────────────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: 'debug', // Log everything from debug level and above
  format: logFormat,
  transports: [
    // Write ALL logs to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880,  // 5MB max file size
      maxFiles: 5,       // Keep last 5 log files
    }),
    // Write only ERROR logs to error.log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    }),
    // Also print to console with colours
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(), // Add colours to console output
        logFormat
      )
    })
  ]
});

module.exports = logger;