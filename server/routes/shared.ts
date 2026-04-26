/**
 * Shared utilities, schemas, and helpers used across all route modules.
 * This module centralizes common functionality to avoid duplication.
 */
import { z } from "zod";
import { storage } from "../storage";
import multer from "multer";
import path from "path";
import fs from "fs";

// ==================== HELPERS ====================

/** Safely extract route params (Express 5 types params as string | string[]) */
export function param(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

/** Safely extract header values */
export function header(val: string | string[] | undefined): string {
  if (!val) return '';
  return Array.isArray(val) ? val[0] : val;
}

/** Reusable server-side amount validation for payment endpoints */
export function validateAmount(amount: number | string, currency: string = 'USD'): { valid: boolean; error?: string; parsed: number } {
  const parsed = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(parsed) || !isFinite(parsed)) return { valid: false, error: 'Invalid amount', parsed: 0 };
  if (parsed <= 0) return { valid: false, error: 'Amount must be greater than zero', parsed };
  if (parsed > 1_000_000_000) return { valid: false, error: 'Amount exceeds maximum limit', parsed };
  const decimalStr = String(parsed);
  const decimalPart = decimalStr.split('.')[1];
  if (decimalPart && decimalPart.length > 2) return { valid: false, error: 'Amount cannot have more than 2 decimal places', parsed };
  return { valid: true, parsed };
}

export function getDateRangeFilter(dateRange: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  const endDate = new Date(now);
  let startDate = new Date(now);

  switch (dateRange) {
    case 'last_7_days':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'last_30_days':
      startDate.setDate(now.getDate() - 30);
      break;
    case 'last_90_days':
      startDate.setDate(now.getDate() - 90);
      break;
    case 'this_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'last_month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate.setDate(0);
      break;
    case 'this_quarter': {
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      break;
    }
    case 'this_year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate.setDate(now.getDate() - 30);
  }

  return { startDate, endDate };
}

export function escapeCSV(field: any): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function filterByDateRange(items: any[], dateField: string, startDate: Date, endDate: Date): any[] {
  return items.filter(item => {
    const itemDate = new Date(item[dateField]);
    return itemDate >= startDate && itemDate <= endDate;
  });
}

export async function getAuditUserName(req: any): Promise<string> {
  try {
    const uid = req.user?.uid;
    if (uid) {
      const profile = await storage.getUserProfileByCognitoSub(uid);
      if (profile?.displayName) return profile.displayName;
      if (profile?.email) return profile.email;
    }
    return req.user?.email || 'System';
  } catch {
    return req.user?.email || 'System';
  }
}

/** Enhanced audit logging helper for approval workflows */
export async function logAudit(
  entityType: string,
  entityId: string,
  action: string,
  userId: string,
  userName: string,
  previousState?: any,
  newState?: any,
  metadata?: any,
  ipAddress?: string
) {
  try {
    await storage.createAuditLog({
      entityType,
      entityId,
      action,
      userId,
      userName,
      details: {
        previousState,
        newState,
        metadata,
        ipAddress,
      },
      ipAddress,
      createdAt: new Date().toISOString(),
    } as any);
  } catch (err) {
    console.error('[AUDIT] Failed to log:', err);
  }
}

/** Resolve the user's active company from their Cognito sub */
export async function resolveUserCompany(req: any): Promise<{ companyId: string; role: string } | null> {
  try {
    const uid = req.user?.uid;
    if (!uid) return null;

    const headerCompanyId = req.headers['x-company-id'] as string;
    let userCompanies = await storage.getUserCompanies(uid);

    if (userCompanies.length === 0 && req.user?.email) {
      const profile = await storage.getUserProfileByCognitoSub(uid);
      if (profile?.email) {
        const memberByEmail = await storage.getCompanyMembersByEmail(profile.email);
        if (memberByEmail.length > 0) {
          for (const member of memberByEmail) {
            if (!member.userId) {
              await storage.updateCompanyMember(member.id, { userId: uid });
            }
          }
          userCompanies = memberByEmail;
        }
      }
    }

    if (userCompanies.length === 0) return null;

    if (headerCompanyId) {
      const match = userCompanies.find(c => c.companyId === headerCompanyId);
      if (match) return { companyId: match.companyId, role: match.role };
    }

    return { companyId: userCompanies[0].companyId, role: userCompanies[0].role };
  } catch (err) {
    console.error('resolveUserCompany error:', err);
    return null;
  }
}

/** Get settings using company context (falls back to singleton) */
export async function getSettingsForRequest(req: any): Promise<any> {
  const company = await resolveUserCompany(req);
  if (company?.companyId) {
    const companySettings = await storage.getCompanyAsSettings(company.companyId);
    if (companySettings) return companySettings;
  }
  return storage.getSettings();
}

