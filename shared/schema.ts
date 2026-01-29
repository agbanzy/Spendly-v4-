import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, decimal, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const UserRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  EDITOR: 'EDITOR',
  EMPLOYEE: 'EMPLOYEE',
  VIEWER: 'VIEWER',
} as const;
export type UserRole = typeof UserRole[keyof typeof UserRole];

export const Permission = {
  VIEW_TREASURY: 'VIEW_TREASURY',
  MANAGE_TREASURY: 'MANAGE_TREASURY',
  CREATE_EXPENSE: 'CREATE_EXPENSE',
  APPROVE_EXPENSE: 'APPROVE_EXPENSE',
  SETTLE_PAYMENT: 'SETTLE_PAYMENT',
  MANAGE_CARDS: 'MANAGE_CARDS',
  MANAGE_TEAM: 'MANAGE_TEAM',
  VIEW_REPORTS: 'VIEW_REPORTS',
  MANAGE_SETTINGS: 'MANAGE_SETTINGS',
} as const;
export type Permission = typeof Permission[keyof typeof Permission];

export const Department = {
  FINANCE: 'Finance',
  ENGINEERING: 'Engineering',
  OPERATIONS: 'Operations',
  SALES: 'Sales',
  HR: 'HR',
  MARKETING: 'Marketing',
  GENERAL: 'General',
} as const;
export type Department = typeof Department[keyof typeof Department];

export const ExpenseStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PAID: 'PAID',
} as const;
export type ExpenseStatus = typeof ExpenseStatus[keyof typeof ExpenseStatus];

export const TransactionType = {
  PAYOUT: 'Payout',
  DEPOSIT: 'Deposit',
  REFUND: 'Refund',
  BILL: 'Bill',
  FEE: 'Fee',
  FUNDING: 'Funding',
} as const;
export type TransactionType = typeof TransactionType[keyof typeof TransactionType];

export const TransactionStatus = {
  COMPLETED: 'Completed',
  PROCESSING: 'Processing',
  FAILED: 'Failed',
  PENDING: 'Pending',
} as const;
export type TransactionStatus = typeof TransactionStatus[keyof typeof TransactionStatus];

export const BillStatus = {
  PAID: 'Paid',
  UNPAID: 'Unpaid',
  OVERDUE: 'Overdue',
} as const;
export type BillStatus = typeof BillStatus[keyof typeof BillStatus];

export const CardStatus = {
  ACTIVE: 'Active',
  FROZEN: 'Frozen',
} as const;
export type CardStatus = typeof CardStatus[keyof typeof CardStatus];

// ==================== DATABASE TABLES ====================

// Users table
export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default('EMPLOYEE'),
  department: text("department").notNull().default('General'),
  avatar: text("avatar"),
  permissions: jsonb("permissions").$type<string[]>().default([]),
});

// Expenses table
export const expenses = pgTable("expenses", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  merchant: text("merchant").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default('USD'),
  date: text("date").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default('PENDING'),
  user: text("user_name").notNull(),
  userId: text("user_id").notNull(),
  department: text("department").notNull().default('General'),
  note: text("note"),
  receiptUrl: text("receipt_url"),
});

// Transactions table
export const transactions = pgTable("transactions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  fee: decimal("fee", { precision: 12, scale: 2 }).notNull().default('0'),
  status: text("status").notNull().default('Pending'),
  date: text("date").notNull(),
  description: text("description").notNull(),
  currency: text("currency").notNull().default('USD'),
});

// Bills table
export const bills = pgTable("bills", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: text("due_date").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default('Unpaid'),
  currency: text("currency").notNull().default('USD'),
  logo: text("logo"),
});

// Budgets table
export const budgets = pgTable("budgets", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(),
  limit: decimal("budget_limit", { precision: 12, scale: 2 }).notNull(),
  spent: decimal("spent", { precision: 12, scale: 2 }).notNull().default('0'),
  currency: text("currency").notNull().default('USD'),
  period: text("period").notNull().default('monthly'),
});

// Virtual Cards table
export const virtualCards = pgTable("virtual_cards", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  last4: text("last4").notNull(),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull().default('0'),
  limit: decimal("card_limit", { precision: 12, scale: 2 }).notNull(),
  type: text("type").notNull().default('Visa'),
  color: text("color").notNull().default('indigo'),
  currency: text("currency").notNull().default('USD'),
  status: text("status").notNull().default('Active'),
});

