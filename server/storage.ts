import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";
import { 
  users, expenses, transactions, bills, budgets, virtualCards, 
  teamMembers, payrollEntries, invoices, vendors, reports,
  cardTransactions, virtualAccounts, companyBalances, companySettings,
  userProfiles, kycSubmissions, notifications, notificationSettings, pushTokens,
  departments, auditLogs, organizationSettings, systemSettings, rolePermissions,
  wallets, walletTransactions, exchangeRates, exchangeRateSettings, payoutDestinations, payouts, fundingSources, adminSettings,
  companies, companyMembers, companyInvitations,
  analyticsSnapshots, businessInsights,
  subscriptions,
  type User, type InsertUser, type Expense, type Transaction, type Bill, 
  type Budget, type VirtualCard, type TeamMember, type PayrollEntry, 
  type Invoice, type Vendor, type Report, type CardTransaction, 
  type VirtualAccount, type CompanyBalances, type CompanySettings, type AIInsight,
  type UserProfile, type InsertUserProfile, type KycSubmission, type InsertKycSubmission,
  type Notification, type InsertNotification, type NotificationSettings, type InsertNotificationSettings,
  type PushToken, type InsertPushToken, type DepartmentRecord,
  type AuditLog, type OrganizationSettings, type SystemSettings, type RolePermissions,
  type Wallet, type InsertWallet, type WalletTransaction, type InsertWalletTransaction,
  type ExchangeRate, type InsertExchangeRate, type ExchangeRateSettings,
  type PayoutDestination, type InsertPayoutDestination,
  type Payout, type InsertPayout,
  type ScheduledPayment, type InsertScheduledPayment,
  scheduledPayments,
  type FundingSource, type InsertFundingSource,
  type AdminSettings, type InsertAdminSettings,
  type Company, type InsertCompany, type CompanyMember, type InsertCompanyMember,
  type CompanyInvitation, type InsertCompanyInvitation,
  type AnalyticsSnapshot, type InsertAnalyticsSnapshot,
  type BusinessInsight, type InsertBusinessInsight,
  processedWebhooks,
  pendingDestructiveActions,
  paymentIntentIndex,
  type CreateTransaction, type CreateExpense, type CreateBill,
  type CreatePayroll, type CreateTeamMember,
  type Subscription, type InsertSubscription,
  type PendingDestructiveAction, type InsertPendingDestructiveAction,
  type PaymentIntentIndex, type InsertPaymentIntentIndex,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getExpenses(companyId?: string): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: CreateExpense): Promise<Expense>;
  updateExpense(id: string, expense: Partial<Omit<Expense, 'id'>>): Promise<Expense | undefined>;
  deleteExpense(id: string): Promise<boolean>;
  
  getTransactions(companyId?: string, opts?: { limit?: number; offset?: number }): Promise<Transaction[]>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactionByReference(reference: string): Promise<Transaction | undefined>;
  createTransaction(transaction: CreateTransaction): Promise<Transaction>;
  updateTransaction(id: string, transaction: Partial<Omit<Transaction, 'id'>>): Promise<Transaction | undefined>;
  deleteTransaction(id: string): Promise<boolean>;
  
  getBills(companyId?: string): Promise<Bill[]>;
  getBill(id: string): Promise<Bill | undefined>;
  createBill(bill: CreateBill): Promise<Bill>;
  updateBill(id: string, bill: Partial<Omit<Bill, 'id'>>): Promise<Bill | undefined>;
  deleteBill(id: string): Promise<boolean>;
  
  getBudgets(companyId?: string): Promise<Budget[]>;
  getBudget(id: string): Promise<Budget | undefined>;
  createBudget(budget: Omit<Budget, 'id'>): Promise<Budget>;
  updateBudget(id: string, budget: Partial<Omit<Budget, 'id'>>): Promise<Budget | undefined>;
  deleteBudget(id: string): Promise<boolean>;
  
  getCards(companyId?: string): Promise<VirtualCard[]>;
  getCard(id: string): Promise<VirtualCard | undefined>;
  createCard(card: Omit<VirtualCard, 'id'>): Promise<VirtualCard>;
  updateCard(id: string, card: Partial<Omit<VirtualCard, 'id'>>): Promise<VirtualCard | undefined>;
  deleteCard(id: string): Promise<boolean>;
  
  getCardTransactions(cardId: string, companyId?: string): Promise<CardTransaction[]>;
  createCardTransaction(tx: Omit<CardTransaction, 'id'>): Promise<CardTransaction>;
  
  getVirtualAccounts(companyId?: string): Promise<VirtualAccount[]>;
  getVirtualAccount(id: string): Promise<VirtualAccount | undefined>;
  createVirtualAccount(account: Omit<VirtualAccount, 'id'>): Promise<VirtualAccount>;
  updateVirtualAccount(id: string, data: Partial<VirtualAccount>): Promise<VirtualAccount | undefined>;
  deleteVirtualAccount(id: string): Promise<boolean>;

  getDepartments(companyId?: string): Promise<DepartmentRecord[]>;
  getDepartment(id: string): Promise<DepartmentRecord | undefined>;
  createDepartment(dept: Omit<DepartmentRecord, 'id'>): Promise<DepartmentRecord>;
  updateDepartment(id: string, dept: Partial<Omit<DepartmentRecord, 'id'>>): Promise<DepartmentRecord | undefined>;
  deleteDepartment(id: string): Promise<boolean>;

  getTeam(companyId?: string): Promise<TeamMember[]>;
  getTeamMember(id: string): Promise<TeamMember | undefined>;
  getTeamMemberByEmail(email: string): Promise<TeamMember | undefined>;
  getTeamMembersByEmail(email: string): Promise<TeamMember[]>;
  createTeamMember(member: CreateTeamMember): Promise<TeamMember>;
  updateTeamMember(id: string, member: Partial<Omit<TeamMember, 'id'>>): Promise<TeamMember | undefined>;
  deleteTeamMember(id: string): Promise<boolean>;
  
  // Transfer tracking for security limits
  getDailyTransferTotal(userId: string): Promise<number>;
  
  // Webhook idempotency
  isWebhookProcessed(eventId: string): Promise<boolean>;
  markWebhookProcessed(eventId: string, provider: string, eventType?: string, metadata?: any): Promise<void>;
  // LU-DD-2 / AUD-DD-MT-005 — Server-issued payment-intent index
  createPaymentIntentIndex(input: InsertPaymentIntentIndex): Promise<PaymentIntentIndex | null>;
  getPaymentIntentIndex(provider: string, providerIntentId: string): Promise<PaymentIntentIndex | undefined>;
  
  // Transaction status updates
  updateTransactionByReference(reference: string, data: Partial<Transaction>): Promise<Transaction | undefined>;
  
  getBalances(companyId?: string): Promise<CompanyBalances>;
  updateBalances(balances: Partial<CompanyBalances>, companyId?: string): Promise<CompanyBalances>;
  
  getInsights(companyId?: string): Promise<AIInsight[]>;
  
  getPayroll(companyId?: string): Promise<PayrollEntry[]>;
  getPayrollEntry(id: string): Promise<PayrollEntry | undefined>;
  createPayrollEntry(entry: CreatePayroll): Promise<PayrollEntry>;
  updatePayrollEntry(id: string, entry: Partial<Omit<PayrollEntry, 'id'>>): Promise<PayrollEntry | undefined>;
  deletePayrollEntry(id: string): Promise<boolean>;
  
  getInvoices(companyId?: string): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  getInvoicePublic(id: string): Promise<Partial<Invoice> | undefined>;
  getNextInvoiceNumber(year: number): Promise<string>;
  createInvoice(invoice: Omit<Invoice, 'id'>): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<Omit<Invoice, 'id'>>): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<boolean>;
  
  getVendors(companyId?: string): Promise<Vendor[]>;
  getVendor(id: string): Promise<Vendor | undefined>;
  createVendor(vendor: Omit<Vendor, 'id'>): Promise<Vendor>;
  updateVendor(id: string, vendor: Partial<Omit<Vendor, 'id'>>): Promise<Vendor | undefined>;
  deleteVendor(id: string): Promise<boolean>;
  getVendorStats(vendorId: string): Promise<{ totalPaid: number; pendingPayments: number }>;
  
  getReports(companyId?: string): Promise<Report[]>;
  getReport(id: string): Promise<Report | undefined>;
  createReport(report: Omit<Report, 'id'>): Promise<Report>;
  updateReportStatus(id: string, update: { status: string; fileSize?: string }): Promise<Report | undefined>;
  deleteReport(id: string): Promise<boolean>;
  
  getSettings(): Promise<CompanySettings>;
  updateSettings(settings: Partial<CompanySettings>): Promise<CompanySettings>;
  getCompanyAsSettings(companyId: string): Promise<CompanySettings | null>;
  updateCompanyAsSettings(companyId: string, settings: Partial<CompanySettings>): Promise<CompanySettings | null>;
  
  // KYC & User Profiles
  getUserProfileByCognitoSub(cognitoSub: string): Promise<UserProfile | undefined>;
  getUserProfileByEmail(email: string): Promise<UserProfile | undefined>;
  createUserProfile(profile: InsertUserProfile): Promise<UserProfile>;
  updateUserProfile(cognitoSub: string, profile: Partial<UserProfile>): Promise<UserProfile | undefined>;
  
  getKycSubmission(userProfileId: string): Promise<KycSubmission | undefined>;
  getKycSubmissionHistory(userProfileId: string): Promise<KycSubmission[]>;
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
  getAuditLogs(companyId?: string): Promise<AuditLog[]>;
  createAuditLog(log: Omit<AuditLog, 'id'>): Promise<AuditLog>;
  getOrganizationSettings(): Promise<OrganizationSettings | undefined>;
  updateOrganizationSettings(data: Partial<OrganizationSettings>): Promise<OrganizationSettings>;
  getSystemSettings(): Promise<SystemSettings[]>;
  updateSystemSetting(key: string, data: Partial<SystemSettings>): Promise<SystemSettings>;
  getRolePermissions(): Promise<RolePermissions[]>;
  // LU-DD-4 / AUD-DD-TEAM-002 — Single-role lookup. Returns the array of
  // permission strings for a role, or null when the role has no row in
  // role_permissions. Caller layers a cache on top of this.
  getPermissionsForRole(role: string): Promise<string[] | null>;
  updateRolePermissions(role: string, data: Partial<RolePermissions>): Promise<RolePermissions>;
  
  // Wallet methods
  getWallets(userId?: string): Promise<Wallet[]>;
  getWalletsByCompany(companyId: string): Promise<Wallet[]>;
  getWallet(id: string): Promise<Wallet | undefined>;
  getWalletByUserId(userId: string, currency?: string): Promise<Wallet | undefined>;
  createWallet(wallet: InsertWallet): Promise<Wallet>;
  updateWallet(id: string, data: Partial<Wallet>): Promise<Wallet | undefined>;
  creditWallet(walletId: string, amount: number, type: string, description: string, reference: string, metadata?: Record<string, unknown>): Promise<WalletTransaction>;
  debitWallet(walletId: string, amount: number, type: string, description: string, reference: string, metadata?: Record<string, unknown>): Promise<WalletTransaction>;
  atomicBillPayment(params: { walletId: string; billId: string; amount: number; reference: string; paidBy: string }): Promise<{ walletTx: WalletTransaction; bill: Bill }>;
  atomicCardFunding(params: { walletId: string; cardId: string; amount: number; reference: string }): Promise<{ walletTx: WalletTransaction; card: VirtualCard }>;
  atomicWalletTransfer(params: { sourceWalletId: string; destWalletId: string; amount: number; description: string; reference: string; exchangeRate?: number }): Promise<{ debitTx: WalletTransaction; creditTx: WalletTransaction }>;
  atomicReversal(params: { walletId: string; originalTxId: string; amount: number; reason: string; reversedBy: string }): Promise<WalletTransaction>;
  
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
  getPayouts(filters?: { recipientType?: string; recipientId?: string; status?: string; providerReference?: string; companyId?: string }): Promise<Payout[]>;
  getPayout(id: string): Promise<Payout | undefined>;
  createPayout(payout: InsertPayout): Promise<Payout>;
  updatePayout(id: string, data: Partial<Payout>): Promise<Payout | undefined>;
  // LU-DD-5 / AUD-DD-PAY-002 — debit-first payout processing.
  // claimPayoutForProcessing atomically transitions the payout's status
  // from {pending,approved} → processing so concurrent /process calls
  // cannot both proceed. Returns the claimed row, or null when another
  // caller already claimed it (or the payout is in a non-processable state).
  claimPayoutForProcessing(payoutId: string): Promise<Payout | null>;
  // atomicPayoutDebit locks company_balances FOR UPDATE, debits the
  // appropriate currency column, and creates a 'processing' transactions
  // row — all in one DB transaction. Throws on insufficient funds or a
  // missing balance row. Must be called BEFORE the external transfer.
  atomicPayoutDebit(params: {
    payoutId: string;
    companyId: string;
    amount: number;
    currency: string;
    description: string;
    reference: string;
    userId?: string | null;
  }): Promise<{ transactionId: string; balanceField: 'usd' | 'local' }>;
  // atomicPayoutCompensateOnFailure runs the inverse of atomicPayoutDebit
  // when the external transfer fails after the local debit committed.
  // Re-credits company_balances and marks the local transaction failed.
  atomicPayoutCompensateOnFailure(params: {
    transactionId: string;
    companyId: string;
    amount: number;
    currency: string;
    reason: string;
  }): Promise<void>;

  // Scheduled Payments
  getScheduledPayments(filters?: { status?: string; type?: string; companyId?: string }): Promise<ScheduledPayment[]>;
  getScheduledPayment(id: string): Promise<ScheduledPayment | undefined>;
  createScheduledPayment(payment: InsertScheduledPayment): Promise<ScheduledPayment>;
  updateScheduledPayment(id: string, data: Partial<ScheduledPayment>): Promise<ScheduledPayment | undefined>;
  deleteScheduledPayment(id: string): Promise<boolean>;
  getDueScheduledPayments(beforeDate: string): Promise<ScheduledPayment[]>;

  // Recurring payroll helpers
  getRecurringPayrollEntries(companyId?: string): Promise<PayrollEntry[]>;
  
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
  // LU-008 — Two-admin destructive-action approval flow
  createPendingDestructiveAction(input: InsertPendingDestructiveAction): Promise<PendingDestructiveAction>;
  getPendingDestructiveAction(id: string): Promise<PendingDestructiveAction | undefined>;
  markPendingDestructiveActionApproved(id: string, data: { approvedBy: string; approvedAt: string; executedAt?: string }): Promise<PendingDestructiveAction | undefined>;
  getUsers(): Promise<User[]>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  
  // Company methods
  getCompany(id: string): Promise<Company | undefined>;
  getCompanyBySlug(slug: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, data: Partial<Company>): Promise<Company | undefined>;
  getCompanies(): Promise<Company[]>;
  
  // Company Members
  getCompanyMembers(companyId: string): Promise<CompanyMember[]>;
  getCompanyMember(companyId: string, userId: string): Promise<CompanyMember | undefined>;
  getCompanyMemberByEmail(companyId: string, email: string): Promise<CompanyMember | undefined>;
  getCompanyMembersByEmail(email: string): Promise<CompanyMember[]>;
  createCompanyMember(member: InsertCompanyMember): Promise<CompanyMember>;
  updateCompanyMember(id: string, data: Partial<CompanyMember>): Promise<CompanyMember | undefined>;
  removeCompanyMember(id: string): Promise<boolean>;
  getUserCompanies(userId: string): Promise<CompanyMember[]>;
  
  // Company Invitations
  getCompanyInvitations(companyId: string): Promise<CompanyInvitation[]>;
  getCompanyInvitationByToken(token: string): Promise<CompanyInvitation | undefined>;
  getCompanyInvitationByEmail(companyId: string, email: string): Promise<CompanyInvitation | undefined>;
  createCompanyInvitation(invitation: InsertCompanyInvitation): Promise<CompanyInvitation>;
  updateCompanyInvitation(id: string, data: Partial<CompanyInvitation>): Promise<CompanyInvitation | undefined>;
  revokeCompanyInvitation(id: string): Promise<boolean>;
  acceptInvitationTransaction(params: {
    invitationId: string;
    companyId: string;
    userId: string;
    email: string;
    role: string;
    createdAt: string;
  }): Promise<{ companyName?: string; walletId?: string }>;

  // Analytics Snapshots
  getAnalyticsSnapshots(periodType?: string): Promise<AnalyticsSnapshot[]>;
  createAnalyticsSnapshot(snapshot: InsertAnalyticsSnapshot): Promise<AnalyticsSnapshot>;

  // Business Insights
  getBusinessInsights(category?: string): Promise<BusinessInsight[]>;
  createBusinessInsight(insight: InsertBusinessInsight): Promise<BusinessInsight>;
  clearBusinessInsights(): Promise<void>;

  // Subscriptions
  getSubscriptionByCompanyId(companyId: string): Promise<Subscription | undefined>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: string, data: Partial<Subscription>): Promise<Subscription | undefined>;
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
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
  async getExpenses(companyId?: string): Promise<Expense[]> {
    if (companyId) {
      const result = await db.select().from(expenses)
        .where(eq(expenses.companyId, companyId))
        .orderBy(desc(expenses.date));
      return result;
    }
    const result = await db.select().from(expenses).orderBy(desc(expenses.date));
    return result;
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    const result = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
    return result[0];
  }

  async createExpense(expense: CreateExpense): Promise<Expense> {
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
  // AUD-BE-010: pagination is now mandatory in code (caps unbounded reads).
  // Default page size 100; hard cap 500 to keep result sets bounded even
  // when callers pass huge values. AUD-BE-014 soft-delete: filter rows where
  // deleted_at IS NOT NULL by default.
  async getTransactions(
    companyId?: string,
    opts: { limit?: number; offset?: number; includeDeleted?: boolean } = {},
  ): Promise<Transaction[]> {
    const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
    const offset = Math.max(opts.offset ?? 0, 0);

    const conditions: any[] = [];
    if (companyId) conditions.push(eq(transactions.companyId, companyId));
    if (!opts.includeDeleted) conditions.push(sql`${transactions.deletedAt} IS NULL`);

    const query = db.select().from(transactions);
    const filtered = conditions.length > 0
      ? query.where(and(...conditions))
      : query;

    return await filtered
      .orderBy(desc(transactions.date))
      .limit(limit)
      .offset(offset);
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    const result = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
    return result[0];
  }

  async getTransactionByReference(reference: string): Promise<Transaction | undefined> {
    const result = await db.select().from(transactions).where(
      eq(transactions.reference, reference)
    ).limit(1);
    return result[0];
  }

  async createTransaction(transaction: CreateTransaction): Promise<Transaction> {
    const result = await db.insert(transactions).values(transaction as any).returning();
    return result[0];
  }

  async updateTransaction(id: string, transaction: Partial<Omit<Transaction, 'id'>>): Promise<Transaction | undefined> {
    const result = await db.update(transactions).set(transaction as any).where(eq(transactions.id, id)).returning();
    return result[0];
  }

  // AUD-DD-TXN-001: hard-delete replaced with soft-delete. Schema column
  // exists since PR #1 but the delete path still hard-deleted, breaking the
  // soft-delete contract. Now sets deletedAt; queries filter on it.
  async deleteTransaction(id: string): Promise<boolean> {
    const result = await db.update(transactions)
      .set({ deletedAt: new Date().toISOString() } as any)
      .where(and(eq(transactions.id, id), sql`${transactions.deletedAt} IS NULL`))
      .returning();
    return result.length > 0;
  }

  // ==================== BILLS ====================
  async getBills(companyId?: string): Promise<Bill[]> {
    if (companyId) {
      const result = await db.select().from(bills)
        .where(eq(bills.companyId, companyId))
        .orderBy(desc(bills.dueDate));
      return result;
    }
    const result = await db.select().from(bills).orderBy(desc(bills.dueDate));
    return result;
  }

  async getBill(id: string): Promise<Bill | undefined> {
    const result = await db.select().from(bills).where(eq(bills.id, id)).limit(1);
    return result[0];
  }

  async createBill(bill: CreateBill): Promise<Bill> {
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
  async getBudgets(companyId?: string): Promise<Budget[]> {
    if (companyId) {
      const result = await db.select().from(budgets)
        .where(eq(budgets.companyId, companyId));
      return result;
    }
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
  async getCards(companyId?: string): Promise<VirtualCard[]> {
    if (companyId) {
      const result = await db.select().from(virtualCards)
        .where(eq(virtualCards.companyId, companyId));
      return result;
    }
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
  async getCardTransactions(cardId: string, companyId?: string): Promise<CardTransaction[]> {
    if (companyId) {
      const result = await db.select().from(cardTransactions)
        .where(and(
          eq(cardTransactions.cardId, cardId),
          eq(cardTransactions.companyId, companyId)
        ))
        .orderBy(desc(cardTransactions.date));
      return result;
    }
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
  async getVirtualAccounts(companyId?: string): Promise<VirtualAccount[]> {
    if (companyId) {
      const result = await db.select().from(virtualAccounts)
        .where(eq(virtualAccounts.companyId, companyId));
      return result;
    }
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

  async deleteVirtualAccount(id: string): Promise<boolean> {
    const result = await db.delete(virtualAccounts).where(eq(virtualAccounts.id, id)).returning();
    return result.length > 0;
  }

  // ==================== DEPARTMENTS ====================
  async getDepartments(companyId?: string): Promise<DepartmentRecord[]> {
    if (companyId) {
      const result = await db.select().from(departments)
        .where(eq(departments.companyId, companyId));
      return result;
    }
    const result = await db.select().from(departments);
    return result;
  }

  async getDepartment(id: string): Promise<DepartmentRecord | undefined> {
    const result = await db.select().from(departments).where(eq(departments.id, id)).limit(1);
    return result[0];
  }

  async createDepartment(dept: Omit<DepartmentRecord, 'id'>): Promise<DepartmentRecord> {
    const result = await db.insert(departments).values(dept as any).returning();
    return result[0];
  }

  async updateDepartment(id: string, dept: Partial<Omit<DepartmentRecord, 'id'>>): Promise<DepartmentRecord | undefined> {
    const result = await db.update(departments).set(dept as any).where(eq(departments.id, id)).returning();
    return result[0];
  }

  async deleteDepartment(id: string): Promise<boolean> {
    const result = await db.delete(departments).where(eq(departments.id, id)).returning();
    return result.length > 0;
  }

  // ==================== TEAM ====================
  // LU-DD-3 Phase 3 / AUD-DD-TEAM-001 — reads now hit company_members
  // (the consolidated source of truth). The TeamMember shape is
  // synthesized from CompanyMember columns — both tables now carry the
  // same fields, so the mapping is direct except joinedAt which is
  // nullable on company_members; we fall back to invitedAt to preserve
  // the existing TeamMember.joinedAt: string contract.
  private companyMemberToTeamMember(cm: CompanyMember): TeamMember {
    const cmAny = cm as any;
    return {
      id: cm.id,
      companyId: cm.companyId,
      userId: cm.userId ?? null,
      email: cm.email,
      role: cm.role,
      status: cm.status,
      joinedAt: cm.joinedAt ?? cm.invitedAt,
      name: cmAny.name ?? cm.email.split('@')[0] ?? 'Member',
      department: cmAny.department ?? 'General',
      departmentId: cmAny.departmentId ?? null,
      avatar: cmAny.avatar ?? null,
      permissions: cmAny.permissions ?? [],
    } as unknown as TeamMember;
  }

  async getTeam(companyId?: string): Promise<TeamMember[]> {
    const rows = companyId
      ? await db.select().from(companyMembers).where(eq(companyMembers.companyId, companyId))
      : await db.select().from(companyMembers);
    return rows.map((cm) => this.companyMemberToTeamMember(cm));
  }

  async getTeamMember(id: string): Promise<TeamMember | undefined> {
    // ID could be from either table during the soak. Try company_members
    // first; fall back to team_members for backward-compat with anything
    // that's holding an old ID.
    const cmResult = await db.select().from(companyMembers).where(eq(companyMembers.id, id)).limit(1);
    if (cmResult[0]) return this.companyMemberToTeamMember(cmResult[0]);
    const tmResult = await db.select().from(teamMembers).where(eq(teamMembers.id, id)).limit(1);
    return tmResult[0];
  }

  async createTeamMember(member: CreateTeamMember): Promise<TeamMember> {
    // LU-DD-3 Phase 3 — primary insert now goes to company_members; the
    // team_members table is the mirror, kept in sync via the reverse
    // helper for back-compat reads from non-migrated callers.
    const memberAny = member as any;
    const cmRow = await db.insert(companyMembers).values({
      companyId: memberAny.companyId,
      userId: memberAny.userId ?? null,
      email: memberAny.email,
      role: memberAny.role ?? 'EMPLOYEE',
      status: memberAny.status ?? 'active',
      invitedAt: memberAny.joinedAt ?? new Date().toISOString(),
      joinedAt: memberAny.joinedAt ?? null,
      name: memberAny.name ?? null,
      department: memberAny.department ?? null,
      departmentId: memberAny.departmentId ?? null,
      avatar: memberAny.avatar ?? null,
      permissions: memberAny.permissions ?? [],
    } as any).returning();
    await this.mirrorCompanyMemberToTeamMember(cmRow[0]).catch((err) => {
      console.warn('[LU-DD-3] mirror company→team on createTeamMember failed:', err?.message);
    });
    return this.companyMemberToTeamMember(cmRow[0]);
  }

  async updateTeamMember(id: string, member: Partial<Omit<TeamMember, 'id'>>): Promise<TeamMember | undefined> {
    const memberAny = member as any;
    // Try update on company_members first (the new source of truth).
    const cmExisting = await db.select().from(companyMembers).where(eq(companyMembers.id, id)).limit(1);
    if (cmExisting[0]) {
      const cmRow = await db.update(companyMembers)
        .set({
          ...(memberAny.userId !== undefined ? { userId: memberAny.userId } : {}),
          ...(memberAny.role !== undefined ? { role: memberAny.role } : {}),
          ...(memberAny.status !== undefined ? { status: memberAny.status } : {}),
          ...(memberAny.joinedAt !== undefined ? { joinedAt: memberAny.joinedAt } : {}),
          ...(memberAny.name !== undefined ? { name: memberAny.name } : {}),
          ...(memberAny.department !== undefined ? { department: memberAny.department } : {}),
          ...(memberAny.departmentId !== undefined ? { departmentId: memberAny.departmentId } : {}),
          ...(memberAny.avatar !== undefined ? { avatar: memberAny.avatar } : {}),
          ...(memberAny.permissions !== undefined ? { permissions: memberAny.permissions } : {}),
        } as any)
        .where(eq(companyMembers.id, id))
        .returning();
      if (cmRow[0]) {
        await this.mirrorCompanyMemberToTeamMember(cmRow[0]).catch((err) => {
          console.warn('[LU-DD-3] mirror company→team on updateTeamMember failed:', err?.message);
        });
        return this.companyMemberToTeamMember(cmRow[0]);
      }
    }
    // Back-compat: ID belonged to team_members only (pre-consolidation
    // row that hasn't been mirrored). Fall back to the legacy path,
    // which itself mirrors into company_members.
    const tmResult = await db.update(teamMembers).set(member as any).where(eq(teamMembers.id, id)).returning();
    if (tmResult[0]) {
      await this.mirrorTeamMemberToCompanyMember(tmResult[0]).catch((err) => {
        console.warn('[LU-DD-3] mirror team→company on updateTeamMember (fallback) failed:', err?.message);
      });
    }
    return tmResult[0];
  }

  async deleteTeamMember(id: string): Promise<boolean> {
    // Try company_members first (new source of truth), then fall back
    // to team_members for legacy IDs.
    const cmExisting = await db.select().from(companyMembers).where(eq(companyMembers.id, id)).limit(1);
    if (cmExisting[0]) {
      const cmRow = await db.delete(companyMembers).where(eq(companyMembers.id, id)).returning();
      await this.removeMirroredTeamMember(cmExisting[0]).catch((err) => {
        console.warn('[LU-DD-3] mirror company→team on deleteTeamMember failed:', err?.message);
      });
      return cmRow.length > 0;
    }
    const tmExisting = await db.select().from(teamMembers).where(eq(teamMembers.id, id)).limit(1);
    const tmRow = await db.delete(teamMembers).where(eq(teamMembers.id, id)).returning();
    if (tmExisting[0]) {
      await this.removeMirroredCompanyMember(tmExisting[0]).catch((err) => {
        console.warn('[LU-DD-3] mirror team→company on deleteTeamMember (fallback) failed:', err?.message);
      });
    }
    return tmRow.length > 0;
  }

  // LU-DD-3 — Parallel-write helpers. Idempotent UPSERT keyed by
  // (companyId, lower(email)). The schema mirrors team_members
  // semantically; for new column names introduced on company_members,
  // we map straight across.
  private async mirrorTeamMemberToCompanyMember(tm: TeamMember): Promise<void> {
    if (!tm.companyId || !tm.email) return;
    const existing = await db.select().from(companyMembers)
      .where(and(
        eq(companyMembers.companyId, tm.companyId),
        sql`LOWER(${companyMembers.email}) = LOWER(${tm.email})`,
      ))
      .limit(1);
    if (existing.length > 0) {
      await db.update(companyMembers)
        .set({
          userId: tm.userId ?? existing[0].userId,
          role: tm.role,
          status: tm.status,
          joinedAt: tm.joinedAt ?? existing[0].joinedAt,
          name: tm.name ?? existing[0].name,
          department: tm.department ?? existing[0].department,
          departmentId: (tm as any).departmentId ?? (existing[0] as any).departmentId,
          avatar: tm.avatar ?? existing[0].avatar,
          permissions: tm.permissions ?? existing[0].permissions,
        } as any)
        .where(eq(companyMembers.id, existing[0].id));
    } else {
      await db.insert(companyMembers).values({
        companyId: tm.companyId,
        userId: tm.userId ?? null,
        email: tm.email,
        role: tm.role,
        status: tm.status,
        invitedAt: tm.joinedAt ?? new Date().toISOString(),
        joinedAt: tm.joinedAt ?? null,
        name: tm.name ?? null,
        department: tm.department ?? null,
        departmentId: (tm as any).departmentId ?? null,
        avatar: tm.avatar ?? null,
        permissions: tm.permissions ?? [],
      } as any);
    }
  }

  private async removeMirroredCompanyMember(tm: TeamMember): Promise<void> {
    if (!tm.companyId || !tm.email) return;
    // Only remove the mirror if it doesn't have a separate userId
    // (i.e. wasn't independently promoted). When in doubt, keep the row
    // and just mark it removed via status — but team_members' delete is
    // semantically a hard delete, so we mirror that.
    await db.delete(companyMembers)
      .where(and(
        eq(companyMembers.companyId, tm.companyId),
        sql`LOWER(${companyMembers.email}) = LOWER(${tm.email})`,
      ));
  }

  async getTeamMemberByEmail(email: string): Promise<TeamMember | undefined> {
    // LU-DD-3 Phase 3 — read from company_members (source of truth).
    const result = await db.select().from(companyMembers)
      .where(sql`LOWER(${companyMembers.email}) = LOWER(${email})`)
      .limit(1);
    if (!result[0]) return undefined;
    return this.companyMemberToTeamMember(result[0]);
  }

  async getTeamMembersByEmail(email: string): Promise<TeamMember[]> {
    const result = await db.select().from(companyMembers)
      .where(sql`LOWER(${companyMembers.email}) = LOWER(${email})`);
    return result.map((cm) => this.companyMemberToTeamMember(cm));
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
  async isWebhookProcessed(eventId: string): Promise<boolean> {
    const result = await db.select({ id: processedWebhooks.id })
      .from(processedWebhooks)
      .where(eq(processedWebhooks.eventId, eventId))
      .limit(1);
    return result.length > 0;
  }

  async markWebhookProcessed(eventId: string, provider: string, eventType: string = 'unknown', metadata?: any): Promise<void> {
    try {
      await db.insert(processedWebhooks).values({
        eventId,
        provider,
        eventType,
        metadata: metadata || null,
      }).onConflictDoNothing();
    } catch (error: any) {
      // If unique constraint violation, it's already processed — that's fine
      if (error.code !== '23505') {
        throw error;
      }
    }
  }

  // ==================== PAYMENT INTENT INDEX (LU-DD-2 / AUD-DD-MT-005) ====================
  // Server-issued mapping from (provider, provider_intent_id) →
  // (companyId, userId, kind), written authoritatively at the moment a
  // payment intent / transfer / payout is created. Read by webhook
  // handlers in place of the previously-trusted metadata.companyId.

  async createPaymentIntentIndex(input: InsertPaymentIntentIndex): Promise<PaymentIntentIndex | null> {
    try {
      const result = await db.insert(paymentIntentIndex)
        .values(input as any)
        .onConflictDoNothing()
        .returning();
      return result[0] ?? null;
    } catch (error: any) {
      // Don't propagate — payment-flow failure should not be caused by
      // an index-write failure. Caller logs the warn.
      return null;
    }
  }

  async getPaymentIntentIndex(provider: string, providerIntentId: string): Promise<PaymentIntentIndex | undefined> {
    const result = await db.select().from(paymentIntentIndex)
      .where(and(
        eq(paymentIntentIndex.provider, provider),
        eq(paymentIntentIndex.providerIntentId, providerIntentId),
      ))
      .limit(1);
    return result[0];
  }

  async updateTransactionByReference(reference: string, data: Partial<Transaction>): Promise<Transaction | undefined> {
    const result = await db.update(transactions)
      .set(data as any)
      .where(eq(transactions.description, reference))
      .returning();
    return result[0];
  }

  // ==================== BALANCES ====================
  async getBalances(companyId?: string): Promise<CompanyBalances> {
    // Multi-tenant: query by companyId if provided, else fallback to first row
    if (companyId) {
      const result = await db.select().from(companyBalances).where(eq(companyBalances.companyId, companyId)).limit(1);
      if (result.length === 0) {
        const newBalances = await db.insert(companyBalances).values({
          companyId,
          local: '0',
          usd: '0',
          escrow: '0',
          localCurrency: 'USD'
        } as any).returning();
        return newBalances[0];
      }
      return result[0];
    }
    // Legacy fallback: return first row
    const result = await db.select().from(companyBalances).limit(1);
    if (result.length === 0) {
      const newBalances = await db.insert(companyBalances).values({
        companyId: 'default',
        local: '0',
        usd: '0',
        escrow: '0',
        localCurrency: 'USD'
      } as any).returning();
      return newBalances[0];
    }
    return result[0];
  }

  async updateBalances(balancesData: Partial<CompanyBalances>, companyId?: string): Promise<CompanyBalances> {
    if (companyId) {
      const result = await db.update(companyBalances).set(balancesData as any).where(eq(companyBalances.companyId, companyId)).returning();
      if (result.length === 0) {
        return this.getBalances(companyId);
      }
      return result[0];
    }
    // Legacy fallback
    const all = await db.select().from(companyBalances).limit(1);
    if (all.length > 0) {
      const result = await db.update(companyBalances).set(balancesData as any).where(eq(companyBalances.id, all[0].id)).returning();
      return result[0] || all[0];
    }
    return this.getBalances();
  }

  async atomicCreditBalance(field: 'local' | 'usd' | 'escrow', amount: number, companyId?: string): Promise<CompanyBalances> {
    if (companyId) {
      const result = await db.execute(
        sql`UPDATE company_balances SET ${sql.raw(field)} = CAST(${sql.raw(field)} AS DECIMAL(20,2)) + ${amount} WHERE company_id = ${companyId} RETURNING *`
      );
      if (!result.rows || result.rows.length === 0) {
        // Auto-create balance row for this company, then retry
        await this.getBalances(companyId);
        const retry = await db.execute(
          sql`UPDATE company_balances SET ${sql.raw(field)} = CAST(${sql.raw(field)} AS DECIMAL(20,2)) + ${amount} WHERE company_id = ${companyId} RETURNING *`
        );
        if (!retry.rows || retry.rows.length === 0) {
          throw new Error('Balance update failed');
        }
        return retry.rows[0] as CompanyBalances;
      }
      return result.rows[0] as CompanyBalances;
    }
    // Legacy fallback
    const result = await db.execute(
      sql`UPDATE company_balances SET ${sql.raw(field)} = CAST(${sql.raw(field)} AS DECIMAL(20,2)) + ${amount} WHERE id = (SELECT id FROM company_balances LIMIT 1) RETURNING *`
    );
    if (!result.rows || result.rows.length === 0) {
      throw new Error('Balance update failed');
    }
    return result.rows[0] as CompanyBalances;
  }

  async atomicDebitBalance(field: 'local' | 'usd' | 'escrow', amount: number, companyId?: string): Promise<CompanyBalances> {
    if (companyId) {
      const result = await db.execute(
        sql`UPDATE company_balances SET ${sql.raw(field)} = CAST(${sql.raw(field)} AS DECIMAL(20,2)) - ${amount} WHERE company_id = ${companyId} AND CAST(${sql.raw(field)} AS DECIMAL(20,2)) >= ${amount} RETURNING *`
      );
      if (!result.rows || result.rows.length === 0) {
        throw new Error('Insufficient balance or balance update failed');
      }
      return result.rows[0] as CompanyBalances;
    }
    // Legacy fallback
    const result = await db.execute(
      sql`UPDATE company_balances SET ${sql.raw(field)} = CAST(${sql.raw(field)} AS DECIMAL(20,2)) - ${amount} WHERE id = (SELECT id FROM company_balances LIMIT 1) AND CAST(${sql.raw(field)} AS DECIMAL(20,2)) >= ${amount} RETURNING *`
    );
    if (!result.rows || result.rows.length === 0) {
      throw new Error('Insufficient balance or balance update failed');
    }
    return result.rows[0] as CompanyBalances;
  }

  // ==================== INSIGHTS ====================
  // AUD-DD-MT-001 — was leaking cross-tenant data when called without companyId.
  // Now scopes to the caller's company; the route resolves and passes it.
  async getInsights(companyId?: string): Promise<AIInsight[]> {
    if (!companyId) {
      // Per AUD-DD-MT-003 hardening: warn but return an empty array rather
      // than aggregate the global dataset. This is a behaviour change for any
      // legacy caller that relied on the previous unscoped result; see
      // docs/audit-2026-04-26/AUDIT_DEEP_DIVE_2026_04_26.md §10.
      // Use the lazy-loaded logger to avoid a circular import at module top.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { logger } = require('./lib/logger');
      logger.warn({ method: 'getInsights' }, 'getInsights called without companyId — returning empty');
      return [];
    }
    const allExpenses = await this.getExpenses(companyId);
    const allBudgets = await this.getBudgets(companyId);
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
  async getPayroll(companyId?: string): Promise<PayrollEntry[]> {
    if (companyId) {
      const result = await db.select().from(payrollEntries)
        .where(eq(payrollEntries.companyId, companyId))
        .orderBy(desc(payrollEntries.payDate));
      return result;
    }
    const result = await db.select().from(payrollEntries).orderBy(desc(payrollEntries.payDate));
    return result;
  }

  async getPayrollEntry(id: string): Promise<PayrollEntry | undefined> {
    const result = await db.select().from(payrollEntries).where(eq(payrollEntries.id, id)).limit(1);
    return result[0];
  }

  async createPayrollEntry(entry: CreatePayroll): Promise<PayrollEntry> {
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
  // AUD-DD-INV-001: every invoice query now filters out soft-deleted rows
  // by default. Pass { includeDeleted: true } to opt out (admin reporting).
  async getInvoices(companyId?: string, opts: { includeDeleted?: boolean } = {}): Promise<Invoice[]> {
    const conditions: any[] = [];
    if (companyId) conditions.push(eq(invoices.companyId, companyId));
    if (!opts.includeDeleted) conditions.push(sql`${invoices.deletedAt} IS NULL`);

    const query = db.select().from(invoices);
    const filtered = conditions.length > 0
      ? query.where(and(...conditions))
      : query;

    return await filtered.orderBy(desc(invoices.issuedDate));
  }

  async getInvoice(id: string, opts: { includeDeleted?: boolean } = {}): Promise<Invoice | undefined> {
    const conditions: any[] = [eq(invoices.id, id)];
    if (!opts.includeDeleted) conditions.push(sql`${invoices.deletedAt} IS NULL`);
    const result = await db.select().from(invoices).where(and(...conditions)).limit(1);
    return result[0];
  }

  async getInvoicePublic(id: string): Promise<Partial<Invoice> | undefined> {
    // AUD-DD-INV-001: deleted invoices must NOT be visible on the public
    // /pay/:id page even with the right ID — soft-delete is also a customer
    // signal that the invoice is no longer outstanding.
    const result = await db.select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      client: invoices.client,
      amount: invoices.amount,
      subtotal: invoices.subtotal,
      taxRate: invoices.taxRate,
      taxAmount: invoices.taxAmount,
      currency: invoices.currency,
      dueDate: invoices.dueDate,
      issuedDate: invoices.issuedDate,
      status: invoices.status,
      items: invoices.items,
      notes: invoices.notes,
    }).from(invoices).where(and(eq(invoices.id, id), sql`${invoices.deletedAt} IS NULL`)).limit(1);
    return result[0];
  }

  async getNextInvoiceNumber(year: number): Promise<string> {
    const prefix = `INV-${year}-`;
    const result = await db.select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(sql`${invoices.invoiceNumber} LIKE ${prefix + '%'}`)
      .orderBy(desc(invoices.invoiceNumber))
      .limit(1);
    if (result.length === 0) {
      return `${prefix}001`;
    }
    const seq = parseInt(result[0].invoiceNumber.replace(prefix, ''), 10);
    return `${prefix}${String(seq + 1).padStart(3, '0')}`;
  }

  async createInvoice(invoice: Omit<Invoice, 'id'>): Promise<Invoice> {
    const result = await db.insert(invoices).values(invoice as any).returning();
    return result[0];
  }

  async updateInvoice(id: string, invoice: Partial<Omit<Invoice, 'id'>>): Promise<Invoice | undefined> {
    const result = await db.update(invoices).set(invoice as any).where(eq(invoices.id, id)).returning();
    return result[0];
  }

  // AUD-DD-INV-002: hard-delete replaced with soft-delete. The schema column
  // was added in PR #1 but invoice deletion still hard-deleted. Now sets
  // deletedAt = now() so the invoice is hidden from queries while the row
  // remains for audit trail. The data-retention scheduler is responsible for
  // eventual hard-delete after the retention window.
  async deleteInvoice(id: string): Promise<boolean> {
    const result = await db.update(invoices)
      .set({ deletedAt: new Date().toISOString() } as any)
      .where(and(eq(invoices.id, id), sql`${invoices.deletedAt} IS NULL`))
      .returning();
    return result.length > 0;
  }

  // ==================== VENDORS ====================
  async getVendors(companyId?: string): Promise<Vendor[]> {
    if (companyId) {
      const result = await db.select().from(vendors)
        .where(eq(vendors.companyId, companyId));
      return result;
    }
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

  // Compute vendor payment aggregates from payouts table (replaces stale totalPaid/pendingPayments)
  async getVendorStats(vendorId: string): Promise<{ totalPaid: number; pendingPayments: number }> {
    const paidResult = await db.execute(
      sql`SELECT COALESCE(SUM(CAST(amount AS DECIMAL(12,2))), 0) as total FROM payouts WHERE recipient_id = ${vendorId} AND status = 'completed'`
    );
    const pendingResult = await db.execute(
      sql`SELECT COALESCE(SUM(CAST(amount AS DECIMAL(12,2))), 0) as total FROM payouts WHERE recipient_id = ${vendorId} AND status IN ('pending', 'processing')`
    );
    return {
      totalPaid: parseFloat(String(paidResult.rows?.[0]?.total || '0')),
      pendingPayments: parseFloat(String(pendingResult.rows?.[0]?.total || '0')),
    };
  }

  // ==================== REPORTS ====================
  async getReports(companyId?: string): Promise<Report[]> {
    if (companyId) {
      const result = await db.select().from(reports)
        .where(eq(reports.companyId, companyId))
        .orderBy(desc(reports.createdAt));
      return result;
    }
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

  // Map a Company row into the CompanySettings shape the client expects
  private companyToSettings(company: any): CompanySettings {
    return {
      id: 1, // Client expects numeric id
      companyName: company.name || '',
      companyEmail: company.email || '',
      companyPhone: company.phone || '',
      companyAddress: company.address || '',
      currency: company.currency || 'USD',
      timezone: company.timezone || 'America/Los_Angeles',
      fiscalYearStart: company.fiscalYearStart || 'January',
      dateFormat: company.dateFormat || 'MM/DD/YYYY',
      language: company.language || 'en',
      notificationsEnabled: company.notificationsEnabled ?? true,
      twoFactorEnabled: company.twoFactorEnabled ?? false,
      autoApproveBelow: company.autoApproveBelow || '100',
      requireReceipts: company.requireReceipts ?? true,
      expenseCategories: company.expenseCategories || ['Software', 'Travel', 'Office', 'Marketing', 'Food', 'Equipment', 'Utilities', 'Legal', 'Other'],
      countryCode: company.countryCode || company.country || 'US',
      region: company.region || 'North America',
      paymentProvider: company.paymentProvider || 'stripe',
      paystackEnabled: company.paystackEnabled ?? true,
      stripeEnabled: company.stripeEnabled ?? true,
      companyLogo: company.logo || null,
      companyTagline: company.tagline || null,
      primaryColor: company.primaryColor || '#4f46e5',
      secondaryColor: company.secondaryColor || '#10b981',
      industry: company.industry || null,
      companySize: company.size || null,
      taxId: company.taxId || null,
      registrationNumber: company.registrationNumber || null,
      website: company.website || null,
      invoicePrefix: company.invoicePrefix || 'INV',
      invoiceFooter: company.invoiceFooter || null,
      invoiceTerms: company.invoiceTerms || 'Payment due within 30 days',
      showLogoOnInvoice: company.showLogoOnInvoice ?? true,
      showLogoOnReceipts: company.showLogoOnReceipts ?? true,
    } as CompanySettings;
  }

  // Map CompanySettings fields back to Company columns
  private settingsToCompany(settings: Partial<CompanySettings>): Record<string, any> {
    const map: Record<string, any> = {};
    if (settings.companyName !== undefined) map.name = settings.companyName;
    if (settings.companyEmail !== undefined) map.email = settings.companyEmail;
    if (settings.companyPhone !== undefined) map.phone = settings.companyPhone;
    if (settings.companyAddress !== undefined) map.address = settings.companyAddress;
    if (settings.currency !== undefined) map.currency = settings.currency;
    if (settings.timezone !== undefined) map.timezone = settings.timezone;
    if (settings.fiscalYearStart !== undefined) map.fiscalYearStart = settings.fiscalYearStart;
    if (settings.dateFormat !== undefined) map.dateFormat = settings.dateFormat;
    if (settings.language !== undefined) map.language = settings.language;
    if (settings.notificationsEnabled !== undefined) map.notificationsEnabled = settings.notificationsEnabled;
    if (settings.twoFactorEnabled !== undefined) map.twoFactorEnabled = settings.twoFactorEnabled;
    if (settings.autoApproveBelow !== undefined) map.autoApproveBelow = String(settings.autoApproveBelow);
    if (settings.requireReceipts !== undefined) map.requireReceipts = settings.requireReceipts;
    if (settings.expenseCategories !== undefined) map.expenseCategories = settings.expenseCategories;
    if (settings.countryCode !== undefined) { map.countryCode = settings.countryCode; map.country = settings.countryCode; }
    if (settings.region !== undefined) map.region = settings.region;
    if (settings.paymentProvider !== undefined) map.paymentProvider = settings.paymentProvider;
    if (settings.paystackEnabled !== undefined) map.paystackEnabled = settings.paystackEnabled;
    if (settings.stripeEnabled !== undefined) map.stripeEnabled = settings.stripeEnabled;
    if (settings.companyLogo !== undefined) map.logo = settings.companyLogo;
    if (settings.companyTagline !== undefined) map.tagline = settings.companyTagline;
    if (settings.primaryColor !== undefined) map.primaryColor = settings.primaryColor;
    if (settings.secondaryColor !== undefined) map.secondaryColor = settings.secondaryColor;
    if (settings.industry !== undefined) map.industry = settings.industry;
    if (settings.companySize !== undefined) map.size = settings.companySize;
    if (settings.taxId !== undefined) map.taxId = settings.taxId;
    if (settings.registrationNumber !== undefined) map.registrationNumber = settings.registrationNumber;
    if (settings.website !== undefined) map.website = settings.website;
    if (settings.invoicePrefix !== undefined) map.invoicePrefix = settings.invoicePrefix;
    if (settings.invoiceFooter !== undefined) map.invoiceFooter = settings.invoiceFooter;
    if (settings.invoiceTerms !== undefined) map.invoiceTerms = settings.invoiceTerms;
    if (settings.showLogoOnInvoice !== undefined) map.showLogoOnInvoice = settings.showLogoOnInvoice;
    if (settings.showLogoOnReceipts !== undefined) map.showLogoOnReceipts = settings.showLogoOnReceipts;
    return map;
  }

  async getCompanyAsSettings(companyId: string): Promise<CompanySettings | null> {
    const company = await this.getCompany(companyId);
    if (!company) return null;
    return this.companyToSettings(company);
  }

  async updateCompanyAsSettings(companyId: string, settingsData: Partial<CompanySettings>): Promise<CompanySettings | null> {
    const companyUpdate = this.settingsToCompany(settingsData);
    if (Object.keys(companyUpdate).length === 0) {
      return this.getCompanyAsSettings(companyId);
    }
    const updated = await this.updateCompany(companyId, companyUpdate);
    if (!updated) return null;
    return this.companyToSettings(updated);
  }

  // ==================== USER PROFILES (KYC) ====================
  async getUserProfileByCognitoSub(cognitoSub: string): Promise<UserProfile | undefined> {
    const result = await db.select().from(userProfiles).where(eq(userProfiles.cognitoSub, cognitoSub)).limit(1);
    return result[0];
  }

  async getUserProfileByEmail(email: string): Promise<UserProfile | undefined> {
    const result = await db.select().from(userProfiles).where(eq(userProfiles.email, email)).limit(1);
    return result[0];
  }

  async createUserProfile(profile: InsertUserProfile): Promise<UserProfile> {
    const result = await db.insert(userProfiles).values(profile as any).returning();
    return result[0];
  }

  async updateUserProfile(cognitoSub: string, profileData: Partial<UserProfile>): Promise<UserProfile | undefined> {
    const now = new Date().toISOString();
    const result = await db.update(userProfiles).set({
      ...profileData,
      updatedAt: now,
    } as any).where(eq(userProfiles.cognitoSub, cognitoSub)).returning();
    return result[0];
  }

  // ==================== KYC SUBMISSIONS ====================
  async getKycSubmission(userProfileId: string): Promise<KycSubmission | undefined> {
    const result = await db.select().from(kycSubmissions)
      .where(eq(kycSubmissions.userProfileId, userProfileId))
      .orderBy(desc(kycSubmissions.createdAt))
      .limit(1);
    return result[0];
  }

  async getKycSubmissionHistory(userProfileId: string): Promise<KycSubmission[]> {
    return db.select().from(kycSubmissions)
      .where(eq(kycSubmissions.userProfileId, userProfileId))
      .orderBy(desc(kycSubmissions.createdAt));
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

  async getAuditLogs(companyId?: string): Promise<AuditLog[]> {
    if (companyId) {
      return await db.select().from(auditLogs)
        .where(eq(auditLogs.companyId, companyId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(100);
    }
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

  // LU-DD-4 / AUD-DD-TEAM-002 — single-role lookup
  async getPermissionsForRole(role: string): Promise<string[] | null> {
    const result = await db.select({ permissions: rolePermissions.permissions })
      .from(rolePermissions)
      .where(eq(rolePermissions.role, role))
      .limit(1);
    if (result.length === 0) return null;
    const perms = (result[0] as any).permissions;
    if (!Array.isArray(perms)) return [];
    return perms.filter((p): p is string => typeof p === 'string');
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

  async getWalletsByCompany(companyId: string): Promise<Wallet[]> {
    return await db.select().from(wallets).where(eq(wallets.companyId, companyId));
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
    return await db.transaction(async (tx) => {
      const walletRows = await tx.execute(
        sql`SELECT * FROM wallets WHERE id = ${walletId} FOR UPDATE`
      );
      const wallet = walletRows.rows[0] as any;
      if (!wallet) throw new Error('Wallet not found');

      const balanceBefore = parseFloat(wallet.balance || '0');
      const balanceAfter = Math.round((balanceBefore + amount) * 100) / 100;
      const availBefore = parseFloat(wallet.available_balance || '0');
      const availAfter = Math.round((availBefore + amount) * 100) / 100;
      const now = new Date().toISOString();

      await tx.update(wallets).set({
        balance: balanceAfter.toFixed(2),
        availableBalance: availAfter.toFixed(2),
        updatedAt: now
      } as any).where(eq(wallets.id, walletId));

      const txResult = await tx.insert(walletTransactions).values({
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
    });
  }

  async debitWallet(
    walletId: string,
    amount: number,
    type: string,
    description: string,
    reference: string,
    metadata?: Record<string, unknown>
  ): Promise<WalletTransaction> {
    return await db.transaction(async (tx) => {
      const walletRows = await tx.execute(
        sql`SELECT * FROM wallets WHERE id = ${walletId} FOR UPDATE`
      );
      const wallet = walletRows.rows[0] as any;
      if (!wallet) throw new Error('Wallet not found');

      const availableBalance = parseFloat(wallet.available_balance || '0');
      if (availableBalance < amount) {
        throw new Error('Insufficient funds');
      }

      const balanceBefore = parseFloat(wallet.balance || '0');
      const balanceAfter = Math.round((balanceBefore - amount) * 100) / 100;
      const availAfter = Math.round((availableBalance - amount) * 100) / 100;
      const now = new Date().toISOString();

      await tx.update(wallets).set({
        balance: balanceAfter.toFixed(2),
        availableBalance: availAfter.toFixed(2),
        updatedAt: now
      } as any).where(eq(wallets.id, walletId));

      const txResult = await tx.insert(walletTransactions).values({
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
    });
  }

  // ==================== ATOMIC WALLET OPERATIONS ====================
  // LU-001 / AUD-BE-002: every atomic wallet op also writes a `transactions`
  // row inside the same DB transaction, so the user-facing transaction history
  // sees bill payments, card fundings, transfers, and reversals.
  // Helper takes a Drizzle transaction handle so writes stay atomic with the
  // wallet ledger insert.
  private async bridgeWalletToTransaction(
    tx: any,
    input: {
      walletTransactionId: string;
      companyId: string | null;
      walletTxType: 'bill_payment' | 'card_funding' | 'wallet_transfer' | 'wallet_transfer_in' | 'reversal';
      amount: string;
      currency: string;
      status: string;
      description: string;
      reference: string | null;
      date: string;
    },
  ): Promise<void> {
    const txnTypeMap: Record<string, string> = {
      bill_payment: 'Bill',
      card_funding: 'Funding',
      wallet_transfer: 'Transfer',
      wallet_transfer_in: 'Transfer',
      reversal: 'Refund',
    };
    await tx.insert(transactions).values({
      type: txnTypeMap[input.walletTxType] ?? 'Other',
      amount: input.amount,
      fee: '0',
      status: input.status,
      date: input.date,
      description: input.description,
      currency: input.currency,
      userId: null,
      reference: input.reference,
      walletTransactionId: input.walletTransactionId,
      companyId: input.companyId,
    } as any);
  }

  async atomicBillPayment(params: {
    walletId: string;
    billId: string;
    amount: number;
    reference: string;
    paidBy: string;
  }): Promise<{ walletTx: WalletTransaction; bill: Bill }> {
    return await db.transaction(async (tx) => {
      // AUD-DD-BILL-003 — lock the BILL row first so the
      // "already paid?" decision and the wallet debit happen under the
      // same lock window. The route's outer status check still does
      // first-pass rejection, but a concurrent caller that slipped past
      // it is caught here.
      const billLockRows = await tx.execute(
        sql`SELECT id, status FROM bills WHERE id = ${params.billId} FOR UPDATE`
      );
      const billLock = billLockRows.rows[0] as any;
      if (!billLock) {
        throw new Error('Bill not found');
      }
      if (typeof billLock.status === 'string' && billLock.status.toLowerCase() === 'paid') {
        // Caller (or a concurrent caller that won the race) already paid.
        throw new Error('BILL_ALREADY_PAID');
      }

      const walletRows = await tx.execute(
        sql`SELECT * FROM wallets WHERE id = ${params.walletId} FOR UPDATE`
      );
      const wallet = walletRows.rows[0] as any;
      if (!wallet) throw new Error('Wallet not found');

      const availableBalance = parseFloat(wallet.available_balance || '0');
      if (availableBalance < params.amount) {
        throw new Error('Insufficient funds');
      }

      const balanceBefore = parseFloat(wallet.balance || '0');
      const balanceAfter = Math.round((balanceBefore - params.amount) * 100) / 100;
      const availAfter = Math.round((availableBalance - params.amount) * 100) / 100;
      const now = new Date().toISOString();

      await tx.update(wallets).set({
        balance: balanceAfter.toFixed(2),
        availableBalance: availAfter.toFixed(2),
        updatedAt: now
      } as any).where(eq(wallets.id, params.walletId));

      const walletTxResult = await tx.insert(walletTransactions).values({
        walletId: params.walletId,
        type: 'bill_payment',
        amount: params.amount.toFixed(2),
        currency: wallet.currency,
        direction: 'debit',
        balanceBefore: balanceBefore.toFixed(2),
        balanceAfter: balanceAfter.toFixed(2),
        description: `Bill payment for bill ${params.billId}`,
        reference: params.reference,
        metadata: { billId: params.billId, paidBy: params.paidBy },
        status: 'completed',
        createdAt: now,
      } as any).returning();

      // AUD-DD-BILL-003 — additional defensive guard: the WHERE clause
      // now matches the bill ID AND its status (still not 'paid'), so
      // the second of two truly-simultaneous calls (which we tried to
      // catch above with FOR UPDATE) cannot mark the bill paid twice
      // even on schemas where row locks behave differently. Combined
      // with the lock-then-check above, this gives belt-and-braces
      // protection.
      const billResult = await tx.update(bills)
        .set({
          status: 'paid',
          paidAmount: params.amount.toFixed(2),
          paidDate: now,
          paidBy: params.paidBy || 'wallet',
          paymentMethod: 'wallet',
          paymentReference: params.reference,
          walletTransactionId: walletTxResult[0].id,
          updatedAt: now,
        } as any)
        .where(and(
          eq(bills.id, params.billId),
          sql`LOWER(${bills.status}) <> 'paid'`,
        ))
        .returning();
      if (billResult.length === 0) {
        // Race winner already updated the bill — abort so the wallet
        // debit rolls back. Rare given the FOR UPDATE above, but cheap
        // insurance.
        throw new Error('BILL_ALREADY_PAID');
      }

      // LU-001: also record in user-facing transactions ledger
      await this.bridgeWalletToTransaction(tx, {
        walletTransactionId: walletTxResult[0].id,
        companyId: wallet.company_id ?? null,
        walletTxType: 'bill_payment',
        amount: params.amount.toFixed(2),
        currency: wallet.currency,
        status: 'completed',
        description: `Bill payment for bill ${params.billId}`,
        reference: params.reference,
        date: now.split('T')[0],
      });

      return {
        walletTx: walletTxResult[0],
        bill: billResult[0],
      };
    });
  }

  async atomicCardFunding(params: {
    walletId: string;
    cardId: string;
    amount: number;
    reference: string;
  }): Promise<{ walletTx: WalletTransaction; card: VirtualCard }> {
    return await db.transaction(async (tx) => {
      const walletRows = await tx.execute(
        sql`SELECT * FROM wallets WHERE id = ${params.walletId} FOR UPDATE`
      );
      const wallet = walletRows.rows[0] as any;
      if (!wallet) throw new Error('Wallet not found');

      const availableBalance = parseFloat(wallet.available_balance || '0');
      if (availableBalance < params.amount) {
        throw new Error('Insufficient funds');
      }

      const balanceBefore = parseFloat(wallet.balance || '0');
      const balanceAfter = Math.round((balanceBefore - params.amount) * 100) / 100;
      const availAfter = Math.round((availableBalance - params.amount) * 100) / 100;
      const now = new Date().toISOString();

      await tx.update(wallets).set({
        balance: balanceAfter.toFixed(2),
        availableBalance: availAfter.toFixed(2),
        updatedAt: now
      } as any).where(eq(wallets.id, params.walletId));

      const walletTxResult = await tx.insert(walletTransactions).values({
        walletId: params.walletId,
        type: 'card_funding',
        amount: params.amount.toFixed(2),
        currency: wallet.currency,
        direction: 'debit',
        balanceBefore: balanceBefore.toFixed(2),
        balanceAfter: balanceAfter.toFixed(2),
        description: `Card funding for card ${params.cardId}`,
        reference: params.reference,
        metadata: { cardId: params.cardId },
        status: 'completed',
        createdAt: now,
      } as any).returning();

      // Lock the card row to prevent race conditions on balance read
      const cardRows = await tx.execute(
        sql`SELECT * FROM virtual_cards WHERE id = ${params.cardId} FOR UPDATE`
      );
      const cardRow = cardRows.rows[0] as any;
      if (!cardRow) throw new Error('Card not found');

      const cardResult = await tx.update(virtualCards)
        .set({
          balance: (parseFloat(cardRow.balance || '0') + params.amount).toFixed(2),
          updatedAt: now,
        } as any)
        .where(eq(virtualCards.id, params.cardId))
        .returning();

      // LU-001: also record in user-facing transactions ledger
      await this.bridgeWalletToTransaction(tx, {
        walletTransactionId: walletTxResult[0].id,
        companyId: wallet.company_id ?? null,
        walletTxType: 'card_funding',
        amount: params.amount.toFixed(2),
        currency: wallet.currency,
        status: 'completed',
        description: `Card funding for card ${params.cardId}`,
        reference: params.reference,
        date: now.split('T')[0],
      });

      return {
        walletTx: walletTxResult[0],
        card: cardResult[0],
      };
    });
  }

  async atomicWalletTransfer(params: {
    sourceWalletId: string;
    destWalletId: string;
    amount: number;
    description: string;
    reference: string;
    exchangeRate?: number;
  }): Promise<{ debitTx: WalletTransaction; creditTx: WalletTransaction }> {
    return await db.transaction(async (tx) => {
      const sourceRows = await tx.execute(
        sql`SELECT * FROM wallets WHERE id = ${params.sourceWalletId} FOR UPDATE`
      );
      const sourceWallet = sourceRows.rows[0] as any;
      if (!sourceWallet) throw new Error('Source wallet not found');

      const destRows = await tx.execute(
        sql`SELECT * FROM wallets WHERE id = ${params.destWalletId} FOR UPDATE`
      );
      const destWallet = destRows.rows[0] as any;
      if (!destWallet) throw new Error('Destination wallet not found');

      const sourceAvail = parseFloat(sourceWallet.available_balance || '0');
      if (sourceAvail < params.amount) {
        throw new Error('Insufficient funds in source wallet');
      }

      const now = new Date().toISOString();
      const rate = params.exchangeRate || 1;
      const destAmount = Math.round((params.amount * rate) * 100) / 100;

      const sourceBefore = parseFloat(sourceWallet.balance || '0');
      const sourceAfter = Math.round((sourceBefore - params.amount) * 100) / 100;
      const sourceAvailAfter = Math.round((sourceAvail - params.amount) * 100) / 100;

      const destBefore = parseFloat(destWallet.balance || '0');
      const destAfter = Math.round((destBefore + destAmount) * 100) / 100;
      const destAvailAfter = Math.round((parseFloat(destWallet.available_balance || '0') + destAmount) * 100) / 100;

      await tx.update(wallets).set({
        balance: sourceAfter.toFixed(2),
        availableBalance: sourceAvailAfter.toFixed(2),
        updatedAt: now
      } as any).where(eq(wallets.id, params.sourceWalletId));

      await tx.update(wallets).set({
        balance: destAfter.toFixed(2),
        availableBalance: destAvailAfter.toFixed(2),
        updatedAt: now
      } as any).where(eq(wallets.id, params.destWalletId));

      const debitTxResult = await tx.insert(walletTransactions).values({
        walletId: params.sourceWalletId,
        type: 'wallet_transfer',
        amount: params.amount.toFixed(2),
        currency: sourceWallet.currency,
        direction: 'debit',
        balanceBefore: sourceBefore.toFixed(2),
        balanceAfter: sourceAfter.toFixed(2),
        description: params.description,
        reference: params.reference,
        metadata: { destWalletId: params.destWalletId, exchangeRate: rate },
        status: 'completed',
        createdAt: now,
      } as any).returning();

      const creditTxResult = await tx.insert(walletTransactions).values({
        walletId: params.destWalletId,
        type: 'wallet_transfer_in',
        amount: destAmount.toFixed(2),
        currency: destWallet.currency,
        direction: 'credit',
        balanceBefore: destBefore.toFixed(2),
        balanceAfter: destAfter.toFixed(2),
        description: params.description,
        reference: params.reference,
        metadata: { sourceWalletId: params.sourceWalletId, exchangeRate: rate },
        status: 'completed',
        createdAt: now,
      } as any).returning();

      // LU-001: bridge BOTH legs into the user-facing transactions ledger.
      // Debit leg uses the source wallet's company; credit leg uses the dest wallet's company
      // (these may differ on cross-company / cross-tenant transfers).
      await this.bridgeWalletToTransaction(tx, {
        walletTransactionId: debitTxResult[0].id,
        companyId: sourceWallet.company_id ?? null,
        walletTxType: 'wallet_transfer',
        amount: params.amount.toFixed(2),
        currency: sourceWallet.currency,
        status: 'completed',
        description: params.description,
        reference: params.reference,
        date: now.split('T')[0],
      });
      await this.bridgeWalletToTransaction(tx, {
        walletTransactionId: creditTxResult[0].id,
        companyId: destWallet.company_id ?? null,
        walletTxType: 'wallet_transfer_in',
        amount: destAmount.toFixed(2),
        currency: destWallet.currency,
        status: 'completed',
        description: params.description,
        reference: params.reference,
        date: now.split('T')[0],
      });

      return {
        debitTx: debitTxResult[0],
        creditTx: creditTxResult[0],
      };
    });
  }

  async atomicReversal(params: {
    walletId: string;
    originalTxId: string;
    amount: number;
    reason: string;
    reversedBy: string;
  }): Promise<WalletTransaction> {
    return await db.transaction(async (tx) => {
      const walletRows = await tx.execute(
        sql`SELECT * FROM wallets WHERE id = ${params.walletId} FOR UPDATE`
      );
      const wallet = walletRows.rows[0] as any;
      if (!wallet) throw new Error('Wallet not found');

      const originalTx = await tx.select().from(walletTransactions)
        .where(eq(walletTransactions.id, params.originalTxId))
        .limit(1);
      if (originalTx.length === 0) throw new Error('Original transaction not found');

      // Idempotency guard: check if already reversed
      if ((originalTx[0] as any).reversedAt) {
        throw new Error('Transaction has already been reversed');
      }

      const now = new Date().toISOString();
      const balanceBefore = parseFloat(wallet.balance || '0');
      let balanceAfter: number;
      let availAfter: number;
      const availBefore = parseFloat(wallet.available_balance || '0');

      if (originalTx[0].direction === 'debit') {
        balanceAfter = Math.round((balanceBefore + params.amount) * 100) / 100;
        availAfter = Math.round((availBefore + params.amount) * 100) / 100;
      } else {
        balanceAfter = Math.round((balanceBefore - params.amount) * 100) / 100;
        availAfter = Math.round((availBefore - params.amount) * 100) / 100;
      }

      await tx.update(wallets).set({
        balance: balanceAfter.toFixed(2),
        availableBalance: availAfter.toFixed(2),
        updatedAt: now
      } as any).where(eq(wallets.id, params.walletId));

      const reversalTxResult = await tx.insert(walletTransactions).values({
        walletId: params.walletId,
        type: 'reversal',
        amount: params.amount.toFixed(2),
        currency: wallet.currency,
        direction: originalTx[0].direction === 'debit' ? 'credit' : 'debit',
        balanceBefore: balanceBefore.toFixed(2),
        balanceAfter: balanceAfter.toFixed(2),
        description: `Reversal of transaction ${params.originalTxId}`,
        reference: `REVERSAL-${params.originalTxId}`,
        metadata: {
          originalTxId: params.originalTxId,
          reason: params.reason,
          reversedBy: params.reversedBy,
        },
        status: 'completed',
        createdAt: now,
      } as any).returning();

      // Mark the original transaction as reversed
      await tx.update(walletTransactions)
        .set({ reversedAt: now, reversedByTxId: reversalTxResult[0].id } as any)
        .where(eq(walletTransactions.id, params.originalTxId));

      // LU-001: bridge to user-facing transactions ledger
      await this.bridgeWalletToTransaction(tx, {
        walletTransactionId: reversalTxResult[0].id,
        companyId: wallet.company_id ?? null,
        walletTxType: 'reversal',
        amount: params.amount.toFixed(2),
        currency: wallet.currency,
        status: 'completed',
        description: `Reversal of transaction ${params.originalTxId}`,
        reference: `REVERSAL-${params.originalTxId}`,
        date: now.split('T')[0],
      });

      return reversalTxResult[0];
    });
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
    // AUD-BE-011: filter by the rate's validity window. A rate must satisfy
    //   validFrom <= now AND (validTo IS NULL OR validTo >= now)
    // Otherwise the latest historical rate would be returned even after it
    // expired, which silently corrupts FX-conversion results.
    const now = new Date().toISOString();
    const result = await db.select().from(exchangeRates)
      .where(and(
        eq(exchangeRates.baseCurrency, baseCurrency),
        eq(exchangeRates.targetCurrency, targetCurrency),
        sql`${exchangeRates.validFrom} <= ${now}`,
        sql`(${exchangeRates.validTo} IS NULL OR ${exchangeRates.validTo} >= ${now})`,
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
  async getPayouts(filters?: { recipientType?: string; recipientId?: string; status?: string; providerReference?: string; companyId?: string }): Promise<Payout[]> {
    // Filter by provider reference (for webhook lookups)
    if (filters?.providerReference) {
      return await db.select().from(payouts)
        .where(eq(payouts.providerReference, filters.providerReference))
        .orderBy(desc(payouts.createdAt));
    }

    // Build conditions array for flexible filtering
    const conditions: any[] = [];
    if (filters?.companyId) {
      conditions.push(eq(payouts.companyId, filters.companyId));
    }
    if (filters?.recipientType) {
      conditions.push(eq(payouts.recipientType, filters.recipientType));
    }
    if (filters?.recipientId) {
      conditions.push(eq(payouts.recipientId, filters.recipientId));
    }
    if (filters?.status) {
      conditions.push(eq(payouts.status, filters.status));
    }

    if (conditions.length > 0) {
      return await db.select().from(payouts)
        .where(and(...conditions))
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

  // ==================== LU-DD-5 / AUD-DD-PAY-002 — Debit-first payout processing ====================
  //
  // The previous /payouts/:id/process flow called the external Stripe /
  // Paystack transfer FIRST and only then updated local state. If the
  // external call succeeded but a subsequent step crashed (DB outage,
  // network, container kill), money left the bank account with no local
  // ledger record. The recurringScheduler.processScheduledPayments path
  // already had the right pattern ("FIX P4"); the route handler did not.
  //
  // The three methods below give the route handler:
  //
  //   1. claimPayoutForProcessing  — atomic status transition that
  //      prevents two concurrent /process calls from both starting work.
  //   2. atomicPayoutDebit         — DB-transactional local debit + a
  //      'Processing' transactions row, BEFORE the external call.
  //   3. atomicPayoutCompensateOnFailure — DB-transactional credit-back
  //      + 'Failed' transactions row, when the external call rejects.

  async claimPayoutForProcessing(payoutId: string): Promise<Payout | null> {
    // Atomic transition: only succeed if the row is currently in a
    // claim-eligible state. The CASE-with-WHERE pattern would also work,
    // but Drizzle's update().where(...) plus .returning() is cleaner.
    const now = new Date().toISOString();
    const result = await db.update(payouts)
      .set({ status: 'processing', updatedAt: now } as any)
      .where(and(
        eq(payouts.id, payoutId),
        sql`${payouts.status} IN ('pending', 'approved')`,
      ))
      .returning();
    return result[0] ?? null;
  }

  async atomicPayoutDebit(params: {
    payoutId: string;
    companyId: string;
    amount: number;
    currency: string;
    description: string;
    reference: string;
    userId?: string | null;
  }): Promise<{ transactionId: string; balanceField: 'usd' | 'local' }> {
    const balanceField: 'usd' | 'local' = params.currency.toUpperCase() === 'USD' ? 'usd' : 'local';
    const now = new Date().toISOString();

    return await db.transaction(async (tx) => {
      // Lock the company_balances row to prevent concurrent debits from
      // racing against each other for the same company / currency.
      const balanceRows = await tx.execute(
        sql`SELECT id, ${sql.raw(balanceField)} AS field_value, local_currency
            FROM company_balances
            WHERE company_id = ${params.companyId}
            FOR UPDATE`
      );
      const row = balanceRows.rows[0] as any;
      if (!row) {
        throw new Error(`No company_balances row for company ${params.companyId}`);
      }

      const currentBalance = parseFloat(String(row.field_value || '0'));
      if (currentBalance < params.amount) {
        throw new Error(`Insufficient ${balanceField} balance: need ${params.amount} ${params.currency}, have ${currentBalance}`);
      }

      // For non-USD currencies stored under `local`, sanity-check that the
      // company's local_currency actually matches what we're debiting. A
      // mismatch (e.g. payout in NGN but local_currency='GHS') would
      // silently take from the wrong currency.
      if (balanceField === 'local' && row.local_currency && row.local_currency !== params.currency.toUpperCase()) {
        throw new Error(`Currency mismatch: payout currency ${params.currency} does not match company.local_currency ${row.local_currency}`);
      }

      const newBalance = Math.round((currentBalance - params.amount) * 100) / 100;

      await tx.execute(
        sql`UPDATE company_balances
            SET ${sql.raw(balanceField)} = ${newBalance.toFixed(2)}
            WHERE id = ${row.id}`
      );

      // Insert the local 'Processing' transaction row in the same transaction
      // so the debit and the ledger record commit together. The post-LU-001
      // bridge writes to `transactions` directly here too because there is
      // no source-side `walletTransaction` to bridge from.
      const txnInsert = await tx.insert(transactions).values({
        type: 'Payout',
        amount: params.amount.toFixed(2),
        fee: '0',
        status: 'Processing',
        date: now.split('T')[0],
        description: params.description,
        currency: params.currency,
        userId: params.userId ?? null,
        reference: params.reference,
        companyId: params.companyId,
      } as any).returning();

      return {
        transactionId: txnInsert[0].id,
        balanceField,
      };
    });
  }

  async atomicPayoutCompensateOnFailure(params: {
    transactionId: string;
    companyId: string;
    amount: number;
    currency: string;
    reason: string;
  }): Promise<void> {
    const balanceField: 'usd' | 'local' = params.currency.toUpperCase() === 'USD' ? 'usd' : 'local';

    await db.transaction(async (tx) => {
      // Lock the balance row.
      const balanceRows = await tx.execute(
        sql`SELECT id, ${sql.raw(balanceField)} AS field_value
            FROM company_balances
            WHERE company_id = ${params.companyId}
            FOR UPDATE`
      );
      const row = balanceRows.rows[0] as any;
      if (!row) {
        throw new Error(`No company_balances row for company ${params.companyId} during compensation`);
      }

      const currentBalance = parseFloat(String(row.field_value || '0'));
      const restored = Math.round((currentBalance + params.amount) * 100) / 100;

      await tx.execute(
        sql`UPDATE company_balances
            SET ${sql.raw(balanceField)} = ${restored.toFixed(2)}
            WHERE id = ${row.id}`
      );

      // Mark the in-flight transaction as failed. We keep the row visible
      // (do NOT soft-delete) so the audit trail still shows the attempted
      // payout and its failure reason. A separate metadata insert isn't
      // needed; the transactions.description was set at debit time.
      await tx.update(transactions)
        .set({ status: 'Failed' } as any)
        .where(eq(transactions.id, params.transactionId));
    });
  }

  // ==================== SCHEDULED PAYMENTS ====================
  async getScheduledPayments(filters?: { status?: string; type?: string; companyId?: string }): Promise<ScheduledPayment[]> {
    const conditions: any[] = [];
    if (filters?.companyId) {
      conditions.push(eq(scheduledPayments.companyId, filters.companyId));
    }
    if (filters?.status) {
      conditions.push(eq(scheduledPayments.status, filters.status));
    }
    if (filters?.type) {
      conditions.push(eq(scheduledPayments.type, filters.type));
    }
    if (conditions.length > 0) {
      return await db.select().from(scheduledPayments)
        .where(and(...conditions))
        .orderBy(desc(scheduledPayments.nextRunDate));
    }
    return await db.select().from(scheduledPayments).orderBy(desc(scheduledPayments.nextRunDate));
  }

  async getScheduledPayment(id: string): Promise<ScheduledPayment | undefined> {
    const result = await db.select().from(scheduledPayments).where(eq(scheduledPayments.id, id)).limit(1);
    return result[0];
  }

  async createScheduledPayment(payment: InsertScheduledPayment): Promise<ScheduledPayment> {
    const now = new Date().toISOString();
    const result = await db.insert(scheduledPayments).values({
      ...payment,
      createdAt: now,
      updatedAt: now,
    } as any).returning();
    return result[0];
  }

  async updateScheduledPayment(id: string, data: Partial<ScheduledPayment>): Promise<ScheduledPayment | undefined> {
    const now = new Date().toISOString();
    const result = await db.update(scheduledPayments)
      .set({ ...data, updatedAt: now } as any)
      .where(eq(scheduledPayments.id, id))
      .returning();
    return result[0];
  }

  async deleteScheduledPayment(id: string): Promise<boolean> {
    const result = await db.delete(scheduledPayments).where(eq(scheduledPayments.id, id)).returning();
    return result.length > 0;
  }

  async getDueScheduledPayments(beforeDate: string): Promise<ScheduledPayment[]> {
    return await db.select().from(scheduledPayments)
      .where(and(
        eq(scheduledPayments.status, 'active'),
        sql`${scheduledPayments.nextRunDate} <= ${beforeDate}`
      ));
  }

  async getRecurringPayrollEntries(companyId?: string): Promise<PayrollEntry[]> {
    if (companyId) {
      return await db.select().from(payrollEntries)
        .where(and(
          eq(payrollEntries.recurring, true),
          eq(payrollEntries.companyId, companyId)
        ))
        .orderBy(desc(payrollEntries.payDate));
    }
    return await db.select().from(payrollEntries)
      .where(eq(payrollEntries.recurring, true))
      .orderBy(desc(payrollEntries.payDate));
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
        // Use logger via dynamic import to avoid a circular import at top of file
        // (logger imports from middleware/auth which imports storage)
        // eslint-disable-next-line no-console
        console.log(`Skipping table ${table}: ${error}`);
      }
    }

    return { purgedTables };
  }

  // LU-008 / AUD-BE-003 — Two-admin destructive-action approval flow
  async createPendingDestructiveAction(input: InsertPendingDestructiveAction): Promise<PendingDestructiveAction> {
    const result = await db.insert(pendingDestructiveActions).values({
      ...input,
      initiatedAt: new Date().toISOString(),
    } as any).returning();
    return result[0];
  }

  async getPendingDestructiveAction(id: string): Promise<PendingDestructiveAction | undefined> {
    const result = await db.select().from(pendingDestructiveActions)
      .where(eq(pendingDestructiveActions.id, id))
      .limit(1);
    return result[0];
  }

  async markPendingDestructiveActionApproved(id: string, data: { approvedBy: string; approvedAt: string; executedAt?: string }): Promise<PendingDestructiveAction | undefined> {
    const result = await db.update(pendingDestructiveActions)
      .set({
        approvedBy: data.approvedBy,
        approvedAt: data.approvedAt,
        executedAt: data.executedAt ?? null,
      } as any)
      .where(eq(pendingDestructiveActions.id, id))
      .returning();
    return result[0];
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

  // ==================== COMPANIES ====================
  async getCompany(id: string): Promise<Company | undefined> {
    const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
    return result[0];
  }

  async getCompanyBySlug(slug: string): Promise<Company | undefined> {
    const result = await db.select().from(companies).where(eq(companies.slug, slug)).limit(1);
    return result[0];
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const now = new Date().toISOString();
    const result = await db.insert(companies).values({
      ...company,
      createdAt: now,
      updatedAt: now,
    } as any).returning();
    return result[0];
  }

  async updateCompany(id: string, data: Partial<Company>): Promise<Company | undefined> {
    const result = await db.update(companies)
      .set({ ...data, updatedAt: new Date().toISOString() } as any)
      .where(eq(companies.id, id))
      .returning();
    return result[0];
  }

  async getCompanies(): Promise<Company[]> {
    return await db.select().from(companies).orderBy(desc(companies.createdAt));
  }

  // ==================== COMPANY MEMBERS ====================
  async getCompanyMembers(companyId: string): Promise<CompanyMember[]> {
    return await db.select().from(companyMembers)
      .where(eq(companyMembers.companyId, companyId));
  }

  async getCompanyMember(companyId: string, userId: string): Promise<CompanyMember | undefined> {
    const result = await db.select().from(companyMembers)
      .where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)))
      .limit(1);
    return result[0];
  }

  async getCompanyMemberByEmail(companyId: string, email: string): Promise<CompanyMember | undefined> {
    const result = await db.select().from(companyMembers)
      .where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.email, email)))
      .limit(1);
    return result[0];
  }

  // Find all company memberships for a given email (across all companies)
  async getCompanyMembersByEmail(email: string): Promise<CompanyMember[]> {
    return await db.select().from(companyMembers)
      .where(and(eq(companyMembers.email, email), eq(companyMembers.status, 'active')));
  }

  async createCompanyMember(member: InsertCompanyMember): Promise<CompanyMember> {
    const result = await db.insert(companyMembers).values(member as any).returning();
    // LU-DD-3 / AUD-DD-TEAM-001 — mirror to team_members so legacy reads
    // and the team-management UI stay in sync during the soak window.
    await this.mirrorCompanyMemberToTeamMember(result[0]).catch((err) => {
      console.warn('[LU-DD-3] mirror company→team failed:', err?.message);
    });
    return result[0];
  }

  async updateCompanyMember(id: string, data: Partial<CompanyMember>): Promise<CompanyMember | undefined> {
    const result = await db.update(companyMembers)
      .set(data as any)
      .where(eq(companyMembers.id, id))
      .returning();
    if (result[0]) {
      await this.mirrorCompanyMemberToTeamMember(result[0]).catch((err) => {
        console.warn('[LU-DD-3] mirror company→team on update failed:', err?.message);
      });
    }
    return result[0];
  }

  async removeCompanyMember(id: string): Promise<boolean> {
    const existing = await db.select().from(companyMembers).where(eq(companyMembers.id, id)).limit(1);
    const result = await db.delete(companyMembers).where(eq(companyMembers.id, id)).returning();
    if (existing[0]) {
      await this.removeMirroredTeamMember(existing[0]).catch((err) => {
        console.warn('[LU-DD-3] mirror company→team on delete failed:', err?.message);
      });
    }
    return result.length > 0;
  }

  // LU-DD-3 — Reverse-direction parallel-write helpers.
  private async mirrorCompanyMemberToTeamMember(cm: CompanyMember): Promise<void> {
    if (!cm.companyId || !cm.email) return;
    const existing = await db.select().from(teamMembers)
      .where(and(
        eq(teamMembers.companyId, cm.companyId),
        sql`LOWER(${teamMembers.email}) = LOWER(${cm.email})`,
      ))
      .limit(1);
    const cmAny = cm as any;
    const fallbackName = cmAny.name ?? cm.email.split('@')[0] ?? 'Member';
    if (existing.length > 0) {
      await db.update(teamMembers)
        .set({
          userId: cm.userId ?? existing[0].userId,
          role: cm.role,
          status: cm.status,
          joinedAt: cm.joinedAt ?? existing[0].joinedAt,
          name: cmAny.name ?? existing[0].name,
          department: cmAny.department ?? existing[0].department,
          departmentId: cmAny.departmentId ?? (existing[0] as any).departmentId,
          avatar: cmAny.avatar ?? existing[0].avatar,
          permissions: cmAny.permissions ?? existing[0].permissions,
        } as any)
        .where(eq(teamMembers.id, existing[0].id));
    } else {
      await db.insert(teamMembers).values({
        companyId: cm.companyId,
        userId: cm.userId ?? null,
        email: cm.email,
        role: cm.role,
        status: cm.status,
        joinedAt: cm.joinedAt ?? cm.invitedAt ?? new Date().toISOString(),
        name: fallbackName,
        department: cmAny.department ?? 'General',
        departmentId: cmAny.departmentId ?? null,
        avatar: cmAny.avatar ?? null,
        permissions: cmAny.permissions ?? [],
      } as any);
    }
  }

  private async removeMirroredTeamMember(cm: CompanyMember): Promise<void> {
    if (!cm.companyId || !cm.email) return;
    await db.delete(teamMembers)
      .where(and(
        eq(teamMembers.companyId, cm.companyId),
        sql`LOWER(${teamMembers.email}) = LOWER(${cm.email})`,
      ));
  }

  async getUserCompanies(userId: string): Promise<CompanyMember[]> {
    // Search by userId (cognitoSub) first
    const byUserId = await db.select().from(companyMembers)
      .where(and(eq(companyMembers.userId, userId), eq(companyMembers.status, 'active')));
    if (byUserId.length > 0) return byUserId;

    // Fallback: check if any company has this user as owner (for cases where companyMember wasn't created)
    const ownedCompanies = await db.select().from(companies).where(eq(companies.ownerId, userId));
    if (ownedCompanies.length > 0) {
      // Auto-create missing companyMember records for owned companies
      const results: CompanyMember[] = [];
      for (const company of ownedCompanies) {
        const existing = await db.select().from(companyMembers)
          .where(and(eq(companyMembers.companyId, company.id), eq(companyMembers.userId, userId)));
        if (existing.length === 0) {
          const [member] = await db.insert(companyMembers).values({
            companyId: company.id,
            userId,
            email: '',
            role: 'OWNER',
            status: 'active',
            invitedAt: new Date().toISOString(),
            joinedAt: new Date().toISOString(),
          } as any).returning();
          results.push(member);
        } else {
          results.push(existing[0]);
        }
      }
      return results;
    }

    return [];
  }

  // ==================== COMPANY INVITATIONS ====================
  async getCompanyInvitations(companyId: string): Promise<CompanyInvitation[]> {
    return await db.select().from(companyInvitations)
      .where(eq(companyInvitations.companyId, companyId))
      .orderBy(desc(companyInvitations.createdAt));
  }

  async getCompanyInvitationByToken(token: string): Promise<CompanyInvitation | undefined> {
    const result = await db.select().from(companyInvitations)
      .where(eq(companyInvitations.token, token))
      .limit(1);
    return result[0];
  }

  async getCompanyInvitationByEmail(companyId: string, email: string): Promise<CompanyInvitation | undefined> {
    const result = await db.select().from(companyInvitations)
      .where(and(
        eq(companyInvitations.companyId, companyId),
        eq(companyInvitations.email, email),
        eq(companyInvitations.status, 'pending')
      ))
      .limit(1);
    return result[0];
  }

  async createCompanyInvitation(invitation: InsertCompanyInvitation): Promise<CompanyInvitation> {
    const result = await db.insert(companyInvitations).values(invitation as any).returning();
    return result[0];
  }

  async updateCompanyInvitation(id: string, data: Partial<CompanyInvitation>): Promise<CompanyInvitation | undefined> {
    const result = await db.update(companyInvitations)
      .set(data as any)
      .where(eq(companyInvitations.id, id))
      .returning();
    return result[0];
  }

  async revokeCompanyInvitation(id: string): Promise<boolean> {
    const result = await db.update(companyInvitations)
      .set({ status: 'revoked' } as any)
      .where(eq(companyInvitations.id, id))
      .returning();
    return result.length > 0;
  }

  async acceptInvitationTransaction(params: {
    invitationId: string;
    companyId: string;
    userId: string;
    email: string;
    role: string;
    createdAt: string;
  }): Promise<{ companyName?: string; walletId?: string }> {
    return await db.transaction(async (tx) => {
      await tx.update(companyInvitations)
        .set({ status: 'accepted', acceptedAt: new Date().toISOString() } as any)
        .where(eq(companyInvitations.id, params.invitationId));

      const existingMember = await tx.select().from(companyMembers)
        .where(and(eq(companyMembers.companyId, params.companyId), eq(companyMembers.userId, params.userId)))
        .limit(1);

      if (existingMember.length === 0) {
        await tx.insert(companyMembers).values({
          companyId: params.companyId,
          userId: params.userId,
          email: params.email,
          role: params.role,
          status: 'active',
          invitedAt: params.createdAt,
          joinedAt: new Date().toISOString(),
        } as any);
      }

      const teamMemberResult = await tx.select().from(teamMembers)
        .where(eq(teamMembers.email, params.email))
        .limit(1);

      if (teamMemberResult.length > 0) {
        await tx.update(teamMembers)
          .set({ status: 'active', userId: params.userId, companyId: params.companyId } as any)
          .where(eq(teamMembers.id, teamMemberResult[0].id));
      }

      await tx.update(userProfiles)
        .set({ companyId: params.companyId } as any)
        .where(eq(userProfiles.userId, params.userId));

      const existingWallet = await tx.select().from(wallets)
        .where(eq(wallets.userId, params.userId))
        .limit(1);

      let walletId: string | undefined;

      if (existingWallet.length === 0) {
        const companyResult = await tx.select().from(companies)
          .where(eq(companies.id, params.companyId))
          .limit(1);
        const company = companyResult[0];
        const newWallet = await tx.insert(wallets).values({
          userId: params.userId,
          companyId: params.companyId,
          type: 'personal',
          currency: company?.currency || 'USD',
          balance: '0',
          availableBalance: '0',
          pendingBalance: '0',
          status: 'active',
        } as any).returning();
        walletId = newWallet[0]?.id;
      } else if (!existingWallet[0].companyId) {
        await tx.update(wallets)
          .set({ companyId: params.companyId } as any)
          .where(eq(wallets.id, existingWallet[0].id));
        walletId = existingWallet[0].id;
      } else {
        walletId = existingWallet[0].id;
      }

      const companyResult = await tx.select().from(companies)
        .where(eq(companies.id, params.companyId))
        .limit(1);

      return {
        companyName: companyResult[0]?.name,
        walletId,
      };
    });
  }

  // ==================== ANALYTICS ====================
  async getAnalyticsSnapshots(periodType?: string): Promise<AnalyticsSnapshot[]> {
    if (periodType) {
      return db.select().from(analyticsSnapshots)
        .where(eq(analyticsSnapshots.periodType, periodType))
        .orderBy(desc(analyticsSnapshots.periodStart));
    }
    return db.select().from(analyticsSnapshots).orderBy(desc(analyticsSnapshots.periodStart));
  }

  async createAnalyticsSnapshot(snapshot: InsertAnalyticsSnapshot): Promise<AnalyticsSnapshot> {
    const result = await db.insert(analyticsSnapshots).values(snapshot as any).returning();
    return result[0];
  }

  async getBusinessInsights(category?: string): Promise<BusinessInsight[]> {
    if (category) {
      return db.select().from(businessInsights)
        .where(and(eq(businessInsights.category, category), eq(businessInsights.isActive, true)))
        .orderBy(desc(businessInsights.createdAt));
    }
    return db.select().from(businessInsights)
      .where(eq(businessInsights.isActive, true))
      .orderBy(desc(businessInsights.createdAt));
  }

  async createBusinessInsight(insight: InsertBusinessInsight): Promise<BusinessInsight> {
    const result = await db.insert(businessInsights).values(insight as any).returning();
    return result[0];
  }

  async clearBusinessInsights(): Promise<void> {
    await db.update(businessInsights).set({ isActive: false } as any);
  }

  // ==================== SUBSCRIPTIONS ====================
  async getSubscriptionByCompanyId(companyId: string): Promise<Subscription | undefined> {
    const result = await db.select().from(subscriptions).where(eq(subscriptions.companyId, companyId)).limit(1);
    return result[0];
  }

  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const result = await db.insert(subscriptions).values(subscription as any).returning();
    return result[0];
  }

  async updateSubscription(id: string, data: Partial<Subscription>): Promise<Subscription | undefined> {
    const result = await db.update(subscriptions).set({ ...data, updatedAt: new Date().toISOString() } as any).where(eq(subscriptions.id, id)).returning();
    return result[0];
  }
}

export const storage = new DatabaseStorage();
