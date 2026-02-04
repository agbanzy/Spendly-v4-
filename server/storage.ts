import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";
import { 
  users, expenses, transactions, bills, budgets, virtualCards, 
  teamMembers, payrollEntries, invoices, vendors, reports,
  cardTransactions, virtualAccounts, companyBalances, companySettings,
  userProfiles, kycSubmissions, notifications, notificationSettings, pushTokens,
  departments, auditLogs, organizationSettings, systemSettings, rolePermissions,
  wallets, walletTransactions, exchangeRates, exchangeRateSettings, payoutDestinations, payouts, fundingSources, adminSettings,
  type User, type InsertUser, type Expense, type Transaction, type Bill, 
  type Budget, type VirtualCard, type TeamMember, type PayrollEntry, 
  type Invoice, type Vendor, type Report, type CardTransaction, 
  type VirtualAccount, type CompanyBalances, type CompanySettings, type AIInsight,
  type UserProfile, type InsertUserProfile, type KycSubmission, type InsertKycSubmission,
  type Notification, type InsertNotification, type NotificationSettings, type InsertNotificationSettings,
  type PushToken, type InsertPushToken, type Department,
  type AuditLog, type OrganizationSettings, type SystemSettings, type RolePermissions,
  type Wallet, type InsertWallet, type WalletTransaction, type InsertWalletTransaction,
  type ExchangeRate, type InsertExchangeRate, type ExchangeRateSettings,
  type PayoutDestination, type InsertPayoutDestination,
  type Payout, type InsertPayout, type FundingSource, type InsertFundingSource,
  type AdminSettings, type InsertAdminSettings
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getExpenses(): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: Omit<Expense, 'id'>): Promise<Expense>;
  updateExpense(id: string, expense: Partial<Omit<Expense, 'id'>>): Promise<Expense | undefined>;
  deleteExpense(id: string): Promise<boolean>;
  
  getTransactions(): Promise<Transaction[]>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  createTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction>;
  updateTransaction(id: string, transaction: Partial<Omit<Transaction, 'id'>>): Promise<Transaction | undefined>;
  deleteTransaction(id: string): Promise<boolean>;
  
  getBills(): Promise<Bill[]>;
  getBill(id: string): Promise<Bill | undefined>;
  createBill(bill: Omit<Bill, 'id'>): Promise<Bill>;
  updateBill(id: string, bill: Partial<Omit<Bill, 'id'>>): Promise<Bill | undefined>;
  deleteBill(id: string): Promise<boolean>;
  
  getBudgets(): Promise<Budget[]>;
  getBudget(id: string): Promise<Budget | undefined>;
  createBudget(budget: Omit<Budget, 'id'>): Promise<Budget>;
  updateBudget(id: string, budget: Partial<Omit<Budget, 'id'>>): Promise<Budget | undefined>;
  deleteBudget(id: string): Promise<boolean>;
  
  getCards(): Promise<VirtualCard[]>;
  getCard(id: string): Promise<VirtualCard | undefined>;
  createCard(card: Omit<VirtualCard, 'id'>): Promise<VirtualCard>;
  updateCard(id: string, card: Partial<Omit<VirtualCard, 'id'>>): Promise<VirtualCard | undefined>;
  deleteCard(id: string): Promise<boolean>;
  
  getCardTransactions(cardId: string): Promise<CardTransaction[]>;
  createCardTransaction(tx: Omit<CardTransaction, 'id'>): Promise<CardTransaction>;
  
  getVirtualAccounts(): Promise<VirtualAccount[]>;
  getVirtualAccount(id: string): Promise<VirtualAccount | undefined>;
  createVirtualAccount(account: Omit<VirtualAccount, 'id'>): Promise<VirtualAccount>;
  updateVirtualAccount(id: string, data: Partial<VirtualAccount>): Promise<VirtualAccount | undefined>;
  
  getDepartments(): Promise<Department[]>;
  getDepartment(id: string): Promise<Department | undefined>;
  createDepartment(dept: Omit<Department, 'id'>): Promise<Department>;
  updateDepartment(id: string, dept: Partial<Omit<Department, 'id'>>): Promise<Department | undefined>;
  deleteDepartment(id: string): Promise<boolean>;

  getTeam(): Promise<TeamMember[]>;
  getTeamMember(id: string): Promise<TeamMember | undefined>;
  getTeamMemberByEmail(email: string): Promise<TeamMember | undefined>;
  createTeamMember(member: Omit<TeamMember, 'id'>): Promise<TeamMember>;
  updateTeamMember(id: string, member: Partial<Omit<TeamMember, 'id'>>): Promise<TeamMember | undefined>;
  deleteTeamMember(id: string): Promise<boolean>;
  
  // Transfer tracking for security limits
  getDailyTransferTotal(userId: string): Promise<number>;
  
  // Webhook idempotency
  isWebhookProcessed(reference: string): Promise<boolean>;
  markWebhookProcessed(reference: string, provider: string): Promise<void>;
  
  // Transaction status updates
  updateTransactionByReference(reference: string, data: Partial<Transaction>): Promise<Transaction | undefined>;
  
  getBalances(): Promise<CompanyBalances>;
  updateBalances(balances: Partial<CompanyBalances>): Promise<CompanyBalances>;
  
  getInsights(): Promise<AIInsight[]>;
  
  getPayroll(): Promise<PayrollEntry[]>;
  getPayrollEntry(id: string): Promise<PayrollEntry | undefined>;
  createPayrollEntry(entry: Omit<PayrollEntry, 'id'>): Promise<PayrollEntry>;
  updatePayrollEntry(id: string, entry: Partial<Omit<PayrollEntry, 'id'>>): Promise<PayrollEntry | undefined>;
  deletePayrollEntry(id: string): Promise<boolean>;
  
  getInvoices(): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: Omit<Invoice, 'id'>): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<Omit<Invoice, 'id'>>): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<boolean>;
  
  getVendors(): Promise<Vendor[]>;
  getVendor(id: string): Promise<Vendor | undefined>;
  createVendor(vendor: Omit<Vendor, 'id'>): Promise<Vendor>;
  updateVendor(id: string, vendor: Partial<Omit<Vendor, 'id'>>): Promise<Vendor | undefined>;
  deleteVendor(id: string): Promise<boolean>;
  
  getReports(): Promise<Report[]>;
  getReport(id: string): Promise<Report | undefined>;
  createReport(report: Omit<Report, 'id'>): Promise<Report>;
  updateReportStatus(id: string, update: { status: string; fileSize?: string }): Promise<Report | undefined>;
  deleteReport(id: string): Promise<boolean>;
  
  getSettings(): Promise<CompanySettings>;
  updateSettings(settings: Partial<CompanySettings>): Promise<CompanySettings>;
  
  // KYC & User Profiles
  getUserProfile(firebaseUid: string): Promise<UserProfile | undefined>;
  createUserProfile(profile: InsertUserProfile): Promise<UserProfile>;
  updateUserProfile(firebaseUid: string, profile: Partial<UserProfile>): Promise<UserProfile | undefined>;
  
  getKycSubmission(userProfileId: string): Promise<KycSubmission | undefined>;
  createKycSubmission(submission: InsertKycSubmission): Promise<KycSubmission>;
  updateKycSubmission(id: string, submission: Partial<KycSubmission>): Promise<KycSubmission | undefined>;
  
  // Notifications
  getNotifications(userId: string): Promise<Notification[]>;
  getNotification(id: number): Promise<Notification | undefined>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  updateNotification(id: number, notification: Partial<Notification>): Promise<Notification | undefined>;
  markNotificationRead(id: number): Promise<Notification | undefined>;
  markAllNotificationsRead(userId: string): Promise<void>;
  deleteNotification(id: number): Promise<boolean>;
  
  // Notification Settings
  getNotificationSettings(userId: string): Promise<NotificationSettings | null>;
  createNotificationSettings(settings: InsertNotificationSettings): Promise<NotificationSettings>;
  updateNotificationSettings(userId: string, settings: Partial<NotificationSettings>): Promise<NotificationSettings | undefined>;
  
  // Push Tokens
  getPushTokens(userId: string): Promise<PushToken[]>;
  createPushToken(token: InsertPushToken): Promise<PushToken>;
  deletePushToken(token: string): Promise<boolean>;
  deactivatePushToken(token: string): Promise<void>;
  
  // Admin methods
  getAuditLogs(): Promise<AuditLog[]>;
  createAuditLog(log: Omit<AuditLog, 'id'>): Promise<AuditLog>;
  getOrganizationSettings(): Promise<OrganizationSettings | undefined>;
  updateOrganizationSettings(data: Partial<OrganizationSettings>): Promise<OrganizationSettings>;
  getSystemSettings(): Promise<SystemSettings[]>;
  updateSystemSetting(key: string, data: Partial<SystemSettings>): Promise<SystemSettings>;
  getRolePermissions(): Promise<RolePermissions[]>;
  updateRolePermissions(role: string, data: Partial<RolePermissions>): Promise<RolePermissions>;
  
  // Wallet methods
  getWallets(userId?: string): Promise<Wallet[]>;
  getWallet(id: string): Promise<Wallet | undefined>;
  getWalletByUserId(userId: string, currency?: string): Promise<Wallet | undefined>;
  createWallet(wallet: InsertWallet): Promise<Wallet>;
  updateWallet(id: string, data: Partial<Wallet>): Promise<Wallet | undefined>;
  creditWallet(walletId: string, amount: number, type: string, description: string, reference: string, metadata?: Record<string, unknown>): Promise<WalletTransaction>;
  debitWallet(walletId: string, amount: number, type: string, description: string, reference: string, metadata?: Record<string, unknown>): Promise<WalletTransaction>;
  
  // Wallet Transactions
  getWalletTransactions(walletId: string): Promise<WalletTransaction[]>;
  getWalletTransaction(id: string): Promise<WalletTransaction | undefined>;
  
  // Exchange Rates
  getExchangeRates(): Promise<ExchangeRate[]>;
  getExchangeRate(baseCurrency: string, targetCurrency: string): Promise<ExchangeRate | undefined>;
  createExchangeRate(rate: InsertExchangeRate): Promise<ExchangeRate>;
  updateExchangeRate(id: string, data: Partial<ExchangeRate>): Promise<ExchangeRate | undefined>;
  
  // Exchange Rate Settings
  getExchangeRateSettings(): Promise<ExchangeRateSettings | undefined>;
  updateExchangeRateSettings(buyMarkup: string, sellMarkup: string, updatedBy?: string): Promise<ExchangeRateSettings>;
  
  // Payout Destinations
  getPayoutDestinations(userId?: string, vendorId?: string): Promise<PayoutDestination[]>;
  getPayoutDestination(id: string): Promise<PayoutDestination | undefined>;
  createPayoutDestination(destination: InsertPayoutDestination): Promise<PayoutDestination>;
  updatePayoutDestination(id: string, data: Partial<PayoutDestination>): Promise<PayoutDestination | undefined>;
  deletePayoutDestination(id: string): Promise<boolean>;
  
  // Payouts
  getPayouts(filters?: { recipientType?: string; recipientId?: string; status?: string; providerReference?: string }): Promise<Payout[]>;
  getPayout(id: string): Promise<Payout | undefined>;
  createPayout(payout: InsertPayout): Promise<Payout>;
  updatePayout(id: string, data: Partial<Payout>): Promise<Payout | undefined>;
  
  // Funding Sources
  getFundingSources(userId: string): Promise<FundingSource[]>;
  createFundingSource(source: InsertFundingSource): Promise<FundingSource>;
  deleteFundingSource(id: string): Promise<boolean>;
  
  // Admin Settings
  getAdminSettings(): Promise<AdminSettings[]>;
  getAdminSetting(key: string): Promise<AdminSettings | undefined>;
  setAdminSetting(key: string, value: string, description?: string): Promise<AdminSettings>;
  
  // Admin Utilities
  purgeDatabase(tablesToPreserve?: string[]): Promise<{ purgedTables: string[] }>;
  getUsers(): Promise<User[]>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  
  // ==================== USERS ====================
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values({
      ...insertUser,
      permissions: [],
      avatar: null,
      department: insertUser.department || 'General',
      role: insertUser.role || 'EMPLOYEE',
    }).returning();
    return result[0];
  }

  // ==================== EXPENSES ====================
  async getExpenses(): Promise<Expense[]> {
    const result = await db.select().from(expenses).orderBy(desc(expenses.date));
    return result;
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    const result = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
    return result[0];
  }

  async createExpense(expense: Omit<Expense, 'id'>): Promise<Expense> {
    const result = await db.insert(expenses).values(expense as any).returning();
    return result[0];
  }

  async updateExpense(id: string, expense: Partial<Omit<Expense, 'id'>>): Promise<Expense | undefined> {
    const result = await db.update(expenses).set(expense as any).where(eq(expenses.id, id)).returning();
    return result[0];
  }

  async deleteExpense(id: string): Promise<boolean> {
    const result = await db.delete(expenses).where(eq(expenses.id, id)).returning();
    return result.length > 0;
  }

  // ==================== TRANSACTIONS ====================
  async getTransactions(): Promise<Transaction[]> {
    const result = await db.select().from(transactions).orderBy(desc(transactions.date));
    return result;
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    const result = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
    return result[0];
  }

  async createTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
    const result = await db.insert(transactions).values(transaction as any).returning();
    return result[0];
  }

  async updateTransaction(id: string, transaction: Partial<Omit<Transaction, 'id'>>): Promise<Transaction | undefined> {
    const result = await db.update(transactions).set(transaction as any).where(eq(transactions.id, id)).returning();
    return result[0];
  }

  async deleteTransaction(id: string): Promise<boolean> {
    const result = await db.delete(transactions).where(eq(transactions.id, id)).returning();
    return result.length > 0;
  }

  // ==================== BILLS ====================
  async getBills(): Promise<Bill[]> {
    const result = await db.select().from(bills).orderBy(desc(bills.dueDate));
    return result;
  }

  async getBill(id: string): Promise<Bill | undefined> {
    const result = await db.select().from(bills).where(eq(bills.id, id)).limit(1);
    return result[0];
  }

  async createBill(bill: Omit<Bill, 'id'>): Promise<Bill> {
    const result = await db.insert(bills).values(bill as any).returning();
    return result[0];
  }

  async updateBill(id: string, bill: Partial<Omit<Bill, 'id'>>): Promise<Bill | undefined> {
    const result = await db.update(bills).set(bill as any).where(eq(bills.id, id)).returning();
    return result[0];
  }

  async deleteBill(id: string): Promise<boolean> {
    const result = await db.delete(bills).where(eq(bills.id, id)).returning();
    return result.length > 0;
  }

  // ==================== BUDGETS ====================
  async getBudgets(): Promise<Budget[]> {
    const result = await db.select().from(budgets);
    return result;
  }

  async getBudget(id: string): Promise<Budget | undefined> {
    const result = await db.select().from(budgets).where(eq(budgets.id, id)).limit(1);
    return result[0];
  }

  async createBudget(budget: Omit<Budget, 'id'>): Promise<Budget> {
    const result = await db.insert(budgets).values(budget as any).returning();
    return result[0];
  }

  async updateBudget(id: string, budget: Partial<Omit<Budget, 'id'>>): Promise<Budget | undefined> {
    const result = await db.update(budgets).set(budget as any).where(eq(budgets.id, id)).returning();
    return result[0];
  }

  async deleteBudget(id: string): Promise<boolean> {
    const result = await db.delete(budgets).where(eq(budgets.id, id)).returning();
    return result.length > 0;
  }

  // ==================== CARDS ====================
  async getCards(): Promise<VirtualCard[]> {
    const result = await db.select().from(virtualCards);
    return result;
  }

  async getCard(id: string): Promise<VirtualCard | undefined> {
    const result = await db.select().from(virtualCards).where(eq(virtualCards.id, id)).limit(1);
    return result[0];
  }

  async createCard(card: Omit<VirtualCard, 'id'>): Promise<VirtualCard> {
    const result = await db.insert(virtualCards).values(card as any).returning();
    return result[0];
  }

  async updateCard(id: string, card: Partial<Omit<VirtualCard, 'id'>>): Promise<VirtualCard | undefined> {
    const result = await db.update(virtualCards).set(card as any).where(eq(virtualCards.id, id)).returning();
    return result[0];
  }

  async deleteCard(id: string): Promise<boolean> {
    const result = await db.delete(virtualCards).where(eq(virtualCards.id, id)).returning();
    return result.length > 0;
  }

  // ==================== CARD TRANSACTIONS ====================
  async getCardTransactions(cardId: string): Promise<CardTransaction[]> {
    const result = await db.select().from(cardTransactions)
      .where(eq(cardTransactions.cardId, cardId))
      .orderBy(desc(cardTransactions.date));
    return result;
  }

  async createCardTransaction(tx: Omit<CardTransaction, 'id'>): Promise<CardTransaction> {
    const result = await db.insert(cardTransactions).values(tx as any).returning();
    return result[0];
  }

  // ==================== VIRTUAL ACCOUNTS ====================
  async getVirtualAccounts(): Promise<VirtualAccount[]> {
    const result = await db.select().from(virtualAccounts);
    return result;
  }

  async getVirtualAccount(id: string): Promise<VirtualAccount | undefined> {
    const result = await db.select().from(virtualAccounts).where(eq(virtualAccounts.id, id)).limit(1);
    return result[0];
  }

  async createVirtualAccount(account: Omit<VirtualAccount, 'id'>): Promise<VirtualAccount> {
    const result = await db.insert(virtualAccounts).values(account as any).returning();
    return result[0];
  }

  async updateVirtualAccount(id: string, data: Partial<VirtualAccount>): Promise<VirtualAccount | undefined> {
    const result = await db.update(virtualAccounts).set(data as any).where(eq(virtualAccounts.id, id)).returning();
    return result[0];
  }

  // ==================== DEPARTMENTS ====================
  async getDepartments(): Promise<Department[]> {
    const result = await db.select().from(departments);
    return result;
  }

  async getDepartment(id: string): Promise<Department | undefined> {
    const result = await db.select().from(departments).where(eq(departments.id, id)).limit(1);
    return result[0];
  }

  async createDepartment(dept: Omit<Department, 'id'>): Promise<Department> {
    const result = await db.insert(departments).values(dept as any).returning();
    return result[0];
  }

  async updateDepartment(id: string, dept: Partial<Omit<Department, 'id'>>): Promise<Department | undefined> {
    const result = await db.update(departments).set(dept as any).where(eq(departments.id, id)).returning();
    return result[0];
  }

  async deleteDepartment(id: string): Promise<boolean> {
    const result = await db.delete(departments).where(eq(departments.id, id)).returning();
    return result.length > 0;
  }

  // ==================== TEAM ====================
  async getTeam(): Promise<TeamMember[]> {
    const result = await db.select().from(teamMembers);
    return result;
  }

  async getTeamMember(id: string): Promise<TeamMember | undefined> {
    const result = await db.select().from(teamMembers).where(eq(teamMembers.id, id)).limit(1);
    return result[0];
  }

  async createTeamMember(member: Omit<TeamMember, 'id'>): Promise<TeamMember> {
    const result = await db.insert(teamMembers).values(member as any).returning();
    return result[0];
  }

  async updateTeamMember(id: string, member: Partial<Omit<TeamMember, 'id'>>): Promise<TeamMember | undefined> {
    const result = await db.update(teamMembers).set(member as any).where(eq(teamMembers.id, id)).returning();
    return result[0];
  }

  async deleteTeamMember(id: string): Promise<boolean> {
    const result = await db.delete(teamMembers).where(eq(teamMembers.id, id)).returning();
    return result.length > 0;
  }

  async getTeamMemberByEmail(email: string): Promise<TeamMember | undefined> {
    const result = await db.select().from(teamMembers).where(eq(teamMembers.email, email)).limit(1);
    return result[0];
  }

  // ==================== TRANSFER TRACKING FOR SECURITY ====================
  async getDailyTransferTotal(userId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    
    // First get all wallets for this user
    const userWallets = await this.getWallets(userId);
    if (userWallets.length === 0) {
      return 0;
    }
    
    const walletIds = userWallets.map(w => w.id);
    
    // Sum all transfer_out transactions for today from user's wallets
    let total = 0;
    for (const walletId of walletIds) {
      const txs = await db.select().from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.walletId, walletId),
            eq(walletTransactions.type, 'transfer_out'),
            sql`DATE(${walletTransactions.createdAt}) = ${today}`
          )
        );
      total += txs.reduce((sum, tx) => sum + parseFloat(String(tx.amount || 0)), 0);
    }
    
    return total;
  }

  // ==================== WEBHOOK IDEMPOTENCY ====================
  async isWebhookProcessed(reference: string): Promise<boolean> {
    // Check in transactions table for existing reference
    const result = await db.select().from(transactions)
      .where(eq(transactions.description, reference))
      .limit(1);
    return result.length > 0;
  }

  async markWebhookProcessed(reference: string, provider: string): Promise<void> {
    // This is handled by creating the transaction - using description as reference marker
    console.log(`Webhook ${reference} from ${provider} marked as processed`);
  }

  async updateTransactionByReference(reference: string, data: Partial<Transaction>): Promise<Transaction | undefined> {
    const result = await db.update(transactions)
      .set(data as any)
      .where(eq(transactions.description, reference))
      .returning();
    return result[0];
  }

  // ==================== BALANCES ====================
  async getBalances(): Promise<CompanyBalances> {
    const result = await db.select().from(companyBalances).where(eq(companyBalances.id, 1)).limit(1);
    if (result.length === 0) {
      const newBalances = await db.insert(companyBalances).values({
        id: 1,
        local: '0',
        usd: '0',
        escrow: '0',
        localCurrency: 'USD'
      }).returning();
      return newBalances[0];
    }
    return result[0];
  }

  async updateBalances(balancesData: Partial<CompanyBalances>): Promise<CompanyBalances> {
    const result = await db.update(companyBalances).set(balancesData as any).where(eq(companyBalances.id, 1)).returning();
    if (result.length === 0) {
      return this.getBalances();
    }
    return result[0];
  }

  // ==================== INSIGHTS ====================
  async getInsights(): Promise<AIInsight[]> {
    const allExpenses = await this.getExpenses();
    const allBudgets = await this.getBudgets();
    const insights: AIInsight[] = [];
    
    const totalSpent = allExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const pendingExpenses = allExpenses.filter(e => e.status === 'PENDING');
    
    if (pendingExpenses.length > 0) {
      const pendingTotal = pendingExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
      insights.push({
        title: 'Pending Approvals',
        description: `You have ${pendingExpenses.length} expense${pendingExpenses.length > 1 ? 's' : ''} totaling $${pendingTotal.toLocaleString()} awaiting approval.`,
        type: 'warning'
      });
    }
    
    const overBudget = allBudgets.filter(b => Number(b.spent) > Number(b.limit));
    if (overBudget.length > 0) {
      insights.push({
        title: 'Budget Alert',
        description: `${overBudget.length} budget${overBudget.length > 1 ? 's have' : ' has'} exceeded the limit. Review spending in ${overBudget.map(b => b.category).join(', ')}.`,
        type: 'warning'
      });
    }
    
    const nearLimit = allBudgets.filter(b => {
      const utilization = Number(b.spent) / Number(b.limit);
      return utilization >= 0.8 && utilization < 1;
    });
    if (nearLimit.length > 0) {
      insights.push({
        title: 'Approaching Budget Limits',
        description: `${nearLimit.length} budget${nearLimit.length > 1 ? 's are' : ' is'} above 80% utilization.`,
        type: 'info'
      });
    }
    
    if (totalSpent > 0 && allBudgets.length > 0) {
      const totalBudget = allBudgets.reduce((sum, b) => sum + Number(b.limit), 0);
      const savingsRate = ((totalBudget - totalSpent) / totalBudget * 100).toFixed(1);
      if (Number(savingsRate) > 10) {
        insights.push({
          title: 'Good Savings Rate',
          description: `You're ${savingsRate}% under budget this period. Great financial discipline!`,
          type: 'saving'
        });
      }
    }
    
    if (insights.length === 0) {
      insights.push({
        title: 'All Clear',
        description: 'No issues detected. Your finances are in good shape!',
        type: 'info'
      });
    }
    
    return insights;
  }

  // ==================== PAYROLL ====================
  async getPayroll(): Promise<PayrollEntry[]> {
    const result = await db.select().from(payrollEntries).orderBy(desc(payrollEntries.payDate));
    return result;
  }

  async getPayrollEntry(id: string): Promise<PayrollEntry | undefined> {
    const result = await db.select().from(payrollEntries).where(eq(payrollEntries.id, id)).limit(1);
    return result[0];
  }

  async createPayrollEntry(entry: Omit<PayrollEntry, 'id'>): Promise<PayrollEntry> {
    const result = await db.insert(payrollEntries).values(entry as any).returning();
    return result[0];
  }

  async updatePayrollEntry(id: string, entry: Partial<Omit<PayrollEntry, 'id'>>): Promise<PayrollEntry | undefined> {
    const result = await db.update(payrollEntries).set(entry as any).where(eq(payrollEntries.id, id)).returning();
    return result[0];
  }

  async deletePayrollEntry(id: string): Promise<boolean> {
    const result = await db.delete(payrollEntries).where(eq(payrollEntries.id, id)).returning();
    return result.length > 0;
  }

  // ==================== INVOICES ====================
  async getInvoices(): Promise<Invoice[]> {
    const result = await db.select().from(invoices).orderBy(desc(invoices.issuedDate));
    return result;
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const result = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    return result[0];
  }

  async createInvoice(invoice: Omit<Invoice, 'id'>): Promise<Invoice> {
    const result = await db.insert(invoices).values(invoice as any).returning();
    return result[0];
  }

  async updateInvoice(id: string, invoice: Partial<Omit<Invoice, 'id'>>): Promise<Invoice | undefined> {
    const result = await db.update(invoices).set(invoice as any).where(eq(invoices.id, id)).returning();
    return result[0];
  }

  async deleteInvoice(id: string): Promise<boolean> {
    const result = await db.delete(invoices).where(eq(invoices.id, id)).returning();
    return result.length > 0;
  }

  // ==================== VENDORS ====================
  async getVendors(): Promise<Vendor[]> {
    const result = await db.select().from(vendors);
    return result;
  }

  async getVendor(id: string): Promise<Vendor | undefined> {
    const result = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
    return result[0];
  }

  async createVendor(vendor: Omit<Vendor, 'id'>): Promise<Vendor> {
    const result = await db.insert(vendors).values(vendor as any).returning();
    return result[0];
  }

  async updateVendor(id: string, vendor: Partial<Omit<Vendor, 'id'>>): Promise<Vendor | undefined> {
    const result = await db.update(vendors).set(vendor as any).where(eq(vendors.id, id)).returning();
    return result[0];
  }

  async deleteVendor(id: string): Promise<boolean> {
    const result = await db.delete(vendors).where(eq(vendors.id, id)).returning();
    return result.length > 0;
  }

  // ==================== REPORTS ====================
  async getReports(): Promise<Report[]> {
    const result = await db.select().from(reports).orderBy(desc(reports.createdAt));
    return result;
  }

  async getReport(id: string): Promise<Report | undefined> {
    const result = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
    return result[0];
  }

  async createReport(report: Omit<Report, 'id'>): Promise<Report> {
    const result = await db.insert(reports).values(report as any).returning();
    return result[0];
  }

  async updateReportStatus(id: string, update: { status: string; fileSize?: string }): Promise<Report | undefined> {
    const result = await db.update(reports).set(update).where(eq(reports.id, id)).returning();
    return result[0];
  }

  async deleteReport(id: string): Promise<boolean> {
    const result = await db.delete(reports).where(eq(reports.id, id)).returning();
    return result.length > 0;
  }

  // ==================== SETTINGS ====================
  async getSettings(): Promise<CompanySettings> {
    const result = await db.select().from(companySettings).where(eq(companySettings.id, 1)).limit(1);
    if (result.length === 0) {
      const newSettings = await db.insert(companySettings).values({
        id: 1,
      }).returning();
      return newSettings[0];
    }
    return result[0];
  }

  async updateSettings(settingsData: Partial<CompanySettings>): Promise<CompanySettings> {
    const result = await db.update(companySettings).set(settingsData as any).where(eq(companySettings.id, 1)).returning();
    if (result.length === 0) {
      return this.getSettings();
    }
    return result[0];
  }

  // ==================== USER PROFILES (KYC) ====================
  async getUserProfile(firebaseUid: string): Promise<UserProfile | undefined> {
    const result = await db.select().from(userProfiles).where(eq(userProfiles.firebaseUid, firebaseUid)).limit(1);
    return result[0];
  }

  async createUserProfile(profile: InsertUserProfile): Promise<UserProfile> {
    const result = await db.insert(userProfiles).values(profile as any).returning();
    return result[0];
  }

  async updateUserProfile(firebaseUid: string, profileData: Partial<UserProfile>): Promise<UserProfile | undefined> {
    const now = new Date().toISOString();
    const result = await db.update(userProfiles).set({
      ...profileData,
      updatedAt: now,
    } as any).where(eq(userProfiles.firebaseUid, firebaseUid)).returning();
    return result[0];
  }

  // ==================== KYC SUBMISSIONS ====================
  async getKycSubmission(userProfileId: string): Promise<KycSubmission | undefined> {
    const result = await db.select().from(kycSubmissions).where(eq(kycSubmissions.userProfileId, userProfileId)).limit(1);
    return result[0];
  }

  async createKycSubmission(submission: InsertKycSubmission): Promise<KycSubmission> {
    const result = await db.insert(kycSubmissions).values(submission as any).returning();
    return result[0];
  }

  async updateKycSubmission(id: string, submissionData: Partial<KycSubmission>): Promise<KycSubmission | undefined> {
    const now = new Date().toISOString();
    const result = await db.update(kycSubmissions).set({
      ...submissionData,
      updatedAt: now,
    } as any).where(eq(kycSubmissions.id, id)).returning();
    return result[0];
  }

  // ==================== NOTIFICATIONS ====================
  async getNotifications(userId: string): Promise<Notification[]> {
    return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
  }

  async getNotification(id: number): Promise<Notification | undefined> {
    const result = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
    return result[0];
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(notification as any).returning();
    return result[0];
  }

  async updateNotification(id: number, notificationData: Partial<Notification>): Promise<Notification | undefined> {
    const result = await db.update(notifications).set(notificationData as any).where(eq(notifications.id, id)).returning();
    return result[0];
  }

  async markNotificationRead(id: number): Promise<Notification | undefined> {
    const now = new Date().toISOString();
    const result = await db.update(notifications).set({
      read: true,
      readAt: now,
    } as any).where(eq(notifications.id, id)).returning();
    return result[0];
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    const now = new Date().toISOString();
    await db.update(notifications).set({
      read: true,
      readAt: now,
    } as any).where(eq(notifications.userId, userId));
  }

  async deleteNotification(id: number): Promise<boolean> {
    const result = await db.delete(notifications).where(eq(notifications.id, id)).returning();
    return result.length > 0;
  }

  // ==================== NOTIFICATION SETTINGS ====================
  async getNotificationSettings(userId: string): Promise<NotificationSettings | null> {
    const result = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, userId)).limit(1);
    return result[0] || null;
  }

  async createNotificationSettings(settings: InsertNotificationSettings): Promise<NotificationSettings> {
    const result = await db.insert(notificationSettings).values(settings as any).returning();
    return result[0];
  }

  async updateNotificationSettings(userId: string, settingsData: Partial<NotificationSettings>): Promise<NotificationSettings | undefined> {
    const now = new Date().toISOString();
    const result = await db.update(notificationSettings).set({
      ...settingsData,
      updatedAt: now,
    } as any).where(eq(notificationSettings.userId, userId)).returning();
    return result[0];
  }

  // ==================== PUSH TOKENS ====================
  async getPushTokens(userId: string): Promise<PushToken[]> {
    return db.select().from(pushTokens).where(eq(pushTokens.userId, userId));
  }

  async createPushToken(token: InsertPushToken): Promise<PushToken> {
    const result = await db.insert(pushTokens).values(token as any).returning();
    return result[0];
  }

  async deletePushToken(token: string): Promise<boolean> {
    const result = await db.delete(pushTokens).where(eq(pushTokens.token, token)).returning();
    return result.length > 0;
  }

  async deactivatePushToken(token: string): Promise<void> {
    await db.update(pushTokens).set({ active: false } as any).where(eq(pushTokens.token, token));
  }

  // ==================== ADMIN METHODS ====================

  async getAuditLogs(): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
  }

  async createAuditLog(log: Omit<AuditLog, 'id'>): Promise<AuditLog> {
    const result = await db.insert(auditLogs).values(log as any).returning();
    return result[0];
  }

  async getOrganizationSettings(): Promise<OrganizationSettings | undefined> {
    const result = await db.select().from(organizationSettings).limit(1);
    return result[0];
  }

  async updateOrganizationSettings(data: Partial<OrganizationSettings>): Promise<OrganizationSettings> {
    const existing = await this.getOrganizationSettings();
    if (existing) {
      const result = await db.update(organizationSettings)
        .set(data as any)
        .where(eq(organizationSettings.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(organizationSettings).values(data as any).returning();
      return result[0];
    }
  }

  async getSystemSettings(): Promise<SystemSettings[]> {
    return await db.select().from(systemSettings);
  }

  async updateSystemSetting(key: string, data: Partial<SystemSettings>): Promise<SystemSettings> {
    const existing = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
    if (existing.length > 0) {
      const result = await db.update(systemSettings)
        .set(data as any)
        .where(eq(systemSettings.key, key))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(systemSettings).values({ ...data, key } as any).returning();
      return result[0];
    }
  }

  async getRolePermissions(): Promise<RolePermissions[]> {
    return await db.select().from(rolePermissions);
  }

  async updateRolePermissions(role: string, data: Partial<RolePermissions>): Promise<RolePermissions> {
    const existing = await db.select().from(rolePermissions).where(eq(rolePermissions.role, role)).limit(1);
    if (existing.length > 0) {
      const result = await db.update(rolePermissions)
        .set(data as any)
        .where(eq(rolePermissions.role, role))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(rolePermissions).values({ ...data, role } as any).returning();
      return result[0];
    }
  }

  // ==================== WALLETS ====================
  async getWallets(userId?: string): Promise<Wallet[]> {
    if (userId) {
      return await db.select().from(wallets).where(eq(wallets.userId, userId));
    }
    return await db.select().from(wallets);
  }

  async getWallet(id: string): Promise<Wallet | undefined> {
    const result = await db.select().from(wallets).where(eq(wallets.id, id)).limit(1);
    return result[0];
  }

  async getWalletByUserId(userId: string, currency?: string): Promise<Wallet | undefined> {
    if (currency) {
      const result = await db.select().from(wallets)
        .where(and(eq(wallets.userId, userId), eq(wallets.currency, currency)))
        .limit(1);
      return result[0];
    }
    const result = await db.select().from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);
    return result[0];
  }

  async createWallet(wallet: InsertWallet): Promise<Wallet> {
    const now = new Date().toISOString();
    const result = await db.insert(wallets).values({
      ...wallet,
      createdAt: now,
      updatedAt: now,
    } as any).returning();
    return result[0];
  }

  async updateWallet(id: string, data: Partial<Wallet>): Promise<Wallet | undefined> {
    const now = new Date().toISOString();
    const result = await db.update(wallets)
      .set({ ...data, updatedAt: now } as any)
      .where(eq(wallets.id, id))
      .returning();
    return result[0];
  }

  async creditWallet(
    walletId: string, 
    amount: number, 
    type: string, 
    description: string, 
    reference: string,
    metadata?: Record<string, unknown>
  ): Promise<WalletTransaction> {
    const wallet = await this.getWallet(walletId);
    if (!wallet) throw new Error('Wallet not found');
    
    const balanceBefore = parseFloat(wallet.balance || '0');
    const balanceAfter = balanceBefore + amount;
    const now = new Date().toISOString();
    
    await db.update(wallets)
      .set({ 
        balance: balanceAfter.toFixed(2),
        availableBalance: (parseFloat(wallet.availableBalance || '0') + amount).toFixed(2),
        updatedAt: now
      } as any)
      .where(eq(wallets.id, walletId));
    
    const txResult = await db.insert(walletTransactions).values({
      walletId,
      type,
      amount: amount.toFixed(2),
      currency: wallet.currency,
      direction: 'credit',
      balanceBefore: balanceBefore.toFixed(2),
      balanceAfter: balanceAfter.toFixed(2),
      description,
      reference,
      metadata,
      status: 'completed',
      createdAt: now,
    } as any).returning();
    
    return txResult[0];
  }

  async debitWallet(
    walletId: string, 
    amount: number, 
    type: string, 
    description: string, 
    reference: string,
    metadata?: Record<string, unknown>
  ): Promise<WalletTransaction> {
    const wallet = await this.getWallet(walletId);
    if (!wallet) throw new Error('Wallet not found');
    
    const availableBalance = parseFloat(wallet.availableBalance || '0');
    if (availableBalance < amount) {
      throw new Error('Insufficient funds');
    }
    
    const balanceBefore = parseFloat(wallet.balance || '0');
    const balanceAfter = balanceBefore - amount;
    const now = new Date().toISOString();
    
    await db.update(wallets)
      .set({ 
        balance: balanceAfter.toFixed(2),
        availableBalance: (availableBalance - amount).toFixed(2),
        updatedAt: now
      } as any)
      .where(eq(wallets.id, walletId));
    
    const txResult = await db.insert(walletTransactions).values({
      walletId,
      type,
      amount: amount.toFixed(2),
      currency: wallet.currency,
      direction: 'debit',
      balanceBefore: balanceBefore.toFixed(2),
      balanceAfter: balanceAfter.toFixed(2),
      description,
      reference,
      metadata,
      status: 'completed',
      createdAt: now,
    } as any).returning();
    
    return txResult[0];
  }

  // ==================== WALLET TRANSACTIONS ====================
  async getWalletTransactions(walletId: string): Promise<WalletTransaction[]> {
    return await db.select().from(walletTransactions)
      .where(eq(walletTransactions.walletId, walletId))
      .orderBy(desc(walletTransactions.createdAt));
  }

  async getWalletTransaction(id: string): Promise<WalletTransaction | undefined> {
    const result = await db.select().from(walletTransactions)
      .where(eq(walletTransactions.id, id))
      .limit(1);
    return result[0];
  }

  // ==================== EXCHANGE RATES ====================
  async getExchangeRates(): Promise<ExchangeRate[]> {
    return await db.select().from(exchangeRates).orderBy(desc(exchangeRates.createdAt));
  }

  async getExchangeRate(baseCurrency: string, targetCurrency: string): Promise<ExchangeRate | undefined> {
    const result = await db.select().from(exchangeRates)
      .where(and(
        eq(exchangeRates.baseCurrency, baseCurrency),
        eq(exchangeRates.targetCurrency, targetCurrency)
      ))
      .orderBy(desc(exchangeRates.createdAt))
      .limit(1);
    return result[0];
  }

  async createExchangeRate(rate: InsertExchangeRate): Promise<ExchangeRate> {
    const now = new Date().toISOString();
    const result = await db.insert(exchangeRates).values({
      ...rate,
      createdAt: now,
    } as any).returning();
    return result[0];
  }

  async updateExchangeRate(id: string, data: Partial<ExchangeRate>): Promise<ExchangeRate | undefined> {
    const result = await db.update(exchangeRates)
      .set(data as any)
      .where(eq(exchangeRates.id, id))
      .returning();
    return result[0];
  }

  // ==================== EXCHANGE RATE SETTINGS ====================
  async getExchangeRateSettings(): Promise<ExchangeRateSettings | undefined> {
    const result = await db.select().from(exchangeRateSettings).limit(1);
    return result[0];
  }

  async updateExchangeRateSettings(buyMarkup: string, sellMarkup: string, updatedBy?: string): Promise<ExchangeRateSettings> {
    const now = new Date().toISOString();
    const existing = await this.getExchangeRateSettings();
    
    if (existing) {
      const result = await db.update(exchangeRateSettings)
        .set({
          buyMarkupPercent: buyMarkup,
          sellMarkupPercent: sellMarkup,
          lastUpdatedBy: updatedBy,
          updatedAt: now,
        } as any)
        .where(eq(exchangeRateSettings.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(exchangeRateSettings).values({
        buyMarkupPercent: buyMarkup,
        sellMarkupPercent: sellMarkup,
        lastUpdatedBy: updatedBy,
        createdAt: now,
        updatedAt: now,
      } as any).returning();
      return result[0];
    }
  }

  // ==================== PAYOUT DESTINATIONS ====================
  async getPayoutDestinations(userId?: string, vendorId?: string): Promise<PayoutDestination[]> {
    if (userId) {
      return await db.select().from(payoutDestinations).where(eq(payoutDestinations.userId, userId));
    }
    if (vendorId) {
      return await db.select().from(payoutDestinations).where(eq(payoutDestinations.vendorId, vendorId));
    }
    return await db.select().from(payoutDestinations);
  }

  async getPayoutDestination(id: string): Promise<PayoutDestination | undefined> {
    const result = await db.select().from(payoutDestinations)
      .where(eq(payoutDestinations.id, id))
      .limit(1);
    return result[0];
  }

  async createPayoutDestination(destination: InsertPayoutDestination): Promise<PayoutDestination> {
    const now = new Date().toISOString();
    const result = await db.insert(payoutDestinations).values({
      ...destination,
      createdAt: now,
      updatedAt: now,
    } as any).returning();
    return result[0];
  }

  async updatePayoutDestination(id: string, data: Partial<PayoutDestination>): Promise<PayoutDestination | undefined> {
    const now = new Date().toISOString();
    const result = await db.update(payoutDestinations)
      .set({ ...data, updatedAt: now } as any)
      .where(eq(payoutDestinations.id, id))
      .returning();
    return result[0];
  }

  async deletePayoutDestination(id: string): Promise<boolean> {
    const result = await db.delete(payoutDestinations).where(eq(payoutDestinations.id, id)).returning();
    return result.length > 0;
  }

  // ==================== PAYOUTS ====================
  async getPayouts(filters?: { recipientType?: string; recipientId?: string; status?: string; providerReference?: string }): Promise<Payout[]> {
    // Filter by provider reference (for webhook lookups)
    if (filters?.providerReference) {
      return await db.select().from(payouts)
        .where(eq(payouts.providerReference, filters.providerReference))
        .orderBy(desc(payouts.createdAt));
    }
    
    if (filters?.recipientType && filters?.recipientId) {
      return await db.select().from(payouts)
        .where(and(
          eq(payouts.recipientType, filters.recipientType),
          eq(payouts.recipientId, filters.recipientId)
        ))
        .orderBy(desc(payouts.createdAt));
    }
    if (filters?.status) {
      return await db.select().from(payouts)
        .where(eq(payouts.status, filters.status))
        .orderBy(desc(payouts.createdAt));
    }
    
    return await db.select().from(payouts).orderBy(desc(payouts.createdAt));
  }

  async getPayout(id: string): Promise<Payout | undefined> {
    const result = await db.select().from(payouts).where(eq(payouts.id, id)).limit(1);
    return result[0];
  }

  async createPayout(payout: InsertPayout): Promise<Payout> {
    const now = new Date().toISOString();
    const result = await db.insert(payouts).values({
      ...payout,
      createdAt: now,
      updatedAt: now,
    } as any).returning();
    return result[0];
  }

  async updatePayout(id: string, data: Partial<Payout>): Promise<Payout | undefined> {
    const now = new Date().toISOString();
    const result = await db.update(payouts)
      .set({ ...data, updatedAt: now } as any)
      .where(eq(payouts.id, id))
      .returning();
    return result[0];
  }

  // ==================== FUNDING SOURCES ====================
  async getFundingSources(userId: string): Promise<FundingSource[]> {
    return await db.select().from(fundingSources).where(eq(fundingSources.userId, userId));
  }

  async createFundingSource(source: InsertFundingSource): Promise<FundingSource> {
    const now = new Date().toISOString();
    const result = await db.insert(fundingSources).values({
      ...source,
      createdAt: now,
    } as any).returning();
    return result[0];
  }

  async deleteFundingSource(id: string): Promise<boolean> {
    const result = await db.delete(fundingSources).where(eq(fundingSources.id, id)).returning();
    return result.length > 0;
  }

  // ==================== ADMIN SETTINGS ====================
  async getAdminSettings(): Promise<AdminSettings[]> {
    return await db.select().from(adminSettings);
  }

  async getAdminSetting(key: string): Promise<AdminSettings | undefined> {
    const result = await db.select().from(adminSettings)
      .where(eq(adminSettings.key, key))
      .limit(1);
    return result[0];
  }

  async setAdminSetting(key: string, value: string, description?: string): Promise<AdminSettings> {
    const now = new Date().toISOString();
    const existing = await this.getAdminSetting(key);
    
    if (existing) {
      const result = await db.update(adminSettings)
        .set({ value, description, updatedAt: now } as any)
        .where(eq(adminSettings.key, key))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(adminSettings).values({
        key,
        value,
        description,
        valueType: 'string',
        updatedAt: now,
      } as any).returning();
      return result[0];
    }
  }

  // ==================== ADMIN UTILITIES ====================
  async purgeDatabase(tablesToPreserve: string[] = ['admin_settings', 'organization_settings', 'system_settings', 'role_permissions']): Promise<{ purgedTables: string[] }> {
    const allTables = [
      'expenses', 'transactions', 'bills', 'budgets', 'virtual_cards',
      'team_members', 'payroll_entries', 'invoices', 'vendors', 'reports',
      'card_transactions', 'virtual_accounts', 'notifications', 'notification_settings',
      'push_tokens', 'user_profiles', 'kyc_submissions', 'audit_logs', 'departments',
      'wallets', 'wallet_transactions', 'exchange_rates', 'payout_destinations',
      'payouts', 'funding_sources', 'users'
    ];
    
    const tablesToPurge = allTables.filter(t => !tablesToPreserve.includes(t));
    const purgedTables: string[] = [];
    
    for (const table of tablesToPurge) {
      try {
        await db.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE`));
        purgedTables.push(table);
      } catch (error) {
        console.log(`Skipping table ${table}: ${error}`);
      }
    }
    
    return { purgedTables };
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const result = await db.update(users)
      .set(data as any)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