// Departments table
export const departments = pgTable("departments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  headId: text("head_id"),
  budget: decimal("budget", { precision: 12, scale: 2 }),
  color: text("color").notNull().default('#6366f1'),
  memberCount: integer("member_count").notNull().default(0),
  status: text("status").notNull().default('Active'),
  createdAt: text("created_at").notNull(),
});

// Team Members table
export const teamMembers = pgTable("team_members", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default('EMPLOYEE'),
  department: text("department").notNull().default('General'),
  departmentId: text("department_id"),
  avatar: text("avatar"),
  status: text("status").notNull().default('Active'),
  joinedAt: text("joined_at").notNull(),
  permissions: jsonb("permissions").$type<string[]>().default([]),
});

// Payroll table
export const payrollEntries = pgTable("payroll_entries", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  employeeId: text("employee_id").notNull(),
  employeeName: text("employee_name").notNull(),
  department: text("department").notNull(),
  salary: decimal("salary", { precision: 12, scale: 2 }).notNull(),
  bonus: decimal("bonus", { precision: 12, scale: 2 }).notNull().default('0'),
  deductions: decimal("deductions", { precision: 12, scale: 2 }).notNull().default('0'),
  netPay: decimal("net_pay", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default('pending'),
  payDate: text("pay_date").notNull(),
});

// Invoices table
export const invoices = pgTable("invoices", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull(),
  client: text("client").notNull(),
  clientEmail: text("client_email").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: text("due_date").notNull(),
  issuedDate: text("issued_date").notNull(),
  status: text("status").notNull().default('pending'),
  items: jsonb("items").$type<{ description: string; quantity: number; rate: number }[]>().default([]),
});

// Vendors table
export const vendors = pgTable("vendors", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default('active'),
  totalPaid: decimal("total_paid", { precision: 12, scale: 2 }).notNull().default('0'),
  pendingPayments: decimal("pending_payments", { precision: 12, scale: 2 }).notNull().default('0'),
  lastPayment: text("last_payment"),
});

// Reports table
export const reports = pgTable("reports", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  dateRange: text("date_range").notNull(),
  createdAt: text("created_at").notNull(),
  status: text("status").notNull().default('completed'),
  fileSize: text("file_size").notNull().default('0 KB'),
});

// Card Transactions table
export const cardTransactions = pgTable("card_transactions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  cardId: text("card_id").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  merchant: text("merchant").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default('pending'),
  date: text("date").notNull(),
});

// Virtual Accounts table
export const virtualAccounts = pgTable("virtual_accounts", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  accountNumber: text("account_number").notNull(),
  bankName: text("bank_name").notNull(),
  bankCode: text("bank_code").notNull(),
  currency: text("currency").notNull().default('USD'),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull().default('0'),
  type: text("type").notNull().default('collection'),
  status: text("status").notNull().default('active'),
  createdAt: text("created_at").notNull(),
});

// Company Balances table (single row)
export const companyBalances = pgTable("company_balances", {
  id: integer("id").primaryKey().default(1),
  local: decimal("local", { precision: 12, scale: 2 }).notNull().default('0'),
  usd: decimal("usd", { precision: 12, scale: 2 }).notNull().default('0'),
  escrow: decimal("escrow", { precision: 12, scale: 2 }).notNull().default('0'),
  localCurrency: text("local_currency").notNull().default('USD'),
});

// Company Settings table (single row)
export const companySettings = pgTable("company_settings", {
  id: integer("id").primaryKey().default(1),
  companyName: text("company_name").notNull().default('Spendly'),
  companyEmail: text("company_email").notNull().default('finance@spendly.com'),
  companyPhone: text("company_phone").notNull().default('+1 (555) 123-4567'),
  companyAddress: text("company_address").notNull().default('123 Business Ave, San Francisco, CA 94105'),
  currency: text("currency").notNull().default('USD'),
  timezone: text("timezone").notNull().default('America/Los_Angeles'),
  fiscalYearStart: text("fiscal_year_start").notNull().default('January'),
  dateFormat: text("date_format").notNull().default('MM/DD/YYYY'),
  language: text("language").notNull().default('en'),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  autoApproveBelow: decimal("auto_approve_below", { precision: 12, scale: 2 }).notNull().default('100'),
  requireReceipts: boolean("require_receipts").notNull().default(true),
  expenseCategories: jsonb("expense_categories").$type<string[]>().default(['Software', 'Travel', 'Office', 'Marketing', 'Food', 'Equipment', 'Utilities', 'Legal', 'Other']),
  countryCode: text("country_code").notNull().default('US'),
  region: text("region").notNull().default('North America'),
  paymentProvider: text("payment_provider").notNull().default('stripe'),
  paystackEnabled: boolean("paystack_enabled").notNull().default(true),
  stripeEnabled: boolean("stripe_enabled").notNull().default(true),
});

