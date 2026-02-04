import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { paymentService, REGION_CONFIGS, getRegionConfig, getCurrencyForCountry } from "./paymentService";
import { getStripePublishableKey } from "./stripeClient";
import { getPaystackPublicKey, paystackClient } from "./paystackClient";
import { notificationService } from "./services/notification-service";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  authLimiter,
  sensitiveLimiter,
  financialLimiter,
  emailLimiter
} from "./middleware/rateLimiter";
import { requireAuth, requireAdmin } from "./middleware/auth";

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const receiptStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: receiptStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF are allowed.'));
    }
  }
});

const expenseSchema = z.object({
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

const transactionSchema = z.object({
  type: z.string().min(1),
  amount: z.union([z.string(), z.number()]).transform(val => String(val)),
  description: z.string().optional(),
  fee: z.union([z.string(), z.number()]).optional().transform(val => String(val || '0')),
});

const billSchema = z.object({
  name: z.string().min(1),
  provider: z.string().optional().default(''),
  amount: z.union([z.string(), z.number()]).transform(val => String(val)),
  dueDate: z.string().min(1),
  category: z.string().optional().default('Other'),
});

const budgetSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  limit: z.union([z.string(), z.number()]).transform(val => String(val)),
  period: z.string().optional().default('monthly'),
});

const cardSchema = z.object({
  name: z.string().min(1),
  limit: z.union([z.string(), z.number()]).transform(val => String(val)),
  type: z.string().optional().default('Visa'),
  color: z.string().optional().default('indigo'),
  currency: z.string().optional().default('USD'),
});

const teamMemberSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.string().optional().default('EMPLOYEE'),
  department: z.string().optional().default('General'),
});

const departmentSchema = z.object({
  name: z.string().min(1, "Department name is required"),
  description: z.string().optional().nullable(),
  headId: z.string().optional().nullable(),
  budget: z.union([z.string(), z.number()]).optional().nullable().transform(val => {
    if (val === null || val === undefined || val === '') return null;
    return typeof val === 'string' ? parseFloat(val) || null : val;
  }),
  color: z.string().optional().default('#6366f1'),
});

const departmentUpdateSchema = departmentSchema.partial().extend({
  status: z.string().optional(),
  memberCount: z.number().optional(),
});

const payrollSchema = z.object({
  employeeId: z.string().optional(),
  employeeName: z.string().min(1),
  department: z.string().optional().default('General'),
  salary: z.union([z.string(), z.number()]).transform(val => String(val)),
  bonus: z.union([z.string(), z.number()]).optional().transform(val => String(val || '0')),
  deductions: z.union([z.string(), z.number()]).optional().transform(val => String(val || '0')),
  payDate: z.string().optional(),
});

const invoiceSchema = z.object({
  client: z.string().min(1),
  clientEmail: z.string().optional().default(''),
  amount: z.union([z.string(), z.number()]).transform(val => String(val)),
  dueDate: z.string().optional(),
  items: z.array(z.any()).optional().default([]),
});

const vendorSchema = z.object({
  name: z.string().min(1),
  email: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  address: z.string().optional().default(''),
  category: z.string().optional().default('Other'),
});

