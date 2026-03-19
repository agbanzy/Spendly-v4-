/**
 * Standardized API response helpers.
 *
 * All API responses follow the shape:
 *   { success: boolean, data?: T, error?: string }
 */
import type { Response } from "express";

export function apiSuccess<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function apiError(res: Response, error: string, status = 400) {
  return res.status(status).json({ success: false, error });
}

export function apiNotFound(res: Response, entity = "Resource") {
  return res.status(404).json({ success: false, error: `${entity} not found` });
}

export function apiUnauthorized(res: Response, message = "Unauthorized") {
  return res.status(401).json({ success: false, error: message });
}

export function apiForbidden(res: Response, message = "Access denied") {
  return res.status(403).json({ success: false, error: message });
}

export function apiServerError(res: Response, message = "Internal server error") {
  return res.status(500).json({ success: false, error: message });
}
