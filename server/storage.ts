import { type User, type InsertUser, type Expense, type Transaction, type Bill, type Budget, type VirtualCard, type TeamMember, type CompanyBalances, type AIInsight } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Expenses
  getExpenses(): Promise<Expense[]>;
  createExpense(expense: Omit<Expense, 'id'>): Promise<Expense>;
  
  // Transactions
  getTransactions(): Promise<Transaction[]>;
  
  // Bills
  getBills(): Promise<Bill[]>;
  
  // Budgets
  getBudgets(): Promise<Budget[]>;
  
  // Cards
  getCards(): Promise<VirtualCard[]>;
  
  // Team
  getTeam(): Promise<TeamMember[]>;
  
  // Balances
  getBalances(): Promise<CompanyBalances>;
  
  // AI Insights
  getInsights(): Promise<AIInsight[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private expenses: Map<string, Expense>;
  private transactions: Map<string, Transaction>;
  private bills: Map<string, Bill>;
  private budgets: Map<string, Budget>;
  private cards: Map<string, VirtualCard>;
  private teamMembers: Map<string, TeamMember>;
  private balances: CompanyBalances;

  constructor() {
    this.users = new Map();
    this.expenses = new Map();
    this.transactions = new Map();
    this.bills = new Map();
    this.budgets = new Map();
    this.cards = new Map();
    this.teamMembers = new Map();
    this.balances = {
      local: 45850,
      usd: 78500,
      escrow: 12400,
      localCurrency: 'USD',
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
    const user: User = { ...insertUser, id, permissions: [] };
    this.users.set(id, user);
    return user;
  }

  async getExpenses(): Promise<Expense[]> {
    return Array.from(this.expenses.values()).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async createExpense(expense: Omit<Expense, 'id'>): Promise<Expense> {
    const id = randomUUID();
    const newExpense: Expense = { ...expense, id };
    this.expenses.set(id, newExpense);
    return newExpense;
  }

  async getTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async getBills(): Promise<Bill[]> {
    return Array.from(this.bills.values()).sort((a, b) => 
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );
  }

  async getBudgets(): Promise<Budget[]> {
    return Array.from(this.budgets.values());
  }

  async getCards(): Promise<VirtualCard[]> {
    return Array.from(this.cards.values());
  }

  async getTeam(): Promise<TeamMember[]> {
    return Array.from(this.teamMembers.values());
  }

  async getBalances(): Promise<CompanyBalances> {
    return this.balances;
  }

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
}

export const storage = new MemStorage();
