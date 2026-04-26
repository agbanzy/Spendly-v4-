import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, jsonb, decimal, serial, index } from "drizzle-orm/pg-core";
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
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  PAID: 'PAID',
} as const;
export type ExpenseStatus = typeof ExpenseStatus[keyof typeof ExpenseStatus];

export const TransactionType = {
  PAYOUT: 'payout',
  DEPOSIT: 'deposit',
  REFUND: 'refund',
  BILL: 'bill',
  FEE: 'fee',
  FUNDING: 'funding',
  TRANSFER: 'transfer',
  WITHDRAWAL: 'withdrawal',
} as const;
export type TransactionType = typeof TransactionType[keyof typeof TransactionType];

export const TransactionStatus = {
  COMPLETED: 'completed',
  PROCESSING: 'processing',
  FAILED: 'failed',
  PENDING: 'pending',
  REVERSED: 'reversed',
} as const;
export type TransactionStatus = typeof TransactionStatus[keyof typeof TransactionStatus];

export const BillStatus = {
  PAID: 'paid',
  UNPAID: 'unpaid',
  OVERDUE: 'overdue',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CHANGES_REQUESTED: 'changes_requested',
} as const;
export type BillStatus = typeof BillStatus[keyof typeof BillStatus];

export const CardStatus = {
  ACTIVE: 'active',
  FROZEN: 'frozen',
  CANCELLED: 'cancelled',
} as const;
export type CardStatus = typeof CardStatus[keyof typeof CardStatus];

export const InvitationStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
} as const;
export type InvitationStatus = typeof InvitationStatus[keyof typeof InvitationStatus];

export const MembershipStatus = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  REMOVED: 'removed',
} as const;
export type MembershipStatus = typeof MembershipStatus[keyof typeof MembershipStatus];

// ==================== DATABASE TABLES ====================

// Companies table — enriched with fields from companySettings and organizationSettings
export const companies = pgTable("companies", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: text("owner_id"),
  logo: text("logo"),
  industry: text("industry"),
  size: text("size"),
  website: text("website"),
  country: text("country").default('US'),
  currency: text("currency").default('USD'),
  status: text("status").notNull().default('active'),
  // Contact & address (from companySettings/organizationSettings)
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  // Operational settings (from companySettings)
  timezone: text("timezone").default('America/Los_Angeles'),
  fiscalYearStart: text("fiscal_year_start").default('January'),
  dateFormat: text("date_format").default('MM/DD/YYYY'),
  language: text("language").default('en'),
  taxId: text("tax_id"),
  registrationNumber: text("registration_number"),
  // Branding (from companySettings)
  tagline: text("tagline"),
  primaryColor: text("primary_color").default('#4f46e5'),
  secondaryColor: text("secondary_color").default('#10b981'),
  // Invoice settings (from companySettings)
  invoicePrefix: text("invoice_prefix").default('INV'),
  invoiceFooter: text("invoice_footer"),
  invoiceTerms: text("invoice_terms").default('Payment due within 30 days'),
  showLogoOnInvoice: boolean("show_logo_on_invoice").default(true),
  showLogoOnReceipts: boolean("show_logo_on_receipts").default(true),
  // Expense settings (from companySettings)
  autoApproveBelow: decimal("auto_approve_below", { precision: 12, scale: 2 }).default('100'),
  requireReceipts: boolean("require_receipts").default(true),
  expenseCategories: jsonb("expense_categories").$type<string[]>().default(['Software', 'Travel', 'Office', 'Marketing', 'Food', 'Equipment', 'Utilities', 'Legal', 'Other']),
  // Payment settings (from companySettings)
  countryCode: text("country_code").default('US'),
  region: text("region").default('North America'),
  paymentProvider: text("payment_provider").default('stripe'),
  paystackEnabled: boolean("paystack_enabled").default(true),
  stripeEnabled: boolean("stripe_enabled").default(true),
  // Feature toggles (from companySettings)
  notificationsEnabled: boolean("notifications_enabled").default(true),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
});

// Company Members table - links users to companies with roles
export const companyMembers = pgTable("company_members", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  userId: text("user_id"),
  email: text("email").notNull(),
  role: text("role").notNull().default('EMPLOYEE'),
  status: text("status").notNull().default('active'),
  invitedAt: text("invited_at").notNull().default(sql`now()`),
  joinedAt: text("joined_at"),
}, (t) => [
  index("company_members_company_id_idx").on(t.companyId),
  index("company_members_user_id_idx").on(t.userId),
  index("company_members_email_idx").on(t.email),
]);

// Company Invitations table - token-based invite system
export const companyInvitations = pgTable("company_invitations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  email: text("email").notNull(),
  role: text("role").notNull().default('EMPLOYEE'),
  department: text("department"),
  token: text("token").notNull().unique(),
  invitedBy: text("invited_by"),
  invitedByName: text("invited_by_name"),
  status: text("status").notNull().default('pending'),
  expiresAt: text("expires_at").notNull(),
  acceptedAt: text("accepted_at"),
  createdAt: text("created_at").notNull().default(sql`now()`),
}, (t) => [
  index("company_invitations_company_id_idx").on(t.companyId),
]);

