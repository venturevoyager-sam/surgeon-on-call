/**
 * surgeon-on-call/backend/src/notifications.js
 *
 * NOTIFICATION SERVICE
 * Company: Vaidhya Healthcare Pvt Ltd
 *
 * Handles all outbound notifications to surgeons via:
 *   1. WhatsApp (primary) — via Twilio WhatsApp sandbox
 *   2. SMS (fallback) — if WhatsApp fails
 *
 * Notification events:
 *   - New case request (cascade notification)
 *   - Case passed to next surgeon (after decline)
 *   - 24-hour surgery reminder (via daily cron job)
 *
 * PRODUCTION TODO:
 *   - Replace WhatsApp sandbox with approved Twilio WhatsApp Business number
 *   - Add message templates approved by WhatsApp/Meta
 *   - Add delivery status webhooks
 */

const twilio = require('twilio');
const logger = require('./logger');

// ── TWILIO CLIENT ──────────────────────────────────────────────────────────────
// Initialised from environment variables set in .env
// Never hardcode credentials here
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Twilio phone numbers from .env
const TWILIO_PHONE      = process.env.TWILIO_PHONE_NUMBER;       // For SMS
const TWILIO_WHATSAPP   = process.env.TWILIO_WHATSAPP_NUMBER;    // For WhatsApp (sandbox)

// ── FORMAT PHONE ───────────────────────────────────────────────────────────────
// Converts a 10-digit Indian number to E.164 format: 9876543210 → +919876543210
// Twilio requires E.164 format for all messages
function formatIndianPhone(phone) {
  if (!phone) return null;
  const clean = String(phone).replace(/\D/g, ''); // Remove non-digits
  if (clean.length === 10) return `+91${clean}`;
  if (clean.length === 12 && clean.startsWith('91')) return `+${clean}`;
  if (clean.startsWith('+')) return phone;
  return `+91${clean.slice(-10)}`;
}

// ── SEND WHATSAPP ──────────────────────────────────────────────────────────────
// Sends a WhatsApp message via Twilio sandbox.
// Returns true on success, false on failure.
async function sendWhatsApp(toPhone, message) {
  console.log('=== sendWhatsApp called, to:', toPhone); // ADD THIS
  try {
    const to = `whatsapp:${formatIndianPhone(toPhone)}`;
    logger.info('Sending WhatsApp', { to, message_length: message.length });

    await client.messages.create({
      from: TWILIO_WHATSAPP,
      to,
      body: message,
    });

    logger.info('WhatsApp sent successfully', { to });
    return true;

  } catch (err) {
    logger.error('WhatsApp send failed', { phone: toPhone, error: err.message });
    return false;
  }
}

// ── SEND SMS ───────────────────────────────────────────────────────────────────
// Sends an SMS via Twilio.
// Used as fallback when WhatsApp fails.
// Returns true on success, false on failure.
async function sendSMS(toPhone, message) {
  try {
    const to = formatIndianPhone(toPhone);
    logger.info('Sending SMS', { to, message_length: message.length });

    await client.messages.create({
      from: TWILIO_PHONE,
      to,
      body: message,
    });

    logger.info('SMS sent successfully', { to });
    return true;

  } catch (err) {
    logger.error('SMS send failed', { phone: toPhone, error: err.message });
    return false;
  }
}

// ── SEND NOTIFICATION ──────────────────────────────────────────────────────────
// Main notification sender — tries WhatsApp first, falls back to SMS.
// This is the function called by the cascade engine and other routes.
async function sendNotification(toPhone, message) {
  if (!toPhone) {
    logger.warn('sendNotification: no phone number provided');
    return false;
  }

  // Try WhatsApp first
  const whatsappSent = await sendWhatsApp(toPhone, message);
  if (whatsappSent) return true;

  // WhatsApp failed — fall back to SMS
  logger.info('WhatsApp failed, falling back to SMS', { phone: toPhone });
  const smsSent = await sendSMS(toPhone, message);
  return smsSent;
}

// ── NOTIFICATION MESSAGES ──────────────────────────────────────────────────────
// All message templates in one place so they're easy to update.