// KYC Verification Status enum
export const KycStatus = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;
export type KycStatus = typeof KycStatus[keyof typeof KycStatus];

// User Profiles table (extended user data for KYC)
export const userProfiles = pgTable("user_profiles", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  firebaseUid: text("firebase_uid").notNull().unique(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  photoUrl: text("photo_url"),
  phoneNumber: text("phone_number"),
  dateOfBirth: text("date_of_birth"),
  nationality: text("nationality"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  country: text("country"),
  postalCode: text("postal_code"),
  kycStatus: text("kyc_status").notNull().default('not_started'),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  onboardingStep: integer("onboarding_step").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// KYC Submissions table
export const kycSubmissions = pgTable("kyc_submissions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userProfileId: text("user_profile_id").notNull(),
  
  // Personal Information
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  middleName: text("middle_name"),
  dateOfBirth: text("date_of_birth").notNull(),
  gender: text("gender"),
  nationality: text("nationality").notNull(),
  
  // Contact Information
  phoneNumber: text("phone_number").notNull(),
  alternatePhone: text("alternate_phone"),
  
  // Address Information
  addressLine1: text("address_line_1").notNull(),
  addressLine2: text("address_line_2"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  country: text("country").notNull(),
  postalCode: text("postal_code").notNull(),
  
  // Identity Documents
  idType: text("id_type").notNull(), // passport, drivers_license, national_id
  idNumber: text("id_number").notNull(),
  idExpiryDate: text("id_expiry_date"),
  idFrontUrl: text("id_front_url"),
  idBackUrl: text("id_back_url"),
  selfieUrl: text("selfie_url"),
  proofOfAddressUrl: text("proof_of_address_url"),
  
  // Business Information (for business accounts)
  isBusinessAccount: boolean("is_business_account").notNull().default(false),
  businessName: text("business_name"),
  businessType: text("business_type"),
  businessRegistrationNumber: text("business_registration_number"),
  businessAddress: text("business_address"),
  businessDocumentUrl: text("business_document_url"),
  
  // Verification Status
  status: text("status").notNull().default('pending_review'),
  reviewNotes: text("review_notes"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  
  // Timestamps
  submittedAt: text("submitted_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ==================== INSERT SCHEMAS ====================

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  email: true,
  role: true,
  department: true,
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true });
export const insertBillSchema = createInsertSchema(bills).omit({ id: true });
export const insertBudgetSchema = createInsertSchema(budgets).omit({ id: true });
export const insertVirtualCardSchema = createInsertSchema(virtualCards).omit({ id: true });
export const insertDepartmentSchema = createInsertSchema(departments).omit({ id: true });
export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({ id: true });
export const insertPayrollSchema = createInsertSchema(payrollEntries).omit({ id: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true });
export const insertVendorSchema = createInsertSchema(vendors).omit({ id: true });
export const insertReportSchema = createInsertSchema(reports).omit({ id: true });
export const insertCardTransactionSchema = createInsertSchema(cardTransactions).omit({ id: true });
export const insertVirtualAccountSchema = createInsertSchema(virtualAccounts).omit({ id: true });
export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({ id: true });
export const insertKycSubmissionSchema = createInsertSchema(kycSubmissions).omit({ id: true });

// ==================== TYPES ====================

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type InsertBill = z.infer<typeof insertBillSchema>;
export type Bill = typeof bills.$inferSelect;

export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type Budget = typeof budgets.$inferSelect;

export type InsertVirtualCard = z.infer<typeof insertVirtualCardSchema>;
export type VirtualCard = typeof virtualCards.$inferSelect;

export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departments.$inferSelect;

export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;

export type InsertPayroll = z.infer<typeof insertPayrollSchema>;
export type PayrollEntry = typeof payrollEntries.$inferSelect;

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendors.$inferSelect;

export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reports.$inferSelect;

export type InsertCardTransaction = z.infer<typeof insertCardTransactionSchema>;
export type CardTransaction = typeof cardTransactions.$inferSelect;

export type InsertVirtualAccount = z.infer<typeof insertVirtualAccountSchema>;
export type VirtualAccount = typeof virtualAccounts.$inferSelect;

export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;

export type InsertKycSubmission = z.infer<typeof insertKycSubmissionSchema>;
export type KycSubmission = typeof kycSubmissions.$inferSelect;

export type CompanyBalances = typeof companyBalances.$inferSelect;
export type CompanySettings = typeof companySettings.$inferSelect;

// Legacy interface for AI Insights (computed, not stored)
export interface AIInsight {
  title: string;
  description: string;
  type: 'saving' | 'warning' | 'info';
}

// ==================== NOTIFICATIONS TABLES ====================

// Notification types enum
export const NotificationType = {
  EXPENSE_SUBMITTED: 'expense_submitted',
  EXPENSE_APPROVED: 'expense_approved',
  EXPENSE_REJECTED: 'expense_rejected',
  PAYMENT_RECEIVED: 'payment_received',
  PAYMENT_SENT: 'payment_sent',
  BILL_DUE: 'bill_due',
  BILL_OVERDUE: 'bill_overdue',
  BUDGET_WARNING: 'budget_warning',
  BUDGET_EXCEEDED: 'budget_exceeded',
  KYC_APPROVED: 'kyc_approved',
  KYC_REJECTED: 'kyc_rejected',
  CARD_TRANSACTION: 'card_transaction',
  TEAM_INVITE: 'team_invite',
  SYSTEM_ALERT: 'system_alert',
} as const;
export type NotificationType = typeof NotificationType[keyof typeof NotificationType];

export const NotificationChannel = {
  IN_APP: 'in_app',
  EMAIL: 'email',
  SMS: 'sms',
  PUSH: 'push',
} as const;
export type NotificationChannel = typeof NotificationChannel[keyof typeof NotificationChannel];

// Notifications table
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>(),
  channels: jsonb("channels").$type<string[]>().default(['in_app']),
  read: boolean("read").notNull().default(false),
  readAt: text("read_at"),
  emailSent: boolean("email_sent").default(false),
  smsSent: boolean("sms_sent").default(false),
  pushSent: boolean("push_sent").default(false),
  createdAt: text("created_at").notNull(),
});

// Notification settings per user
export const notificationSettings = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  smsEnabled: boolean("sms_enabled").notNull().default(false),
  pushEnabled: boolean("push_enabled").notNull().default(true),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  email: text("email"),
  phone: text("phone"),
  pushToken: text("push_token"),
  expenseNotifications: boolean("expense_notifications").notNull().default(true),
  paymentNotifications: boolean("payment_notifications").notNull().default(true),
  billNotifications: boolean("bill_notifications").notNull().default(true),
  budgetNotifications: boolean("budget_notifications").notNull().default(true),
  securityNotifications: boolean("security_notifications").notNull().default(true),
  marketingNotifications: boolean("marketing_notifications").notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Push notification tokens
export const pushTokens = pgTable("push_tokens", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  token: text("token").notNull(),
  platform: text("platform").notNull(), // 'ios', 'android', 'web'
  deviceId: text("device_id"),
  active: boolean("active").notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Insert schemas for notifications
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true });
export const insertNotificationSettingsSchema = createInsertSchema(notificationSettings).omit({ id: true });
export const insertPushTokenSchema = createInsertSchema(pushTokens).omit({ id: true });

// Types for notifications
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export type InsertNotificationSettings = z.infer<typeof insertNotificationSettingsSchema>;
export type NotificationSettings = typeof notificationSettings.$inferSelect;

export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;
export type PushToken = typeof pushTokens.$inferSelect;

// Category icons mapping
export const categoryIcons: Record<string, string> = {
  'Software': 'code',
  'Travel': 'plane',
  'Office': 'building',
  'Marketing': 'megaphone',
  'Food': 'utensils',
  'Equipment': 'monitor',
  'Utilities': 'zap',
  'Legal': 'scale',
  'Other': 'folder',
};
