import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { apiLimiter } from "./middleware/rateLimiter";
import { csrfProtection } from "./middleware/csrf";
import { startRecurringScheduler } from "./recurringScheduler";
import { logger, requestLogger } from "./lib/logger";
import { startRetentionScheduler } from "./lib/data-retention";

// ==================== PROCESS-LEVEL ERROR HANDLERS ====================

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception — process will exit');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled promise rejection — process will exit');
  process.exit(1);
});

// ==================== STARTUP GUARDS ====================

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL'];
// Cognito IDs are NOT in productionRequiredVars by default — the
// runtime is multi-cloud (AWS Cognito on the AWS deploy path; future
// non-AWS auth provider on the DO deploy path). The Cognito middleware
// at server/middleware/auth.ts logs a clear "not configured" line and
// the app boots; protected routes 401 at request time. To re-enable
// the strict boot guard (recommended once Cognito is wired in any
// environment), set REQUIRE_COGNITO_AT_BOOT=true.
const productionRequiredVars = ['APP_URL'];
if (process.env.REQUIRE_COGNITO_AT_BOOT === 'true') {
  productionRequiredVars.push('COGNITO_USER_POOL_ID', 'COGNITO_CLIENT_ID');
}

for (const v of requiredEnvVars) {
  if (!process.env[v]) {
    console.error(`FATAL: Missing required environment variable: ${v}`);
    process.exit(1);
  }
}
if (process.env.NODE_ENV === 'production') {
  for (const v of productionRequiredVars) {
    if (!process.env[v]) {
      console.error(`FATAL: Missing production environment variable: ${v}`);
      process.exit(1);
    }
  }
  // Loud banner when Cognito is missing in production. The middleware
  // handles the missing-config case gracefully, but operators need to
  // know the deploy isn't fully auth-protected.
  if (!process.env.COGNITO_USER_POOL_ID || !process.env.COGNITO_CLIENT_ID) {
    console.warn(
      '⚠️  COGNITO NOT CONFIGURED IN PRODUCTION — auth endpoints will 401. ' +
      'Wire up COGNITO_USER_POOL_ID + COGNITO_CLIENT_ID (or your replacement ' +
      'auth provider) before exposing this deploy to real users. ' +
      'Set REQUIRE_COGNITO_AT_BOOT=true to make this fatal at boot once wired.',
    );
  }

  // Block startup if test API keys are used in production
  const keysToCheck = [
    { name: 'STRIPE_SECRET_KEY', value: process.env.STRIPE_SECRET_KEY },
    { name: 'PAYSTACK_SECRET_KEY', value: process.env.PAYSTACK_SECRET_KEY },
  ];
  for (const key of keysToCheck) {
    if (key.value && (key.value.includes('_test_') || key.value.includes('sk_test'))) {
      console.error(`FATAL: ${key.name} appears to be a test key in production!`);
      process.exit(1);
    }
  }
}

// ==================== APP SETUP ====================

const app = express();
app.set('trust proxy', 1);

// Security headers (X-Frame-Options, HSTS, CSP, X-Content-Type-Options, etc.)
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://*.amazonaws.com", "https://api.stripe.com", "https://api.paystack.co"],
      fontSrc: ["'self'", "https:", "data:"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  } : false, // Disabled in development for Vite/React HMR inline scripts
  crossOriginEmbedderPolicy: false, // Disabled for cross-origin resource loading
}));

const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// CORS configuration
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      ...(process.env.APP_URL ? [process.env.APP_URL] : []),
      'https://thefinanciar.com',
      'https://www.thefinanciar.com',
      'https://app.thefinanciar.com',
    ]
  : ['http://localhost:3000', 'http://localhost:5000', 'http://localhost:5001', 'http://localhost:8081'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (same-origin, mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Log blocked origin for debugging
    logger.warn({ origin, allowedOrigins }, 'CORS blocked origin');
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-transaction-pin', 'X-Company-Id'],
}));

// CSRF protection — require X-Requested-With on state-changing API requests
app.use('/api', csrfProtection);

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// Legacy log function — kept for backward compatibility with existing callers
export function log(message: string, source = "express") {
  logger.info({ source }, message);
}

// Structured request logging with correlation IDs
app.use(requestLogger);

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    const correlationId = (req as any).correlationId;

    logger.error({ err, correlationId, path: req.path, method: req.method }, 'Unhandled error');

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message, correlationId });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || "0.0.0.0";
  httpServer.listen(
    {
      port,
      host,
      reusePort: host === "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
      startRecurringScheduler(3600000);
      startRetentionScheduler();
    },
  );
})();