// @deprecated — Legacy users table. Auth moved to Cognito; user data lives in userProfiles.
// Kept for backward compatibility. Plan removal after confirming zero active usage.
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
  companyId: text("company_id"),
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
  companyId: text("company_id").references(() => companies.id, { onDelete: 'set null' }),
  department: text("department").notNull().default('General'), // Cached display value
  departmentId: text("department_id").default(sql`null`).references(() => departments.id, { onDelete: 'set null' }),
  note: text("note"),
  receiptUrl: text("receipt_url"),
  expenseType: text("expense_type").notNull().default('request'),
  attachments: jsonb("attachments").$type<string[]>().default([]),
  taggedReviewers: jsonb("tagged_reviewers").$type<string[]>().default([]),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  rejectedBy: text("rejected_by"),
  rejectedAt: text("rejected_at"),
  approvalComments: text("approval_comments"),
  reviewerComments: text("reviewer_comments"),
  vendorId: text("vendor_id").references(() => vendors.id, { onDelete: 'set null' }),
  payoutStatus: text("payout_status").default('not_started'),
  payoutId: text("payout_id"),
  // LU-004 / AUD-BE-014: soft-delete for audit-trail preservation
  deletedAt: text("deleted_at").default(sql`null`),
}, (t) => [
  index("expenses_user_id_idx").on(t.userId),
  index("expenses_company_id_idx").on(t.companyId),
  index("expenses_date_idx").on(t.date),
  index("expenses_status_idx").on(t.status),
  index("expenses_company_id_status_idx").on(t.companyId, t.status),
  index("expenses_department_id_idx").on(t.departmentId),
  index("expenses_vendor_id_idx").on(t.vendorId),
]);

// Transactions table — external-facing transaction records
export const transactions = pgTable("transactions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  fee: decimal("fee", { precision: 12, scale: 2 }).notNull().default('0'),
  status: text("status").notNull().default('pending'),
  date: text("date").notNull(),
  description: text("description").notNull(),
  currency: text("currency").notNull().default('USD'),
  userId: text("user_id").default(sql`null`),
  reference: text("reference").default(sql`null`),
  // NOTE: walletTransactionId FK to walletTransactions.id is enforced at the database level via migration
  // (walletTransactions table is defined after transactions, Drizzle doesn't support forward references)
  walletTransactionId: text("wallet_transaction_id").default(sql`null`),
  companyId: text("company_id").default(sql`null`).references(() => companies.id, { onDelete: 'set null' }),
  // LU-004 / AUD-BE-014: soft-delete for audit-trail preservation
  deletedAt: text("deleted_at").default(sql`null`),
}, (t) => [
  index("transactions_date_idx").on(t.date),
  index("transactions_status_idx").on(t.status),
  index("transactions_type_idx").on(t.type),
  index("transactions_company_id_idx").on(t.companyId),
  index("transactions_reference_idx").on(t.reference),
  index("transactions_user_id_idx").on(t.userId),
  index("transactions_wallet_transaction_id_idx").on(t.walletTransactionId),
]);

// Bills table
export const bills = pgTable("bills", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: text("due_date").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default('unpaid'),
  currency: text("currency").notNull().default('USD'),
  logo: text("logo"),
  userId: varchar("user_id", { length: 36 }),
  companyId: text("company_id").references(() => companies.id, { onDelete: 'set null' }),
  recurring: boolean("recurring").default(false),
  frequency: text("frequency").default('monthly'),
  // Bill payment tracking fields
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }),
  paidDate: text("paid_date"),
  paidBy: text("paid_by"),
  paymentMethod: text("payment_method"),
  paymentReference: text("payment_reference"),
  walletTransactionId: text("wallet_transaction_id").default(sql`null`),
  // Approval tracking
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  reviewerComments: text("reviewer_comments"),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
}, (t) => [
  index("bills_user_id_idx").on(t.userId),
  index("bills_company_id_idx").on(t.companyId),
  index("bills_due_date_idx").on(t.dueDate),
  index("bills_status_idx").on(t.status),
]);

// Budgets table
export const budgets = pgTable("budgets", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(),
  limit: decimal("budget_limit", { precision: 12, scale: 2 }).notNull(),
  spent: decimal("spent", { precision: 12, scale: 2 }).notNull().default('0'),
  currency: text("currency").notNull().default('USD'),
  period: text("period").notNull().default('monthly'),
  companyId: text("company_id").references(() => companies.id, { onDelete: 'cascade' }),
}, (t) => [
  index("budgets_company_id_idx").on(t.companyId),
]);

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
  status: text("status").notNull().default('active'),
  stripeCardId: text("stripe_card_id"),
  stripeCardholderId: text("stripe_cardholder_id"),
  companyId: text("company_id").references(() => companies.id, { onDelete: 'set null' }),
}, (t) => [
  index("virtual_cards_stripe_card_id_idx").on(t.stripeCardId),
  index("virtual_cards_company_id_idx").on(t.companyId),
]);

// Departments table
export const departments = pgTable("departments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  headId: text("head_id"),
  budget: decimal("budget", { precision: 12, scale: 2 }),
  color: text("color").notNull().default('#6366f1'),
  memberCount: integer("member_count").notNull().default(0),
  status: text("status").notNull().default('active'),
  companyId: text("company_id").references(() => companies.id, { onDelete: 'cascade' }),
  createdAt: text("created_at").notNull(),
}, (t) => [
  index("departments_company_id_idx").on(t.companyId),
]);