// Sent when a surgeon is notified about a new case request
function newCaseMessage({ surgeonName, procedure, date, time, fee, expiresIn }) {
  return `🏥 *Surgeon on Call — New Case Request*

Hi Dr. ${surgeonName},

You have a new surgery request:

🔪 *Procedure:* ${procedure}
📅 *Date:* ${date}
🕐 *Time:* ${time}
💰 *Fee:* ${fee}

⏰ Please respond within ${expiresIn} hours.

Open the Surgeon on Call app to accept or decline.

_Vaidhya Healthcare Pvt Ltd_`;
}

// Sent when a case is passed to the next surgeon (previous one declined/expired)
function casePassedMessage({ surgeonName, procedure, date, time, fee }) {
  return `🏥 *Surgeon on Call — Urgent Case Request*

Hi Dr. ${surgeonName},

A surgery case has been passed to you:

🔪 *Procedure:* ${procedure}
📅 *Date:* ${date}
🕐 *Time:* ${time}
💰 *Fee:* ${fee}

⏰ Please respond within 2 hours.

Open the Surgeon on Call app to accept or decline.

_Vaidhya Healthcare Pvt Ltd_`;
}

// Sent 24 hours before surgery as a reminder
function surgeryReminderMessage({ surgeonName, procedure, date, time, hospitalCity }) {
  return `🏥 *Surgeon on Call — Surgery Tomorrow*

Hi Dr. ${surgeonName},

Reminder: You have a confirmed surgery tomorrow.

🔪 *Procedure:* ${procedure}
📅 *Date:* ${date}
🕐 *Time:* ${time}
📍 *City:* ${hospitalCity}

Our associate will contact you with the full hospital address shortly.

_Vaidhya Healthcare Pvt Ltd_`;
}

// ── EXPORTED NOTIFICATION FUNCTIONS ───────────────────────────────────────────
// These are called from cases.js and surgeons.js

/**
 * Notify a surgeon about a new case request (cascade notification).
 * Called from triggerCascade() in cases.js and surgeons.js.
 */
async function notifyNewCase({ surgeonName, surgeonPhone, procedure, surgeryDate, surgeryTime, feeMax, expiresAt }) {
  // Format date nicely: "2026-03-10" → "Mon, Mar 10"
  const date = new Date(surgeryDate).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short'
  });

  // Format fee: 4500000 paise → "₹45,000"
  const fee = '₹' + (feeMax / 100).toLocaleString('en-IN');

  // Hours until expiry
  const expiresIn = expiresAt
    ? Math.max(1, Math.round((new Date(expiresAt) - new Date()) / 3600000))
    : 2;

  const message = newCaseMessage({
    surgeonName,
    procedure,
    date,
    time: surgeryTime,
    fee,
    expiresIn,
  });

  return await sendNotification(surgeonPhone, message);
}

/**
 * Notify a surgeon that a case has been passed to them
 * (previous surgeon declined or didn't respond).
 * Also called from triggerCascade() — same as notifyNewCase but
 * with "Urgent" framing.
 */
async function notifyCasePassed({ surgeonName, surgeonPhone, procedure, surgeryDate, surgeryTime, feeMax }) {
  const date = new Date(surgeryDate).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short'
  });
  const fee = '₹' + (feeMax / 100).toLocaleString('en-IN');

  const message = casePassedMessage({
    surgeonName,
    procedure,
    date,
    time: surgeryTime,
    fee,
  });

  return await sendNotification(surgeonPhone, message);
}

/**
 * Send a 24-hour reminder to a surgeon about tomorrow's surgery.
 * Called from the daily cron job in index.js.
 */
async function notifySurgeryReminder({ surgeonName, surgeonPhone, procedure, surgeryDate, surgeryTime, hospitalCity }) {
  const date = new Date(surgeryDate).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'
  });

  const message = surgeryReminderMessage({
    surgeonName,
    procedure,
    date,
    time: surgeryTime,
    hospitalCity: hospitalCity || 'TBD',
  });

  return await sendNotification(surgeonPhone, message);
}

module.exports = {
  notifyNewCase,
  notifyCasePassed,
  notifySurgeryReminder,
};