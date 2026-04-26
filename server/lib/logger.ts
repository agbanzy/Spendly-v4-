import pino from 'pino';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

// PII patterns to redact from log output
const PII_PATTERNS: [RegExp, string][] = [
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]'],
  [/\b\d{10,11}\b/g, '[PHONE]'],             // Nigerian phone numbers
  [/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]'], // Card numbers
  [/\b\d{3}\b(?=.*cvv|.*cvc)/gi, '[CVV]'],   // CVV/CVC near keywords
  [/\bNG\d{10}\b/g, '[NUBAN]'],              // Nigerian bank accounts
  [/\b\d{11}\b(?=.*bvn)/gi, '[BVN]'],        // BVN near keyword
];

function maskPII(value: string): string {
  let masked = value;
  for (const [pattern, replacement] of PII_PATTERNS) {
    masked = masked.replace(pattern, replacement);
  }
  return masked;
}

// LU-013 / AUD-OB-001 — Recursively walk a log payload object and apply
// maskPII to every string leaf. The maxDepth and key cap prevent runaway
// traversal of pathological objects.
const REDACTION_MAX_DEPTH = 6;
const REDACTION_MAX_KEYS = 200;

function maskPIIInValue(value: unknown, depth = 0): unknown {
  if (depth > REDACTION_MAX_DEPTH) return value;
  if (value == null) return value;
  if (typeof value === 'string') return maskPII(value);
  if (Array.isArray(value)) {
    return value.slice(0, REDACTION_MAX_KEYS).map((v) => maskPIIInValue(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    let count = 0;
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (count++ >= REDACTION_MAX_KEYS) break;
      out[k] = maskPIIInValue(v, depth + 1);
    }
    return out;
  }
  return value;
}

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  transport: isProduction
    ? undefined // JSON output in production (for CloudWatch/Datadog)
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } },
  serializers: {
    err: pino.stdSerializers.err,
    req: (req) => ({
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
  // LU-013 / AUD-OB-001: auto-redact PII (email, phone, card, CVV, NUBAN,
  // BVN) from every log payload's string leaves before write. Header
  // redaction below remains as a strict-replace belt-and-braces.
  formatters: {
    log: (payload) => maskPIIInValue(payload) as Record<string, unknown>,
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-transaction-pin"]',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
});

/**
 * Generate a unique correlation ID for request tracing.
 */
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

/**
 * Express middleware that:
 * 1. Assigns a correlation ID to each request
 * 2. Creates a child logger bound to that request
 * 3. Logs request start/finish with timing
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const correlationId = (req.headers['x-correlation-id'] as string) || generateCorrelationId();
  const startTime = Date.now();

  // Attach to request for downstream use
  (req as any).correlationId = correlationId;
  (req as any).log = logger.child({ correlationId });

  // Set correlation ID on response header for client tracing
  res.setHeader('X-Correlation-Id', correlationId);

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      correlationId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.headers['user-agent']?.substring(0, 100),
    };

    if (res.statusCode >= 500) {
      logger.error(logData, 'Request failed');
    } else if (res.statusCode >= 400) {
      logger.warn(logData, 'Request client error');
    } else if (req.path.startsWith('/api')) {
      logger.info(logData, 'Request completed');
    }
  });

  next();
}

/**
 * Mask PII in a string value for safe logging.
 */
export { maskPII };

// Extend Express Request type for correlation ID
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      log?: pino.Logger;
    }
  }
}