// Team Members table
export const teamMembers = pgTable("team_members", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default('EMPLOYEE'),
  department: text("department").notNull().default('General'),
  departmentId: text("department_id").references(() => departments.id, { onDelete: 'set null' }),
  avatar: text("avatar"),
  status: text("status").notNull().default('active'),
  companyId: text("company_id").references(() => companies.id, { onDelete: 'cascade' }),
  userId: text("user_id"),
  joinedAt: text("joined_at").notNull(),
  permissions: jsonb("permissions").$type<string[]>().default([]),
}, (t) => [
  index("team_members_company_id_idx").on(t.companyId),
]);

// Payroll table — employeeName/department/bank fields are intentional snapshots for audit trail
export const payrollEntries = pgTable("payroll_entries", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  employeeId: text("employee_id").notNull(),
  employeeName: text("employee_name").notNull(),
  department: text("department").notNull(), // Snapshot at time of payment
  departmentId: text("department_id").default(sql`null`).references(() => departments.id, { onDelete: 'set null' }),
  country: text("country"),
  currency: text("currency").default('USD'),
  salary: decimal("salary", { precision: 12, scale: 2 }).notNull(),
  bonus: decimal("bonus", { precision: 12, scale: 2 }).notNull().default('0'),
  deductions: decimal("deductions", { precision: 12, scale: 2 }).notNull().default('0'),
  deductionBreakdown: jsonb("deduction_breakdown").$type<{ tax: number; pension: number; insurance: number; other: number }>(),
  netPay: decimal("net_pay", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default('pending'),
  payDate: text("pay_date").notNull(),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  accountName: text("account_name"),
  recurring: boolean("recurring").default(false),
  frequency: text("frequency").default('monthly'),
  nextPayDate: text("next_pay_date"),
  companyId: text("company_id").references(() => companies.id, { onDelete: 'set null' }),
  email: text("email"),
  payoutDestinationId: text("payout_destination_id"),
}, (t) => [
  index("payroll_entries_company_id_idx").on(t.companyId),
  index("payroll_entries_employee_id_idx").on(t.employeeId),
]);

// Invoices table
export const invoices = pgTable("invoices", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull(),
  client: text("client").notNull(),
  clientEmail: text("client_email").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default('0'),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).default('0'),
  currency: text("currency").default('USD'),
  notes: text("notes"),
  companyId: text("company_id").references(() => companies.id, { onDelete: 'set null' }),
  dueDate: text("due_date").notNull(),
  issuedDate: text("issued_date").notNull(),
  status: text("status").notNull().default('pending'),
  items: jsonb("items").$type<{ description: string; quantity: number; rate: number }[]>().default([]),
  // LU-004 / AUD-BE-014: soft-delete for audit-trail preservation
  deletedAt: text("deleted_at").default(sql`null`),
}, (t) => [
  index("invoices_company_id_idx").on(t.companyId),
  index("invoices_status_idx").on(t.status),
]);

// Vendors table
export const vendors = pgTable("vendors", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  category: text("category").notNull(),
  currency: text("currency").default('USD'),
  status: text("status").notNull().default('active'),
  totalPaid: decimal("total_paid", { precision: 12, scale: 2 }).notNull().default('0'),
  pendingPayments: decimal("pending_payments", { precision: 12, scale: 2 }).notNull().default('0'),
  lastPayment: text("last_payment"),
  companyId: text("company_id").references(() => companies.id, { onDelete: 'set null' }),
  paymentTerms: text("payment_terms"),
  taxId: text("tax_id"),
  notes: text("notes"),
}, (t) => [
  index("vendors_company_id_idx").on(t.companyId),
]);

// Reports table
export const reports = pgTable("reports", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  dateRange: text("date_range").notNull(),
  createdAt: text("created_at").notNull(),
  status: text("status").notNull().default('completed'),
  fileSize: text("file_size").notNull().default('0 KB'),
  companyId: text("company_id").references(() => companies.id, { onDelete: 'cascade' }),
}, (t) => [
  index("reports_company_id_idx").on(t.companyId),
]);

// Card Transactions table
export const cardTransactions = pgTable("card_transactions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  cardId: text("card_id").notNull().references(() => virtualCards.id, { onDelete: 'cascade' }),
  companyId: text("company_id").references(() => companies.id, { onDelete: 'set null' }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default('USD'),
  merchant: text("merchant").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default('pending'),
  date: text("date").notNull(),
}, (t) => [
  index("card_transactions_card_id_idx").on(t.cardId),
  index("card_transactions_date_idx").on(t.date),
  index("card_transactions_company_id_idx").on(t.companyId),
]);

// Virtual Accounts table
export const virtualAccounts = pgTable("virtual_accounts", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id"),
  companyId: text("company_id").references(() => companies.id, { onDelete: 'set null' }),
  name: text("name").notNull(),
  accountNumber: text("account_number").notNull(),
  accountName: text("account_name"),
  bankName: text("bank_name").notNull(),
  bankCode: text("bank_code").notNull(),
  routingNumber: text("routing_number"),
  swiftCode: text("swift_code"),
  country: text("country").default('US'),
  currency: text("currency").notNull().default('USD'),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull().default('0'),
  type: text("type").notNull().default('collection'),
  status: text("status").notNull().default('active'),
  provider: text("provider").notNull().default('stripe'),
  providerAccountId: text("provider_account_id"),
  providerCustomerCode: text("provider_customer_code"),
  createdAt: text("created_at").notNull(),
}, (t) => [
  index("virtual_accounts_user_id_idx").on(t.userId),
  index("virtual_accounts_company_id_idx").on(t.companyId),
  index("virtual_accounts_status_idx").on(t.status),
]);