/**
 * Verify an entity belongs to the user's active company.
 *
 * AUD-DD-INV-004: previously returned `true` whenever `entityCompanyId` was
 * null/undefined — a permissive default that meant any auth'd user could
 * access an unscoped row. The audit found that invoices created with a null
 * companyId (because `resolveUserCompany` returned no company) became
 * globally accessible. The new policy is fail-closed: missing tenant
 * ownership is rejected.
 *
 * The legacy permissive behaviour can be re-enabled per call site by passing
 * { allowNullEntity: true } — currently nowhere — for one-off back-compat
 * during a migration. Any new use of that flag should be treated as a code
 * smell.
 */
export async function verifyCompanyAccess(
  entityCompanyId: string | null | undefined,
  userCompanyId: string,
  opts: { allowNullEntity?: boolean } = {},
): Promise<boolean> {
  if (!entityCompanyId) return opts.allowNullEntity === true;
  return entityCompanyId === userCompanyId;
}

// ==================== FILE UPLOAD ====================

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const receiptStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const upload = multer({
  storage: receiptStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'));
    }
  }
});

// ==================== ZOD SCHEMAS ====================

export const expenseSchema = z.object({
  merchant: z.string().min(1),
  amount: z.union([z.string(), z.number()]).transform(val => String(val)),
  category: z.string().min(1),
  note: z.string().optional().nullable(),
  receiptUrl: z.string().optional().nullable(),
  expenseType: z.enum(['spent', 'request']).optional().default('request'),
  attachments: z.array(z.string()).optional().default([]),
  taggedReviewers: z.array(z.string()).optional().default([]),
  userId: z.string().default('1'),
  user: z.string().default('Unknown User'),
});

export const transactionSchema = z.object({
  type: z.string().min(1),
  amount: z.union([z.string(), z.number()]).transform(val => String(val)),
  description: z.string().optional(),
  fee: z.union([z.string(), z.number()]).optional().transform(val => String(val || '0')),
});

export const billSchema = z.object({
  name: z.string().min(2, "Bill name must be at least 2 characters").max(100, "Bill name must be less than 100 characters"),
  provider: z.string().min(2, "Provider must be at least 2 characters").optional().default(''),
  amount: z.union([z.string(), z.number()])
    .transform(val => String(val))
    .refine(val => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0 && num <= 1000000000;
    }, "Amount must be a positive number and less than 1 billion"),
  dueDate: z.string().min(1, "Due date is required").refine(val => {
    const selectedDate = new Date(val);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate >= today;
  }, "Due date cannot be in the past"),
  category: z.string().min(1, "Category is required").optional().default('Other'),
  recurring: z.boolean().optional().default(false),
  frequency: z.enum(['once', 'weekly', 'monthly', 'quarterly', 'yearly']).optional().default('monthly'),
  userId: z.string().optional(),
});

export const budgetSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  limit: z.union([z.string(), z.number()]).transform(val => String(val)),
  period: z.string().optional().default('monthly'),
});

export const cardSchema = z.object({
  name: z.string().min(2, "Card name must be at least 2 characters").max(50),
  limit: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().positive("Spending limit must be greater than 0").max(1000000, "Spending limit too high")
  ).optional(),
  type: z.string().optional().default('Visa'),
  color: z.string().optional().default('indigo'),
  currency: z.string().optional().default('USD'),
});

export const teamMemberSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.string().optional().default('EMPLOYEE'),
  department: z.string().optional().default('General'),
});

export const departmentSchema = z.object({
  name: z.string().min(1, "Department name is required"),
  description: z.string().optional().nullable(),
  headId: z.string().optional().nullable(),
  budget: z.union([z.string(), z.number()]).optional().nullable().transform(val => {
    if (val === null || val === undefined || val === '') return null;
    return typeof val === 'string' ? parseFloat(val) || null : val;
  }),
  color: z.string().optional().default('#6366f1'),
});

export const departmentUpdateSchema = departmentSchema.partial().extend({
  status: z.string().optional(),
  memberCount: z.number().optional(),
});

