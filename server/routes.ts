import type { Express } from "express";
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
  amount: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseFloat(val) : val),
  category: z.string().min(1),
  note: z.string().optional(),
  receiptUrl: z.string().optional(),
});

const transactionSchema = z.object({
  type: z.string().min(1),
  amount: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseFloat(val) : val),
  description: z.string().optional(),
  fee: z.union([z.string(), z.number()]).optional().transform(val => typeof val === 'string' ? parseFloat(val) || 0 : val || 0),
});

const billSchema = z.object({
  name: z.string().min(1),
  provider: z.string().optional().default(''),
  amount: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseFloat(val) : val),
  dueDate: z.string().min(1),
  category: z.string().optional().default('Other'),
});

const budgetSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  limit: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseFloat(val) : val),
  period: z.string().optional().default('monthly'),
});

const cardSchema = z.object({
  name: z.string().min(1),
  limit: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseFloat(val) : val),
  type: z.string().optional().default('Visa'),
  color: z.string().optional().default('indigo'),
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
  salary: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseFloat(val) : val),
  bonus: z.union([z.string(), z.number()]).optional().transform(val => typeof val === 'string' ? parseFloat(val) || 0 : val || 0),
  deductions: z.union([z.string(), z.number()]).optional().transform(val => typeof val === 'string' ? parseFloat(val) || 0 : val || 0),
  payDate: z.string().optional(),
});