// Company Balances table — keyed by companyId for multi-tenant support
export const companyBalances = pgTable("company_balances", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: text("company_id").notNull().unique().references(() => companies.id, { onDelete: 'cascade' }),
  local: decimal("local", { precision: 12, scale: 2 }).notNull().default('0'),
  usd: decimal("usd", { precision: 12, scale: 2 }).notNull().default('0'),
  escrow: decimal("escrow", { precision: 12, scale: 2 }).notNull().default('0'),
  localCurrency: text("local_currency").notNull().default('USD'),
}, (t) => [
  index("company_balances_company_id_idx").on(t.companyId),
]);

// Company Settings table (single row)
export const companySettings = pgTable("company_settings", {
  id: integer("id").primaryKey().default(1),
  companyName: text("company_name").notNull().default(''),
  companyEmail: text("company_email").notNull().default(''),
  companyPhone: text("company_phone").notNull().default(''),
  companyAddress: text("company_address").notNull().default(''),
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
  companyLogo: text("company_logo"),
  companyTagline: text("company_tagline"),
  primaryColor: text("primary_color").default('#4f46e5'),
  secondaryColor: text("secondary_color").default('#10b981'),
  industry: text("industry"),
  companySize: text("company_size"),
  taxId: text("tax_id"),
  registrationNumber: text("registration_number"),
  website: text("website"),
  invoicePrefix: text("invoice_prefix").default('INV'),
  invoiceFooter: text("invoice_footer"),
  invoiceTerms: text("invoice_terms").default('Payment due within 30 days'),
  showLogoOnInvoice: boolean("show_logo_on_invoice").notNull().default(true),
  showLogoOnReceipts: boolean("show_logo_on_receipts").notNull().default(true),
  subscriptionStatus: text("subscription_status").notNull().default('trialing'),
  trialEndsAt: text("trial_ends_at"),
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
  cognitoSub: text("cognito_sub").notNull().unique(),
  userId: text("user_id"),
  email: text("email").notNull(),
  companyId: text("company_id").references(() => companies.id, { onDelete: 'set null' }),
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
  transactionPinHash: text("transaction_pin_hash"),
  transactionPinEnabled: boolean("transaction_pin_enabled").notNull().default(false),
  // @deprecated — Use notificationSettings table instead. Will be removed in Phase 6.
  emailNotifications: boolean("email_notifications").notNull().default(true),
  pushNotifications: boolean("push_notifications").notNull().default(true),
  smsNotifications: boolean("sms_notifications").notNull().default(false),
  expenseAlerts: boolean("expense_alerts").notNull().default(true),
  budgetWarnings: boolean("budget_warnings").notNull().default(true),
  paymentReminders: boolean("payment_reminders").notNull().default(true),
  weeklyDigest: boolean("weekly_digest").notNull().default(true),
  // User Preferences
  preferredCurrency: text("preferred_currency").default('USD'),
  preferredLanguage: text("preferred_language").default('en'),
  preferredTimezone: text("preferred_timezone").default('America/Los_Angeles'),
  preferredDateFormat: text("preferred_date_format").default('MM/DD/YYYY'),
  darkMode: boolean("dark_mode").notNull().default(false),
  // Security Settings
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  twoFactorSecret: text("two_factor_secret"),
  sessionTimeout: integer("session_timeout").default(30), // minutes
  lastLoginAt: text("last_login_at"),
  lastLoginIp: text("last_login_ip"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("user_profiles_cognito_sub_idx").on(t.cognitoSub),
  index("user_profiles_email_idx").on(t.email),
  index("user_profiles_company_id_idx").on(t.companyId),
  index("user_profiles_kyc_status_idx").on(t.kycStatus),
]);

// KYC Submissions table
export const kycSubmissions = pgTable("kyc_submissions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userProfileId: text("user_profile_id").notNull().references(() => userProfiles.id, { onDelete: 'cascade' }),
  
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
}, (t) => [
  index("kyc_submissions_user_profile_id_idx").on(t.userProfileId),
  index("kyc_submissions_status_idx").on(t.status),
]);

// Audit Logs table
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  details: jsonb("details").$type<Record<string, any>>().default({}),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  companyId: text("company_id").references(() => companies.id, { onDelete: 'set null' }),
  createdAt: text("created_at").notNull().default(sql`now()`),
}, (t) => [
  index("audit_logs_user_id_idx").on(t.userId),
  index("audit_logs_entity_type_entity_id_idx").on(t.entityType, t.entityId),
  index("audit_logs_created_at_idx").on(t.createdAt),
]);

