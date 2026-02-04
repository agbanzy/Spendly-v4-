import rateLimit from 'express-rate-limit';

// General API rate limiter - 100 requests per 15 minutes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests', message: 'You have exceeded the rate limit. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for authentication endpoints - 5 requests per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: { error: 'Too many authentication attempts', message: 'You have made too many failed login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Moderate limiter for sensitive operations - 10 requests per 15 minutes
export const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Rate limit exceeded', message: 'Too many requests for this sensitive operation. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for financial operations - 3 requests per minute
export const financialLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3,
  message: { error: 'Transaction rate limit exceeded', message: 'Too many transaction attempts. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Email operation limiter - 3 requests per hour
export const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { error: 'Email rate limit exceeded', message: 'Too many email requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