const invoiceSchema = z.object({
  client: z.string().min(1),
  clientEmail: z.string().optional().default(''),
  amount: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseFloat(val) : val),
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

const expenseUpdateSchema = expenseSchema.partial();
const transactionUpdateSchema = transactionSchema.partial();
const billUpdateSchema = billSchema.partial().extend({
  status: z.string().optional(),
});
const budgetUpdateSchema = budgetSchema.partial().extend({
  spent: z.union([z.string(), z.number()]).optional().transform(val => typeof val === 'string' ? parseFloat(val) : val),
});
const cardUpdateSchema = cardSchema.partial().extend({
  status: z.string().optional(),
  balance: z.union([z.string(), z.number()]).optional().transform(val => typeof val === 'string' ? parseFloat(val) : val),
});
const teamMemberUpdateSchema = teamMemberSchema.partial().extend({
  status: z.string().optional(),
});
const payrollUpdateSchema = payrollSchema.partial().extend({
  status: z.enum(['pending', 'processing', 'paid']).optional(),
  netPay: z.union([z.string(), z.number()]).optional().transform(val => typeof val === 'string' ? parseFloat(val) : val),
});
const invoiceUpdateSchema = invoiceSchema.partial().extend({
  status: z.string().optional(),
});
const vendorUpdateSchema = vendorSchema.partial().extend({
  status: z.string().optional(),
  totalPaid: z.union([z.string(), z.number()]).optional().transform(val => typeof val === 'string' ? parseFloat(val) : val),
  pendingPayments: z.union([z.string(), z.number()]).optional().transform(val => typeof val === 'string' ? parseFloat(val) : val),
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
      const newLocal = (currentBalances?.local || 0) + parsedAmount;
      
      await storage.createTransaction({
        type: "Funding",
        amount: parsedAmount,
        fee: 0,
        status: 'Completed',
        date: new Date().toISOString().split('T')[0],
        description: "Wallet Funding",
        currency: 'USD',
      });
      
      const updatedBalances = await storage.updateBalances({ local: newLocal });
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
      const currentLocal = currentBalances?.local || 0;
      
      if (parsedAmount > currentLocal) {
        return res.status(400).json({ error: "Insufficient funds" });
      }

      const newLocal = currentLocal - parsedAmount;
      
      await storage.createTransaction({
        type: "Payout" as any,
        amount: parsedAmount,
        fee: 0,
        status: 'Completed',
        date: new Date().toISOString().split('T')[0],
        description: "Wallet Withdrawal",
        currency: 'USD',
      });
      
      const updatedBalances = await storage.updateBalances({ local: newLocal });
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
      const currentLocal = currentBalances?.local || 0;
      
      if (parsedAmount > currentLocal) {
        return res.status(400).json({ error: "Insufficient funds" });
      }

      const newLocal = currentLocal - parsedAmount;
      
      await storage.createTransaction({
        type: "Payout",
        amount: parsedAmount,
        fee: 0,
        status: 'Completed',
        date: new Date().toISOString().split('T')[0],
        description: `Payment to ${recipient}${note ? ` - ${note}` : ''}`,
        currency: 'USD',
      });
      
      const updatedBalances = await storage.updateBalances({ local: newLocal });
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
      const { merchant, amount, category, note, receiptUrl } = result.data;

      const expense = await storage.createExpense({
        merchant,
        amount,
        currency: 'USD',
        date: new Date().toISOString().split('T')[0],
        category,
        status: 'PENDING',
        user: 'John Doe',
        userId: '1',
        department: 'General',
        note,
        receiptUrl,
      });
      
      res.status(201).json(expense);
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
        const userId = expense.submittedBy || expense.userId || 'system';
        
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
        type: type as any,
        amount,
        fee: fee || 0,
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
        spent: 0,
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

  app.post("/api/cards", async (req, res) => {
    try {
      const result = cardSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid card data", details: result.error.issues });
      }
      const { name, limit, type, color } = result.data;

      const last4 = String(Math.floor(1000 + Math.random() * 9000));
      
      const card = await storage.createCard({
        name,
        last4,
        balance: limit,
        limit,
        type: (type || 'Visa') as any,
        color: color || 'indigo',
        currency: 'USD',
        status: 'Active',
      });
      
      res.status(201).json(card);
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

  // Fund a virtual card
  app.post("/api/cards/:id/fund", async (req, res) => {
    try {
      const { amount, paymentMethod } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valid amount is required" });
      }
      
      const card = await storage.getCard(req.params.id);
      if (!card) {
        return res.status(404).json({ error: "Card not found" });
      }
      
      // Update card balance
      const newBalance = card.balance + amount;
      const updated = await storage.updateCard(req.params.id, { balance: newBalance });
      
      // Create funding transaction
      await storage.createTransaction({
        description: `Card funding - ${card.name}`,
        amount,
        type: 'Funding',
        status: 'Completed',
        date: new Date().toISOString().split('T')[0],
        account: `Virtual Card ****${card.last4}`,
        category: 'Card Funding',
        reference: `FUND-${Date.now()}`,
      });
      
      res.json({ 
        success: true, 
        card: updated,
        message: `$${amount.toLocaleString()} funded to card`
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fund card" });
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
      
      if (card.status !== 'active') {
        return res.status(400).json({ error: "Card is not active" });
      }
      
      if (card.balance < amount) {
        return res.status(400).json({ error: "Insufficient card balance" });
      }
      
      // Deduct from card balance
      const newBalance = card.balance - amount;
      await storage.updateCard(req.params.id, { balance: newBalance });
      
      // Create card transaction record
      const cardTx = await storage.createCardTransaction({
        cardId: req.params.id,
        amount,
        merchant,
        category: category || 'General',
        description: description || '',
        status: 'completed',
        date: new Date().toISOString(),
      });
      
      // Create expense record
      await storage.createExpense({
        merchant,
        amount,
        currency: card.currency || 'USD',
        date: new Date().toISOString().split('T')[0],
        category: category || 'General',
        status: 'PAID',
        user: 'Card Payment',
        userId: '1',
        department: 'General',
        note: `Paid with virtual card ****${card.last4}`,
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
        id: `VA-${Date.now()}`,
        name,
        accountNumber,
        bankName: bankCode === 'PAYSTACK' ? 'Wema Bank' : 'Stripe Treasury',
        bankCode,
        currency: currency || 'USD',
        balance: 0,
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
        description: `Deposit to ${account.name}`,
        amount,
        type: 'Deposit',
        status: 'Completed',
        date: new Date().toISOString().split('T')[0],
        account: account.accountNumber,
        category: 'Virtual Account',
        reference: reference || `DEP-${Date.now()}`,
      });
      
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
      
      if (account.balance < amount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      
      // Update balance
      const newBalance = account.balance - amount;
      await storage.updateVirtualAccount(req.params.id, { balance: newBalance });
      
      // Create transaction record
      await storage.createTransaction({
        description: `Withdrawal from ${account.name}`,
        amount,
        type: 'Payout',
        status: 'Completed',
        date: new Date().toISOString().split('T')[0],
        account: account.accountNumber,
        category: 'Virtual Account',
        reference: reference || `WTH-${Date.now()}`,
      });
      
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

  app.post("/api/team", async (req, res) => {
    try {
      const result = teamMemberSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid team member data", details: result.error.issues });
      }
      const { name, email, role, department } = result.data;

      const member = await storage.createTeamMember({
        name,
        email,
        role: (role || 'EMPLOYEE') as any,
        department: (department || 'General') as any,
        status: 'Active',
        joinedAt: new Date().toISOString().split('T')[0],
        permissions: ['CREATE_EXPENSE'],
      });
      
      res.status(201).json(member);
    } catch (error) {
      res.status(500).json({ error: "Failed to create team member" });
    }
  });

  app.patch("/api/team/:id", async (req, res) => {
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

  app.delete("/api/team/:id", async (req, res) => {
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
        id: `RPT${Date.now()}`,
        name,
        type,
        dateRange,
        createdAt: now.toISOString().split('T')[0],
        status: "processing",
        fileSize: "--"
      });
      
      // Simulate report generation - mark as completed after short delay
      setTimeout(async () => {
        await storage.updateReport(report.id, { 
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
        reportData.totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
        reportData.count = expenses.length;
      } else if (report.type === "budget" || report.type === "Budget Report") {
        reportData.budgets = budgets;
        reportData.totalBudget = budgets.reduce((sum, b) => sum + b.limit, 0);
        reportData.totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
      } else if (report.type === "transaction" || report.type === "Transaction Report") {
        reportData.transactions = transactions;
        reportData.totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
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

      const salaryNum = salary;
      const bonusNum = bonus || 0;
      const deductionsNum = deductions || 0;
      
      const entry = await storage.createPayrollEntry({
        employeeId: employeeId || String(Date.now()),
        employeeName,
        department: department || 'General',
        salary: salaryNum,
        bonus: bonusNum,
        deductions: deductionsNum,
        netPay: salaryNum + bonusNum - deductionsNum,
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

      const totalPaid = processedEntries.reduce((sum, e) => sum + e.netPay, 0);
      
      await storage.createTransaction({
        type: "Payout",
        amount: totalPaid,
        fee: 0,
        status: 'Completed',
        date: new Date().toISOString().split('T')[0],
        description: `Payroll - ${processedEntries.length} employees`,
        currency: 'USD',
      });

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
        amount: Number(entry.netPay),
        fee: 0,
        status: 'Completed',
        date: new Date().toISOString().split('T')[0],
        description: `Salary payment - ${entry.employeeName}`,
        currency: 'USD',
      });

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
        totalPaid: 0,
        pendingPayments: 0,
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
        await storage.updateBalances({ usd: balances.usd + amount });
        
        await storage.createTransaction({
          type: 'Funding',
          amount,
          fee: 0,
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

  app.post("/api/payment/transfer", async (req, res) => {
    try {
      const result = transferSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid transfer data", details: result.error.issues });
      }

      const { amount, countryCode, reason, recipientDetails } = result.data;
      const transferResult = await paymentService.initiateTransfer(
        amount,
        recipientDetails,
        countryCode,
        reason
      );
      
      res.json(transferResult);
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

  app.post("/api/payment/virtual-account", async (req, res) => {
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
        if (balances.usd < bill.amount) {
          return res.status(400).json({ error: "Insufficient wallet balance" });
        }
        
        await storage.updateBalances({ usd: balances.usd - bill.amount });
        await storage.updateBill(billId, { status: 'Paid' });
        
        await storage.createTransaction({
          type: 'Bill',
          amount: bill.amount,
          fee: 0,
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

  app.post("/api/wallet/payout", async (req, res) => {
    try {
      const result = payoutSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid payout data", details: result.error.issues });
      }

      const { amount, countryCode, recipientDetails, reason } = result.data;
      
      const balances = await storage.getBalances();
      if (balances.usd < amount) {
        return res.status(400).json({ error: "Insufficient wallet balance" });
      }
      
      const transferResult = await paymentService.initiateTransfer(
        amount,
        recipientDetails,
        countryCode,
        reason
      );
      
      await storage.updateBalances({ usd: balances.usd - amount });
      
      await storage.createTransaction({
        type: 'Payout',
        amount,
        fee: 0,
        status: 'Processing',
        date: new Date().toISOString().split('T')[0],
        description: reason,
        currency: getCurrencyForCountry(countryCode).currency,
      });
      
      res.json({
        success: true,
        transferDetails: transferResult,
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
      if (balances.local < amount) {
        return res.status(400).json({ error: "Insufficient wallet balance" });
      }
      
      await storage.updateBalances({ local: balances.local - amount });
      
      await storage.createTransaction({
        type: 'Expense' as any,
        amount,
        fee: 0,
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

  // ==================== ACCOUNT VALIDATION ====================
  const validateAccountSchema = z.object({
    accountNumber: z.string().min(1),
    bankCode: z.string().min(1),
    countryCode: z.string().min(2).max(2).default('NG'),
  });

  app.post("/api/payment/validate-account", async (req, res) => {
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
      
      if (paystackSecretKey) {
        const hash = crypto.createHmac('sha512', paystackSecretKey)
          .update(JSON.stringify(req.body))
          .digest('hex');
        
        const signature = req.headers['x-paystack-signature'];
        if (hash !== signature) {
          console.error('Paystack webhook signature verification failed');
          return res.status(401).json({ error: "Invalid signature" });
        }
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
        const amountInNaira = amount / 100;
        
        if (metadata?.type === 'wallet_funding') {
          const balances = await storage.getBalances();
          await storage.updateBalances({ local: balances.local + amountInNaira });
          
          await storage.createTransaction({
            type: 'Funding',
            amount: amountInNaira,
            fee: 0,
            status: 'Completed',
            description: 'Card payment via Paystack',
            currency: event.data.currency || 'NGN',
            date: new Date().toISOString().split('T')[0],
          });
        }
        
        console.log(`Paystack payment confirmed: ${reference}`);
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
        await storage.updateBalances({ local: balances.local + verification.amount });
        
        await storage.createTransaction({
          type: 'Funding',
          amount: verification.amount,
          fee: 0,
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
          amount: amountInNaira,
          fee: 0,
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
      
      const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
      const totalIncome = transactions
        .filter(t => t.type === 'Deposit' || t.type === 'Funding' || t.type === 'Refund')
        .reduce((sum, t) => sum + t.amount, 0);
      const totalOutflow = transactions
        .filter(t => t.type === 'Payout' || t.type === 'Bill')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const categoryBreakdown: Record<string, number> = {};
      expenses.forEach(e => {
        categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.amount;
      });
      
      const departmentBreakdown: Record<string, number> = {};
      expenses.forEach(e => {
        departmentBreakdown[e.department || 'Other'] = (departmentBreakdown[e.department || 'Other'] || 0) + e.amount;
      });
      
      const budgetUtilization = budgets.map(b => ({
        name: b.name,
        budget: b.limit,
        spent: b.spent,
        percentage: Math.round((b.spent / b.limit) * 100),
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
  const kycSubmissionSchema = z.object({
    firebaseUid: z.string().min(1, "Firebase UID is required"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    middleName: z.string().optional(),
    dateOfBirth: z.string().min(1, "Date of birth is required"),
    gender: z.string().optional(),
    nationality: z.string().min(1, "Nationality is required"),
    phoneNumber: z.string().min(1, "Phone number is required"),
    alternatePhone: z.string().optional(),
    addressLine1: z.string().min(1, "Address is required"),
    addressLine2: z.string().optional(),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    country: z.string().min(1, "Country is required"),
    postalCode: z.string().min(1, "Postal code is required"),
    idType: z.string().min(1, "ID type is required"),
    idNumber: z.string().min(1, "ID number is required"),
    idExpiryDate: z.string().optional(),
    idFrontUrl: z.string().optional(),
    idBackUrl: z.string().optional(),
    selfieUrl: z.string().optional(),
    proofOfAddressUrl: z.string().optional(),
    isBusinessAccount: z.boolean().optional().default(false),
    businessName: z.string().optional(),
    businessType: z.string().optional(),
    businessRegistrationNumber: z.string().optional(),
    businessAddress: z.string().optional(),
    businessDocumentUrl: z.string().optional(),
  });

  // Submit KYC
  app.post("/api/kyc", async (req, res) => {
    try {
      const parseResult = kycSubmissionSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid request data" });
      }

      const data = parseResult.data;
      
      // Get user profile by firebaseUid to get the profile ID
      const userProfile = await storage.getUserProfile(data.firebaseUid);
      if (!userProfile) {
        return res.status(404).json({ error: "User profile not found. Please complete registration first." });
      }

      const now = new Date().toISOString();
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
        idType: data.idType,
        idNumber: data.idNumber,
        idExpiryDate: data.idExpiryDate || null,
        idFrontUrl: data.idFrontUrl || null,
        idBackUrl: data.idBackUrl || null,
        selfieUrl: data.selfieUrl || null,
        proofOfAddressUrl: data.proofOfAddressUrl || null,
        isBusinessAccount: data.isBusinessAccount || false,
        businessName: data.businessName || null,
        businessType: data.businessType || null,
        businessRegistrationNumber: data.businessRegistrationNumber || null,
        businessAddress: data.businessAddress || null,
        businessDocumentUrl: data.businessDocumentUrl || null,
        status: 'pending_review',
        reviewNotes: null,
        reviewedBy: null,
        reviewedAt: null,
        submittedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      // Update user profile KYC status using firebaseUid
      await storage.updateUserProfile(data.firebaseUid, { 
        kycStatus: 'pending_review',
        onboardingCompleted: true,
        onboardingStep: 5,
      });

      res.status(201).json(submission);
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

  // Upload KYC document
  app.post("/api/kyc/upload", upload.single('document'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const fileUrl = `/uploads/${req.file.filename}`;
      res.json({ url: fileUrl, filename: req.file.filename });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to upload document" });
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
      
      res.json(settings);
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

  return httpServer;
}
