import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, decimal } from "drizzle-orm/pg-core";
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

// Tables
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default('EMPLOYEE'),
  department: text("department").notNull().default('General'),
  avatar: text("avatar"),
  permissions: jsonb("permissions").$type<string[]>().default([]),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  email: true,
  role: true,
  department: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// In-memory types (not DB tables for MVP)
export interface Expense {
  id: string;
  merchant: string;
  amount: number;
  currency: string;
  date: string;
  category: string;
  status: ExpenseStatus;
  user: string;
  userId: string;
  department: Department;
  note?: string;
  receiptUrl?: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  fee: number;
  status: TransactionStatus;
  date: string;
  description: string;
  currency: string;
}

export interface Bill {
  id: string;
  name: string;
  provider: string;
  amount: number;
  dueDate: string;
  category: string;
  status: BillStatus;
  currency: string;
  logo?: string;
}

export interface VirtualCard {
  id: string;
  name: string;
  last4: string;
  balance: number;
  limit: number;
  type: 'Visa' | 'Mastercard';
  color: string;
  currency: string;
  status: CardStatus;
}

export interface Budget {
  id: string;
  name: string;
  category: string;
  limit: number;
  spent: number;
  currency: string;
  period: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: Department;
  avatar?: string;
  status: 'Active' | 'Inactive';
  joinedAt: string;
  permissions: Permission[];
}

export interface CompanyBalances {
  local: number;
  usd: number;
  escrow: number;
  localCurrency: string;
}

export interface AIInsight {
  title: string;
  description: string;
  type: 'saving' | 'warning' | 'info';
}

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