// Pending destructive actions — two-admin approval queue for irreversible operations.
// LU-008 / AUD-BE-003 — replaces the single-admin /api/admin/purge-database endpoint.
export const pendingDestructiveActions = pgTable("pending_destructive_actions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").notNull(),                 // e.g. 'purge_database'
  initiatedBy: text("initiated_by").notNull(),      // cognitoSub of admin 1
  initiatedAt: text("initiated_at").notNull().default(sql`now()`),
  expiresAt: text("expires_at").notNull(),
  approvedBy: text("approved_by"),                  // cognitoSub of admin 2 (must differ from initiatedBy)
  approvedAt: text("approved_at"),
  executedAt: text("executed_at"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
}, (t) => [
  index("pending_destructive_actions_action_status_idx").on(t.action, t.executedAt, t.expiresAt),
]);

// Organization Settings table
export const organizationSettings = pgTable("organization_settings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().default('My Organization'),
  logo: text("logo"),
  website: text("website"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  country: text("country").default('US'),
  postalCode: text("postal_code"),
  taxId: text("tax_id"),
  currency: text("currency").default('USD'),
  timezone: text("timezone").default('UTC'),
  fiscalYearStart: text("fiscal_year_start").default('January'),
  industry: text("industry"),
  size: text("size"),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
});

// System Settings table — also absorbs adminSettings key-value pairs
export const systemSettings = pgTable("system_settings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value"),
  valueType: text("value_type").default('string'),
  category: text("category").notNull().default('general'),
  description: text("description"),
  isPublic: boolean("is_public").default(false),
  updatedBy: text("updated_by"),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
});

// Role Permissions table
export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  role: text("role").notNull(),
  permissions: jsonb("permissions").$type<string[]>().default([]),
  description: text("description"),
  isSystem: boolean("is_system").default(false),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
});

// ==================== WALLET & FINANCIAL TABLES ====================

// Wallets table - for user/company wallets
export const wallets = pgTable("wallets", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  companyId: text("company_id").references(() => companies.id, { onDelete: 'set null' }),
  type: text("type").notNull().default('personal'),
  currency: text("currency").notNull().default('USD'),
  balance: decimal("balance", { precision: 16, scale: 2 }).notNull().default('0'),
  availableBalance: decimal("available_balance", { precision: 16, scale: 2 }).notNull().default('0'),
  pendingBalance: decimal("pending_balance", { precision: 16, scale: 2 }).notNull().default('0'),
  status: text("status").notNull().default('active'),
  virtualAccountId: text("virtual_account_id").references(() => virtualAccounts.id, { onDelete: 'set null' }),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
}, (t) => [
  index("wallets_user_id_idx").on(t.userId),
  index("wallets_company_id_idx").on(t.companyId),
]);

// Wallet Transactions table - ledger for all wallet credits/debits
export const walletTransactions = pgTable("wallet_transactions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  walletId: text("wallet_id").notNull().references(() => wallets.id, { onDelete: 'cascade' }),
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 16, scale: 2 }).notNull(),
  currency: text("currency").notNull().default('USD'),
  direction: text("direction").notNull(),
  balanceBefore: decimal("balance_before", { precision: 16, scale: 2 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 16, scale: 2 }).notNull(),
  description: text("description"),
  reference: text("reference").notNull(),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: text("related_entity_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  status: text("status").notNull().default('completed'),
  reversedAt: text("reversed_at"),
  reversedByTxId: text("reversed_by_tx_id"),
  // LU-004 / AUD-BE-014: soft-delete for audit-trail preservation
  deletedAt: text("deleted_at").default(sql`null`),
  createdAt: text("created_at").notNull().default(sql`now()`),
}, (t) => [
  index("wallet_transactions_wallet_id_idx").on(t.walletId),
  index("wallet_transactions_created_at_idx").on(t.createdAt),
]);

