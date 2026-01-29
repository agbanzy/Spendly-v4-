import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Balances
  app.get("/api/balances", async (req, res) => {
    try {
      const balances = await storage.getBalances();
      res.json(balances);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch balances" });
    }
  });

  // Expenses
  app.get("/api/expenses", async (req, res) => {
    try {
      const expenses = await storage.getExpenses();
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const { merchant, amount, category, note } = req.body;
      
      if (!merchant || !amount || !category) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const expense = await storage.createExpense({
        merchant,
        amount: parseFloat(amount),
        currency: 'USD',
        date: new Date().toISOString().split('T')[0],
        category,
        status: 'PENDING',
        user: 'John Doe',
        userId: '1',
        department: 'General',
        note,
      });
      
      res.status(201).json(expense);
    } catch (error) {
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  // Transactions
  app.get("/api/transactions", async (req, res) => {
    try {
      const transactions = await storage.getTransactions();
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  // Bills
  app.get("/api/bills", async (req, res) => {
    try {
      const bills = await storage.getBills();
      res.json(bills);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bills" });
    }
  });

  // Budgets
  app.get("/api/budgets", async (req, res) => {
    try {
      const budgets = await storage.getBudgets();
      res.json(budgets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch budgets" });
    }
  });

  // Cards
  app.get("/api/cards", async (req, res) => {
    try {
      const cards = await storage.getCards();
      res.json(cards);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cards" });
    }
  });

  // Team
  app.get("/api/team", async (req, res) => {
    try {
      const team = await storage.getTeam();
      res.json(team);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch team" });
    }
  });

  // AI Insights
  app.get("/api/insights", async (req, res) => {
    try {
      const insights = await storage.getInsights();
      res.json(insights);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch insights" });
    }
  });

  // Payroll
  app.get("/api/payroll", async (req, res) => {
    try {
      const payroll = await storage.getPayroll();
      res.json(payroll);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payroll" });
    }
  });

  // Invoices
  app.get("/api/invoices", async (req, res) => {
    try {
      const invoices = await storage.getInvoices();
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      const { client, clientEmail, amount, dueDate, items } = req.body;
      
      if (!client || !amount) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const invoiceNumber = `INV-2026-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
      
      const invoice = await storage.createInvoice({
        invoiceNumber,
        client,
        clientEmail: clientEmail || '',
        amount: parseFloat(amount),
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

  // Vendors
  app.get("/api/vendors", async (req, res) => {
    try {
      const vendors = await storage.getVendors();
      res.json(vendors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vendors" });
    }
  });

  app.post("/api/vendors", async (req, res) => {
    try {
      const { name, email, phone, address, category } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Vendor name is required" });
      }

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

  return httpServer;
}