const expenseUpdateSchema = expenseSchema.partial().extend({
  status: z.string().optional(),
  rejectionReason: z.string().optional(),
});
const transactionUpdateSchema = transactionSchema.partial();
const billUpdateSchema = billSchema.partial().extend({
  status: z.string().optional(),
});
const budgetUpdateSchema = budgetSchema.partial().extend({
  spent: z.union([z.string(), z.number()]).optional().transform(val => String(val || '0')),
});
const cardUpdateSchema = cardSchema.partial().extend({
  status: z.string().optional(),
  balance: z.union([z.string(), z.number()]).optional().transform(val => String(val || '0')),
});
const teamMemberUpdateSchema = teamMemberSchema.partial().extend({
  status: z.string().optional(),
});
const payrollUpdateSchema = payrollSchema.partial().extend({
  status: z.enum(['pending', 'processing', 'paid']).optional(),
  netPay: z.union([z.string(), z.number()]).optional().transform(val => String(val || '0')),
  bankName: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  accountName: z.string().optional().nullable(),
});
const invoiceUpdateSchema = invoiceSchema.partial().extend({
  status: z.string().optional(),
});
const vendorUpdateSchema = vendorSchema.partial().extend({
  status: z.string().optional(),
  totalPaid: z.union([z.string(), z.number()]).optional().transform(val => String(val || '0')),
  pendingPayments: z.union([z.string(), z.number()]).optional().transform(val => String(val || '0')),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ==================== BALANCES ====================
  app.get("/api/balances", async (req, res) => {
    try {
      const balances = await storage.getBalances();
      res.json(balances);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch balances" });
    }
  });

  app.patch("/api/balances", async (req, res) => {
    try {
      const balances = await storage.updateBalances(req.body);
      res.json(balances);
    } catch (error) {
      res.status(500).json({ error: "Failed to update balances" });
    }
  });

  app.post("/api/balances/fund", async (req, res) => {
    try {
      const { amount } = req.body;
      const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
      
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      const currentBalances = await storage.getBalances();
      const currentLocal = parseFloat(String(currentBalances?.local || 0));
      const newLocal = currentLocal + parsedAmount;
      
      await storage.createTransaction({
        type: "Funding",
        amount: String(parsedAmount),
        fee: "0",
        status: 'Completed',
        date: new Date().toISOString().split('T')[0],
        description: "Wallet Funding",
        currency: 'USD',
      });
      
      const updatedBalances = await storage.updateBalances({ local: String(newLocal) });
      res.json(updatedBalances);
    } catch (error) {
      res.status(500).json({ error: "Failed to fund wallet" });
    }
  });

  app.post("/api/balances/withdraw", async (req, res) => {
    try {
      const { amount } = req.body;
      const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
      
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      const currentBalances = await storage.getBalances();
      const currentLocal = parseFloat(String(currentBalances?.local || 0));
      
      if (parsedAmount > currentLocal) {
        return res.status(400).json({ error: "Insufficient funds" });
      }

      const newLocal = currentLocal - parsedAmount;
      
      await storage.createTransaction({
        type: "Payout",
        amount: String(parsedAmount),
        fee: "0",
        status: 'Completed',
        date: new Date().toISOString().split('T')[0],
        description: "Wallet Withdrawal",
        currency: 'USD',
      });
      
      const updatedBalances = await storage.updateBalances({ local: String(newLocal) });
      res.json(updatedBalances);
    } catch (error) {
      res.status(500).json({ error: "Failed to withdraw" });
    }
  });

  app.post("/api/balances/send", async (req, res) => {
    try {
      const { amount, recipient, note } = req.body;
      const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
      
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }
      
      if (!recipient) {
        return res.status(400).json({ error: "Recipient required" });
      }

      const currentBalances = await storage.getBalances();
      const currentLocal = parseFloat(String(currentBalances?.local || 0));
      
      if (parsedAmount > currentLocal) {
        return res.status(400).json({ error: "Insufficient funds" });
      }

      const newLocal = currentLocal - parsedAmount;
      
      await storage.createTransaction({
        type: "Payout",
        amount: String(parsedAmount),
        fee: "0",
        status: 'Completed',
        date: new Date().toISOString().split('T')[0],
        description: `Payment to ${recipient}${note ? ` - ${note}` : ''}`,
        currency: 'USD',
      });
      
      const updatedBalances = await storage.updateBalances({ local: String(newLocal) });
      res.json(updatedBalances);
    } catch (error) {
      res.status(500).json({ error: "Failed to send money" });
    }
  });

  // ==================== EXPENSES ====================
  app.get("/api/expenses", async (req, res) => {
    try {
      const expenses = await storage.getExpenses();
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.get("/api/expenses/:id", async (req, res) => {
    try {
      const expense = await storage.getExpense(req.params.id);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expense" });
    }
  });

  app.use('/uploads', (await import('express')).default.static(uploadDir));

  app.post("/api/upload/receipt", upload.single('receipt'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const fileUrl = `/uploads/${req.file.filename}`;
      res.json({ success: true, url: fileUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to upload file" });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const result = expenseSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid expense data", details: result.error.issues });
      }
      const { merchant, amount, category, note, receiptUrl, expenseType, attachments, taggedReviewers, userId, user } = result.data;

      // Get company settings for auto-approval and currency
      const settings = await storage.getSettings();
      const currency = settings.currency || 'USD';
      const autoApproveThreshold = parseFloat(settings.autoApproveBelow?.toString() || '100');
      const expenseAmount = parseFloat(amount);
      
      // Determine status based on expense type and auto-approval threshold
      let status = 'PENDING';
      let autoApproved = false;
      
      if (expenseType === 'spent') {
        // Already spent - auto approve
        status = 'APPROVED';
        autoApproved = true;
      } else if (expenseAmount <= autoApproveThreshold) {
        // Below auto-approve threshold
        status = 'APPROVED';
        autoApproved = true;
      }

      const expense = await storage.createExpense({
        merchant,
        amount,
        currency,
        date: new Date().toISOString().split('T')[0],
        category,
        status,
        user: user || 'Unknown User',
        userId: userId || '1',
        department: 'General',
        note: note || null,
        receiptUrl: receiptUrl || null,
        expenseType: expenseType || 'request',
        attachments: attachments || [],
        taggedReviewers: taggedReviewers || [],
      });
      
      res.status(201).json({ ...expense, autoApproved });
    } catch (error) {
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  app.patch("/api/expenses/:id", async (req, res) => {
    try {
      const result = expenseUpdateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid expense data", details: result.error.issues });
      }
      
      const originalExpense = await storage.getExpense(req.params.id);
      const expense = await storage.updateExpense(req.params.id, result.data);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      
      // Send notification if status changed
      if (originalExpense && expense.status !== originalExpense.status) {
        const userId = (expense as any).submittedBy || expense.userId || 'system';
        
        if (expense.status === 'APPROVED') {
          notificationService.notifyExpenseApproved(userId, {
            id: expense.id,
            merchant: expense.merchant,
            amount: parseFloat(expense.amount),
          }).catch(console.error);
        } else if (expense.status === 'REJECTED') {
          notificationService.notifyExpenseRejected(userId, {
            id: expense.id,
            merchant: expense.merchant,
            amount: parseFloat(expense.amount),
            reason: result.data.rejectionReason,
          }).catch(console.error);
        }
      }
      
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: "Failed to update expense" });
    }
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteExpense(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  // ==================== TRANSACTIONS ====================
  app.get("/api/transactions", async (req, res) => {
    try {
      const transactions = await storage.getTransactions();
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.get("/api/transactions/:id", async (req, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transaction" });
    }
  });

  app.post("/api/transactions", async (req, res) => {
    try {
      const result = transactionSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid transaction data", details: result.error.issues });
      }
      const { type, amount, description, fee } = result.data;

      const transaction = await storage.createTransaction({
        type: type,
        amount: String(amount),
        fee: String(fee || 0),
        status: 'Completed',
        date: new Date().toISOString().split('T')[0],
        description: description || '',
        currency: 'USD',
      });
      
      res.status(201).json(transaction);
    } catch (error) {
      res.status(500).json({ error: "Failed to create transaction" });
    }
  });

  app.patch("/api/transactions/:id", async (req, res) => {
    try {
      const result = transactionUpdateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid transaction data", details: result.error.issues });
      }
      const transaction = await storage.updateTransaction(req.params.id, result.data as any);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ error: "Failed to update transaction" });
    }
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteTransaction(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete transaction" });
    }
  });

  // ==================== BILLS ====================
  app.get("/api/bills", async (req, res) => {
    try {
      const bills = await storage.getBills();
      res.json(bills);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bills" });
    }
  });

  app.get("/api/bills/:id", async (req, res) => {
    try {
      const bill = await storage.getBill(req.params.id);
      if (!bill) {
        return res.status(404).json({ error: "Bill not found" });
      }
      res.json(bill);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bill" });
    }
  });

  app.post("/api/bills", async (req, res) => {
    try {
      const result = billSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid bill data", details: result.error.issues });
      }
      const { name, provider, amount, dueDate, category } = result.data;

      const bill = await storage.createBill({
        name,
        provider: provider || '',
        amount,
        dueDate,
        category: category || 'Other',
        status: 'Unpaid',
        currency: 'USD',
        logo: null,
      });
      
      res.status(201).json(bill);
    } catch (error) {
      res.status(500).json({ error: "Failed to create bill" });
    }
  });

  app.patch("/api/bills/:id", async (req, res) => {
    try {
      const result = billUpdateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid bill data", details: result.error.issues });
      }
      const bill = await storage.updateBill(req.params.id, result.data as any);
      if (!bill) {
        return res.status(404).json({ error: "Bill not found" });
      }
      res.json(bill);
    } catch (error) {
      res.status(500).json({ error: "Failed to update bill" });
    }
  });

  app.delete("/api/bills/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteBill(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Bill not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete bill" });
    }
  });

  // ==================== BUDGETS ====================
  app.get("/api/budgets", async (req, res) => {
    try {
      const budgets = await storage.getBudgets();
      res.json(budgets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch budgets" });
    }
  });

  app.get("/api/budgets/:id", async (req, res) => {
    try {
      const budget = await storage.getBudget(req.params.id);
      if (!budget) {
        return res.status(404).json({ error: "Budget not found" });
      }
      res.json(budget);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch budget" });
    }
  });

  app.post("/api/budgets", async (req, res) => {
    try {
      const result = budgetSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid budget data", details: result.error.issues });
      }
      const { name, category, limit, period } = result.data;

      const budget = await storage.createBudget({
        name,
        category,
        limit,
        spent: '0',
        currency: 'USD',
        period: (period || 'monthly') as any,
      });
      
      res.status(201).json(budget);
    } catch (error) {
      res.status(500).json({ error: "Failed to create budget" });
    }
  });

  app.patch("/api/budgets/:id", async (req, res) => {
    try {
      const result = budgetUpdateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid budget data", details: result.error.issues });
      }
      const budget = await storage.updateBudget(req.params.id, result.data as any);
      if (!budget) {
        return res.status(404).json({ error: "Budget not found" });
      }
      res.json(budget);
    } catch (error) {
      res.status(500).json({ error: "Failed to update budget" });
    }
  });

  app.delete("/api/budgets/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteBudget(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Budget not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete budget" });
    }
  });

  // ==================== CARDS ====================
  app.get("/api/cards", async (req, res) => {
    try {
      const cards = await storage.getCards();
      res.json(cards);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cards" });
    }
  });

  app.get("/api/cards/:id", async (req, res) => {
    try {
      const card = await storage.getCard(req.params.id);
      if (!card) {
        return res.status(404).json({ error: "Card not found" });
      }
      res.json(card);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch card" });
    }
  });

  app.post("/api/cards", requireAuth, async (req, res) => {
    try {
      const result = cardSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid card data", details: result.error.issues });
      }
      const { name, limit, type, color, currency: cardCurrency } = result.data;

      const last4 = String(Math.floor(1000 + Math.random() * 9000));
      const selectedCurrency = cardCurrency || 'USD';
      
      // Determine provider based on currency
      const isLocalCurrency = ['NGN', 'GHS', 'KES', 'ZAR', 'EGP', 'RWF', 'XOF'].includes(selectedCurrency);
      const provider = isLocalCurrency ? 'paystack' : 'stripe';
      
      // For Stripe currencies, cards are Visa; for Paystack, use Mastercard
      const cardType = isLocalCurrency ? 'Mastercard' : (type || 'Visa');
      
      const card = await storage.createCard({
        name,
        last4,
        balance: 0, // Start with 0, needs to be funded from wallet
        limit: limit || 0,
        type: cardType as any,
        color: color || 'indigo',
        currency: selectedCurrency,
        status: 'Active',
      });
      
      res.status(201).json({
        ...card,
        provider,
        message: `Virtual ${cardType} card created. Fund it from your wallet to start using.`,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to create card" });
    }
  });

  app.patch("/api/cards/:id", async (req, res) => {
    try {
      const result = cardUpdateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid card data", details: result.error.issues });
      }
      const card = await storage.updateCard(req.params.id, result.data as any);
      if (!card) {
        return res.status(404).json({ error: "Card not found" });
      }
      res.json(card);
    } catch (error) {
      res.status(500).json({ error: "Failed to update card" });
    }
  });

  app.delete("/api/cards/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCard(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Card not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete card" });
    }
  });

  // Fund a virtual card from wallet
  app.post("/api/cards/:id/fund", requireAuth, async (req, res) => {
    try {
      const { amount, sourceCurrency } = req.body;
      const userId = (req as any).user?.uid;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valid amount is required" });
      }
      
      const card = await storage.getCard(req.params.id);
      if (!card) {
        return res.status(404).json({ error: "Card not found" });
      }

      const cardCurrency = card.currency || 'USD';
      const fundingCurrency = sourceCurrency || cardCurrency;
      
      // Get user's wallet for the source currency
      const sourceWallet = await storage.getWalletByUserId(userId, fundingCurrency);
      if (!sourceWallet) {
        return res.status(400).json({ 
          error: `No ${fundingCurrency} wallet found. Please fund your wallet first.` 
        });
      }

      const walletBalance = parseFloat(String(sourceWallet.balance || 0));
      
      // Calculate exchange rate if currencies differ
      let amountToDeduct = amount;
      let amountToCredit = amount;
      let exchangeRate = 1;

      if (fundingCurrency !== cardCurrency) {
        // Get exchange rate
        const rate = await storage.getExchangeRate(fundingCurrency, cardCurrency);
        if (!rate) {
          return res.status(400).json({ 
            error: `No exchange rate available for ${fundingCurrency} to ${cardCurrency}. Contact admin.` 
          });
        }
        exchangeRate = parseFloat(String(rate.rate));
        // User provides amount in card currency, we calculate source currency needed
        amountToDeduct = amount / exchangeRate;
        amountToCredit = amount;
      }

      // Check wallet balance
      if (walletBalance < amountToDeduct) {
        return res.status(400).json({ 
          error: "Insufficient wallet balance",
          required: amountToDeduct,
          available: walletBalance,
          currency: fundingCurrency
        });
      }
      
      // Debit from wallet
      await storage.debitWallet(
        sourceWallet.id,
        amountToDeduct,
        'card_funding',
        `Fund card ${card.name} (****${card.last4})`,
        `CFUND-${Date.now()}`,
        { cardId: card.id, exchangeRate, cardCurrency }
      );

      // Update card balance
      const currentBalance = parseFloat(String(card.balance || 0));
      const newBalance = currentBalance + amountToCredit;
      const updated = await storage.updateCard(req.params.id, { balance: newBalance });
      
      // Create funding transaction
      await storage.createTransaction({
        description: `Card funding - ${card.name} (****${card.last4})`,
        amount: String(amountToCredit),
        fee: "0",
        type: 'Funding',
        status: 'Completed',
        date: new Date().toISOString().split('T')[0],
        currency: cardCurrency,
      });

      const currencySymbols: Record<string, string> = {
        USD: '$', EUR: '€', GBP: '£', NGN: '₦', GHS: 'GH₵', KES: 'KSh', ZAR: 'R'
      };
      const cardSymbol = currencySymbols[cardCurrency] || cardCurrency;
      
      res.json({ 
        success: true, 
        card: updated,
        amountCredited: amountToCredit,
        amountDebited: amountToDeduct,
        exchangeRate: exchangeRate !== 1 ? exchangeRate : undefined,
        message: `${cardSymbol}${amountToCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })} funded to card`
      });
    } catch (error: any) {
      console.error('Card funding error:', error);
      res.status(500).json({ error: error.message || "Failed to fund card" });
    }
  });

  // Make a payment with virtual card
  app.post("/api/cards/:id/pay", async (req, res) => {
    try {
      const { amount, merchant, category, description } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valid amount is required" });
      }
      if (!merchant) {
        return res.status(400).json({ error: "Merchant is required" });
      }
      
      const card = await storage.getCard(req.params.id);
      if (!card) {
        return res.status(404).json({ error: "Card not found" });
      }
      
      if (card.status !== 'Active') {
        return res.status(400).json({ error: "Card is not active" });
      }
      
      const cardBalance = parseFloat(card.balance);
      if (cardBalance < amount) {
        return res.status(400).json({ error: "Insufficient card balance" });
      }
      
      // Deduct from card balance
      const newBalance = cardBalance - amount;
      await storage.updateCard(req.params.id, { balance: String(newBalance) });
      
      // Create card transaction record
      const cardTx = await storage.createCardTransaction({
        cardId: req.params.id,
        amount: String(amount),
        merchant,
        category: category || 'General',
        description: description || '',
        status: 'completed',
        date: new Date().toISOString(),
      });
      
      // Create expense record
      await storage.createExpense({
        merchant,
        amount: String(amount),
        currency: card.currency || 'USD',
        date: new Date().toISOString().split('T')[0],
        category: category || 'General',
        status: 'PAID',
        user: 'Card Payment',
        userId: '1',
        department: 'General',
        note: `Paid with virtual card ****${card.last4}`,
        receiptUrl: null,
        expenseType: 'spent',
        attachments: [],
        taggedReviewers: [],
        vendorId: null,
        payoutStatus: 'not_started',
        payoutId: null,
      });
      
      res.json({ 
        success: true, 
        transaction: cardTx,
        remainingBalance: newBalance,
        message: `$${amount.toLocaleString()} paid to ${merchant}`
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to process payment" });
    }
  });

  // Get card transactions
  app.get("/api/cards/:id/transactions", async (req, res) => {
    try {
      const card = await storage.getCard(req.params.id);
      if (!card) {
        return res.status(404).json({ error: "Card not found" });
      }
      
      const transactions = await storage.getCardTransactions(req.params.id);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch card transactions" });
    }
  });

  // ==================== VIRTUAL ACCOUNTS ====================
  app.get("/api/virtual-accounts", async (req, res) => {
    try {
      const accounts = await storage.getVirtualAccounts();
      res.json(accounts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch virtual accounts" });
    }
  });

  app.post("/api/virtual-accounts", async (req, res) => {
    try {
      const { name, currency, type } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Account name is required" });
      }
      
      // Generate account number
      const accountNumber = `VA${Date.now()}${Math.floor(Math.random() * 1000)}`;
      const bankCode = currency === 'NGN' ? 'PAYSTACK' : 'STRIPE';
      
      const account = await storage.createVirtualAccount({
        name,
        accountNumber,
        bankName: bankCode === 'PAYSTACK' ? 'Wema Bank' : 'Stripe Treasury',
        bankCode,
        currency: currency || 'USD',
        balance: '0',
        type: type || 'collection',
        status: 'active',
        createdAt: new Date().toISOString(),
      });
      
      res.status(201).json(account);
    } catch (error) {
      res.status(500).json({ error: "Failed to create virtual account" });
    }
  });

  app.get("/api/virtual-accounts/:id", async (req, res) => {
    try {
      const account = await storage.getVirtualAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Virtual account not found" });
      }
      res.json(account);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch virtual account" });
    }
  });

  // Transfer to virtual account
  app.post("/api/virtual-accounts/:id/deposit", async (req, res) => {
    try {
      const { amount, reference, source } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valid amount is required" });
      }
      
      const account = await storage.getVirtualAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Virtual account not found" });
      }
      
      // Update balance
      const newBalance = account.balance + amount;
      await storage.updateVirtualAccount(req.params.id, { balance: newBalance });
      
      // Create transaction record
      await storage.createTransaction({
        description: `Deposit to ${account.name} (${account.accountNumber})`,
        amount: String(amount),
        fee: "0",
        type: 'Deposit',
        status: 'Completed',
        date: new Date().toISOString().split('T')[0],
        currency: 'USD',
      });
      
      // Send transaction notification if user has phone
      if (account.userId) {
        const profile = await storage.getUserProfile(account.userId);
        const settings = await storage.getNotificationSettings(account.userId);
        if (profile?.phone && settings?.transactionNotifications) {
          notificationService.sendTransactionAlertSms({
            phone: profile.phone,
            type: 'credit',
            amount,
            currency: 'USD',
            description: `Deposit to ${account.name}`,
            balance: newBalance,
          }).catch(err => console.error('Transaction SMS failed:', err));
        }
      }
      
      res.json({ 
        success: true, 
        newBalance,
        message: `$${amount.toLocaleString()} deposited`
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to deposit" });
    }
  });

  // Withdraw from virtual account
  app.post("/api/virtual-accounts/:id/withdraw", async (req, res) => {
    try {
      const { amount, destination, reference } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valid amount is required" });
      }
      
      const account = await storage.getVirtualAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Virtual account not found" });
      }
      
      const accountBalance = parseFloat(account.balance);
      if (accountBalance < amount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      
      // Update balance
      const newBalance = accountBalance - amount;
      await storage.updateVirtualAccount(req.params.id, { balance: String(newBalance) });
      
      // Create transaction record
      await storage.createTransaction({
        description: `Withdrawal from ${account.name} (${account.accountNumber})`,
        amount: String(amount),
        fee: "0",
        type: 'Payout',
        status: 'Completed',
        date: new Date().toISOString().split('T')[0],
        currency: 'USD',
      });
      
      // Send transaction notification if user has phone
      if (account.userId) {
        const profile = await storage.getUserProfile(account.userId);
        const settings = await storage.getNotificationSettings(account.userId);
        if (profile?.phone && settings?.transactionNotifications) {
          notificationService.sendTransactionAlertSms({
            phone: profile.phone,
            type: 'debit',
            amount,
            currency: 'USD',
            description: `Withdrawal from ${account.name}`,
            balance: newBalance,
          }).catch(err => console.error('Transaction SMS failed:', err));
        }
      }
      
      res.json({ 
        success: true, 
        newBalance,
        message: `$${amount.toLocaleString()} withdrawn`
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to withdraw" });
    }
  });

  // ==================== DEPARTMENTS ====================
  app.get("/api/departments", async (req, res) => {
    try {
      const depts = await storage.getDepartments();
      res.json(depts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch departments" });
    }
  });

  app.get("/api/departments/:id", async (req, res) => {
    try {
      const dept = await storage.getDepartment(req.params.id);
      if (!dept) {
        return res.status(404).json({ error: "Department not found" });
      }
      res.json(dept);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch department" });
    }
  });

  app.post("/api/departments", async (req, res) => {
    try {
      const result = departmentSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid department data", details: result.error.issues });
      }
      const { name, description, headId, budget, color } = result.data;
      const dept = await storage.createDepartment({
        name,
        description: description || null,
        headId: headId || null,
        budget: budget ? String(budget) : null,
        color: color || '#6366f1',
        memberCount: 0,
        status: 'Active',
        createdAt: new Date().toISOString(),
      });
      res.status(201).json(dept);
    } catch (error) {
      console.error("Create department error:", error);
      res.status(500).json({ error: "Failed to create department" });
    }
  });

  app.patch("/api/departments/:id", async (req, res) => {
    try {
      const result = departmentUpdateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid department data", details: result.error.issues });
      }
      const { name, description, headId, budget, color, status, memberCount } = result.data;
      const updateData: Record<string, any> = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (headId !== undefined) updateData.headId = headId;
      if (budget !== undefined) updateData.budget = budget ? String(budget) : null;
      if (color !== undefined) updateData.color = color;
      if (status !== undefined) updateData.status = status;
      if (memberCount !== undefined) updateData.memberCount = memberCount;

      const dept = await storage.updateDepartment(req.params.id, updateData);
      if (!dept) {
        return res.status(404).json({ error: "Department not found" });
      }
      res.json(dept);
    } catch (error) {
      res.status(500).json({ error: "Failed to update department" });
    }
  });

  app.delete("/api/departments/:id", async (req, res) => {
    try {
      const success = await storage.deleteDepartment(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Department not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete department" });
    }
  });

  // ==================== TEAM ====================
  app.get("/api/team", async (req, res) => {
    try {
      const team = await storage.getTeam();
      res.json(team);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch team" });
    }
  });

  app.get("/api/team/:id", async (req, res) => {
    try {
      const member = await storage.getTeamMember(req.params.id);
      if (!member) {
        return res.status(404).json({ error: "Team member not found" });
      }
      res.json(member);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch team member" });
    }
  });

  app.post("/api/team", requireAuth, requireAdmin, async (req, res) => {
    try {
      const result = teamMemberSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid team member data", details: result.error.issues });
      }
      const { name, email, role, department } = result.data;

      // Check for duplicate email
      const existingMember = await storage.getTeamMemberByEmail(email);
      if (existingMember) {
        return res.status(400).json({ error: "Team member with this email already exists" });
      }

      const member = await storage.createTeamMember({
        name,
        email,
        role: (role || 'EMPLOYEE') as any,
        department: (department || 'General') as any,
        departmentId: null,
        avatar: null,
        status: 'Active',
        joinedAt: new Date().toISOString().split('T')[0],
        permissions: ['CREATE_EXPENSE'],
      });
      
      // Send team invite email
      const emailResult = await notificationService.sendTeamInvite({
        email,
        name,
        role: role || 'Employee',
        department: department || undefined,
      });
      
      if (!emailResult.success) {
        console.warn('Team invite email failed:', emailResult.error);
      }
      
      res.status(201).json({ 
        ...member, 
        inviteEmailSent: emailResult.success,
        inviteEmailError: emailResult.success ? undefined : emailResult.error
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to create team member" });
    }
  });

  app.patch("/api/team/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const result = teamMemberUpdateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid team member data", details: result.error.issues });
      }
      const member = await storage.updateTeamMember(req.params.id, result.data as any);
      if (!member) {
        return res.status(404).json({ error: "Team member not found" });
      }
      res.json(member);
    } catch (error) {
      res.status(500).json({ error: "Failed to update team member" });
    }
  });

  app.delete("/api/team/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteTeamMember(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Team member not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete team member" });
    }
  });

  // ==================== AI INSIGHTS ====================
  app.get("/api/insights", async (req, res) => {
    try {
      const insights = await storage.getInsights();
      res.json(insights);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch insights" });
    }
  });

  // ==================== REPORTS ====================
  app.get("/api/reports", async (req, res) => {
    try {
      const reports = await storage.getReports();
      res.json(reports);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reports" });
    }
  });

  app.post("/api/reports", async (req, res) => {
    try {
      const { name, type, dateRange } = req.body;
      if (!name || !type || !dateRange) {
        return res.status(400).json({ error: "Name, type, and dateRange are required" });
      }
      
      const now = new Date();
      const report = await storage.createReport({
        name,
        type,
        dateRange,
        createdAt: now.toISOString().split('T')[0],
        status: "processing",
        fileSize: "--"
      });
      
      // Simulate report generation - mark as completed after short delay
      setTimeout(async () => {
        await storage.updateReportStatus(report.id, { 
          status: "completed", 
          fileSize: `${(Math.random() * 5 + 0.5).toFixed(1)} MB` 
        });
      }, 3000);
      
      res.status(201).json(report);
    } catch (error) {
      res.status(500).json({ error: "Failed to create report" });
    }
  });

  app.delete("/api/reports/:id", async (req, res) => {
    try {
      await storage.deleteReport(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete report" });
    }
  });

  app.get("/api/reports/:id/download", async (req, res) => {
    try {
      const reports = await storage.getReports();
      const report = reports.find(r => r.id === req.params.id);
      
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      
      if (report.status !== "completed") {
        return res.status(400).json({ error: "Report is not ready for download" });
      }
      
      // Generate report data based on type
      const expenses = await storage.getExpenses();
      const transactions = await storage.getTransactions();
      const budgets = await storage.getBudgets();
      
      let reportData: any = { generatedAt: new Date().toISOString(), report: report.name };
      
      if (report.type === "expense" || report.type === "Expense Summary") {
        reportData.expenses = expenses;
        reportData.totalAmount = expenses.reduce((sum, e) => sum + parseFloat(String(e.amount)), 0);
        reportData.count = expenses.length;
      } else if (report.type === "budget" || report.type === "Budget Report") {
        reportData.budgets = budgets;
        reportData.totalBudget = budgets.reduce((sum, b) => sum + parseFloat(String(b.limit)), 0);
        reportData.totalSpent = budgets.reduce((sum, b) => sum + parseFloat(String(b.spent)), 0);
      } else if (report.type === "transaction" || report.type === "Transaction Report") {
        reportData.transactions = transactions;
        reportData.totalAmount = transactions.reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);
      } else {
        reportData.expenses = expenses;
        reportData.transactions = transactions;
        reportData.budgets = budgets;
      }
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${report.name.replace(/\s+/g, '_')}.json"`);
      res.json(reportData);
    } catch (error) {
      res.status(500).json({ error: "Failed to download report" });
    }
  });

  // ==================== PAYROLL ====================
  app.get("/api/payroll", async (req, res) => {
    try {
      const payroll = await storage.getPayroll();
      res.json(payroll);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payroll" });
    }
  });

  app.get("/api/payroll/:id", async (req, res) => {
    try {
      const entry = await storage.getPayrollEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ error: "Payroll entry not found" });
      }
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payroll entry" });
    }
  });

  app.post("/api/payroll", async (req, res) => {
    try {
      const result = payrollSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid payroll data", details: result.error.issues });
      }
      const { employeeId, employeeName, department, salary, bonus, deductions, payDate } = result.data;

      const salaryNum = parseFloat(salary);
      const bonusNum = parseFloat(bonus || '0');
      const deductionsNum = parseFloat(deductions || '0');
      const netPayNum = salaryNum + bonusNum - deductionsNum;
      
      const entry = await storage.createPayrollEntry({
        employeeId: employeeId || String(Date.now()),
        employeeName,
        department: department || 'General',
        salary,
        bonus: bonus || '0',
        deductions: deductions || '0',
        netPay: String(netPayNum),
        status: 'pending',
        payDate: payDate || new Date().toISOString().split('T')[0],
      });
      
      res.status(201).json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to create payroll entry" });
    }
  });

  app.patch("/api/payroll/:id", async (req, res) => {
    try {
      const result = payrollUpdateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid payroll data", details: result.error.issues });
      }
      const entry = await storage.updatePayrollEntry(req.params.id, result.data);
      if (!entry) {
        return res.status(404).json({ error: "Payroll entry not found" });
      }
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to update payroll entry" });
    }
  });

  app.delete("/api/payroll/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePayrollEntry(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Payroll entry not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete payroll entry" });
    }
  });

  app.post("/api/payroll/process", async (req, res) => {
    try {
      const entries = await storage.getPayroll();
      const pendingEntries = entries.filter((e: any) => e.status === "pending");
      
      if (pendingEntries.length === 0) {
        return res.status(400).json({ error: "No pending payroll entries to process" });
      }

      const processedEntries = [];
      for (const entry of pendingEntries) {
        const updated = await storage.updatePayrollEntry(entry.id, { status: "paid" });
        if (updated) {
          processedEntries.push(updated);
        }
      }

      const totalPaid = processedEntries.reduce((sum, e) => sum + parseFloat(String(e.netPay)), 0);
      
      await storage.createTransaction({
        type: "Payout",
        amount: String(totalPaid),
        fee: "0",
        status: 'Completed',
        date: new Date().toISOString().split('T')[0],
        description: `Payroll - ${processedEntries.length} employees`,
        currency: 'USD',
      });

      // Send payslip emails to each employee
      const settings = await storage.getOrganizationSettings();
      const companyName = settings?.companyName || 'Spendly';
      const currency = settings?.currency || 'USD';
      const payPeriod = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      for (const entry of processedEntries) {
        if (entry.email) {
          notificationService.sendPayslipEmail({
            email: entry.email,
            employeeName: entry.employeeName,
            payPeriod,
            grossSalary: parseFloat(String(entry.salary || entry.grossSalary || 0)),
            deductions: parseFloat(String(entry.deductions || 0)),
            netPay: parseFloat(String(entry.netPay)),
            currency,
            paymentDate: new Date().toLocaleDateString(),
            companyName,
          }).catch(err => console.error('Failed to send payslip:', err));
        }
      }

      res.json({ 
        message: "Payroll processed successfully",
        processed: processedEntries.length,
        totalPaid,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to process payroll" });
    }
  });

  // Pay individual employee
  app.post("/api/payroll/:id/pay", async (req, res) => {
    try {
      const entry = await storage.getPayrollEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ error: "Payroll entry not found" });
      }
      
      if (entry.status !== "pending") {
        return res.status(400).json({ error: "Payroll entry is not pending" });
      }

      const updated = await storage.updatePayrollEntry(req.params.id, { status: "paid" });
      
      await storage.createTransaction({
        type: "Payout",
        amount: String(entry.netPay),
        fee: "0",
        status: 'Completed',
        date: new Date().toISOString().split('T')[0],
        description: `Salary payment - ${entry.employeeName}`,
        currency: 'USD',
      });

      // Send payslip email to employee
      if (entry.email) {
        const settings = await storage.getOrganizationSettings();
        const companyName = settings?.companyName || 'Spendly';
        const currency = settings?.currency || 'USD';
        const payPeriod = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        notificationService.sendPayslipEmail({
          email: entry.email,
          employeeName: entry.employeeName,
          payPeriod,
          grossSalary: parseFloat(String(entry.salary || (entry as any).grossSalary || 0)),
          deductions: parseFloat(String(entry.deductions || 0)),
          netPay: parseFloat(String(entry.netPay)),
          currency,
          paymentDate: new Date().toLocaleDateString(),
          companyName,
        }).catch(err => console.error('Failed to send payslip:', err));
      }

      res.json({ 
        message: "Payment processed successfully",
        entry: updated,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to process payment" });
    }
  });

  // ==================== INVOICES ====================
  app.get("/api/invoices", async (req, res) => {
    try {
      const invoices = await storage.getInvoices();
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  app.get("/api/invoices/:id", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invoice" });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      const result = invoiceSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid invoice data", details: result.error.issues });
      }
      const { client, clientEmail, amount, dueDate, items } = result.data;

      const invoiceNumber = `INV-2026-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
      
      const invoice = await storage.createInvoice({
        invoiceNumber,
        client,
        clientEmail: clientEmail || '',
        amount,
        dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        issuedDate: new Date().toISOString().split('T')[0],
        status: 'pending',
        items: items || [],
      });
      
      // Send invoice email to client if email provided
      if (clientEmail) {
        const settings = await storage.getOrganizationSettings();
        const companyName = settings?.companyName || 'Spendly';
        const appUrl = process.env.REPLIT_DEV_DOMAIN 
          ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
          : 'https://spendlymanager.com';
        
        notificationService.sendInvoiceEmail({
          email: clientEmail,
          clientName: client,
          senderName: companyName,
          invoiceNumber,
          amount: parseFloat(amount),
          currency: settings?.currency || 'USD',
          dueDate: invoice.dueDate,
          items: (items || []).map((item: any) => ({
            description: item.description || 'Service',
            quantity: item.quantity || 1,
            price: parseFloat(item.price || item.amount || 0),
          })),
          paymentLink: `${appUrl}/pay/${invoice.id}`,
        }).catch(err => console.error('Failed to send invoice email:', err));
      }
      
      res.status(201).json(invoice);
    } catch (error) {
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  app.patch("/api/invoices/:id", async (req, res) => {
    try {
      const result = invoiceUpdateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid invoice data", details: result.error.issues });
      }
      const invoice = await storage.updateInvoice(req.params.id, result.data as any);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "Failed to update invoice" });
    }
  });

  app.delete("/api/invoices/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteInvoice(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete invoice" });
    }
  });

  // ==================== VENDORS ====================
  app.get("/api/vendors", async (req, res) => {
    try {
      const vendors = await storage.getVendors();
      res.json(vendors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vendors" });
    }
  });

  app.get("/api/vendors/:id", async (req, res) => {
    try {
      const vendor = await storage.getVendor(req.params.id);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }
      res.json(vendor);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vendor" });
    }
  });

  app.post("/api/vendors", async (req, res) => {
    try {
      const result = vendorSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid vendor data", details: result.error.issues });
      }
      const { name, email, phone, address, category } = result.data;

      const vendor = await storage.createVendor({
        name,
        email: email || '',
        phone: phone || '',
        address: address || '',
        category: category || 'Other',
        status: 'active',
        totalPaid: '0',
        pendingPayments: '0',
        lastPayment: '',
      });
      
      res.status(201).json(vendor);
    } catch (error) {
      res.status(500).json({ error: "Failed to create vendor" });
    }
  });

  app.patch("/api/vendors/:id", async (req, res) => {
    try {
      const result = vendorUpdateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid vendor data", details: result.error.issues });
      }
      const vendor = await storage.updateVendor(req.params.id, result.data as any);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }
      res.json(vendor);
    } catch (error) {
      res.status(500).json({ error: "Failed to update vendor" });
    }
  });

  app.delete("/api/vendors/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteVendor(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Vendor not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete vendor" });
    }
  });

  // ==================== SETTINGS ====================
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings", async (req, res) => {
    try {
      const settings = await storage.updateSettings(req.body);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // ==================== PAYMENT ROUTES ====================
  app.get("/api/regions", async (req, res) => {
    try {
      res.json(REGION_CONFIGS);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch regions" });
    }
  });

  app.get("/api/region/:countryCode", async (req, res) => {
    try {
      const config = getRegionConfig(req.params.countryCode);
      if (!config) {
        return res.status(404).json({ error: "Region not found for country" });
      }
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch region config" });
    }
  });

  app.get("/api/currency/:countryCode", async (req, res) => {
    try {
      const currency = getCurrencyForCountry(req.params.countryCode);
      res.json(currency);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch currency" });
    }
  });

  app.get("/api/payment/keys", async (req, res) => {
    try {
      let stripeKey = null;
      let paystackKey = null;
      
      try {
        stripeKey = await getStripePublishableKey();
      } catch (e) {
        console.log("Stripe not configured");
      }
      
      try {
        paystackKey = getPaystackPublicKey();
      } catch (e) {
        console.log("Paystack not configured");
      }
      
      res.json({
        stripe: stripeKey,
        paystack: paystackKey,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment keys" });
    }
  });

  // Stripe checkout session for card payments (non-African countries)
  const checkoutSessionSchema = z.object({
    amount: z.number().positive(),
    currency: z.string().min(3).max(3),
    countryCode: z.string().min(2).max(2),
    successUrl: z.string().url(),
    cancelUrl: z.string().url(),
    metadata: z.record(z.any()).optional(),
  });

  app.post("/api/stripe/checkout-session", async (req, res) => {
    try {
      const result = checkoutSessionSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid checkout data", details: result.error.issues });
      }

      const { amount, currency, successUrl, cancelUrl, metadata } = result.data;
      
      const { getUncachableStripeClient } = await import('./stripeClient');
      const stripe = await getUncachableStripeClient();
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: metadata?.description || 'Wallet Funding',
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: metadata || {},
      });
      
      res.json({
        sessionId: session.id,
        url: session.url,
      });
    } catch (error: any) {
      console.error('Stripe checkout error:', error);
      res.status(500).json({ error: error.message || "Failed to create checkout session" });
    }
  });

  // Stripe payment confirmation endpoint
  app.post("/api/stripe/confirm-payment", async (req, res) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID required" });
      }

      const { getUncachableStripeClient } = await import('./stripeClient');
      const stripe = await getUncachableStripeClient();
      
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (session.payment_status === 'paid') {
        const amount = (session.amount_total || 0) / 100;
        const balances = await storage.getBalances();
        const currentUsd = parseFloat(String(balances.usd || 0));
        await storage.updateBalances({ usd: String(currentUsd + amount) });
        
        await storage.createTransaction({
          type: 'Funding',
          amount: String(amount),
          fee: "0",
          status: 'Completed',
          description: 'Card payment via Stripe',
          currency: session.currency?.toUpperCase() || 'USD',
          date: new Date().toISOString().split('T')[0],
        });
        
        res.json({
          success: true,
          amount,
          status: 'completed',
        });
      } else {
        res.json({
          success: false,
          status: session.payment_status,
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to confirm payment" });
    }
  });

  const paymentIntentSchema = z.object({
    amount: z.number().positive(),
    currency: z.string().min(1),
    countryCode: z.string().min(2).max(2),
    email: z.string().email().optional(),
    metadata: z.record(z.any()).optional(),
  });

  app.post("/api/payment/create-intent", async (req, res) => {
    try {
      const result = paymentIntentSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid payment data", details: result.error.issues });
      }

      const { amount, currency, countryCode, email, metadata } = result.data;
      const paymentResult = await paymentService.createPaymentIntent(
        amount,
        currency,
        countryCode,
        { email, ...metadata }
      );
      
      res.json(paymentResult);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create payment intent" });
    }
  });

  const transferSchema = z.object({
    amount: z.number().positive(),
    countryCode: z.string().min(2).max(2),
    reason: z.string().min(1),
    recipientDetails: z.object({
      accountNumber: z.string().optional(),
      bankCode: z.string().optional(),
      accountName: z.string().optional(),
      stripeAccountId: z.string().optional(),
      currency: z.string().optional(),
    }),
  });

  app.post("/api/payment/transfer", requireAuth, financialLimiter, async (req, res) => {
    try {
      const result = transferSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid transfer data", details: result.error.issues });
      }

      const { amount, countryCode, reason, recipientDetails } = result.data;
      const { currency } = getCurrencyForCountry(countryCode);
      const userId = (req as any).user?.uid;

      if (!userId) {
        return res.status(401).json({ error: "User authentication required" });
      }

      // SECURITY: Verify user's personal wallet balance before transfer
      const userWallet = await storage.getWalletByUserId(userId, currency);
      if (!userWallet) {
        return res.status(400).json({ 
          error: "No wallet found for this user",
          currency 
        });
      }

      const walletBalance = parseFloat(String(userWallet.balance || 0));
      if (walletBalance < amount) {
        return res.status(400).json({
          error: "Insufficient wallet balance",
          required: amount,
          available: walletBalance,
          currency
        });
      }

      // SECURITY: Check daily transfer limits (per-user)
      const dailyTotal = await storage.getDailyTransferTotal(userId);
      const DAILY_LIMIT = 50000; // $50k daily limit per user
      if (dailyTotal + amount > DAILY_LIMIT) {
        return res.status(400).json({
          error: "Daily transfer limit exceeded",
          limit: DAILY_LIMIT,
          used: dailyTotal,
          requested: amount,
          currency
        });
      }

      // SECURITY: Large transaction requires additional verification
      const LARGE_TRANSACTION_THRESHOLD = 10000;
      if (amount > LARGE_TRANSACTION_THRESHOLD) {
        console.log(`SECURITY ALERT: Large transfer of ${currency} ${amount} by user ${userId}`);
        // In production, this would require 2FA or admin approval
      }

      // Generate unique reference for idempotency tracking
      const transferReference = `TRF-${userId.substring(0, 8)}-${Date.now()}`;

      const transferResult = await paymentService.initiateTransfer(
        amount,
        recipientDetails,
        countryCode,
        reason
      );

      // Debit from user's wallet after successful transfer initiation
      await storage.debitWallet(
        userWallet.id,
        amount,
        'transfer_out',
        `Transfer: ${reason}`,
        transferResult.reference || transferReference,
        { recipientName: recipientDetails.accountName, countryCode }
      );

      // Create transaction record with provider reference for webhook tracking
      const providerRef = transferResult.reference || transferResult.transferId || transferReference;
      await storage.createTransaction({
        type: 'Transfer',
        amount: String(amount),
        fee: "0",
        status: 'Processing',
        date: new Date().toISOString().split('T')[0],
        description: providerRef, // Store provider reference in description for lookup
        currency,
      });

      // Send notification
      try {
        const userEmail = (req as any).user?.email;
        if (userEmail) {
          await notificationService.notifyPayoutProcessed({
            email: userEmail,
            name: recipientDetails.accountName || 'User',
            recipientName: recipientDetails.accountName || 'Recipient',
            recipientBank: recipientDetails.bankCode,
            recipientAccount: recipientDetails.accountNumber,
            amount,
            currency,
            reference: providerRef,
            date: new Date().toLocaleDateString(),
          });
        }
      } catch (notifError) {
        console.warn('Transfer notification failed:', notifError);
      }
      
      res.json({ ...transferResult, reference: providerRef });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to initiate transfer" });
    }
  });

  const virtualAccountSchema = z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    countryCode: z.string().min(2).max(2),
  });

  app.post("/api/payment/virtual-account", requireAuth, async (req, res) => {
    try {
      const result = virtualAccountSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid account data", details: result.error.issues });
      }

      const { email, firstName, lastName, countryCode } = result.data;
      const accountResult = await paymentService.createVirtualAccount(
        email,
        firstName,
        lastName,
        countryCode
      );
      
      res.json(accountResult);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create virtual account" });
    }
  });

  app.post("/api/payment/verify", async (req, res) => {
    try {
      const { reference, provider } = req.body;
      if (!reference || !provider) {
        return res.status(400).json({ error: "Reference and provider required" });
      }

      const verifyResult = await paymentService.verifyPayment(reference, provider);
      res.json(verifyResult);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to verify payment" });
    }
  });

  app.get("/api/payment/banks/:countryCode", async (req, res) => {
    try {
      const banks = await paymentService.getBanks(req.params.countryCode);
      res.json(banks);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch banks" });
    }
  });

  app.get("/api/payment/provider-balance/:countryCode", async (req, res) => {
    try {
      const balances = await paymentService.getBalance(req.params.countryCode);
      res.json(balances);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch balance" });
    }
  });

  // ==================== BILL PAYMENT ====================
  const billPaymentSchema = z.object({
    billId: z.string().min(1),
    paymentMethod: z.enum(['wallet', 'card', 'bank']),
    countryCode: z.string().min(2).max(2).default('US'),
  });

  app.post("/api/bills/pay", async (req, res) => {
    try {
      const result = billPaymentSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid payment data", details: result.error.issues });
      }

      const { billId, paymentMethod, countryCode } = result.data;
      const bill = await storage.getBill(billId);
      
      if (!bill) {
        return res.status(404).json({ error: "Bill not found" });
      }

      if (bill.status === 'Paid') {
        return res.status(400).json({ error: "Bill already paid" });
      }

      if (paymentMethod === 'wallet') {
        const balances = await storage.getBalances();
        const currentUsd = parseFloat(String(balances.usd || 0));
        const billAmount = parseFloat(String(bill.amount || 0));
        if (currentUsd < billAmount) {
          return res.status(400).json({ error: "Insufficient wallet balance" });
        }
        
        await storage.updateBalances({ usd: String(currentUsd - billAmount) });
        await storage.updateBill(billId, { status: 'Paid' });
        
        await storage.createTransaction({
          type: 'Bill',
          amount: String(bill.amount),
          fee: "0",
          status: 'Completed',
          date: new Date().toISOString().split('T')[0],
          description: `Bill payment - ${bill.name}`,
          currency: bill.currency || 'USD',
        });
        
        res.json({ success: true, message: "Bill paid successfully from wallet" });
      } else {
        const paymentResult = await paymentService.createPaymentIntent(
          bill.amount,
          bill.currency || 'USD',
          countryCode,
          { billId, type: 'bill_payment' }
        );
        
        res.json({
          success: true,
          requiresPayment: true,
          paymentDetails: paymentResult,
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to pay bill" });
    }
  });

  // ==================== DEPOSIT/FUND WALLET ====================
  const depositSchema = z.object({
    amount: z.number().positive(),
    source: z.enum(['bank', 'card', 'crypto']),
    countryCode: z.string().min(2).max(2).default('US'),
    email: z.string().email().optional(),
  });

  app.post("/api/wallet/deposit", async (req, res) => {
    try {
      const result = depositSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid deposit data", details: result.error.issues });
      }

      const { amount, source, countryCode, email } = result.data;
      const currencyInfo = getCurrencyForCountry(countryCode);
      
      const paymentResult = await paymentService.createPaymentIntent(
        amount,
        currencyInfo.currency,
        countryCode,
        { email, type: 'wallet_deposit', source }
      );
      
      res.json({
        success: true,
        paymentDetails: paymentResult,
        currency: currencyInfo,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to initiate deposit" });
    }
  });

  // ==================== PAYOUT/WITHDRAW ====================
  const payoutSchema = z.object({
    amount: z.number().positive(),
    countryCode: z.string().min(2).max(2).default('US'),
    recipientDetails: z.object({
      accountNumber: z.string().optional(),
      bankCode: z.string().optional(),
      accountName: z.string().optional(),
      stripeAccountId: z.string().optional(),
    }),
    reason: z.string().default('Payout'),
  });

  app.post("/api/wallet/payout", requireAuth, financialLimiter, async (req, res) => {
    try {
      const result = payoutSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid payout data", details: result.error.issues });
      }

      const { amount, countryCode, recipientDetails, reason } = result.data;
      const { currency } = getCurrencyForCountry(countryCode);

      // Get balance in the correct currency
      const balances = await storage.getBalances();
      let currentBalance = 0;

      // Map currency to balance field (temporary workaround for legacy balance structure)
      if (currency === 'USD' || ['US', 'CA'].includes(countryCode)) {
        currentBalance = parseFloat(String(balances.usd || 0));
      } else {
        // For non-USD currencies, use local balance
        currentBalance = parseFloat(String(balances.local || 0));
      }

      if (currentBalance < amount) {
        return res.status(400).json({
          error: "Insufficient wallet balance",
          required: amount,
          available: currentBalance,
          currency
        });
      }

      const transferResult = await paymentService.initiateTransfer(
        amount,
        recipientDetails,
        countryCode,
        reason
      );

      // Deduct from correct currency balance
      if (currency === 'USD' || ['US', 'CA'].includes(countryCode)) {
        await storage.updateBalances({ usd: String(currentBalance - amount) });
      } else {
        await storage.updateBalances({ local: String(currentBalance - amount) });
      }

      await storage.createTransaction({
        type: 'Payout',
        amount: String(amount),
        fee: "0",
        status: 'Processing',
        date: new Date().toISOString().split('T')[0],
        description: reason,
        currency,
      });

      res.json({
        success: true,
        transferDetails: transferResult,
        balanceDeducted: {
          amount,
          currency,
          remainingBalance: currentBalance - amount
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to process payout" });
    }
  });

  // ==================== UTILITY PAYMENTS ====================
  const utilityPaymentSchema = z.object({
    type: z.enum(['airtime', 'data', 'electricity', 'cable', 'internet']),
    provider: z.string().min(1),
    amount: z.number().positive(),
    reference: z.string().min(1),
  });

  app.post("/api/payments/utility", async (req, res) => {
    try {
      const result = utilityPaymentSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid utility payment data", details: result.error.issues });
      }

      const { type, provider, amount, reference } = result.data;
      
      const balances = await storage.getBalances();
      const currentLocal = parseFloat(String(balances.local || 0));
      if (currentLocal < amount) {
        return res.status(400).json({ error: "Insufficient wallet balance" });
      }
      
      await storage.updateBalances({ local: String(currentLocal - amount) });
      
      await storage.createTransaction({
        type: 'Payout',
        amount: String(amount),
        fee: "0",
        status: 'Completed',
        date: new Date().toISOString().split('T')[0],
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} - ${provider} (${reference})`,
        currency: 'USD',
      });
      
      res.json({
        success: true,
        message: `${type.charAt(0).toUpperCase() + type.slice(1)} payment successful`,
        reference: `UTL-${Date.now()}`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to process utility payment" });
    }
  });

  // ==================== TRANSACTION PIN ====================
  const bcrypt = await import('bcryptjs');
  const BCRYPT_ROUNDS = 10;
  
  const setPinSchema = z.object({
    firebaseUid: z.string().min(1),
    pin: z.string().length(4).regex(/^\d{4}$/, "PIN must be 4 digits"),
  });
  
  const verifyPinSchema = z.object({
    firebaseUid: z.string().min(1),
    pin: z.string().length(4),
  });

  app.post("/api/user/set-pin", async (req, res) => {
    try {
      const result = setPinSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid PIN format. Must be 4 digits." });
      }
      
      const { firebaseUid, pin } = result.data;
      const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
      
      const profile = await storage.getUserProfile(firebaseUid);
      if (!profile) {
        return res.status(404).json({ error: "User profile not found" });
      }
      
      await storage.updateUserProfile(firebaseUid, {
        transactionPinHash: pinHash,
        transactionPinEnabled: true,
      });
      
      res.json({ success: true, message: "Transaction PIN set successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to set PIN" });
    }
  });

  app.post("/api/user/verify-pin", async (req, res) => {
    try {
      const result = verifyPinSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid PIN format" });
      }
      
      const { firebaseUid, pin } = result.data;
      const profile = await storage.getUserProfile(firebaseUid);
      
      if (!profile) {
        return res.status(404).json({ error: "User profile not found" });
      }
      
      if (!profile.transactionPinEnabled || !profile.transactionPinHash) {
        return res.status(400).json({ error: "Transaction PIN not set" });
      }
      
      const valid = await bcrypt.compare(pin, profile.transactionPinHash);
      
      res.json({ valid });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to verify PIN" });
    }
  });

  app.post("/api/user/disable-pin", async (req, res) => {
    try {
      const { firebaseUid } = req.body;
      if (!firebaseUid) {
        return res.status(400).json({ error: "Firebase UID required" });
      }
      
      await storage.updateUserProfile(firebaseUid, {
        transactionPinEnabled: false,
      });
      
      res.json({ success: true, message: "Transaction PIN disabled" });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to disable PIN" });
    }
  });

  // ==================== ACCOUNT VALIDATION ====================
  const validateAccountSchema = z.object({
    accountNumber: z.string().min(1),
    bankCode: z.string().min(1),
    countryCode: z.string().min(2).max(2).default('NG'),
  });

  app.post("/api/payment/validate-account", requireAuth, financialLimiter, async (req, res) => {
    try {
      const result = validateAccountSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid account data", details: result.error.issues });
      }

      const { accountNumber, bankCode, countryCode } = result.data;
      
      const isAfricanCountry = ['NG', 'GH', 'KE', 'ZA', 'EG', 'RW', 'CI'].includes(countryCode);
      
      if (isAfricanCountry) {
        try {
          const { paystackClient } = await import('./paystackClient');
          const verification = await paystackClient.resolveAccount(accountNumber, bankCode);
          res.json({
            success: true,
            accountName: verification.data?.account_name || 'Account Holder',
            accountNumber: verification.data?.account_number || accountNumber,
            bankId: bankCode,
          });
        } catch (error: any) {
          res.status(400).json({ error: "Could not verify account", details: error.message });
        }
      } else {
        res.json({
          success: true,
          accountName: "Account Holder",
          accountNumber,
          bankId: bankCode,
          note: "Account verification simulated for non-African countries",
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to validate account" });
    }
  });

  // ==================== PAYSTACK WEBHOOK ====================
  const processedPaystackReferences = new Set<string>();
  
  app.post("/api/paystack/webhook", async (req, res) => {
    try {
      const crypto = await import('crypto');
      const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;

      // SECURITY: Reject webhook if secret key is not configured
      if (!paystackSecretKey) {
        console.error('Paystack webhook rejected: PAYSTACK_SECRET_KEY not configured');
        return res.status(500).json({ error: "Webhook configuration error" });
      }

      // Verify webhook signature
      const hash = crypto.createHmac('sha512', paystackSecretKey)
        .update(JSON.stringify(req.body))
        .digest('hex');

      const signature = req.headers['x-paystack-signature'];
      if (hash !== signature) {
        console.error('Paystack webhook signature verification failed');
        return res.status(401).json({ error: "Invalid signature" });
      }
      
      const event = req.body;
      const eventType = event.event;
      
      if (eventType === 'charge.success') {
        const { reference, amount, metadata } = event.data;
        
        if (processedPaystackReferences.has(reference)) {
          console.log(`Paystack reference ${reference} already processed`);
          return res.status(200).json({ received: true });
        }
        
        processedPaystackReferences.add(reference);
        const amountValue = amount / 100;
        
        if (metadata?.type === 'wallet_funding') {
          const balances = await storage.getBalances();
          const currentLocal = parseFloat(String(balances.local || 0));
          await storage.updateBalances({ local: String(currentLocal + amountValue) });
          
          await storage.createTransaction({
            type: 'Funding',
            amount: amountValue.toString(),
            fee: '0',
            status: 'Completed',
            description: 'Card payment via Paystack',
            currency: event.data.currency || 'NGN',
            date: new Date().toISOString().split('T')[0],
          });
        }
        
        console.log(`Paystack payment confirmed: ${reference}`);
      }

      // Handle dedicated virtual account assignment
      if (eventType === 'dedicatedaccount.assign.success') {
        const { customer, dedicated_account } = event.data;
        console.log(`DVA assigned: ${dedicated_account.account_number} for customer ${customer.customer_code}`);
        
        // Store the DVA assignment for future reference
        try {
          await storage.createFundingSource({
            userId: customer.email || customer.customer_code,
            type: 'virtual_account',
            provider: 'paystack',
            accountNumber: dedicated_account.account_number,
            bankName: dedicated_account.bank?.name || 'Wema Bank',
            currency: 'NGN',
            isActive: true,
            isVerified: false,
            metadata: { customerCode: customer.customer_code, assignedAt: new Date().toISOString() },
          });
        } catch (err) {
          console.log('DVA funding source may already exist, skipping creation');
        }
      }

      // Handle virtual account funding (incoming bank transfer via DVA)
      if (eventType === 'charge.success' && event.data.channel === 'dedicated_nuban') {
        const { reference, amount, customer, authorization } = event.data;
        const dedicatedAccount = event.data.dedicated_account || {};
        
        // In-memory idempotency check
        if (processedPaystackReferences.has(reference)) {
          console.log(`DVA funding reference ${reference} already processed (memory)`);
          return res.status(200).json({ received: true });
        }
        
        // Storage-level idempotency: check if transaction with this reference already exists
        const alreadyProcessed = await storage.isWebhookProcessed(reference);
        if (alreadyProcessed) {
          console.log(`DVA funding reference ${reference} already exists in storage`);
          processedPaystackReferences.add(reference);
          return res.status(200).json({ received: true });
        }
        
        processedPaystackReferences.add(reference);
        const amountValue = amount / 100;
        
        // Priority lookup for wallet:
        // 1) Find virtual account by account number, get userId, find wallet
        // 2) Match by Paystack customer code in wallet metadata
        // 3) Match by email as userId
        
        let userWallet = null;
        let virtualAccount = null;
        
        // First try to find by virtual account number
        const virtualAccounts = await storage.getVirtualAccounts();
        if (dedicatedAccount?.account_number) {
          virtualAccount = virtualAccounts.find((va: any) => 
            va.accountNumber === dedicatedAccount.account_number
          );
        }
        
        const wallets = await storage.getWallets();
        
        if (virtualAccount && virtualAccount.userId) {
          // Found the virtual account, now find the user's wallet
          userWallet = wallets.find((w: any) => w.userId === virtualAccount.userId);
          console.log(`Found wallet via virtual account ${virtualAccount.accountNumber} for user ${virtualAccount.userId}`);
        }
        
        // Fallback: match by Paystack customer code
        if (!userWallet) {
          userWallet = wallets.find((w: any) => 
            w.metadata?.paystackCustomerCode === customer?.customer_code
          );
        }
        
        // Fallback: match by email if no customer code match
        if (!userWallet) {
          userWallet = wallets.find((w: any) => w.userId === customer?.email);
        }

        if (userWallet) {
          // Credit the wallet
          await storage.creditWallet(
            userWallet.id,
            amountValue,
            'virtual_account_funding',
            `Bank transfer via DVA - Ref: ${reference}`,
            reference,
            {
              provider: 'paystack',
              channel: 'dedicated_nuban',
              customerCode: customer?.customer_code,
              accountNumber: dedicatedAccount?.account_number,
              senderName: authorization?.sender_name || 'Unknown'
            }
          );
          console.log(`Wallet ${userWallet.id} credited with ${amountValue} via DVA (${reference})`);

          // Send SMS notification if user has phone number
          try {
            if (userWallet.userId) {
              const userProfile = await storage.getUserProfile(userWallet.userId);
              if (userProfile?.phoneNumber) {
                const wallet = await storage.getWallet(userWallet.id);
                const settings = await storage.getSettings();
                const currency = settings?.currency || 'NGN';
                const newBalance = wallet?.balance || userWallet.balance;
                await notificationService.sendTransactionAlertSms(
                  userProfile.phoneNumber,
                  'credit',
                  amountValue,
                  currency,
                  `Bank transfer - ${reference.substring(0, 8)}`,
                  parseFloat(String(newBalance))
                );
              }
            }
          } catch (smsError) {
            console.error('Failed to send DVA funding SMS notification:', smsError);
          }
        } else {
          // CRITICAL: Wallet not found - attempt to auto-create wallet
          console.warn(`No wallet found for customer ${customer?.customer_code || customer?.email}. Attempting auto-creation.`);

          try {
            const userId = virtualAccount?.userId || customer?.email;
            if (userId) {
              // Auto-create wallet for this user
              const newWallet = await storage.createWallet({
                userId,
                type: 'personal',
                currency: event.data.currency || 'NGN',
                balance: '0',
                availableBalance: '0',
                pendingBalance: '0',
                status: 'active',
                virtualAccountId: virtualAccount?.id || dedicatedAccount?.account_number,
              });

              // Now credit the newly created wallet
              await storage.creditWallet(
                newWallet.id,
                amountValue,
                'virtual_account_funding',
                `Bank transfer via DVA - Ref: ${reference} (Auto-created wallet)`,
                reference,
                {
                  provider: 'paystack',
                  channel: 'dedicated_nuban',
                  customerCode: customer?.customer_code,
                  accountNumber: dedicatedAccount?.account_number,
                  senderName: authorization?.sender_name || 'Unknown',
                  autoCreated: true
                }
              );
              console.log(`✅ Auto-created wallet ${newWallet.id} and credited ${amountValue} for user ${userId}`);
            } else {
              throw new Error('Cannot determine userId for wallet creation');
            }
          } catch (walletCreationError: any) {
            // If auto-creation fails, store as pending transaction for manual reconciliation
            console.error(`❌ Failed to auto-create wallet: ${walletCreationError.message}`);

            await storage.createTransaction({
              type: 'Funding',
              amount: amountValue.toString(),
              fee: '0',
              status: 'Pending',
              description: `UNMATCHED DVA DEPOSIT - Manual reconciliation required. Customer: ${customer?.customer_code || customer?.email}, Account: ${dedicatedAccount?.account_number}`,
              currency: event.data.currency || 'NGN',
              date: new Date().toISOString().split('T')[0],
            });

            // TODO: Send alert to administrators about unmatched deposit
            console.error(`⚠️ ALERT: Unmatched deposit of ${amountValue} ${event.data.currency} stored as pending transaction. Reference: ${reference}`);
          }
        }
      }

      // Handle transfer success (payout completed)
      if (eventType === 'transfer.success') {
        const { reference } = event.data;
        
        // In-memory idempotency check
        if (processedPaystackReferences.has(`transfer:${reference}`)) {
          console.log(`Transfer success ${reference} already processed (memory)`);
          return res.status(200).json({ received: true });
        }
        
        // Find payout by provider reference (storage-level lookup)
        const payouts = await storage.getPayouts({ providerReference: reference });
        const payout = payouts[0]; // First match
        
        if (payout) {
          // State guard: only update if not already completed (storage-level idempotency)
          if (payout.status !== 'completed') {
            processedPaystackReferences.add(`transfer:${reference}`);
            
            await storage.updatePayout(payout.id, {
              status: 'completed',
              processedAt: new Date().toISOString(),
            });

            // Update related expense if applicable
            if (payout.relatedEntityType === 'expense' && payout.relatedEntityId) {
              await storage.updateExpense(payout.relatedEntityId, {
                status: 'PAID',
                payoutStatus: 'completed',
              });
            }

            console.log(`Payout ${payout.id} completed via transfer ${reference}`);
          } else {
            console.log(`Payout ${payout.id} already completed, skipping webhook update`);
          }
        } else {
          console.warn(`No payout found for transfer reference ${reference}`);
        }
      }

      // Handle transfer failure
      if (eventType === 'transfer.failed' || eventType === 'transfer.reversed') {
        const { reference, reason } = event.data;
        
        // In-memory idempotency check
        if (processedPaystackReferences.has(`transfer:${reference}`)) {
          console.log(`Transfer failure ${reference} already processed (memory)`);
          return res.status(200).json({ received: true });
        }
        
        // Find payout by provider reference (storage-level lookup)
        const payouts = await storage.getPayouts({ providerReference: reference });
        const payout = payouts[0]; // First match
        
        if (payout) {
          // State guard: only update if not already in terminal state
          if (payout.status !== 'failed' && payout.status !== 'completed') {
            processedPaystackReferences.add(`transfer:${reference}`);
            
            await storage.updatePayout(payout.id, {
              status: 'failed',
              failureReason: reason || eventType,
            });

            // Update related expense if applicable
            if (payout.relatedEntityType === 'expense' && payout.relatedEntityId) {
              await storage.updateExpense(payout.relatedEntityId, {
                payoutStatus: 'failed',
              });
            }

            console.log(`Payout ${payout.id} failed: ${reason}`);
          } else {
            console.log(`Payout ${payout.id} already in terminal state (${payout.status}), skipping webhook update`);
          }
        } else {
          console.warn(`No payout found for transfer reference ${reference}`);
        }
      }
      
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Paystack webhook error:', error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // ==================== PAYSTACK CALLBACK ====================
  app.get("/api/paystack/callback", async (req, res) => {
    try {
      const { reference } = req.query;
      if (!reference || typeof reference !== 'string') {
        return res.redirect('/dashboard?payment=failed');
      }
      
      if (processedPaystackReferences.has(reference)) {
        console.log(`Paystack reference ${reference} already processed via webhook`);
        return res.redirect('/dashboard?payment=success');
      }
      
      const verification = await paymentService.verifyPayment(reference, 'paystack');
      
      if (verification.status === 'success') {
        processedPaystackReferences.add(reference);
        
        const balances = await storage.getBalances();
        const currentLocal = parseFloat(String(balances.local || 0));
        await storage.updateBalances({ local: String(currentLocal + verification.amount) });
        
        await storage.createTransaction({
          type: 'Funding',
          amount: String(verification.amount),
          fee: "0",
          status: 'Completed',
          description: 'Card payment via Paystack',
          currency: verification.currency || 'NGN',
          date: new Date().toISOString().split('T')[0],
        });
        
        res.redirect('/dashboard?payment=success');
      } else {
        res.redirect('/dashboard?payment=failed');
      }
    } catch (error: any) {
      console.error('Paystack callback error:', error);
      res.redirect('/dashboard?payment=failed');
    }
  });

  // ==================== STRIPE WEBHOOK ====================
  const processedStripeEvents = new Set<string>();
  
  app.post("/api/stripe/webhook", async (req, res) => {
    try {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      // SECURITY: Reject webhook if secret key is not configured
      if (!stripeSecretKey) {
        console.error('Stripe webhook rejected: STRIPE_SECRET_KEY not configured');
        return res.status(500).json({ error: "Webhook configuration error" });
      }

      let event = req.body;
      
      // If webhook secret is configured, verify signature
      if (stripeWebhookSecret) {
        const Stripe = await import('stripe');
        const stripe = new Stripe.default(stripeSecretKey);
        const sig = req.headers['stripe-signature'];
        
        if (sig) {
          try {
            // Note: For raw body parsing, Express needs express.raw() for this route
            const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            event = stripe.webhooks.constructEvent(payload, sig, stripeWebhookSecret);
          } catch (err: any) {
            console.error('Stripe webhook signature verification failed:', err.message);
            return res.status(401).json({ error: "Invalid signature" });
          }
        }
      }

      const eventId = event.id;
      const eventType = event.type;

      // Idempotency check
      if (processedStripeEvents.has(eventId)) {
        console.log(`Stripe event ${eventId} already processed`);
        return res.status(200).json({ received: true });
      }

      // Handle transfer events
      if (eventType === 'transfer.paid') {
        processedStripeEvents.add(eventId);
        const transfer = event.data.object;
        const reference = transfer.id;

        console.log(`Stripe transfer completed: ${reference}`);
        
        // Update transaction status
        await storage.updateTransactionByReference(reference, {
          status: 'Completed',
        });

        // Find and update payout if exists
        const payouts = await storage.getPayouts({ providerReference: reference });
        if (payouts.length > 0) {
          await storage.updatePayout(payouts[0].id, {
            status: 'completed',
            processedAt: new Date().toISOString(),
          });
        }
      }

      if (eventType === 'transfer.failed') {
        processedStripeEvents.add(eventId);
        const transfer = event.data.object;
        const reference = transfer.id;
        const failureMessage = transfer.failure_message || 'Transfer failed';

        console.log(`Stripe transfer failed: ${reference} - ${failureMessage}`);
        
        // Update transaction status
        await storage.updateTransactionByReference(reference, {
          status: 'Failed',
        });

        // Find and update payout if exists
        const payouts = await storage.getPayouts({ providerReference: reference });
        if (payouts.length > 0) {
          await storage.updatePayout(payouts[0].id, {
            status: 'failed',
            failureReason: failureMessage,
          });

          // Refund the wallet balance if initiatedBy user has a wallet
          const payout = payouts[0];
          if (payout.initiatedBy) {
            try {
              const userWallet = await storage.getWalletByUserId(payout.initiatedBy, payout.currency);
              if (userWallet) {
                await storage.creditWallet(
                  userWallet.id,
                  parseFloat(String(payout.amount)),
                  'transfer_refund',
                  `Refund for failed transfer ${reference}`,
                  `refund-${reference}`,
                  { originalReference: reference, failureReason: failureMessage }
                );
                console.log(`Wallet ${userWallet.id} refunded for failed transfer ${reference}`);
              }
            } catch (refundError) {
              console.error(`Failed to refund wallet for transfer ${reference}:`, refundError);
            }
          }
        }
      }

      if (eventType === 'transfer.reversed') {
        processedStripeEvents.add(eventId);
        const transfer = event.data.object;
        const reference = transfer.id;

        console.log(`Stripe transfer reversed: ${reference}`);
        
        // Update transaction status
        await storage.updateTransactionByReference(reference, {
          status: 'Reversed',
        });

        // Find and update payout if exists
        const payouts = await storage.getPayouts({ providerReference: reference });
        if (payouts.length > 0) {
          await storage.updatePayout(payouts[0].id, {
            status: 'failed',
            failureReason: 'Transfer reversed',
          });
        }
      }

      // Handle payment intent events (for card payments)
      if (eventType === 'payment_intent.succeeded') {
        processedStripeEvents.add(eventId);
        const paymentIntent = event.data.object;
        const amount = paymentIntent.amount / 100;
        const currency = paymentIntent.currency.toUpperCase();
        const reference = paymentIntent.id;

        console.log(`Stripe payment succeeded: ${reference} - ${currency} ${amount}`);
        
        // Credit wallet if metadata contains wallet info
        if (paymentIntent.metadata?.walletId) {
          await storage.creditWallet(
            paymentIntent.metadata.walletId,
            amount,
            'card_funding',
            `Card payment via Stripe - ${reference}`,
            reference,
            { provider: 'stripe', paymentIntentId: paymentIntent.id }
          );
        } else {
          // Fallback: credit company balance
          const balances = await storage.getBalances();
          const currentUsd = parseFloat(String(balances.usd || 0));
          await storage.updateBalances({ usd: String(currentUsd + amount) });
          
          await storage.createTransaction({
            type: 'Funding',
            amount: String(amount),
            fee: '0',
            status: 'Completed',
            description: `Card payment via Stripe - ${reference}`,
            currency,
            date: new Date().toISOString().split('T')[0],
          });
        }
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Stripe webhook error:', error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // ==================== PAYSTACK AUTO-DEBIT & SUBSCRIPTIONS ====================
  app.post("/api/paystack/plans", async (req, res) => {
    try {
      const { name, amount, interval, description } = req.body;
      if (!name || !amount || !interval) {
        return res.status(400).json({ error: "Name, amount, and interval are required" });
      }
      const result = await paystackClient.createSubscriptionPlan(name, amount, interval, description);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create plan" });
    }
  });

  app.get("/api/paystack/plans", async (req, res) => {
    try {
      const result = await paystackClient.listPlans();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to list plans" });
    }
  });

  app.post("/api/paystack/subscriptions", async (req, res) => {
    try {
      const { customerEmail, planCode, authorizationCode } = req.body;
      if (!customerEmail || !planCode) {
        return res.status(400).json({ error: "Customer email and plan code are required" });
      }
      const result = await paystackClient.createSubscription(customerEmail, planCode, authorizationCode);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create subscription" });
    }
  });

  app.get("/api/paystack/subscriptions", async (req, res) => {
    try {
      const result = await paystackClient.listSubscriptions();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to list subscriptions" });
    }
  });

  app.post("/api/paystack/subscriptions/enable", async (req, res) => {
    try {
      const { subscriptionCode, emailToken } = req.body;
      if (!subscriptionCode || !emailToken) {
        return res.status(400).json({ error: "Subscription code and email token are required" });
      }
      const result = await paystackClient.enableSubscription(subscriptionCode, emailToken);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to enable subscription" });
    }
  });

  app.post("/api/paystack/subscriptions/disable", async (req, res) => {
    try {
      const { subscriptionCode, emailToken } = req.body;
      if (!subscriptionCode || !emailToken) {
        return res.status(400).json({ error: "Subscription code and email token are required" });
      }
      const result = await paystackClient.disableSubscription(subscriptionCode, emailToken);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to disable subscription" });
    }
  });

  app.post("/api/paystack/charge-authorization", async (req, res) => {
    try {
      const { email, amount, authorizationCode, reference, metadata } = req.body;
      if (!email || !amount || !authorizationCode) {
        return res.status(400).json({ error: "Email, amount, and authorization code are required" });
      }
      const result = await paystackClient.chargeAuthorization(email, amount, authorizationCode, reference, metadata);
      
      if (result.status && result.data?.status === 'success') {
        const amountInNaira = result.data.amount / 100;
        await storage.createTransaction({
          type: 'Payout',
          amount: String(amountInNaira),
          fee: "0",
          status: 'Completed',
          description: metadata?.description || 'Auto-debit charge',
          currency: 'NGN',
          date: new Date().toISOString().split('T')[0],
        });
      }
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to charge authorization" });
    }
  });

  app.get("/api/paystack/authorizations/:email", async (req, res) => {
    try {
      const result = await paystackClient.listAuthorizations(req.params.email);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to list authorizations" });
    }
  });

  app.post("/api/paystack/deactivate-authorization", async (req, res) => {
    try {
      const { authorizationCode } = req.body;
      if (!authorizationCode) {
        return res.status(400).json({ error: "Authorization code is required" });
      }
      const result = await paystackClient.deactivateAuthorization(authorizationCode);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to deactivate authorization" });
    }
  });

  // ==================== ANALYTICS API ====================
  app.get("/api/analytics/summary", async (req, res) => {
    try {
      const expenses = await storage.getExpenses();
      const transactions = await storage.getTransactions();
      const budgets = await storage.getBudgets();
      
      const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(String(e.amount)), 0);
      const totalIncome = transactions
        .filter(t => t.type === 'Deposit' || t.type === 'Funding' || t.type === 'Refund')
        .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);
      const totalOutflow = transactions
        .filter(t => t.type === 'Payout' || t.type === 'Bill')
        .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);
      
      const categoryBreakdown: Record<string, number> = {};
      expenses.forEach(e => {
        categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + parseFloat(String(e.amount));
      });
      
      const departmentBreakdown: Record<string, number> = {};
      expenses.forEach(e => {
        departmentBreakdown[e.department || 'Other'] = (departmentBreakdown[e.department || 'Other'] || 0) + parseFloat(String(e.amount));
      });
      
      const budgetUtilization = budgets.map(b => ({
        name: b.name,
        budget: parseFloat(String(b.limit)),
        spent: parseFloat(String(b.spent)),
        percentage: Math.round((parseFloat(String(b.spent)) / parseFloat(String(b.limit))) * 100) || 0,
      }));
      
      res.json({
        totalExpenses,
        totalIncome,
        totalOutflow,
        netCashFlow: totalIncome - totalOutflow,
        pendingExpenses: expenses.filter(e => e.status === 'PENDING').length,
        approvedExpenses: expenses.filter(e => e.status === 'APPROVED' || e.status === 'PAID').length,
        categoryBreakdown,
        departmentBreakdown,
        budgetUtilization,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch analytics" });
    }
  });

  // ==================== KYC & ONBOARDING API ====================
  
  // Get user profile by Firebase UID
  app.get("/api/user-profile/:firebaseUid", async (req, res) => {
    try {
      const { firebaseUid } = req.params;
      const profile = await storage.getUserProfile(firebaseUid);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch profile" });
    }
  });

  // Create user profile
  app.post("/api/user-profile", async (req, res) => {
    try {
      const { firebaseUid, email, displayName, photoUrl } = req.body;
      if (!firebaseUid || !email) {
        return res.status(400).json({ error: "firebaseUid and email are required" });
      }
      
      const existing = await storage.getUserProfile(firebaseUid);
      if (existing) {
        return res.json(existing);
      }
      
      const now = new Date().toISOString();
      const profile = await storage.createUserProfile({
        firebaseUid,
        email,
        displayName: displayName || null,
        photoUrl: photoUrl || null,
        phoneNumber: null,
        dateOfBirth: null,
        nationality: null,
        address: null,
        city: null,
        state: null,
        country: null,
        postalCode: null,
        kycStatus: 'not_started',
        onboardingCompleted: false,
        onboardingStep: 1,
        createdAt: now,
        updatedAt: now,
      });
      
      // Send welcome email to new user
      notificationService.sendWelcomeEmail({
        email,
        name: displayName || email.split('@')[0],
      }).catch(err => console.error('Failed to send welcome email:', err));
      
      res.status(201).json(profile);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create profile" });
    }
  });

  // Update user profile
  app.patch("/api/user-profile/:firebaseUid", async (req, res) => {
    try {
      const { firebaseUid } = req.params;
      const profile = await storage.updateUserProfile(firebaseUid, req.body);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update profile" });
    }
  });

  // Get user settings (notification preferences, etc.)
  app.get("/api/user-settings/:firebaseUid", async (req, res) => {
    try {
      const { firebaseUid } = req.params;
      const profile = await storage.getUserProfile(firebaseUid);
      if (!profile) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Return user-specific settings
      res.json({
        emailNotifications: profile.emailNotifications ?? true,
        pushNotifications: profile.pushNotifications ?? true,
        smsNotifications: profile.smsNotifications ?? false,
        expenseAlerts: profile.expenseAlerts ?? true,
        budgetWarnings: profile.budgetWarnings ?? true,
        paymentReminders: profile.paymentReminders ?? true,
        weeklyDigest: profile.weeklyDigest ?? true,
        preferredCurrency: profile.preferredCurrency ?? 'USD',
        preferredLanguage: profile.preferredLanguage ?? 'en',
        preferredTimezone: profile.preferredTimezone ?? 'America/Los_Angeles',
        preferredDateFormat: profile.preferredDateFormat ?? 'MM/DD/YYYY',
        darkMode: profile.darkMode ?? false,
        twoFactorEnabled: profile.twoFactorEnabled ?? false,
        transactionPinEnabled: profile.transactionPinEnabled ?? false,
        sessionTimeout: profile.sessionTimeout ?? 30,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch user settings" });
    }
  });

  // Update user settings
  app.patch("/api/user-settings/:firebaseUid", async (req, res) => {
    try {
      const { firebaseUid } = req.params;
      const allowedFields = [
        'emailNotifications', 'pushNotifications', 'smsNotifications',
        'expenseAlerts', 'budgetWarnings', 'paymentReminders', 'weeklyDigest',
        'preferredCurrency', 'preferredLanguage', 'preferredTimezone', 
        'preferredDateFormat', 'darkMode', 'sessionTimeout'
      ];
      
      // Filter to only allowed settings fields
      const updates: Record<string, any> = {};
      for (const key of allowedFields) {
        if (req.body[key] !== undefined) {
          updates[key] = req.body[key];
        }
      }
      
      const profile = await storage.updateUserProfile(firebaseUid, updates);
      if (!profile) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({
        success: true,
        message: "Settings updated successfully",
        settings: {
          emailNotifications: profile.emailNotifications,
          pushNotifications: profile.pushNotifications,
          smsNotifications: profile.smsNotifications,
          expenseAlerts: profile.expenseAlerts,
          budgetWarnings: profile.budgetWarnings,
          paymentReminders: profile.paymentReminders,
          weeklyDigest: profile.weeklyDigest,
          preferredCurrency: profile.preferredCurrency,
          preferredLanguage: profile.preferredLanguage,
          preferredTimezone: profile.preferredTimezone,
          preferredDateFormat: profile.preferredDateFormat,
          darkMode: profile.darkMode,
          sessionTimeout: profile.sessionTimeout,
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update user settings" });
    }
  });

  // Get KYC submission
  app.get("/api/kyc/:userProfileId", async (req, res) => {
    try {
      const { userProfileId } = req.params;
      const submission = await storage.getKycSubmission(userProfileId);
      if (!submission) {
        return res.status(404).json({ error: "KYC submission not found" });
      }
      res.json(submission);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch KYC submission" });
    }
  });

  // KYC submission validation schema
  // Helper to coerce falsy values to undefined for optional string fields
  const optionalString = z.preprocess(
    (val) => (val === false || val === '' || val === null || val === undefined) ? undefined : String(val),
    z.string().optional()
  );
  
  // Helper to coerce any value to string for required string fields
  const requiredString = (fieldName: string) => z.preprocess(
    (val) => {
      if (val === false || val === null || val === undefined || val === '') return '';
      return String(val);
    },
    z.string().min(1, `${fieldName} is required`)
  );
  
  const kycSubmissionSchema = z.object({
    firebaseUid: requiredString("Firebase UID"),
    firstName: requiredString("First name"),
    lastName: requiredString("Last name"),
    middleName: optionalString,
    dateOfBirth: requiredString("Date of birth"),
    gender: optionalString,
    nationality: requiredString("Nationality"),
    phoneNumber: requiredString("Phone number"),
    alternatePhone: optionalString,
    addressLine1: requiredString("Address"),
    addressLine2: optionalString,
    city: requiredString("City"),
    state: requiredString("State"),
    country: requiredString("Country"),
    postalCode: requiredString("Postal code"),
    idType: optionalString,
    idNumber: optionalString,
    idExpiryDate: optionalString,
    idFrontUrl: optionalString,
    idBackUrl: optionalString,
    selfieUrl: optionalString,
    proofOfAddressUrl: optionalString,
    isBusinessAccount: z.union([z.boolean(), z.string()]).optional().default(false).transform(v => v === true || v === 'true'),
    businessName: optionalString,
    businessType: optionalString,
    businessRegistrationNumber: optionalString,
    businessAddress: optionalString,
    businessDocumentUrl: optionalString,
    // Frontend form fields that may be passed
    acceptTerms: z.union([z.boolean(), z.string()]).optional().transform(v => v === true || v === 'true'),
    accountType: optionalString,
    bvnNumber: optionalString,
    // Auto-approval flags
    bvnVerified: z.union([z.boolean(), z.string()]).optional().transform(v => v === true || v === 'true'),
    stripeVerified: z.union([z.boolean(), z.string()]).optional().transform(v => v === true || v === 'true'),
  });

  // Submit KYC
  app.post("/api/kyc", sensitiveLimiter, async (req, res) => {
    try {
      const parseResult = kycSubmissionSchema.safeParse(req.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0];
        const errorPath = firstError?.path?.join('.') || 'unknown';
        const errorMessage = firstError?.message || "Invalid request data";
        console.error('KYC validation error:', { path: errorPath, message: errorMessage, received: (firstError as any)?.received });
        return res.status(400).json({ error: `${errorMessage} (field: ${errorPath})` });
      }

      const data = parseResult.data;
      
      // Get user profile by firebaseUid to get the profile ID
      const userProfile = await storage.getUserProfile(data.firebaseUid);
      if (!userProfile) {
        return res.status(404).json({ error: "User profile not found. Please complete registration first." });
      }

      const now = new Date().toISOString();
      
      // Auto-approve if BVN or Stripe verification was successful
      const isAutoApproved = data.bvnVerified || data.stripeVerified;
      const kycStatus = isAutoApproved ? 'approved' : 'pending_review';
      
      const submission = await storage.createKycSubmission({
        userProfileId: userProfile.id,
        firstName: data.firstName,
        lastName: data.lastName,
        middleName: data.middleName || null,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender || null,
        nationality: data.nationality,
        phoneNumber: data.phoneNumber,
        alternatePhone: data.alternatePhone || null,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 || null,
        city: data.city,
        state: data.state,
        country: data.country,
        postalCode: data.postalCode,
        idType: data.idType || 'BVN', // Default to BVN if not provided (BVN-verified users)
        idNumber: data.idNumber || data.bvnNumber || 'N/A', // Use BVN number if available
        idExpiryDate: data.idExpiryDate || null,
        idFrontUrl: data.idFrontUrl || null,
        idBackUrl: data.idBackUrl || null,
        selfieUrl: data.selfieUrl || null,
        proofOfAddressUrl: data.proofOfAddressUrl || null,
        isBusinessAccount: data.isBusinessAccount,
        businessName: data.businessName || null,
        businessType: data.businessType || null,
        businessRegistrationNumber: data.businessRegistrationNumber || null,
        businessAddress: data.businessAddress || null,
        businessDocumentUrl: data.businessDocumentUrl || null,
        status: kycStatus,
        reviewNotes: isAutoApproved ? 'Auto-approved via BVN/Stripe verification' : null,
        reviewedBy: isAutoApproved ? 'system' : null,
        reviewedAt: isAutoApproved ? now : null,
        submittedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      // Update user profile KYC status using firebaseUid
      await storage.updateUserProfile(data.firebaseUid, { 
        kycStatus: kycStatus,
        onboardingCompleted: true,
        onboardingStep: 5,
      });

      // Auto-create virtual account if approved
      let virtualAccount = null;
      if (isAutoApproved) {
        try {
          // Check if user already has a virtual account
          const existingAccounts = await storage.getVirtualAccounts();
          const userAccount = existingAccounts.find((a: any) => a.userId === data.firebaseUid);
          
          if (!userAccount) {
            // Create virtual account via payment provider
            const result = await paymentService.createVirtualAccount(
              userProfile.email,
              data.firstName,
              data.lastName,
              data.country
            );

            // Store in database
            virtualAccount = await storage.createVirtualAccount({
              userId: data.firebaseUid,
              name: result.accountName || `${data.firstName} ${data.lastName}`,
              accountNumber: result.accountNumber || '',
              bankName: result.bankName || 'Spendly',
              bankCode: result.bankCode || 'SPENDLY',
              currency: getCurrencyForCountry(data.country).currency,
              balance: '0',
              type: 'personal',
              status: 'active',
              createdAt: new Date().toISOString(),
            });

            // Create wallet for this user if not exists
            const existingWallet = await storage.getWalletByUserId(data.firebaseUid);
            if (!existingWallet) {
              await storage.createWallet({
                userId: data.firebaseUid,
                currency: getCurrencyForCountry(data.country).currency,
                type: 'personal',
                balance: '0',
                availableBalance: '0',
                pendingBalance: '0',
                status: 'active',
                virtualAccountId: virtualAccount.id,
              });
            }
          } else {
            virtualAccount = userAccount;
          }
        } catch (vaError: any) {
          console.error('Failed to create virtual account:', vaError.message);
          // Don't fail the KYC submission if virtual account creation fails
        }
      }

      res.status(201).json({ 
        ...submission, 
        virtualAccount,
        autoApproved: isAutoApproved 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to submit KYC" });
    }
  });

  // Update KYC submission
  app.patch("/api/kyc/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const submission = await storage.updateKycSubmission(id, req.body);
      if (!submission) {
        return res.status(404).json({ error: "KYC submission not found" });
      }
      res.json(submission);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update KYC submission" });
    }
  });

  // Upload KYC document with multer error handling
  app.post("/api/kyc/upload", (req, res) => {
    upload.single('document')(req, res, (err: any) => {
      if (err) {
        const message = err.message || "Failed to upload document";
        if (message.includes("Invalid file type")) {
          return res.status(400).json({ error: message });
        }
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: "File size exceeds 5MB limit" });
        }
        return res.status(400).json({ error: message });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const fileUrl = `/uploads/${req.file.filename}`;
      res.json({ url: fileUrl, filename: req.file.filename });
    });
  });

  // ==================== STRIPE IDENTITY KYC ====================

  // Create Stripe Identity verification session
  app.post("/api/kyc/stripe/create-session", async (req, res) => {
    try {
      const { userId, email, returnUrl } = req.body;
      if (!userId || !email) {
        return res.status(400).json({ error: "userId and email are required" });
      }

      const Stripe = await import('stripe');
      const stripe = new Stripe.default(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2024-12-18.acacia' as any,
      });

      // Create Identity verification session
      const verificationSession = await stripe.identity.verificationSessions.create({
        type: 'document',
        metadata: {
          userId,
          email,
        },
        options: {
          document: {
            allowed_types: ['passport', 'driving_license', 'id_card'],
            require_id_number: true,
            require_matching_selfie: true,
          },
        },
        return_url: returnUrl || `${req.protocol}://${req.get('host')}/onboarding?step=verification`,
      });

      res.json({
        sessionId: verificationSession.id,
        clientSecret: verificationSession.client_secret,
        url: verificationSession.url,
        status: verificationSession.status,
      });
    } catch (error: any) {
      console.error('Stripe Identity error:', error);
      res.status(500).json({ error: error.message || "Failed to create verification session" });
    }
  });

  // Check Stripe Identity verification status
  app.get("/api/kyc/stripe/status/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const Stripe = await import('stripe');
      const stripe = new Stripe.default(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2024-12-18.acacia' as any,
      });

      const verificationSession = await stripe.identity.verificationSessions.retrieve(sessionId);

      res.json({
        id: verificationSession.id,
        status: verificationSession.status,
        lastError: verificationSession.last_error,
        verifiedOutputs: verificationSession.verified_outputs,
      });
    } catch (error: any) {
      console.error('Stripe Identity status error:', error);
      res.status(500).json({ error: error.message || "Failed to get verification status" });
    }
  });

  // Stripe Identity webhook handler
  app.post("/api/kyc/stripe/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const Stripe = await import('stripe');
      const stripe = new Stripe.default(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2024-12-18.acacia' as any,
      });

      const sig = req.headers['stripe-signature'] as string;
      const webhookSecret = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET || '';
      
      let event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err: any) {
        console.log('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Handle verification events
      if (event.type === 'identity.verification_session.verified') {
        const session = event.data.object as any;
        const userId = session.metadata?.userId;
        if (userId) {
          // Update KYC status to approved
          await storage.updateUserProfile(userId, {
            kycStatus: 'approved',
            updatedAt: new Date().toISOString(),
          });
        }
      } else if (event.type === 'identity.verification_session.requires_input') {
        const session = event.data.object as any;
        const userId = session.metadata?.userId;
        if (userId) {
          await storage.updateUserProfile(userId, {
            kycStatus: 'pending_review',
            updatedAt: new Date().toISOString(),
          });
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('Stripe Identity webhook error:', error);
      res.status(500).json({ error: error.message || "Webhook processing failed" });
    }
  });

  // ==================== PAYSTACK KYC (BVN VERIFICATION) ====================

  // Resolve BVN (Bank Verification Number) - Nigeria
  app.post("/api/kyc/paystack/resolve-bvn", async (req, res) => {
    try {
      const { bvn, accountNumber, bankCode, firstName, lastName } = req.body;
      if (!bvn) {
        return res.status(400).json({ error: "BVN is required" });
      }

      const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!paystackSecretKey) {
        return res.status(500).json({ error: "Paystack secret key not configured" });
      }

      // Resolve BVN
      const response = await fetch(`https://api.paystack.co/bvn/match`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bvn,
          account_number: accountNumber,
          bank_code: bankCode,
          first_name: firstName,
          last_name: lastName,
        }),
      });

      const data = await response.json();
      
      if (data.status) {
        res.json({
          success: true,
          verified: data.data?.is_blacklisted === false,
          data: {
            firstName: data.data?.first_name,
            lastName: data.data?.last_name,
            dateOfBirth: data.data?.dob,
            mobile: data.data?.mobile,
          }
        });
      } else {
        res.status(400).json({ 
          success: false, 
          error: data.message || "BVN verification failed" 
        });
      }
    } catch (error: any) {
      console.error('Paystack BVN error:', error);
      res.status(500).json({ error: error.message || "Failed to verify BVN" });
    }
  });

  // Validate account with Paystack
  app.post("/api/kyc/paystack/validate-account", async (req, res) => {
    try {
      const { accountNumber, bankCode } = req.body;
      if (!accountNumber || !bankCode) {
        return res.status(400).json({ error: "Account number and bank code are required" });
      }

      const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!paystackSecretKey) {
        return res.status(500).json({ error: "Paystack secret key not configured" });
      }

      const response = await fetch(
        `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          headers: {
            'Authorization': `Bearer ${paystackSecretKey}`,
          },
        }
      );

      const data = await response.json();
      
      if (data.status) {
        res.json({
          success: true,
          accountName: data.data?.account_name,
          accountNumber: data.data?.account_number,
          bankId: data.data?.bank_id,
        });
      } else {
        res.status(400).json({ 
          success: false, 
          error: data.message || "Account validation failed" 
        });
      }
    } catch (error: any) {
      console.error('Paystack account validation error:', error);
      res.status(500).json({ error: error.message || "Failed to validate account" });
    }
  });

  // Get list of banks (for BVN verification)
  app.get("/api/kyc/paystack/banks", async (req, res) => {
    try {
      const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!paystackSecretKey) {
        return res.status(500).json({ error: "Paystack secret key not configured" });
      }

      const response = await fetch('https://api.paystack.co/bank', {
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
        },
      });

      const data = await response.json();
      
      if (data.status) {
        res.json({
          success: true,
          banks: data.data?.map((bank: any) => ({
            id: bank.id,
            name: bank.name,
            code: bank.code,
            slug: bank.slug,
            country: bank.country,
          })),
        });
      } else {
        res.status(400).json({ 
          success: false, 
          error: data.message || "Failed to fetch banks" 
        });
      }
    } catch (error: any) {
      console.error('Paystack banks error:', error);
      res.status(500).json({ error: error.message || "Failed to fetch banks" });
    }
  });

  // ==================== NOTIFICATIONS API ====================

  // Get all notifications for a user
  app.get("/api/notifications", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      const notifications = await storage.getNotifications(userId);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch notifications" });
    }
  });

  // Get unread notification count
  app.get("/api/notifications/unread-count", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      const notifications = await storage.getNotifications(userId);
      const unreadCount = notifications.filter(n => !n.read).length;
      res.json({ count: unreadCount });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch unread count" });
    }
  });

  // Mark notification as read
  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const notification = await storage.markNotificationRead(id);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read
  app.post("/api/notifications/mark-all-read", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      await storage.markAllNotificationsRead(userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to mark all notifications as read" });
    }
  });

  // Delete notification
  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteNotification(id);
      if (!deleted) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete notification" });
    }
  });

  // Send test notification
  app.post("/api/notifications/send", async (req, res) => {
    try {
      const { userId, type, title, message, data, channels } = req.body;
      if (!userId || !title || !message) {
        return res.status(400).json({ error: "userId, title, and message are required" });
      }
      await notificationService.send({
        userId,
        type: type || 'system_alert',
        title,
        message,
        data,
        channels: channels || ['in_app', 'push'],
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to send notification" });
    }
  });

  // ==================== NOTIFICATION SETTINGS API ====================

  // Get notification settings
  app.get("/api/notification-settings", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      const settings = await storage.getNotificationSettings(userId);
      if (!settings) {
        // Create default settings
        const now = new Date().toISOString();
        const newSettings = await storage.createNotificationSettings({
          userId,
          emailEnabled: true,
          smsEnabled: false,
          pushEnabled: true,
          inAppEnabled: true,
          email: null,
          phone: null,
          pushToken: null,
          expenseNotifications: true,
          paymentNotifications: true,
          billNotifications: true,
          budgetNotifications: true,
          securityNotifications: true,
          marketingNotifications: false,
          createdAt: now,
          updatedAt: now,
        });
        return res.json(newSettings);
      }
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch notification settings" });
    }
  });

  // Update notification settings
  app.patch("/api/notification-settings", async (req, res) => {
    try {
      const { userId, ...settingsData } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      let settings = await storage.getNotificationSettings(userId);
      if (!settings) {
        const now = new Date().toISOString();
        settings = await storage.createNotificationSettings({
          userId,
          emailEnabled: settingsData.emailEnabled ?? true,
          smsEnabled: settingsData.smsEnabled ?? false,
          pushEnabled: settingsData.pushEnabled ?? true,
          inAppEnabled: settingsData.inAppEnabled ?? true,
          email: settingsData.email || null,
          phone: settingsData.phone || null,
          pushToken: settingsData.pushToken || null,
          expenseNotifications: settingsData.expenseNotifications ?? true,
          paymentNotifications: settingsData.paymentNotifications ?? true,
          billNotifications: settingsData.billNotifications ?? true,
          budgetNotifications: settingsData.budgetNotifications ?? true,
          securityNotifications: settingsData.securityNotifications ?? true,
          marketingNotifications: settingsData.marketingNotifications ?? false,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        settings = await storage.updateNotificationSettings(userId, settingsData);
      }
      
      res.json(settings || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update notification settings" });
    }
  });

  // ==================== PUSH TOKENS API ====================

  // Register push token
  app.post("/api/push-tokens", async (req, res) => {
    try {
      const { userId, token, platform, deviceId } = req.body;
      if (!userId || !token || !platform) {
        return res.status(400).json({ error: "userId, token, and platform are required" });
      }

      // Deactivate existing tokens for this device
      if (deviceId) {
        const existingTokens = await storage.getPushTokens(userId);
        for (const t of existingTokens) {
          if (t.deviceId === deviceId && t.token !== token) {
            await storage.deactivatePushToken(t.token);
          }
        }
      }

      const now = new Date().toISOString();
      const pushToken = await storage.createPushToken({
        userId,
        token,
        platform,
        deviceId: deviceId || null,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      res.json(pushToken);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to register push token" });
    }
  });

  // Delete push token
  app.delete("/api/push-tokens/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const deleted = await storage.deletePushToken(token);
      if (!deleted) {
        return res.status(404).json({ error: "Push token not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete push token" });
    }
  });

  // ==================== ADMIN ROUTES ====================

  // Get audit logs
  app.get("/api/admin/audit-logs", async (req, res) => {
    try {
      const logs = await storage.getAuditLogs();
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch audit logs" });
    }
  });

  // Create audit log
  app.post("/api/admin/audit-logs", async (req, res) => {
    try {
      const { userId, userName, action, entityType, entityId, details, ipAddress, userAgent } = req.body;
      if (!userId || !userName || !action || !entityType) {
        return res.status(400).json({ error: "userId, userName, action, and entityType are required" });
      }
      const log = await storage.createAuditLog({
        userId,
        userName,
        action,
        entityType,
        entityId,
        details: details || {},
        ipAddress,
        userAgent,
        createdAt: new Date().toISOString(),
      });
      res.status(201).json(log);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create audit log" });
    }
  });

  // Get organization settings
  app.get("/api/admin/organization", async (req, res) => {
    try {
      const settings = await storage.getOrganizationSettings();
      res.json(settings || {
        id: '1',
        name: 'My Organization',
        currency: 'USD',
        timezone: 'UTC',
        fiscalYearStart: 'January',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch organization settings" });
    }
  });

  // Update organization settings
  app.put("/api/admin/organization", async (req, res) => {
    try {
      const data = req.body;
      const settings = await storage.updateOrganizationSettings({
        ...data,
        updatedAt: new Date().toISOString(),
      });
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update organization settings" });
    }
  });

  // Get system settings
  app.get("/api/admin/settings", async (req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch system settings" });
    }
  });

  // Update system setting
  app.put("/api/admin/settings/:key", async (req, res) => {
    try {
      const { key } = req.params;
      const { value, description, category } = req.body;
      const setting = await storage.updateSystemSetting(key, {
        value,
        description,
        category,
        updatedAt: new Date().toISOString(),
      });
      res.json(setting);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update system setting" });
    }
  });

  // Update security settings (simplified)
  app.put("/api/admin/security", async (req, res) => {
    try {
      const settings = req.body;
      // In a real app, you'd store these in system_settings table
      res.json({ success: true, ...settings });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update security settings" });
    }
  });

  // Get role permissions
  app.get("/api/admin/roles", async (req, res) => {
    try {
      const roles = await storage.getRolePermissions();
      res.json(roles);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch role permissions" });
    }
  });

  // Update role permissions
  app.put("/api/admin/roles/:role", async (req, res) => {
    try {
      const { role } = req.params;
      const { permissions, description } = req.body;
      const updated = await storage.updateRolePermissions(role, {
        permissions,
        description,
        updatedAt: new Date().toISOString(),
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update role permissions" });
    }
  });

  // ==================== WALLET ROUTES ====================
  
  // Get all wallets (admin) or user's wallets
  app.get("/api/wallets", async (req, res) => {
    try {
      const { userId } = req.query;
      const walletsList = await storage.getWallets(userId as string);
      res.json(walletsList);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch wallets" });
    }
  });

  // Get wallet by ID
  app.get("/api/wallets/:id", async (req, res) => {
    try {
      const wallet = await storage.getWallet(req.params.id);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      res.json(wallet);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch wallet" });
    }
  });

  // Create wallet
  app.post("/api/wallets", async (req, res) => {
    try {
      const { userId, currency, type } = req.body;
      
      // Check if wallet already exists for this user/currency
      const existing = await storage.getWalletByUserId(userId, currency);
      if (existing) {
        return res.status(400).json({ error: "Wallet already exists for this currency" });
      }
      
      const wallet = await storage.createWallet({
        userId,
        currency: currency || 'USD',
        type: type || 'personal',
        balance: '0',
        availableBalance: '0',
        pendingBalance: '0',
        status: 'active',
      });
      res.status(201).json(wallet);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create wallet" });
    }
  });

  // Get wallet transactions
  app.get("/api/wallets/:id/transactions", async (req, res) => {
    try {
      const transactions = await storage.getWalletTransactions(req.params.id);
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch wallet transactions" });
    }
  });

  // Fund wallet (credit)
  app.post("/api/wallets/:id/fund", async (req, res) => {
    try {
      const { amount, reference, description, metadata } = req.body;
      const transaction = await storage.creditWallet(
        req.params.id,
        parseFloat(amount),
        'funding',
        description || 'Wallet funding',
        reference || `FUND-${Date.now()}`,
        metadata
      );
      res.json(transaction);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fund wallet" });
    }
  });

  // Withdraw from wallet (debit)
  app.post("/api/wallets/:id/withdraw", async (req, res) => {
    try {
      const { amount, reference, description, metadata } = req.body;
      const transaction = await storage.debitWallet(
        req.params.id,
        parseFloat(amount),
        'withdrawal',
        description || 'Wallet withdrawal',
        reference || `WD-${Date.now()}`,
        metadata
      );
      res.json(transaction);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to withdraw from wallet" });
    }
  });

  // ==================== EXCHANGE RATES ROUTES ====================
  
  app.get("/api/exchange-rates", async (req, res) => {
    try {
      const rates = await storage.getExchangeRates();
      res.json(rates);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch exchange rates" });
    }
  });

  app.post("/api/exchange-rates", async (req, res) => {
    try {
      const { baseCurrency, targetCurrency, rate, source } = req.body;
      const exchangeRate = await storage.createExchangeRate({
        baseCurrency,
        targetCurrency,
        rate: rate.toString(),
        source: source || 'manual',
        validFrom: new Date().toISOString(),
      });
      res.status(201).json(exchangeRate);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create exchange rate" });
    }
  });

  app.get("/api/exchange-rates/:base/:target", async (req, res) => {
    try {
      const { base, target } = req.params;
      const rate = await storage.getExchangeRate(base, target);
      if (!rate) {
        return res.status(404).json({ error: "Exchange rate not found" });
      }
      res.json(rate);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch exchange rate" });
    }
  });

  // Seed default exchange rates (admin only)
  app.post("/api/exchange-rates/seed", requireAdmin, async (req, res) => {
    try {
      const defaultRates = [
        { baseCurrency: 'USD', targetCurrency: 'NGN', rate: '1550.00' },
        { baseCurrency: 'USD', targetCurrency: 'EUR', rate: '0.92' },
        { baseCurrency: 'USD', targetCurrency: 'GBP', rate: '0.79' },
        { baseCurrency: 'USD', targetCurrency: 'GHS', rate: '15.50' },
        { baseCurrency: 'USD', targetCurrency: 'KES', rate: '152.50' },
        { baseCurrency: 'USD', targetCurrency: 'ZAR', rate: '18.50' },
        { baseCurrency: 'NGN', targetCurrency: 'USD', rate: '0.000645' },
        { baseCurrency: 'EUR', targetCurrency: 'USD', rate: '1.087' },
        { baseCurrency: 'GBP', targetCurrency: 'USD', rate: '1.266' },
        { baseCurrency: 'EUR', targetCurrency: 'NGN', rate: '1685.00' },
        { baseCurrency: 'GBP', targetCurrency: 'NGN', rate: '1961.00' },
      ];

      const createdRates = [];
      for (const rateData of defaultRates) {
        // Check if rate already exists
        const existing = await storage.getExchangeRate(rateData.baseCurrency, rateData.targetCurrency);
        if (!existing) {
          const rate = await storage.createExchangeRate({
            ...rateData,
            source: 'system',
            validFrom: new Date().toISOString(),
          });
          createdRates.push(rate);
        }
      }

      res.json({
        message: `Seeded ${createdRates.length} exchange rates`,
        rates: createdRates
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to seed exchange rates" });
    }
  });

  // Get exchange rate settings (markup percentages)
  app.get("/api/exchange-rates/settings", async (req, res) => {
    try {
      let settings = await storage.getExchangeRateSettings();
      if (!settings) {
        // Create default settings with 10% markup
        settings = await storage.updateExchangeRateSettings('10.00', '10.00');
      }
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch exchange rate settings" });
    }
  });

  // Update exchange rate settings (admin only)
  app.put("/api/exchange-rates/settings", requireAdmin, async (req, res) => {
    try {
      const { buyMarkupPercent, sellMarkupPercent } = req.body;
      
      if (buyMarkupPercent === undefined || sellMarkupPercent === undefined) {
        return res.status(400).json({ error: "buyMarkupPercent and sellMarkupPercent are required" });
      }
      
      const buyMarkup = parseFloat(buyMarkupPercent);
      const sellMarkup = parseFloat(sellMarkupPercent);
      
      if (isNaN(buyMarkup) || isNaN(sellMarkup) || buyMarkup < 0 || sellMarkup < 0 || buyMarkup > 50 || sellMarkup > 50) {
        return res.status(400).json({ error: "Markup percentages must be between 0 and 50" });
      }
      
      const adminId = (req as any).adminId || 'admin';
      const settings = await storage.updateExchangeRateSettings(
        buyMarkup.toFixed(2),
        sellMarkup.toFixed(2),
        adminId
      );
      
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update exchange rate settings" });
    }
  });

  // Fetch live exchange rates from external API and store with markup
  app.post("/api/exchange-rates/fetch-live", requireAdmin, async (req, res) => {
    try {
      const baseCurrencies = ['USD', 'EUR', 'GBP'];
      const targetCurrencies = ['USD', 'EUR', 'GBP', 'NGN', 'GHS', 'KES', 'ZAR'];
      
      // Fetch live rates from exchangerate-api (free tier)
      const fetchedRates: any[] = [];
      
      for (const base of baseCurrencies) {
        try {
          const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${base}`);
          if (response.ok) {
            const data = await response.json();
            
            for (const target of targetCurrencies) {
              if (base !== target && data.rates[target]) {
                const rate = data.rates[target];
                
                // Check if rate already exists, update or create
                const existing = await storage.getExchangeRate(base, target);
                if (existing) {
                  await storage.updateExchangeRate(existing.id, {
                    rate: rate.toFixed(6),
                    source: 'live_api',
                    validFrom: new Date().toISOString(),
                  });
                } else {
                  await storage.createExchangeRate({
                    baseCurrency: base,
                    targetCurrency: target,
                    rate: rate.toFixed(6),
                    source: 'live_api',
                    validFrom: new Date().toISOString(),
                  });
                }
                
                fetchedRates.push({ base, target, rate: rate.toFixed(6) });
              }
            }
          }
        } catch (fetchError) {
          console.error(`Failed to fetch rates for ${base}:`, fetchError);
        }
      }
      
      res.json({
        message: `Fetched ${fetchedRates.length} live exchange rates`,
        rates: fetchedRates
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch live exchange rates" });
    }
  });

  // Get exchange rate with markup applied (for customer-facing transactions)
  app.get("/api/exchange-rates/:base/:target/with-markup", async (req, res) => {
    try {
      const { base, target } = req.params;
      const { type = 'buy' } = req.query; // 'buy' or 'sell'
      
      const rate = await storage.getExchangeRate(base, target);
      if (!rate) {
        return res.status(404).json({ error: "Exchange rate not found" });
      }
      
      // Get markup settings
      let settings = await storage.getExchangeRateSettings();
      if (!settings) {
        settings = await storage.updateExchangeRateSettings('10.00', '10.00');
      }
      
      const baseRate = parseFloat(String(rate.rate));
      const markupPercent = type === 'sell' 
        ? parseFloat(String(settings.sellMarkupPercent))
        : parseFloat(String(settings.buyMarkupPercent));
      
      // Apply markup: for buying foreign currency, increase rate; for selling, decrease rate
      // Customer buys foreign currency at higher rate (pays more)
      // Customer sells foreign currency at lower rate (receives less)
      let adjustedRate: number;
      if (type === 'buy') {
        // Customer buying target currency - they pay more
        adjustedRate = baseRate * (1 + markupPercent / 100);
      } else {
        // Customer selling target currency - they receive less
        adjustedRate = baseRate * (1 - markupPercent / 100);
      }
      
      res.json({
        baseCurrency: base,
        targetCurrency: target,
        marketRate: baseRate,
        markupPercent,
        type,
        customerRate: parseFloat(adjustedRate.toFixed(6)),
        source: rate.source,
        validFrom: rate.validFrom,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch exchange rate with markup" });
    }
  });

  // ==================== PAYOUT DESTINATIONS ROUTES ====================
  
  app.get("/api/payout-destinations", async (req, res) => {
    try {
      const { userId, vendorId } = req.query;
      const destinations = await storage.getPayoutDestinations(
        userId as string,
        vendorId as string
      );
      res.json(destinations);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch payout destinations" });
    }
  });

  app.post("/api/payout-destinations", async (req, res) => {
    try {
      const destination = await storage.createPayoutDestination(req.body);
      res.status(201).json(destination);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create payout destination" });
    }
  });

  app.put("/api/payout-destinations/:id", async (req, res) => {
    try {
      const destination = await storage.updatePayoutDestination(req.params.id, req.body);
      if (!destination) {
        return res.status(404).json({ error: "Payout destination not found" });
      }
      res.json(destination);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update payout destination" });
    }
  });

  app.delete("/api/payout-destinations/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePayoutDestination(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Payout destination not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete payout destination" });
    }
  });

  // ==================== PAYOUT ROUTES ====================
  
  app.get("/api/payouts", async (req, res) => {
    try {
      const { recipientType, recipientId, status } = req.query;
      const payoutsList = await storage.getPayouts({
        recipientType: recipientType as string,
        recipientId: recipientId as string,
        status: status as string,
      });
      res.json(payoutsList);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch payouts" });
    }
  });

  app.get("/api/payouts/:id", async (req, res) => {
    try {
      const payout = await storage.getPayout(req.params.id);
      if (!payout) {
        return res.status(404).json({ error: "Payout not found" });
      }
      res.json(payout);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch payout" });
    }
  });

  // Initiate payout (expense reimbursement, payroll, vendor payment)
  app.post("/api/payouts", async (req, res) => {
    try {
      const { 
        type, amount, currency, recipientType, recipientId, recipientName,
        destinationId, relatedEntityType, relatedEntityId, initiatedBy
      } = req.body;

      // Get payout destination
      let destination = null;
      let provider = 'stripe';
      
      if (destinationId) {
        destination = await storage.getPayoutDestination(destinationId);
        if (destination) {
          provider = destination.provider;
        }
      }

      // Create payout record
      const payout = await storage.createPayout({
        type,
        amount: amount.toString(),
        currency: currency || 'USD',
        status: 'pending',
        recipientType,
        recipientId,
        recipientName,
        destinationId,
        provider,
        relatedEntityType,
        relatedEntityId,
        initiatedBy,
      });

      res.status(201).json(payout);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create payout" });
    }
  });

  // Process payout (actually send money via Stripe/Paystack)
  app.post("/api/payouts/:id/process", async (req, res) => {
    try {
      const payout = await storage.getPayout(req.params.id);
      if (!payout) {
        return res.status(404).json({ error: "Payout not found" });
      }

      if (payout.status !== 'pending') {
        return res.status(400).json({ error: "Payout already processed" });
      }

      // Get destination details
      const destination = payout.destinationId 
        ? await storage.getPayoutDestination(payout.destinationId)
        : null;

      if (!destination) {
        return res.status(400).json({ error: "No payout destination configured" });
      }

      // Determine country for provider selection
      const countryCode = destination.country || 'US';
      
      try {
        // Initiate transfer via payment service
        const transferResult = await paymentService.initiateTransfer(
          parseFloat(payout.amount),
          {
            accountNumber: destination.accountNumber,
            bankCode: destination.bankCode,
            accountName: destination.accountName,
            stripeAccountId: destination.providerRecipientId,
            currency: destination.currency,
          },
          countryCode,
          `Payout: ${payout.type} - ${payout.id}`
        );

        // Update payout status
        const updatedPayout = await storage.updatePayout(payout.id, {
          status: 'processing',
          providerTransferId: transferResult.transferId || transferResult.transferCode,
          providerReference: transferResult.reference,
          processedAt: new Date().toISOString(),
        });

        // If related to an expense, update expense payout status
        if (payout.relatedEntityType === 'expense' && payout.relatedEntityId) {
          await storage.updateExpense(payout.relatedEntityId, {
            payoutStatus: 'processing',
            payoutId: payout.id,
          });
        }

        // Credit recipient wallet if they have one
        if (payout.recipientType === 'employee' && payout.recipientId) {
          const recipientWallet = await storage.getWalletByUserId(payout.recipientId, payout.currency);
          if (recipientWallet) {
            await storage.creditWallet(
              recipientWallet.id,
              parseFloat(payout.amount),
              payout.type,
              `Payout received: ${payout.type}`,
              `PO-${payout.id}`,
              { payoutId: payout.id }
            );
          }
          
          // Send payout confirmation notification
          notificationService.notifyPayoutProcessed(payout.recipientId, {
            amount: parseFloat(payout.amount),
            currency: payout.currency,
            recipientName: payout.recipientName,
            bankName: destination.bankName,
            reference: transferResult.reference,
          }).catch(err => console.error('Failed to send payout notification:', err));
          
          // Also send detailed payout confirmation email if user has email
          const recipientProfile = await storage.getUserProfile(payout.recipientId);
          if (recipientProfile?.email) {
            notificationService.sendPayoutConfirmationEmail({
              email: recipientProfile.email,
              name: payout.recipientName,
              amount: parseFloat(payout.amount),
              currency: payout.currency,
              recipientName: payout.recipientName,
              recipientBank: destination.bankName,
              recipientAccount: destination.accountNumber,
              reference: transferResult.reference || payout.id,
              date: new Date().toLocaleDateString(),
            }).catch(err => console.error('Failed to send payout email:', err));
          }
        }

        res.json(updatedPayout);
      } catch (transferError: any) {
        // Update payout as failed
        await storage.updatePayout(payout.id, {
          status: 'failed',
          failureReason: transferError.message,
        });
        res.status(500).json({ error: transferError.message || "Transfer failed" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to process payout" });
    }
  });

  // ==================== BILL PAYMENT FROM WALLET ====================
  
  app.post("/api/bills/:id/pay", async (req, res) => {
    try {
      const { walletId } = req.body;
      
      const bill = await storage.getBill(req.params.id);
      if (!bill) {
        return res.status(404).json({ error: "Bill not found" });
      }

      if (bill.status === 'Paid') {
        return res.status(400).json({ error: "Bill already paid" });
      }

      const wallet = await storage.getWallet(walletId);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }

      const billAmount = parseFloat(bill.amount);
      
      // Debit wallet
      const transaction = await storage.debitWallet(
        walletId,
        billAmount,
        'bill_payment',
        `Bill payment: ${bill.name}`,
        `BILL-${bill.id}`,
        { billId: bill.id }
      );

      // Update bill status
      const updatedBill = await storage.updateBill(bill.id, {
        status: 'Paid',
      });

      // Create a transaction record
      await storage.createTransaction({
        type: 'Bill',
        amount: bill.amount,
        fee: '0',
        status: 'Completed',
        date: new Date().toISOString(),
        description: `Bill payment: ${bill.name}`,
        currency: wallet.currency,
      });

      res.json({ bill: updatedBill, walletTransaction: transaction });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to pay bill" });
    }
  });

  // ==================== EXPENSE APPROVAL & PAYOUT FLOW ====================
  
  // Approve expense and initiate payout
  app.post("/api/expenses/:id/approve-and-pay", async (req, res) => {
    try {
      const { approvedBy, vendorId } = req.body;
      
      const expense = await storage.getExpense(req.params.id);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }

      if (expense.status !== 'PENDING') {
        return res.status(400).json({ error: "Expense is not pending" });
      }

      // Update expense status
      const updatedExpense = await storage.updateExpense(expense.id, {
        status: 'APPROVED',
        vendorId: vendorId || expense.vendorId,
        payoutStatus: 'pending',
      });

      // Determine recipient (employee or vendor)
      const recipientType = vendorId ? 'vendor' : 'employee';
      const recipientId = vendorId || expense.userId;
      let recipientName = expense.user;

      if (vendorId) {
        const vendor = await storage.getVendor(vendorId);
        if (vendor) {
          recipientName = vendor.name;
        }
      }

      // Get recipient's payout destination
      const destinations = await storage.getPayoutDestinations(
        recipientType === 'employee' ? recipientId : undefined,
        recipientType === 'vendor' ? recipientId : undefined
      );
      const defaultDestination = destinations.find(d => d.isDefault) || destinations[0];

      // Create payout
      const payout = await storage.createPayout({
        type: 'expense_reimbursement',
        amount: expense.amount,
        currency: expense.currency,
        status: 'pending',
        recipientType,
        recipientId,
        recipientName,
        destinationId: defaultDestination?.id,
        provider: defaultDestination?.provider || 'stripe',
        relatedEntityType: 'expense',
        relatedEntityId: expense.id,
        initiatedBy: approvedBy,
      });

      // Update expense with payout ID
      await storage.updateExpense(expense.id, {
        payoutId: payout.id,
      });

      // Send notification
      await notificationService.notifyExpenseApproved(expense.userId, {
        id: expense.id,
        merchant: expense.merchant,
        amount: parseFloat(expense.amount),
      });

      res.json({ expense: updatedExpense, payout });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to approve expense" });
    }
  });

  // ==================== PAYROLL BATCH PAYOUT ====================
  
  app.post("/api/payroll/batch-payout", async (req, res) => {
    try {
      const { payrollIds, initiatedBy } = req.body;
      
      const results = [];
      
      for (const payrollId of payrollIds) {
        try {
          const entry = await storage.getPayrollEntry(payrollId);
          if (!entry || entry.status === 'paid') continue;

          // Get employee's payout destination
          const destinations = await storage.getPayoutDestinations(entry.employeeId);
          const defaultDestination = destinations.find(d => d.isDefault) || destinations[0];

          // Create payout
          const payout = await storage.createPayout({
            type: 'payroll',
            amount: entry.netPay || entry.salary,
            currency: 'USD',
            status: 'pending',
            recipientType: 'employee',
            recipientId: entry.employeeId,
            recipientName: entry.employeeName,
            destinationId: defaultDestination?.id,
            provider: defaultDestination?.provider || 'stripe',
            relatedEntityType: 'payroll',
            relatedEntityId: entry.id,
            initiatedBy,
          });

          // Update payroll entry
          await storage.updatePayrollEntry(entry.id, {
            status: 'processing',
            payoutId: payout.id,
          } as any);

          results.push({ payrollId, payoutId: payout.id, status: 'created' });
        } catch (err: any) {
          results.push({ payrollId, error: err.message });
        }
      }

      res.json({ results });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create batch payouts" });
    }
  });

  // ==================== VENDOR PAYMENT ====================
  
  app.post("/api/vendors/:id/pay", async (req, res) => {
    try {
      const { amount, description, initiatedBy, invoiceId } = req.body;
      
      const vendor = await storage.getVendor(req.params.id);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }

      // Get vendor's payout destination
      const destinations = await storage.getPayoutDestinations(undefined, vendor.id);
      const defaultDestination = destinations.find(d => d.isDefault) || destinations[0];

      if (!defaultDestination) {
        return res.status(400).json({ error: "Vendor has no payout destination configured" });
      }

      // Create payout
      const payout = await storage.createPayout({
        type: 'vendor_payment',
        amount: amount.toString(),
        currency: 'USD',
        status: 'pending',
        recipientType: 'vendor',
        recipientId: vendor.id,
        recipientName: vendor.name,
        destinationId: defaultDestination.id,
        provider: defaultDestination.provider,
        relatedEntityType: invoiceId ? 'invoice' : undefined,
        relatedEntityId: invoiceId,
        initiatedBy,
      });

      res.status(201).json(payout);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create vendor payment" });
    }
  });

  // ==================== VIRTUAL ACCOUNT CREATION ON SIGNUP ====================
  
  app.post("/api/virtual-accounts/create", async (req, res) => {
    try {
      const { userId, email, firstName, lastName, countryCode } = req.body;

      // Check if user already has a virtual account
      const existingAccounts = await storage.getVirtualAccounts();
      const userAccount = existingAccounts.find((a: any) => a.userId === userId);
      if (userAccount) {
        return res.json(userAccount);
      }

      // Create virtual account via payment provider
      const result = await paymentService.createVirtualAccount(
        email,
        firstName,
        lastName,
        countryCode
      );

      // Store in database
      const virtualAccount = await storage.createVirtualAccount({
        userId,
        name: result.accountName || `${firstName} ${lastName}`,
        accountNumber: result.accountNumber || '',
        bankName: result.bankName || 'Spendly',
        bankCode: result.bankCode || 'SPENDLY',
        currency: getCurrencyForCountry(countryCode).currency,
        balance: '0',
        type: 'personal',
        status: 'active',
        createdAt: new Date().toISOString(),
      });

      // Create wallet for this user if not exists
      const existingWallet = await storage.getWalletByUserId(userId);
      if (!existingWallet) {
        await storage.createWallet({
          userId,
          currency: getCurrencyForCountry(countryCode).currency,
          type: 'personal',
          balance: '0',
          availableBalance: '0',
          pendingBalance: '0',
          status: 'active',
          virtualAccountId: virtualAccount.id,
        });
      }

      res.status(201).json(virtualAccount);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create virtual account" });
    }
  });

  // ==================== ADMIN UTILITIES ====================
  
  // Get all users (admin)
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const usersList = await storage.getUsers();
      res.json(usersList);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch users" });
    }
  });

  // Update user (admin)
  app.put("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const user = await storage.updateUser(req.params.id, req.body);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update user" });
    }
  });

  // Delete user (admin)
  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteUser(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete user" });
    }
  });

  // Purge database (admin)
  app.post("/api/admin/purge-database", requireAdmin, async (req, res) => {
    try {
      const { tablesToPreserve, confirmPurge } = req.body;
      
      if (confirmPurge !== 'CONFIRM_PURGE') {
        return res.status(400).json({ error: "Must confirm purge with 'CONFIRM_PURGE'" });
      }

      const result = await storage.purgeDatabase(tablesToPreserve);
      
      // Log the action
      await storage.createAuditLog({
        action: 'database_purge',
        userId: 'system',
        resourceType: 'database',
        resourceId: 'all',
        details: { purgedTables: result.purgedTables },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || '',
        createdAt: new Date().toISOString(),
      } as any);

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to purge database" });
    }
  });

  // Admin settings
  app.get("/api/admin/admin-settings", async (req, res) => {
    try {
      const settings = await storage.getAdminSettings();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch admin settings" });
    }
  });

  app.put("/api/admin/admin-settings/:key", async (req, res) => {
    try {
      const { value, description } = req.body;
      const setting = await storage.setAdminSetting(req.params.key, value, description);
      res.json(setting);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update admin setting" });
    }
  });

  // Single admin enforcement
  app.post("/api/admin/set-single-admin", requireAdmin, async (req, res) => {
    try {
      const { adminUserId } = req.body;
      
      // Get all users
      const allUsers = await storage.getUsers();
      
      // Demote all other admins/owners to MANAGER
      for (const user of allUsers) {
        if (user.id !== adminUserId && (user.role === 'OWNER' || user.role === 'ADMIN')) {
          await storage.updateUser(user.id, { role: 'MANAGER' });
        }
      }

      // Promote specified user to OWNER
      const adminUser = await storage.updateUser(adminUserId, { role: 'OWNER' });

      // Set admin setting
      await storage.setAdminSetting('single_admin_id', adminUserId, 'The single admin user ID');
      await storage.setAdminSetting('single_admin_enforced', 'true', 'Whether single admin is enforced');

      res.json({ success: true, admin: adminUser });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to set single admin" });
    }
  });

  // ==================== INVOICE WITH VIRTUAL ACCOUNT ====================
  
  // Get invoice with virtual account details
  app.get("/api/invoices/:id/payment-details", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Get company virtual account for receiving payments
      const virtualAccountsList = await storage.getVirtualAccounts();
      const companyAccount = virtualAccountsList[0]; // Use first/primary account

      res.json({
        invoice,
        paymentDetails: companyAccount ? {
          bankName: companyAccount.bankName,
          accountNumber: companyAccount.accountNumber,
          accountName: companyAccount.accountName,
          currency: companyAccount.currency,
          reference: `INV-${invoice.invoiceNumber}`,
          instructions: `Please include reference INV-${invoice.invoiceNumber} in your payment`,
        } : null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch invoice payment details" });
    }
  });

  // ==================== FUNDING SOURCE ROUTES ====================
  
  app.get("/api/funding-sources", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const sources = await storage.getFundingSources(userId as string);
      res.json(sources);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch funding sources" });
    }
  });

  app.post("/api/funding-sources", async (req, res) => {
    try {
      const source = await storage.createFundingSource(req.body);
      res.status(201).json(source);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create funding source" });
    }
  });

  app.delete("/api/funding-sources/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteFundingSource(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Funding source not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete funding source" });
    }
  });

  // ==================== ADMIN USER MANAGEMENT ====================
  
  // Seed admin user (one-time setup)
  app.post("/api/admin/seed", async (req, res) => {
    try {
      const bcrypt = await import('bcryptjs');
      
      // Check if admin already exists
      const existingUsers = await storage.getUsers();
      const adminExists = existingUsers.some(u => u.role === 'OWNER' || u.username === 'admin');
      
      if (adminExists) {
        return res.status(400).json({ error: "Admin user already exists" });
      }
      
      // Create default admin user
      const hashedPassword = await bcrypt.hash('Admin@123', 10);
      const adminUser = await storage.createUser({
        username: 'admin',
        password: hashedPassword,
        name: 'System Administrator',
        email: 'info@spendlymanager.com',
        role: 'OWNER',
        department: 'Administration',
        avatar: null,
        permissions: ['all'],
      });
      
      res.status(201).json({ 
        message: "Admin user created successfully",
        username: 'admin',
        defaultPassword: 'Admin@123',
        note: 'Please change the password after first login'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create admin user" });
    }
  });

  // Admin login
  app.post("/api/admin/login", authLimiter, async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      
      const bcrypt = await import('bcryptjs');
      const users = await storage.getUsers();
      const user = users.find(u => u.username === username);
      
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Check if user has admin privileges
      if (!['OWNER', 'ADMIN'].includes(user.role)) {
        return res.status(403).json({ error: "Access denied. Admin privileges required." });
      }
      
      // Return user info (without password)
      const { password: _, ...userWithoutPassword } = user;
      
      // Send login alert email if user has email
      if (user.email) {
        const ipAddress = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];
        notificationService.sendLoginAlertEmail({
          email: user.email,
          name: user.displayName || user.username,
          loginTime: new Date().toLocaleString(),
          ipAddress: ipAddress?.split(',')[0],
          device: userAgent,
        }).catch(err => console.error('Failed to send login alert:', err));
      }
      
      res.json({
        success: true,
        user: userWithoutPassword,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Login failed" });
    }
  });

  // Get all admin users
  app.get("/api/admin/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      const adminUsers = users
        .filter(u => ['OWNER', 'ADMIN'].includes(u.role))
        .map(({ password, ...user }) => user);
      res.json(adminUsers);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch admin users" });
    }
  });

  // ==================== NOTIFICATION API ENDPOINTS ====================

  // Track user login (called from frontend after Firebase auth)
  app.post("/api/auth/track-login", async (req, res) => {
    try {
      const { userId, email, displayName } = req.body;
      
      if (!userId || !email) {
        return res.status(400).json({ error: "userId and email are required" });
      }
      
      // Get user settings to check if login alerts are enabled
      const settings = await storage.getNotificationSettings(userId);
      
      if (settings?.securityNotifications) {
        const ipAddress = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];
        
        notificationService.sendLoginAlertEmail({
          email,
          name: displayName || email.split('@')[0],
          loginTime: new Date().toLocaleString(),
          ipAddress: ipAddress?.split(',')[0],
          device: userAgent,
        }).catch(err => console.error('Failed to send login alert:', err));
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to track login" });
    }
  });

  // Send password reset confirmation (called after successful reset)
  app.post("/api/auth/password-reset-success", async (req, res) => {
    try {
      const { email, name } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "email is required" });
      }
      
      const result = await notificationService.sendPasswordResetSuccess({
        email,
        name: name || email.split('@')[0],
      });
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to send confirmation" });
    }
  });

  // Send email verification
  app.post("/api/auth/send-verification", async (req, res) => {
    try {
      const { email, name, verificationLink } = req.body;
      
      if (!email || !verificationLink) {
        return res.status(400).json({ error: "email and verificationLink are required" });
      }
      
      const result = await notificationService.sendEmailVerification({
        email,
        name: name || email.split('@')[0],
        verificationLink,
      });
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to send verification" });
    }
  });

  // Send transaction SMS alert
  app.post("/api/notifications/transaction-sms", async (req, res) => {
    try {
      const { phone, type, amount, currency, description, balance } = req.body;
      
      if (!phone || !type || !amount || !currency) {
        return res.status(400).json({ error: "phone, type, amount, and currency are required" });
      }
      
      const result = await notificationService.sendTransactionAlertSms({
        phone,
        type,
        amount: parseFloat(amount),
        currency,
        description: description || 'Transaction',
        balance: balance ? parseFloat(balance) : undefined,
      });
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to send SMS" });
    }
  });

  // Resend invoice email
  app.post("/api/invoices/:id/send", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      if (!invoice.clientEmail) {
        return res.status(400).json({ error: "Invoice has no client email" });
      }
      
      const settings = await storage.getOrganizationSettings();
      const companyName = settings?.companyName || 'Spendly';
      const appUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
        : 'https://spendlymanager.com';
      
      const items = Array.isArray(invoice.items) ? invoice.items : [];
      
      const result = await notificationService.sendInvoiceEmail({
        email: invoice.clientEmail,
        clientName: invoice.client,
        senderName: companyName,
        invoiceNumber: invoice.invoiceNumber,
        amount: parseFloat(invoice.amount),
        currency: settings?.currency || 'USD',
        dueDate: invoice.dueDate,
        items: items.map((item: any) => ({
          description: item.description || 'Service',
          quantity: item.quantity || 1,
          price: parseFloat(item.price || item.amount || 0),
        })),
        paymentLink: `${appUrl}/pay/${invoice.id}`,
      });
      
      res.json({ success: result.success, message: result.success ? 'Invoice sent successfully' : result.error });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to send invoice" });
    }
  });

  return httpServer;
}