// Exchange Rates table - for currency conversion
export const exchangeRates = pgTable("exchange_rates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  baseCurrency: text("base_currency").notNull(),
  targetCurrency: text("target_currency").notNull(),
  rate: decimal("rate", { precision: 16, scale: 6 }).notNull(),
  source: text("source").notNull().default('manual'),
  validFrom: text("valid_from").notNull(),
  validTo: text("valid_to"),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

// Exchange Rate Settings table - admin configurable markup/spread
export const exchangeRateSettings = pgTable("exchange_rate_settings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  buyMarkupPercent: decimal("buy_markup_percent", { precision: 5, scale: 2 }).notNull().default('10.00'),
  sellMarkupPercent: decimal("sell_markup_percent", { precision: 5, scale: 2 }).notNull().default('10.00'),
  lastUpdatedBy: text("last_updated_by"),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

// Payout Destinations table - bank accounts/virtual accounts for payouts
export const payoutDestinations = pgTable("payout_destinations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id"),
  vendorId: text("vendor_id").references(() => vendors.id, { onDelete: 'set null' }),
  type: text("type").notNull().default('bank_account'),
  provider: text("provider").notNull(),
  bankName: text("bank_name"),
  bankCode: text("bank_code"),
  accountNumber: text("account_number"),
  accountName: text("account_name"),
  routingNumber: text("routing_number"),
  swiftCode: text("swift_code"),
  currency: text("currency").notNull().default('USD'),
  country: text("country").notNull().default('US'),
  isDefault: boolean("is_default").default(false),
  isVerified: boolean("is_verified").default(false),
  providerRecipientId: text("provider_recipient_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
}, (t) => [
  index("payout_destinations_user_id_idx").on(t.userId),
  index("payout_destinations_vendor_id_idx").on(t.vendorId),
]);

// Payouts table - track all payouts (expense reimbursements, payroll, vendor payments)
export const payouts = pgTable("payouts", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 16, scale: 2 }).notNull(),
  currency: text("currency").notNull().default('USD'),
  status: text("status").notNull().default('pending'),
  recipientType: text("recipient_type").notNull(),
  recipientId: text("recipient_id").notNull(),
  recipientName: text("recipient_name"),
  destinationId: text("destination_id").references(() => payoutDestinations.id, { onDelete: 'set null' }),
  provider: text("provider").notNull(),
  providerTransferId: text("provider_transfer_id"),
  providerReference: text("provider_reference"),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: text("related_entity_id"),
  feeAmount: decimal("fee_amount", { precision: 12, scale: 2 }).default('0'),
  feeCurrency: text("fee_currency").default('USD'),
  exchangeRate: decimal("exchange_rate", { precision: 16, scale: 6 }),
  failureReason: text("failure_reason"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  companyId: text("company_id").default(sql`null`).references(() => companies.id, { onDelete: 'set null' }),
  initiatedBy: text("initiated_by"),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  firstApprovedBy: text("first_approved_by"),
  firstApprovedAt: text("first_approved_at"),
  approvalStatus: text("approval_status").default('none'),
  processedAt: text("processed_at"),
  recurring: boolean("recurring").default(false),
  frequency: text("frequency").default('monthly'),
  nextRunDate: text("next_run_date"),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
}, (t) => [
  index("payouts_status_idx").on(t.status),
  index("payouts_recipient_id_idx").on(t.recipientId),
  index("payouts_created_at_idx").on(t.createdAt),
]);

export const scheduledPayments = pgTable("scheduled_payments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  amount: decimal("amount", { precision: 16, scale: 2 }).notNull(),
  currency: text("currency").notNull().default('USD'),
  frequency: text("frequency").notNull().default('monthly'),
  nextRunDate: text("next_run_date").notNull(),
  lastRunDate: text("last_run_date"),
  status: text("status").notNull().default('active'),
  recipientType: text("recipient_type"),
  recipientId: text("recipient_id"),
  recipientName: text("recipient_name"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  companyId: text("company_id").references(() => companies.id, { onDelete: 'set null' }),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
}, (t) => [
  index("scheduled_payments_company_id_idx").on(t.companyId),
  index("scheduled_payments_status_idx").on(t.status),
  index("scheduled_payments_next_run_date_idx").on(t.nextRunDate),
]);

// Funding Sources table - methods users can use to fund their wallet
export const fundingSources = pgTable("funding_sources", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  cardLast4: text("card_last4"),
  cardBrand: text("card_brand"),
  bankName: text("bank_name"),
  accountLast4: text("account_last4"),
  providerSourceId: text("provider_source_id"),
  isDefault: boolean("is_default").default(false),
  isVerified: boolean("is_verified").default(false),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: text("created_at").notNull().default(sql`now()`),
}, (t) => [
  index("funding_sources_user_id_idx").on(t.userId),
]);

// Admin Settings table - for single admin enforcement and other admin configs
export const adminSettings = pgTable("admin_settings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value"),
  valueType: text("value_type").notNull().default('string'),
  description: text("description"),
  updatedBy: text("updated_by"),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
});

// Subscription Status enum
export const SubscriptionStatus = {
  TRIALING: 'trialing',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  EXPIRED: 'expired',
} as const;
export type SubscriptionStatus = typeof SubscriptionStatus[keyof typeof SubscriptionStatus];

// Subscriptions table
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  status: text("status").notNull().default('trialing'),
  provider: text("provider").notNull().default('stripe'), // stripe | paystack
  providerSubscriptionId: text("provider_subscription_id"),
  providerCustomerId: text("provider_customer_id"),
  providerPlanId: text("provider_plan_id"),
  trialStartDate: text("trial_start_date"),
  trialEndDate: text("trial_end_date"),
  currentPeriodStart: text("current_period_start"),
  currentPeriodEnd: text("current_period_end"),
  canceledAt: text("canceled_at"),
  quantity: integer("quantity").notNull().default(1), // seat count
  unitPrice: integer("unit_price").notNull().default(500), // $5.00 in cents
  currency: text("currency").notNull().default('USD'),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
}, (t) => [
  index("subscriptions_company_id_idx").on(t.companyId),
]);

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
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true });
export const insertOrganizationSettingsSchema = createInsertSchema(organizationSettings).omit({ id: true });
export const insertSystemSettingsSchema = createInsertSchema(systemSettings).omit({ id: true });
export const insertRolePermissionsSchema = createInsertSchema(rolePermissions).omit({ id: true });
export const insertWalletSchema = createInsertSchema(wallets).omit({ id: true });
export const insertWalletTransactionSchema = createInsertSchema(walletTransactions).omit({ id: true });
export const insertExchangeRateSchema = createInsertSchema(exchangeRates).omit({ id: true });
export const insertExchangeRateSettingsSchema = createInsertSchema(exchangeRateSettings).omit({ id: true });
export const insertPayoutDestinationSchema = createInsertSchema(payoutDestinations).omit({ id: true });
export const insertPayoutSchema = createInsertSchema(payouts).omit({ id: true });
export const insertScheduledPaymentSchema = createInsertSchema(scheduledPayments).omit({ id: true });
export const insertFundingSourceSchema = createInsertSchema(fundingSources).omit({ id: true });
export const insertAdminSettingsSchema = createInsertSchema(adminSettings).omit({ id: true });
export const insertCompanySchema = createInsertSchema(companies).omit({ id: true });
export const insertCompanyMemberSchema = createInsertSchema(companyMembers).omit({ id: true });
export const insertCompanyInvitationSchema = createInsertSchema(companyInvitations).omit({ id: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true });
export const insertPendingDestructiveActionSchema = createInsertSchema(pendingDestructiveActions).omit({ id: true, initiatedAt: true });

