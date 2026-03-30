/**
 * EMAIL UTILITY — Nodemailer Gmail SMTP
 * Company: Surgeon on Call (OPC) Pvt Ltd
 *
 * Sends email notifications for platform events (new registrations, etc.)
 * Uses Gmail SMTP with an App Password for authentication.
 *
 * Environment variables required:
 *   GMAIL_USER          — Gmail address (e.g. yourname@gmail.com)
 *   GMAIL_APP_PASSWORD  — 16-character App Password from Google Account settings
 *
 * Usage:
 *   const { sendAdminNotification } = require('./email');
 *   await sendAdminNotification('Subject here', '<p>HTML body</p>');
 */

const nodemailer = require('nodemailer');
const logger     = require('./logger');

// ── ADMIN NOTIFICATION RECIPIENTS ────────────────────────────────────────────
// All registration emails are sent to these addresses so the ops team can
// review and verify new hospitals/surgeons.
const ADMIN_EMAILS = [
  'shivatadakamalla.soc@gmail.com',
  'samdhathri.soc@gmail.com',
  'sragwin.soc@gmail.com',
];

// ── GMAIL SMTP TRANSPORTER ───────────────────────────────────────────────────
// Created lazily on first use. Returns null if env vars are missing (dev mode
// gracefully degrades — logs the email instead of crashing).
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    logger.warn('Email: GMAIL_USER or GMAIL_APP_PASSWORD not set — emails will be logged only');
    return null;
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  logger.info('Email: Gmail SMTP transporter created', { user });
  return transporter;
}

// ── SEND ADMIN NOTIFICATION ──────────────────────────────────────────────────
// Sends an email to all admin recipients. Gracefully logs and returns false
// if SMTP is not configured (dev mode) or if sending fails.
async function sendAdminNotification(subject, htmlBody) {
  const transport = getTransporter();

  if (!transport) {
    // Dev mode fallback — log the email content instead of sending
    logger.info('Email (dev mode — not sent):', { subject, to: ADMIN_EMAILS });
    return false;
  }

  try {
    const info = await transport.sendMail({
      from:    `"Surgeon on Call" <${process.env.GMAIL_USER}>`,
      to:      ADMIN_EMAILS.join(', '),
      subject,
      html:    htmlBody,
    });

    logger.info('Email sent successfully', {
      subject,
      messageId: info.messageId,
      to: ADMIN_EMAILS,
    });

    return true;
  } catch (error) {
    logger.error('Email send failed', {
      subject,
      error: error.message,
    });
    return false;
  }
}

module.exports = { sendAdminNotification, ADMIN_EMAILS };
