import express from "express";
import { storage } from "../storage";

const router = express.Router();

// ==================== HEALTH CHECK ====================
router.get("/health", async (_req, res) => {
  let dbStatus = "ok";
  try {
    // Quick DB connectivity check with timeout for ALB health checks
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000)
    );
    await Promise.race([
      storage.getNotifications('__health_check__'),
      timeoutPromise,
    ]);
  } catch {
    dbStatus = "unreachable";
  }

  const status = dbStatus === "ok" ? "ok" : "degraded";
  const statusCode = dbStatus === "ok" ? 200 : 503;
  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    version: "4.0.0",
    environment: process.env.NODE_ENV || "development",
    database: dbStatus,
  });
});

export default router;