// ==================== TYPES ====================

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type InsertBill = z.infer<typeof insertBillSchema>;
export type Bill = typeof bills.$inferSelect;

// Helper type: makes specified keys optional while keeping everything else required
type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Create-input types: select types with newly-added nullable columns made optional
// so existing call sites that omit these fields still type-check.
export type CreateTransaction = OptionalFields<Omit<Transaction, 'id'>, 'walletTransactionId' | 'userId' | 'reference' | 'companyId' | 'deletedAt'>;
export type CreateExpense     = OptionalFields<Omit<Expense, 'id'>,     'departmentId' | 'approvedBy' | 'approvedAt' | 'rejectedBy' | 'rejectedAt' | 'approvalComments' | 'reviewerComments' | 'deletedAt'>;
export type CreateBill        = OptionalFields<Omit<Bill, 'id'>,        'walletTransactionId' | 'paidAmount' | 'paidDate' | 'paidBy' | 'paymentMethod' | 'paymentReference' | 'approvedBy' | 'approvedAt' | 'reviewerComments'>;
export type CreatePayroll     = OptionalFields<Omit<PayrollEntry, 'id'>,'departmentId' | 'payoutDestinationId'>;
export type CreateTeamMember  = OptionalFields<Omit<TeamMember, 'id'>,  'departmentId'>;

export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type Budget = typeof budgets.$inferSelect;

export type InsertVirtualCard = z.infer<typeof insertVirtualCardSchema>;
export type VirtualCard = typeof virtualCards.$inferSelect;

export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type DepartmentRecord = typeof departments.$inferSelect;

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

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export type InsertOrganizationSettings = z.infer<typeof insertOrganizationSettingsSchema>;
export type OrganizationSettings = typeof organizationSettings.$inferSelect;

export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;
export type SystemSettings = typeof systemSettings.$inferSelect;

export type InsertRolePermissions = z.infer<typeof insertRolePermissionsSchema>;
export type RolePermissions = typeof rolePermissions.$inferSelect;

export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof wallets.$inferSelect;

export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type WalletTransaction = typeof walletTransactions.$inferSelect;

export type InsertExchangeRate = z.infer<typeof insertExchangeRateSchema>;
export type ExchangeRate = typeof exchangeRates.$inferSelect;

export type InsertExchangeRateSettings = z.infer<typeof insertExchangeRateSettingsSchema>;
export type ExchangeRateSettings = typeof exchangeRateSettings.$inferSelect;

export type InsertPayoutDestination = z.infer<typeof insertPayoutDestinationSchema>;
export type PayoutDestination = typeof payoutDestinations.$inferSelect;

export type InsertPayout = z.infer<typeof insertPayoutSchema>;
export type Payout = typeof payouts.$inferSelect;

export type InsertScheduledPayment = z.infer<typeof insertScheduledPaymentSchema>;
export type ScheduledPayment = typeof scheduledPayments.$inferSelect;

export type InsertFundingSource = z.infer<typeof insertFundingSourceSchema>;
export type FundingSource = typeof fundingSources.$inferSelect;

export type InsertAdminSettings = z.infer<typeof insertAdminSettingsSchema>;
export type AdminSettings = typeof adminSettings.$inferSelect;

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

export type InsertCompanyMember = z.infer<typeof insertCompanyMemberSchema>;
export type CompanyMember = typeof companyMembers.$inferSelect;

export type InsertCompanyInvitation = z.infer<typeof insertCompanyInvitationSchema>;
export type CompanyInvitation = typeof companyInvitations.$inferSelect;

export type CompanyBalances = typeof companyBalances.$inferSelect;
export type CompanySettings = typeof companySettings.$inferSelect;

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

export type InsertPendingDestructiveAction = z.infer<typeof insertPendingDestructiveActionSchema>;
export type PendingDestructiveAction = typeof pendingDestructiveActions.$inferSelect;

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
}, (t) => [
  index("notifications_user_id_idx").on(t.userId),
  index("notifications_created_at_idx").on(t.createdAt),
  index("notifications_user_id_read_idx").on(t.userId, t.read),
]);

// Notification settings per user — SINGLE SOURCE OF TRUTH for notification preferences
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
  weeklyDigest: boolean("weekly_digest").notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("notification_settings_user_id_idx").on(t.userId),
]);

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
}, (t) => [
  index("push_tokens_user_id_idx").on(t.userId),
]);

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

