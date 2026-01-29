import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { 
  users, expenses, transactions, bills, budgets, virtualCards, 
  teamMembers, payrollEntries, invoices, vendors, reports,
  cardTransactions, virtualAccounts, companyBalances, companySettings,
  userProfiles, kycSubmissions,
  type User, type InsertUser, type Expense, type Transaction, type Bill, 
  type Budget, type VirtualCard, type TeamMember, type PayrollEntry, 
  type Invoice, type Vendor, type Report, type CardTransaction, 
  type VirtualAccount, type CompanyBalances, type CompanySettings, type AIInsight,
  type UserProfile, type InsertUserProfile, type KycSubmission, type InsertKycSubmission
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
  
  getTeam(): Promise<TeamMember[]>;
  getTeamMember(id: string): Promise<TeamMember | undefined>;
  createTeamMember(member: Omit<TeamMember, 'id'>): Promise<TeamMember>;
  updateTeamMember(id: string, member: Partial<Omit<TeamMember, 'id'>>): Promise<TeamMember | undefined>;
  deleteTeamMember(id: string): Promise<boolean>;
  
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
}

export const storage = new DatabaseStorage();
