/**
 * REQUEST LOGGER MIDDLEWARE
 *
 * Automatically logs every incoming HTTP request and its response.
 * This runs on EVERY API call so we have a full audit trail.
 *
 * Logs:
 * - Method, URL, request body (incoming)
 * - Status code, response time (outgoing)
 */

const logger = require('../logger');

const requestLogger = (req, res, next) => {
  // Record when the request arrived
  const startTime = Date.now();

  // Log the incoming request
  logger.info(`→ ${req.method} ${req.url}`, {
    body: req.body,
    query: req.query,
    ip: req.ip,
  });

  // Intercept the response to log it when it goes out
  // We override res.json to capture what we're sending back
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 400 ? 'error' : 'info';

    logger[level](`← ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`, {
      response: res.statusCode >= 400 ? body : { success: true },
    });

    return originalJson(body);
  };

  // Continue to the next middleware or route
  next();
};

module.exports = requestLogger;