// Analytics Snapshots table - persisted daily/monthly aggregated metrics
export const analyticsSnapshots = pgTable("analytics_snapshots", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  periodType: text("period_type").notNull(), // 'daily', 'weekly', 'monthly'
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  currency: text("currency").notNull().default('USD'),
  totalRevenue: decimal("total_revenue", { precision: 14, scale: 2 }).notNull().default('0'),
  totalExpenses: decimal("total_expenses", { precision: 14, scale: 2 }).notNull().default('0'),
  totalPayroll: decimal("total_payroll", { precision: 14, scale: 2 }).notNull().default('0'),
  totalBillsPaid: decimal("total_bills_paid", { precision: 14, scale: 2 }).notNull().default('0'),
  totalInvoicesIssued: decimal("total_invoices_issued", { precision: 14, scale: 2 }).notNull().default('0'),
  totalInvoicesPaid: decimal("total_invoices_paid", { precision: 14, scale: 2 }).notNull().default('0'),
  grossProfit: decimal("gross_profit", { precision: 14, scale: 2 }).notNull().default('0'),
  profitMargin: decimal("profit_margin", { precision: 6, scale: 2 }).notNull().default('0'),
  netCashFlow: decimal("net_cash_flow", { precision: 14, scale: 2 }).notNull().default('0'),
  expenseCount: integer("expense_count").notNull().default(0),
  transactionCount: integer("transaction_count").notNull().default(0),
  topCategory: text("top_category"),
  topVendor: text("top_vendor"),
  categoryBreakdown: jsonb("category_breakdown").$type<Record<string, number>>().default({}),
  departmentBreakdown: jsonb("department_breakdown").$type<Record<string, number>>().default({}),
  companyId: text("company_id").references(() => companies.id, { onDelete: 'set null' }),
  createdAt: text("created_at").notNull().default(sql`now()`),
}, (t) => [
  index("analytics_snapshots_company_id_idx").on(t.companyId),
  index("analytics_snapshots_period_type_idx").on(t.periodType),
  index("analytics_snapshots_period_start_idx").on(t.periodStart),
]);

// Business Insights table - generated insights and recommendations
export const businessInsights = pgTable("business_insights", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  category: text("category").notNull(), // 'cash-flow', 'vendor', 'payroll', 'budget', 'risk', 'growth', 'savings'
  severity: text("severity").notNull().default('info'), // 'info', 'warning', 'critical', 'success'
  source: text("source").notNull().default('system'), // 'system', 'ai'
  recommendation: text("recommendation"),
  metric: text("metric"),
  metricValue: decimal("metric_value", { precision: 14, scale: 2 }),
  metricChange: decimal("metric_change", { precision: 8, scale: 2 }),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: text("related_entity_id"),
  periodStart: text("period_start"),
  periodEnd: text("period_end"),
  companyId: text("company_id").references(() => companies.id, { onDelete: 'set null' }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`now()`),
}, (t) => [
  index("business_insights_company_id_idx").on(t.companyId),
  index("business_insights_category_idx").on(t.category),
  index("business_insights_is_active_idx").on(t.isActive),
]);

export const insertAnalyticsSnapshotSchema = createInsertSchema(analyticsSnapshots).omit({ id: true });
export const insertBusinessInsightSchema = createInsertSchema(businessInsights).omit({ id: true });

export type InsertAnalyticsSnapshot = z.infer<typeof insertAnalyticsSnapshotSchema>;
export type AnalyticsSnapshot = typeof analyticsSnapshots.$inferSelect;

export type InsertBusinessInsight = z.infer<typeof insertBusinessInsightSchema>;
export type BusinessInsight = typeof businessInsights.$inferSelect;

// Processed webhooks table — dedicated idempotency tracking for payment webhooks
export const processedWebhooks = pgTable("processed_webhooks", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").notNull().unique(),
  provider: text("provider").notNull(), // 'stripe' | 'paystack'
  eventType: text("event_type").notNull(),
  processedAt: text("processed_at").notNull().default(sql`now()`),
  metadata: jsonb("metadata"),
});

// Payment Methods table — saved cards and bank accounts for Stripe + Paystack
export const paymentMethods = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  companyId: integer("company_id"),
  provider: text("provider").notNull(), // 'stripe' or 'paystack'
  type: text("type").notNull(), // 'card', 'bank_account'
  last4: text("last4"),
  brand: text("brand"), // 'visa', 'mastercard', etc.
  expMonth: integer("exp_month"),
  expYear: integer("exp_year"),
  bankName: text("bank_name"),
  // Stripe fields
  stripePaymentMethodId: text("stripe_payment_method_id"),
  stripeCustomerId: text("stripe_customer_id"),
  // Paystack fields
  paystackAuthorizationCode: text("paystack_authorization_code"),
  paystackCustomerCode: text("paystack_customer_code"),
  isDefault: boolean("is_default").default(false),
  isReusable: boolean("is_reusable").default(true),
  metadata: jsonb("metadata"),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
}, (t) => [
  index("payment_methods_user_id_idx").on(t.userId),
  index("payment_methods_company_id_idx").on(t.companyId),
  index("payment_methods_provider_idx").on(t.provider),
]);

export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).omit({ id: true });
export const selectPaymentMethodSchema = createInsertSchema(paymentMethods);
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;
export type PaymentMethod = typeof paymentMethods.$inferSelect;

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
