import { type User, type InsertUser, type Expense, type Transaction, type Bill, type Budget, type VirtualCard, type TeamMember, type CompanyBalances, type AIInsight, type PayrollEntry, type Invoice, type Vendor, type CompanySettings } from "@shared/schema";

export interface Report {
  id: string;
  name: string;
  type: string;
  dateRange: string;
  createdAt: string;
  status: "completed" | "processing" | "scheduled";
  fileSize: string;
}

export interface CardTransaction {
  id: string;
  cardId: string;
  amount: number;
  merchant: string;
  category: string;
  description: string;
  status: "pending" | "completed" | "declined";
  date: string;
}

export interface VirtualAccount {
  id: string;
  name: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  currency: string;
  balance: number;
  type: "collection" | "disbursement";
  status: "active" | "inactive";
  createdAt: string;
}
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Expenses
  getExpenses(): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: Omit<Expense, 'id'>): Promise<Expense>;
  updateExpense(id: string, expense: Partial<Omit<Expense, 'id'>>): Promise<Expense | undefined>;
  deleteExpense(id: string): Promise<boolean>;
  
  // Transactions
  getTransactions(): Promise<Transaction[]>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  createTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction>;
  updateTransaction(id: string, transaction: Partial<Omit<Transaction, 'id'>>): Promise<Transaction | undefined>;
  deleteTransaction(id: string): Promise<boolean>;
  
  // Bills
  getBills(): Promise<Bill[]>;
  getBill(id: string): Promise<Bill | undefined>;
  createBill(bill: Omit<Bill, 'id'>): Promise<Bill>;
  updateBill(id: string, bill: Partial<Omit<Bill, 'id'>>): Promise<Bill | undefined>;
  deleteBill(id: string): Promise<boolean>;
  
  // Budgets
  getBudgets(): Promise<Budget[]>;
  getBudget(id: string): Promise<Budget | undefined>;
  createBudget(budget: Omit<Budget, 'id'>): Promise<Budget>;
  updateBudget(id: string, budget: Partial<Omit<Budget, 'id'>>): Promise<Budget | undefined>;
  deleteBudget(id: string): Promise<boolean>;
  
  // Cards
  getCards(): Promise<VirtualCard[]>;
  getCard(id: string): Promise<VirtualCard | undefined>;
  createCard(card: Omit<VirtualCard, 'id'>): Promise<VirtualCard>;
  updateCard(id: string, card: Partial<Omit<VirtualCard, 'id'>>): Promise<VirtualCard | undefined>;
  deleteCard(id: string): Promise<boolean>;
  
  // Card Transactions
  getCardTransactions(cardId: string): Promise<CardTransaction[]>;
  createCardTransaction(tx: Omit<CardTransaction, 'id'>): Promise<CardTransaction>;
  
  // Virtual Accounts
  getVirtualAccounts(): Promise<VirtualAccount[]>;
  getVirtualAccount(id: string): Promise<VirtualAccount | undefined>;
  createVirtualAccount(account: VirtualAccount): Promise<VirtualAccount>;
  updateVirtualAccount(id: string, data: Partial<VirtualAccount>): Promise<VirtualAccount | undefined>;
  
  // Team
  getTeam(): Promise<TeamMember[]>;
  getTeamMember(id: string): Promise<TeamMember | undefined>;
  createTeamMember(member: Omit<TeamMember, 'id'>): Promise<TeamMember>;
  updateTeamMember(id: string, member: Partial<Omit<TeamMember, 'id'>>): Promise<TeamMember | undefined>;
  deleteTeamMember(id: string): Promise<boolean>;
  
  // Balances
  getBalances(): Promise<CompanyBalances>;
  updateBalances(balances: Partial<CompanyBalances>): Promise<CompanyBalances>;
  
  // AI Insights
  getInsights(): Promise<AIInsight[]>;
  
  // Reports
  getReports(): Promise<Report[]>;
  createReport(report: Report): Promise<Report>;
  updateReport(id: string, report: Partial<Report>): Promise<Report | undefined>;
  deleteReport(id: string): Promise<boolean>;
  
  // Payroll
  getPayroll(): Promise<PayrollEntry[]>;
  getPayrollEntry(id: string): Promise<PayrollEntry | undefined>;
  createPayrollEntry(entry: Omit<PayrollEntry, 'id'>): Promise<PayrollEntry>;
  updatePayrollEntry(id: string, entry: Partial<Omit<PayrollEntry, 'id'>>): Promise<PayrollEntry | undefined>;
  deletePayrollEntry(id: string): Promise<boolean>;
  
  // Invoices
  getInvoices(): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: Omit<Invoice, 'id'>): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<Omit<Invoice, 'id'>>): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<boolean>;
  
  // Vendors
  getVendors(): Promise<Vendor[]>;
  getVendor(id: string): Promise<Vendor | undefined>;
  createVendor(vendor: Omit<Vendor, 'id'>): Promise<Vendor>;
  updateVendor(id: string, vendor: Partial<Omit<Vendor, 'id'>>): Promise<Vendor | undefined>;
  deleteVendor(id: string): Promise<boolean>;
  
  // Settings
  getSettings(): Promise<CompanySettings>;
  updateSettings(settings: Partial<CompanySettings>): Promise<CompanySettings>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private expenses: Map<string, Expense>;
  private transactions: Map<string, Transaction>;
  private bills: Map<string, Bill>;
  private budgets: Map<string, Budget>;
  private cards: Map<string, VirtualCard>;
  private cardTransactions: Map<string, CardTransaction>;
  private virtualAccounts: Map<string, VirtualAccount>;
  private teamMembers: Map<string, TeamMember>;
  private payrollEntries: Map<string, PayrollEntry>;
  private invoices: Map<string, Invoice>;
  private vendors: Map<string, Vendor>;
  private reports: Map<string, Report>;
  private balances: CompanyBalances;
  private settings: CompanySettings;

  constructor() {
    this.users = new Map();
    this.expenses = new Map();
    this.transactions = new Map();
    this.bills = new Map();
    this.budgets = new Map();
    this.cards = new Map();
    this.cardTransactions = new Map();
    this.virtualAccounts = new Map();
    this.teamMembers = new Map();
    this.payrollEntries = new Map();
    this.invoices = new Map();
    this.vendors = new Map();
    this.reports = new Map();
    this.balances = {
      local: 0,
      usd: 0,
      escrow: 0,
      localCurrency: 'USD',
    };
    this.settings = {
      companyName: 'Spendly',
      companyEmail: 'finance@spendly.com',
      companyPhone: '+1 (555) 123-4567',
      companyAddress: '123 Business Ave, San Francisco, CA 94105',
      currency: 'USD',
      timezone: 'America/Los_Angeles',
      fiscalYearStart: 'January',
      dateFormat: 'MM/DD/YYYY',
      language: 'en',
      notificationsEnabled: true,
      twoFactorEnabled: false,
      autoApproveBelow: 100,
      requireReceipts: true,
      expenseCategories: ['Software', 'Travel', 'Office', 'Marketing', 'Food', 'Equipment', 'Utilities', 'Legal', 'Other'],
      countryCode: 'US',
      region: 'North America',
      paymentProvider: 'stripe',
      paystackEnabled: true,
      stripeEnabled: true,
    };
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id, 
      permissions: [],
      avatar: null,
      department: insertUser.department || 'General',
      role: insertUser.role || 'EMPLOYEE',
    };
    this.users.set(id, user);
    return user;
  }

  // ==================== EXPENSES ====================
  async getExpenses(): Promise<Expense[]> {
    return Array.from(this.expenses.values()).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    return this.expenses.get(id);
  }

  async createExpense(expense: Omit<Expense, 'id'>): Promise<Expense> {
    const id = randomUUID();
    const newExpense: Expense = { ...expense, id };
    this.expenses.set(id, newExpense);
    return newExpense;
  }

  async updateExpense(id: string, expense: Partial<Omit<Expense, 'id'>>): Promise<Expense | undefined> {
    const existing = this.expenses.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...expense };
    this.expenses.set(id, updated);
    return updated;
  }

  async deleteExpense(id: string): Promise<boolean> {
    return this.expenses.delete(id);
  }

  // ==================== TRANSACTIONS ====================
  async getTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    return this.transactions.get(id);
  }

  async createTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
    const id = randomUUID();
    const newTransaction: Transaction = { ...transaction, id };
    this.transactions.set(id, newTransaction);
    return newTransaction;
  }

  async updateTransaction(id: string, transaction: Partial<Omit<Transaction, 'id'>>): Promise<Transaction | undefined> {
    const existing = this.transactions.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...transaction };
    this.transactions.set(id, updated);
    return updated;
  }

  async deleteTransaction(id: string): Promise<boolean> {
    return this.transactions.delete(id);
  }

  // ==================== BILLS ====================
  async getBills(): Promise<Bill[]> {
    return Array.from(this.bills.values()).sort((a, b) => 
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );
  }

  async getBill(id: string): Promise<Bill | undefined> {
    return this.bills.get(id);
  }

  async createBill(bill: Omit<Bill, 'id'>): Promise<Bill> {
    const id = randomUUID();
    const newBill: Bill = { ...bill, id };
    this.bills.set(id, newBill);
    return newBill;
  }

  async updateBill(id: string, bill: Partial<Omit<Bill, 'id'>>): Promise<Bill | undefined> {
    const existing = this.bills.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...bill };
    this.bills.set(id, updated);
    return updated;
  }

  async deleteBill(id: string): Promise<boolean> {
    return this.bills.delete(id);
  }

  // ==================== BUDGETS ====================
  async getBudgets(): Promise<Budget[]> {
    return Array.from(this.budgets.values());
  }

  async getBudget(id: string): Promise<Budget | undefined> {
    return this.budgets.get(id);
  }

  async createBudget(budget: Omit<Budget, 'id'>): Promise<Budget> {
    const id = randomUUID();
    const newBudget: Budget = { ...budget, id };
    this.budgets.set(id, newBudget);
    return newBudget;
  }

  async updateBudget(id: string, budget: Partial<Omit<Budget, 'id'>>): Promise<Budget | undefined> {
    const existing = this.budgets.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...budget };
    this.budgets.set(id, updated);
    return updated;
  }

  async deleteBudget(id: string): Promise<boolean> {
    return this.budgets.delete(id);
  }

  // ==================== CARDS ====================
  async getCards(): Promise<VirtualCard[]> {
    return Array.from(this.cards.values());
  }

  async getCard(id: string): Promise<VirtualCard | undefined> {
    return this.cards.get(id);
  }

  async createCard(card: Omit<VirtualCard, 'id'>): Promise<VirtualCard> {
    const id = randomUUID();
    const newCard: VirtualCard = { ...card, id };
    this.cards.set(id, newCard);
    return newCard;
  }

  async updateCard(id: string, card: Partial<Omit<VirtualCard, 'id'>>): Promise<VirtualCard | undefined> {
    const existing = this.cards.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...card };
    this.cards.set(id, updated);
    return updated;
  }

  async deleteCard(id: string): Promise<boolean> {
    return this.cards.delete(id);
  }

  // ==================== CARD TRANSACTIONS ====================
  async getCardTransactions(cardId: string): Promise<CardTransaction[]> {
    return Array.from(this.cardTransactions.values())
      .filter(tx => tx.cardId === cardId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async createCardTransaction(tx: Omit<CardTransaction, 'id'>): Promise<CardTransaction> {
    const id = randomUUID();
    const newTx: CardTransaction = { ...tx, id };
    this.cardTransactions.set(id, newTx);
    return newTx;
  }

  // ==================== VIRTUAL ACCOUNTS ====================
  async getVirtualAccounts(): Promise<VirtualAccount[]> {
    return Array.from(this.virtualAccounts.values());
  }

  async getVirtualAccount(id: string): Promise<VirtualAccount | undefined> {
    return this.virtualAccounts.get(id);
  }

  async createVirtualAccount(account: VirtualAccount): Promise<VirtualAccount> {
    this.virtualAccounts.set(account.id, account);
    return account;
  }

  async updateVirtualAccount(id: string, data: Partial<VirtualAccount>): Promise<VirtualAccount | undefined> {
    const existing = this.virtualAccounts.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.virtualAccounts.set(id, updated);
    return updated;
  }

  // ==================== TEAM ====================
  async getTeam(): Promise<TeamMember[]> {
    return Array.from(this.teamMembers.values());
  }

  async getTeamMember(id: string): Promise<TeamMember | undefined> {
    return this.teamMembers.get(id);
  }

  async createTeamMember(member: Omit<TeamMember, 'id'>): Promise<TeamMember> {
    const id = randomUUID();
    const newMember: TeamMember = { ...member, id };
    this.teamMembers.set(id, newMember);
    return newMember;
  }

  async updateTeamMember(id: string, member: Partial<Omit<TeamMember, 'id'>>): Promise<TeamMember | undefined> {
    const existing = this.teamMembers.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...member };
    this.teamMembers.set(id, updated);
    return updated;
  }

  async deleteTeamMember(id: string): Promise<boolean> {
    return this.teamMembers.delete(id);
  }

  // ==================== BALANCES ====================
  async getBalances(): Promise<CompanyBalances> {
    return this.balances;
  }

  async updateBalances(balances: Partial<CompanyBalances>): Promise<CompanyBalances> {
    this.balances = { ...this.balances, ...balances };
    return this.balances;
  }

  // ==================== AI INSIGHTS ====================
  async getInsights(): Promise<AIInsight[]> {
    return [
      {
        title: 'Reduce Software Spending',
        description: 'Your software budget is at 75% utilization. Consider consolidating tools to save $2,500/month.',
        type: 'saving',
      },
      {
        title: 'Marketing Budget Alert',
        description: 'Marketing spend is trending 20% higher than last month. Review campaign ROI.',
        type: 'warning',
      },
      {
        title: 'Cash Flow Positive',
        description: 'Your business has maintained positive cash flow for 6 consecutive months.',
        type: 'info',
      },
    ];
  }

  // ==================== REPORTS ====================
  async getReports(): Promise<Report[]> {
    return Array.from(this.reports.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async createReport(report: Report): Promise<Report> {
    this.reports.set(report.id, report);
    return report;
  }

  async updateReport(id: string, data: Partial<Report>): Promise<Report | undefined> {
    const report = this.reports.get(id);
    if (!report) return undefined;
    const updated = { ...report, ...data };
    this.reports.set(id, updated);
    return updated;
  }

  async deleteReport(id: string): Promise<boolean> {
    return this.reports.delete(id);
  }

  // ==================== PAYROLL ====================
  async getPayroll(): Promise<PayrollEntry[]> {
    return Array.from(this.payrollEntries.values()).sort((a, b) => 
      new Date(b.payDate).getTime() - new Date(a.payDate).getTime()
    );
  }

  async getPayrollEntry(id: string): Promise<PayrollEntry | undefined> {
    return this.payrollEntries.get(id);
  }

  async createPayrollEntry(entry: Omit<PayrollEntry, 'id'>): Promise<PayrollEntry> {
    const id = randomUUID();
    const newEntry: PayrollEntry = { ...entry, id };
    this.payrollEntries.set(id, newEntry);
    return newEntry;
  }

  async updatePayrollEntry(id: string, entry: Partial<Omit<PayrollEntry, 'id'>>): Promise<PayrollEntry | undefined> {
    const existing = this.payrollEntries.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...entry };
    this.payrollEntries.set(id, updated);
    return updated;
  }

  async deletePayrollEntry(id: string): Promise<boolean> {
    return this.payrollEntries.delete(id);
  }

  // ==================== INVOICES ====================
  async getInvoices(): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).sort((a, b) => 
      new Date(b.issuedDate).getTime() - new Date(a.issuedDate).getTime()
    );
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    return this.invoices.get(id);
  }

  async createInvoice(invoice: Omit<Invoice, 'id'>): Promise<Invoice> {
    const id = randomUUID();
    const newInvoice: Invoice = { ...invoice, id };
    this.invoices.set(id, newInvoice);
    return newInvoice;
  }

  async updateInvoice(id: string, invoice: Partial<Omit<Invoice, 'id'>>): Promise<Invoice | undefined> {
    const existing = this.invoices.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...invoice };
    this.invoices.set(id, updated);
    return updated;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    return this.invoices.delete(id);
  }

  // ==================== VENDORS ====================
  async getVendors(): Promise<Vendor[]> {
    return Array.from(this.vendors.values());
  }

  async getVendor(id: string): Promise<Vendor | undefined> {
    return this.vendors.get(id);
  }

  async createVendor(vendor: Omit<Vendor, 'id'>): Promise<Vendor> {
    const id = randomUUID();
    const newVendor: Vendor = { ...vendor, id };
    this.vendors.set(id, newVendor);
    return newVendor;
  }

  async updateVendor(id: string, vendor: Partial<Omit<Vendor, 'id'>>): Promise<Vendor | undefined> {
    const existing = this.vendors.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...vendor };
    this.vendors.set(id, updated);
    return updated;
  }

  async deleteVendor(id: string): Promise<boolean> {
    return this.vendors.delete(id);
  }

  // ==================== SETTINGS ====================
  async getSettings(): Promise<CompanySettings> {
    return this.settings;
  }

  async updateSettings(settings: Partial<CompanySettings>): Promise<CompanySettings> {
    this.settings = { ...this.settings, ...settings };
    return this.settings;
  }
}

export const storage = new MemStorage();
