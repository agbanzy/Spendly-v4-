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
    this.teamMembers = new Map();
    this.payrollEntries = new Map();
    this.invoices = new Map();
    this.vendors = new Map();
    this.reports = new Map();
    this.balances = {
      local: 45850,
      usd: 78500,
      escrow: 12400,
      localCurrency: 'USD',
    };
    this.settings = {
      companyName: 'Acme Corporation',
      companyEmail: 'finance@acme.com',
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
      paystackEnabled: false,
      stripeEnabled: true,
    };
    
    this.initializeDemoData();
  }

  private initializeDemoData() {
    // Demo expenses
    const demoExpenses: Omit<Expense, 'id'>[] = [
      { merchant: 'AWS', amount: 2499, currency: 'USD', date: '2026-01-28', category: 'Software', status: 'PAID', user: 'John Doe', userId: '1', department: 'Engineering', note: 'Cloud hosting' },
      { merchant: 'Figma', amount: 45, currency: 'USD', date: '2026-01-27', category: 'Software', status: 'PAID', user: 'Sarah Chen', userId: '2', department: 'Marketing' },
      { merchant: 'Delta Airlines', amount: 890, currency: 'USD', date: '2026-01-26', category: 'Travel', status: 'PENDING', user: 'Mike Johnson', userId: '3', department: 'Sales' },
      { merchant: 'WeWork', amount: 1200, currency: 'USD', date: '2026-01-25', category: 'Office', status: 'APPROVED', user: 'John Doe', userId: '1', department: 'General' },
      { merchant: 'Google Ads', amount: 5000, currency: 'USD', date: '2026-01-24', category: 'Marketing', status: 'PAID', user: 'Sarah Chen', userId: '2', department: 'Marketing' },
      { merchant: 'Uber', amount: 156, currency: 'USD', date: '2026-01-23', category: 'Travel', status: 'PAID', user: 'Mike Johnson', userId: '3', department: 'Sales' },
      { merchant: 'Slack', amount: 12.50, currency: 'USD', date: '2026-01-22', category: 'Software', status: 'PAID', user: 'John Doe', userId: '1', department: 'Engineering' },
      { merchant: 'Office Depot', amount: 345, currency: 'USD', date: '2026-01-21', category: 'Office', status: 'REJECTED', user: 'Emily Brown', userId: '4', department: 'HR' },
    ];
    
    demoExpenses.forEach((exp) => {
      const id = randomUUID();
      this.expenses.set(id, { ...exp, id });
    });

    // Demo transactions
    const demoTransactions: Omit<Transaction, 'id'>[] = [
      { type: 'Deposit', amount: 50000, fee: 0, status: 'Completed', date: '2026-01-28', description: 'Wire transfer from Client A', currency: 'USD' },
      { type: 'Payout', amount: 2499, fee: 2.50, status: 'Completed', date: '2026-01-28', description: 'AWS Payment', currency: 'USD' },
      { type: 'Payout', amount: 5000, fee: 5, status: 'Processing', date: '2026-01-27', description: 'Google Ads Campaign', currency: 'USD' },
      { type: 'Funding', amount: 25000, fee: 0, status: 'Completed', date: '2026-01-26', description: 'Capital injection', currency: 'USD' },
      { type: 'Bill', amount: 1200, fee: 0, status: 'Completed', date: '2026-01-25', description: 'WeWork Monthly', currency: 'USD' },
      { type: 'Refund', amount: 345, fee: 0, status: 'Completed', date: '2026-01-24', description: 'Office Depot refund', currency: 'USD' },
      { type: 'Payout', amount: 890, fee: 1.50, status: 'Pending', date: '2026-01-23', description: 'Delta Airlines booking', currency: 'USD' },
    ];
    
    demoTransactions.forEach((tx) => {
      const id = randomUUID();
      this.transactions.set(id, { ...tx, id });
    });

    // Demo bills
    const demoBills: Omit<Bill, 'id'>[] = [
      { name: 'AWS Hosting', provider: 'Amazon Web Services', amount: 2499, dueDate: '2026-02-01', category: 'Software', status: 'Unpaid', currency: 'USD' },
      { name: 'Office Rent', provider: 'WeWork', amount: 3500, dueDate: '2026-02-01', category: 'Office', status: 'Unpaid', currency: 'USD' },
      { name: 'Internet', provider: 'Comcast Business', amount: 299, dueDate: '2026-01-15', category: 'Utilities', status: 'Paid', currency: 'USD' },
      { name: 'Insurance', provider: 'State Farm', amount: 1200, dueDate: '2026-01-10', category: 'Legal', status: 'Paid', currency: 'USD' },
      { name: 'Google Workspace', provider: 'Google', amount: 144, dueDate: '2026-01-05', category: 'Software', status: 'Overdue', currency: 'USD' },
    ];
    
    demoBills.forEach((bill) => {
      const id = randomUUID();
      this.bills.set(id, { ...bill, id });
    });

    // Demo budgets
    const demoBudgets: Omit<Budget, 'id'>[] = [
      { name: 'Software & Tools', category: 'Software', limit: 10000, spent: 7540, currency: 'USD', period: 'monthly' },
      { name: 'Marketing Spend', category: 'Marketing', limit: 15000, spent: 12500, currency: 'USD', period: 'monthly' },
      { name: 'Travel Expenses', category: 'Travel', limit: 5000, spent: 2890, currency: 'USD', period: 'monthly' },
      { name: 'Office Operations', category: 'Office', limit: 8000, spent: 4200, currency: 'USD', period: 'monthly' },
      { name: 'Employee Benefits', category: 'Other', limit: 20000, spent: 22500, currency: 'USD', period: 'monthly' },
    ];
    
    demoBudgets.forEach((budget) => {
      const id = randomUUID();
      this.budgets.set(id, { ...budget, id });
    });

    // Demo cards
    const demoCards: Omit<VirtualCard, 'id'>[] = [
      { name: 'Marketing Team', last4: '4532', balance: 8500, limit: 15000, type: 'Visa', color: 'indigo', currency: 'USD', status: 'Active' },
      { name: 'Engineering', last4: '7891', balance: 12340, limit: 25000, type: 'Mastercard', color: 'emerald', currency: 'USD', status: 'Active' },
      { name: 'Travel Card', last4: '2345', balance: 3200, limit: 10000, type: 'Visa', color: 'rose', currency: 'USD', status: 'Active' },
      { name: 'Office Supplies', last4: '6789', balance: 1500, limit: 5000, type: 'Visa', color: 'amber', currency: 'USD', status: 'Frozen' },
    ];
    
    demoCards.forEach((card) => {
      const id = randomUUID();
      this.cards.set(id, { ...card, id });
    });

    // Demo team members
    const demoTeam: Omit<TeamMember, 'id'>[] = [
      { name: 'John Doe', email: 'john@acme.com', role: 'OWNER', department: 'General', status: 'Active', joinedAt: '2024-01-15', permissions: ['VIEW_TREASURY', 'MANAGE_TREASURY', 'CREATE_EXPENSE', 'APPROVE_EXPENSE', 'MANAGE_TEAM', 'VIEW_REPORTS', 'MANAGE_SETTINGS'] },
      { name: 'Sarah Chen', email: 'sarah@acme.com', role: 'ADMIN', department: 'Marketing', status: 'Active', joinedAt: '2024-03-01', permissions: ['VIEW_TREASURY', 'CREATE_EXPENSE', 'APPROVE_EXPENSE', 'VIEW_REPORTS'] },
      { name: 'Mike Johnson', email: 'mike@acme.com', role: 'MANAGER', department: 'Sales', status: 'Active', joinedAt: '2024-06-15', permissions: ['CREATE_EXPENSE', 'VIEW_REPORTS'] },
      { name: 'Emily Brown', email: 'emily@acme.com', role: 'EMPLOYEE', department: 'HR', status: 'Active', joinedAt: '2024-09-01', permissions: ['CREATE_EXPENSE'] },
      { name: 'Alex Rivera', email: 'alex@acme.com', role: 'EMPLOYEE', department: 'Engineering', status: 'Active', joinedAt: '2025-01-10', permissions: ['CREATE_EXPENSE'] },
      { name: 'Lisa Park', email: 'lisa@acme.com', role: 'VIEWER', department: 'Finance', status: 'Inactive', joinedAt: '2025-06-01', permissions: ['VIEW_REPORTS'] },
    ];
    
    demoTeam.forEach((member) => {
      const id = randomUUID();
      this.teamMembers.set(id, { ...member, id });
    });

    // Demo payroll
    const demoPayroll: Omit<PayrollEntry, 'id'>[] = [
      { employeeId: '1', employeeName: 'John Doe', department: 'Engineering', salary: 8500, bonus: 1000, deductions: 1200, netPay: 8300, status: 'paid', payDate: '2026-01-25' },
      { employeeId: '2', employeeName: 'Sarah Chen', department: 'Marketing', salary: 7200, bonus: 500, deductions: 950, netPay: 6750, status: 'paid', payDate: '2026-01-25' },
      { employeeId: '3', employeeName: 'Mike Johnson', department: 'Sales', salary: 6500, bonus: 2200, deductions: 1100, netPay: 7600, status: 'pending', payDate: '2026-02-01' },
      { employeeId: '4', employeeName: 'Emily Brown', department: 'HR', salary: 5800, bonus: 0, deductions: 780, netPay: 5020, status: 'pending', payDate: '2026-02-01' },
      { employeeId: '5', employeeName: 'Alex Rivera', department: 'Engineering', salary: 7800, bonus: 800, deductions: 1050, netPay: 7550, status: 'processing', payDate: '2026-01-28' },
    ];
    
    demoPayroll.forEach((entry) => {
      const id = randomUUID();
      this.payrollEntries.set(id, { ...entry, id });
    });

    // Demo invoices
    const demoInvoices: Omit<Invoice, 'id'>[] = [
      { invoiceNumber: 'INV-2026-001', client: 'TechCorp Inc.', clientEmail: 'billing@techcorp.com', amount: 15000, dueDate: '2026-02-15', issuedDate: '2026-01-15', status: 'pending', items: [{ description: 'Consulting Services', quantity: 40, rate: 375 }] },
      { invoiceNumber: 'INV-2026-002', client: 'GlobalScale Ltd.', clientEmail: 'accounts@globalscale.com', amount: 8500, dueDate: '2026-01-20', issuedDate: '2026-01-05', status: 'paid', items: [{ description: 'Software Development', quantity: 1, rate: 8500 }] },
      { invoiceNumber: 'INV-2026-003', client: 'StartupHub', clientEmail: 'finance@startuphub.io', amount: 3200, dueDate: '2026-01-10', issuedDate: '2025-12-15', status: 'overdue', items: [{ description: 'Design Services', quantity: 16, rate: 200 }] },
      { invoiceNumber: 'INV-2026-004', client: 'Acme Corp', clientEmail: 'billing@acme.com', amount: 22000, dueDate: '2026-03-01', issuedDate: '2026-01-28', status: 'draft', items: [{ description: 'Annual Maintenance', quantity: 1, rate: 22000 }] },
    ];
    
    demoInvoices.forEach((invoice) => {
      const id = randomUUID();
      this.invoices.set(id, { ...invoice, id });
    });

    // Demo vendors
    const demoVendors: Omit<Vendor, 'id'>[] = [
      { name: 'Amazon Web Services', email: 'billing@aws.amazon.com', phone: '+1 (888) 123-4567', address: 'Seattle, WA, USA', category: 'Cloud Services', status: 'active', totalPaid: 28500, pendingPayments: 2499, lastPayment: '2026-01-28' },
      { name: 'Google Cloud', email: 'billing@google.com', phone: '+1 (800) 555-0123', address: 'Mountain View, CA, USA', category: 'Cloud Services', status: 'active', totalPaid: 12000, pendingPayments: 0, lastPayment: '2026-01-15' },
      { name: 'Figma Inc.', email: 'enterprise@figma.com', phone: '+1 (415) 555-7890', address: 'San Francisco, CA, USA', category: 'Design Tools', status: 'active', totalPaid: 540, pendingPayments: 45, lastPayment: '2026-01-27' },
      { name: 'WeWork', email: 'invoices@wework.com', phone: '+1 (212) 555-4567', address: 'New York, NY, USA', category: 'Office Space', status: 'active', totalPaid: 14400, pendingPayments: 1200, lastPayment: '2026-01-25' },
      { name: 'Comcast Business', email: 'business@comcast.com', phone: '+1 (800) 555-9876', address: 'Philadelphia, PA, USA', category: 'Utilities', status: 'active', totalPaid: 3588, pendingPayments: 0, lastPayment: '2026-01-15' },
    ];
    
    demoVendors.forEach((vendor) => {
      const id = randomUUID();
      this.vendors.set(id, { ...vendor, id });
    });
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