export const payrollSchema = z.object({
  employeeId: z.string().optional(),
  employeeName: z.string().min(1),
  department: z.string().optional().default('General'),
  country: z.string().optional(),
  currency: z.string().optional(),
  salary: z.union([z.string(), z.number()]).transform(val => String(val)),
  bonus: z.union([z.string(), z.number()]).optional().transform(val => String(val || '0')),
  deductions: z.union([z.string(), z.number()]).optional().transform(val => String(val || '0')),
  deductionBreakdown: z.object({
    tax: z.number().default(0),
    pension: z.number().default(0),
    insurance: z.number().default(0),
    other: z.number().default(0),
  }).optional(),
  payDate: z.string().optional(),
  recurring: z.boolean().optional().default(false),
  frequency: z.enum(['once', 'weekly', 'monthly', 'quarterly', 'yearly']).optional().default('monthly'),
  email: z.string().email().optional().or(z.literal('')),
});

export const invoiceSchema = z.object({
  client: z.string().min(1),
  clientEmail: z.string().email("Invalid email address").optional().or(z.literal('')),
  amount: z.union([z.string(), z.number()]).transform(val => String(val)),
  subtotal: z.union([z.string(), z.number()]).optional().transform(val => val ? String(val) : undefined),
  taxRate: z.union([z.string(), z.number()]).optional().transform(val => val ? String(val) : '0'),
  taxAmount: z.union([z.string(), z.number()]).optional().transform(val => val ? String(val) : '0'),
  currency: z.string().optional().default('USD'),
  notes: z.string().optional(),
  dueDate: z.string().optional(),
  items: z.array(z.object({
    description: z.string().optional(),
    quantity: z.union([z.string(), z.number()]).optional(),
    price: z.union([z.string(), z.number()]).optional(),
    amount: z.union([z.string(), z.number()]).optional(),
  })).optional().default([]),
});

export const vendorSchema = z.object({
  name: z.string().min(2, "Vendor name must be at least 2 characters"),
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  phone: z.string().regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/, "Invalid phone number format").optional().or(z.literal('')),
  address: z.string().optional().default(''),
  category: z.string().optional().default('Other'),
  paymentTerms: z.string().optional(),
  taxId: z.string().optional(),
  notes: z.string().optional(),
});

export const fundingSourceSchema = z.object({
  type: z.enum(['bank_account', 'card', 'mobile_money']).default('bank_account'),
  provider: z.string().min(1),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountName: z.string().optional(),
  routingNumber: z.string().optional(),
  currency: z.string().length(3).default('USD'),
  country: z.string().length(2).default('US'),
  isDefault: z.boolean().optional().default(false),
  last4: z.string().max(4).optional(),
  expiryDate: z.string().optional(),
});

// Update schemas (partial versions)
export const expenseUpdateSchema = expenseSchema.partial().extend({
  status: z.string().optional(),
  rejectionReason: z.string().optional(),
});
export const transactionUpdateSchema = transactionSchema.partial();
export const billUpdateSchema = billSchema.partial().extend({
  status: z.string().optional(),
});
export const budgetUpdateSchema = budgetSchema.partial().extend({
  spent: z.union([z.string(), z.number()]).optional().transform(val => String(val || '0')),
});
export const cardUpdateSchema = cardSchema.partial();
export const teamMemberUpdateSchema = teamMemberSchema.partial().extend({
  status: z.string().optional(),
});
export const payrollUpdateSchema = payrollSchema.partial().extend({
  status: z.enum(['pending', 'processing', 'paid']).optional(),
  netPay: z.union([z.string(), z.number()]).optional().transform(val => String(val || '0')),
  bankName: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  accountName: z.string().optional().nullable(),
  deductionBreakdown: z.object({
    tax: z.number().default(0),
    pension: z.number().default(0),
    insurance: z.number().default(0),
    other: z.number().default(0),
  }).optional(),
});
export const invoiceUpdateSchema = invoiceSchema.partial().extend({
  status: z.string().optional(),
});
export const vendorUpdateSchema = vendorSchema.partial().extend({
  status: z.string().optional(),
  totalPaid: z.union([z.string(), z.number()]).optional().transform(val => String(val || '0')),
  pendingPayments: z.union([z.string(), z.number()]).optional().transform(val => String(val || '0')),
});

// Payout schema used by wallet payout route
export const payoutSchema = z.object({
  amount: z.number().positive(),
  countryCode: z.string().min(2).max(3),
  recipientDetails: z.object({
    accountNumber: z.string().min(1),
    bankCode: z.string().optional(),
    accountName: z.string().optional(),
    bankName: z.string().optional(),
    routingNumber: z.string().optional(),
    sortCode: z.string().optional(),
    iban: z.string().optional(),
    bic: z.string().optional(),
  }),
  reason: z.string().min(1),
  recurring: z.boolean().optional().default(false),
  frequency: z.enum(['once', 'weekly', 'monthly', 'quarterly', 'yearly']).optional().default('once'),
});
