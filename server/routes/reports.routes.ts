import express from "express";
import { storage } from "../storage";
import { requireAuth } from "../middleware/auth";
import {
  param,
  resolveUserCompany,
  escapeCSV,
  filterByDateRange,
  getDateRangeFilter,
} from "./shared";

const router = express.Router();

// ==================== AI INSIGHTS ====================

router.get("/insights", requireAuth, async (req, res) => {
  try {
    const insights = await storage.getInsights();
    res.json(insights);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch insights" });
  }
});

// ==================== REPORTS ====================

router.get("/reports", requireAuth, async (req, res) => {
  try {
    const reports = await storage.getReports();
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

router.post("/reports", requireAuth, async (req, res) => {
  try {
    const { name, type, dateRange } = req.body;
    if (!name || !type || !dateRange) {
      return res.status(400).json({ error: "Name, type, and dateRange are required" });
    }

    const company = await resolveUserCompany(req);
    const companyId = company?.companyId;
    const now = new Date();

    // Create report entry in "processing" state
    const report = await storage.createReport({
      name,
      type,
      dateRange,
      createdAt: now.toISOString().split('T')[0],
      status: "processing",
      fileSize: "--",
      companyId: companyId || null,
    });

    // Actually generate the report data and calculate real file size
    try {
      const expenses = await storage.getExpenses(companyId);
      const transactions = await storage.getTransactions(companyId);
      const budgets = await storage.getBudgets(companyId);
      const bills = await storage.getBills(companyId);
      const payroll = await storage.getPayroll(companyId);

      let reportData: any = { generatedAt: now.toISOString(), report: name, type, dateRange };
      let recordCount = 0;

      const resolveDateRangeToken = (rangeToken: string): [string, string] => {
        const now = new Date();
        const fmt = (d: Date) => d.toISOString().split('T')[0];
        switch (rangeToken) {
          case 'last_7_days': { const s = new Date(now); s.setDate(now.getDate() - 7); return [fmt(s), fmt(now)]; }
          case 'last_30_days': { const s = new Date(now); s.setDate(now.getDate() - 30); return [fmt(s), fmt(now)]; }
          case 'last_90_days': { const s = new Date(now); s.setDate(now.getDate() - 90); return [fmt(s), fmt(now)]; }
          case 'this_month': { return [fmt(new Date(now.getFullYear(), now.getMonth(), 1)), fmt(now)]; }
          case 'last_month': { return [fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1)), fmt(new Date(now.getFullYear(), now.getMonth(), 0))]; }
          case 'this_year': { return [fmt(new Date(now.getFullYear(), 0, 1)), fmt(now)]; }
          default: {
            if (rangeToken.includes(' - ')) {
              const parts = rangeToken.split(' - ').map((d: string) => d.trim());
              return [parts[0], parts[1]];
            }
            return ['', ''];
          }
        }
      };
      const [startDate, endDate] = resolveDateRangeToken(dateRange);
      const filterByDate = (items: any[], dateField: string = 'date') => {
        if (!startDate || !endDate) return items;
        return items.filter((item: any) => {
          const itemDate = item[dateField] || item.createdAt || '';
          return itemDate >= startDate && itemDate <= endDate;
        });
      };

      if (type === "expense" || type === "Expense Summary") {
        const filtered = filterByDate(expenses);
        reportData.expenses = filtered;
        reportData.totalAmount = filtered.reduce((sum: number, e: any) => sum + parseFloat(String(e.amount || 0)), 0);
        reportData.count = filtered.length;
        reportData.byCategory = filtered.reduce((acc: any, e: any) => {
          const cat = e.category || 'Uncategorized';
          acc[cat] = (acc[cat] || 0) + parseFloat(String(e.amount || 0));
          return acc;
        }, {});
        reportData.byStatus = filtered.reduce((acc: any, e: any) => {
          const status = e.status || 'Unknown';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});
        recordCount = filtered.length;
      } else if (type === "budget" || type === "Budget Report") {
        reportData.budgets = budgets;
        reportData.totalBudget = budgets.reduce((sum: number, b: any) => sum + parseFloat(String(b.limit || 0)), 0);
        reportData.totalSpent = budgets.reduce((sum: number, b: any) => sum + parseFloat(String(b.spent || 0)), 0);
        reportData.utilization = reportData.totalBudget > 0 ?
          Math.round((reportData.totalSpent / reportData.totalBudget) * 100) : 0;
        recordCount = budgets.length;
      } else if (type === "transaction" || type === "Transaction Report") {
        const filtered = filterByDate(transactions);
        reportData.transactions = filtered;
        reportData.totalAmount = filtered.reduce((sum: number, t: any) => sum + parseFloat(String(t.amount || 0)), 0);
        reportData.byType = filtered.reduce((acc: any, t: any) => {
          const tp = t.type || 'Unknown';
          acc[tp] = (acc[tp] || 0) + parseFloat(String(t.amount || 0));
          return acc;
        }, {});
        recordCount = filtered.length;
      } else if (type === "payroll" || type === "Payroll Report") {
        const filtered = filterByDate(payroll, 'payDate');
        reportData.payroll = filtered;
        reportData.totalGross = filtered.reduce((sum: number, p: any) => sum + parseFloat(String(p.salary || p.grossSalary || 0)), 0);
        reportData.totalDeductions = filtered.reduce((sum: number, p: any) => sum + parseFloat(String(p.deductions || 0)), 0);
        reportData.totalNet = filtered.reduce((sum: number, p: any) => sum + parseFloat(String(p.netPay || 0)), 0);
        reportData.employeeCount = filtered.length;
        recordCount = filtered.length;
      } else {
        // Comprehensive report
        reportData.expenses = filterByDate(expenses);
        reportData.transactions = filterByDate(transactions);
        reportData.budgets = budgets;
        reportData.bills = filterByDate(bills, 'dueDate');
        reportData.payroll = filterByDate(payroll, 'payDate');
        recordCount = expenses.length + transactions.length + budgets.length;
      }

      // Calculate actual data size in bytes
      const jsonStr = JSON.stringify(reportData);
      const fileSizeBytes = Buffer.byteLength(jsonStr, 'utf8');
      const fileSizeFormatted = fileSizeBytes > 1048576
        ? `${(fileSizeBytes / 1048576).toFixed(1)} MB`
        : `${(fileSizeBytes / 1024).toFixed(1)} KB`;

      await storage.updateReportStatus(report.id, {
        status: "completed",
        fileSize: fileSizeFormatted,
      });

      // Return updated report
      const updatedReport = { ...report, status: 'completed', fileSize: fileSizeFormatted, recordCount };
      res.status(201).json(updatedReport);
    } catch (genErr: any) {
      console.error('Report generation error:', genErr);
      await storage.updateReportStatus(report.id, { status: "failed", fileSize: "0" });
      res.status(201).json({ ...report, status: 'failed' });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to create report" });
  }
});

router.delete("/reports/:id", requireAuth, async (req, res) => {
  try {
    await storage.deleteReport(param(req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete report" });
  }
});

router.get("/reports/:id/download", requireAuth, async (req, res) => {
  try {
    const reports = await storage.getReports();
    const report = reports.find(r => r.id === param(req.params.id));

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    if (report.status !== "completed") {
      return res.status(400).json({ error: "Report is not ready for download" });
    }

    const format = (req.query.format as string) || 'csv';
    const company = await resolveUserCompany(req);
    const companyId = company?.companyId;

    const expenses = await storage.getExpenses(companyId);
    const transactions = await storage.getTransactions(companyId);
    const budgets = await storage.getBudgets(companyId);
    const payroll = await storage.getPayroll(companyId);

    const resolveDateRange = (rangeToken: string): [string, string] => {
      const now = new Date();
      const fmt = (d: Date) => d.toISOString().split('T')[0];
      switch (rangeToken) {
        case 'last_7_days': {
          const start = new Date(now); start.setDate(now.getDate() - 7);
          return [fmt(start), fmt(now)];
        }
        case 'last_30_days': {
          const start = new Date(now); start.setDate(now.getDate() - 30);
          return [fmt(start), fmt(now)];
        }
        case 'last_90_days': {
          const start = new Date(now); start.setDate(now.getDate() - 90);
          return [fmt(start), fmt(now)];
        }
        case 'this_month': {
          const start = new Date(now.getFullYear(), now.getMonth(), 1);
          return [fmt(start), fmt(now)];
        }
        case 'last_month': {
          const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const end = new Date(now.getFullYear(), now.getMonth(), 0);
          return [fmt(start), fmt(end)];
        }
        case 'this_year': {
          const start = new Date(now.getFullYear(), 0, 1);
          return [fmt(start), fmt(now)];
        }
        default: {
          if (rangeToken.includes(' - ')) {
            const parts = rangeToken.split(' - ').map((d: string) => d.trim());
            return [parts[0], parts[1]];
          }
          return ['', ''];
        }
      }
    };

    const [startDate, endDate] = resolveDateRange(report.dateRange || '');
    const filterByDate = (items: any[], dateField: string = 'date') => {
      if (!startDate || !endDate) return items;
      return items.filter((item: any) => {
        const itemDate = item[dateField] || item.createdAt || '';
        return itemDate >= startDate && itemDate <= endDate;
      });
    };

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const toCsv = (headers: string[], rows: any[][]) => {
      const headerLine = headers.map(escapeCsv).join(',');
      const dataLines = rows.map(row => row.map(escapeCsv).join(','));
      return [headerLine, ...dataLines].join('\n');
    };

    let csvContent = '';
    const fileName = report.name.replace(/\s+/g, '_');

    if (report.type === "expense" || report.type === "Expense Summary") {
      const filtered = filterByDate(expenses);
      const headers = ['Date', 'Description', 'Category', 'Amount', 'Currency', 'Status', 'Vendor', 'Submitted By'];
      const rows = filtered.map((e: any) => [
        e.date || '', e.description || '', e.category || '', e.amount || 0,
        e.currency || 'USD', e.status || '', e.vendor || '', e.submittedBy || ''
      ]);
      const total = filtered.reduce((s: number, e: any) => s + parseFloat(String(e.amount || 0)), 0);
      rows.push(['', '', '', '', '', '', '', '']);
      rows.push(['TOTAL', '', '', total.toFixed(2), '', `${filtered.length} records`, '', '']);
      csvContent = toCsv(headers, rows);
    } else if (report.type === "budget" || report.type === "Budget Report") {
      const headers = ['Category', 'Budget Limit', 'Spent', 'Remaining', 'Utilization %', 'Period'];
      const rows = budgets.map((b: any) => {
        const limit = parseFloat(String(b.limit || 0));
        const spent = parseFloat(String(b.spent || 0));
        return [b.category || '', limit.toFixed(2), spent.toFixed(2), (limit - spent).toFixed(2),
          limit > 0 ? Math.round((spent / limit) * 100) : 0, b.period || ''];
      });
      const totalBudget = budgets.reduce((s: number, b: any) => s + parseFloat(String(b.limit || 0)), 0);
      const totalSpent = budgets.reduce((s: number, b: any) => s + parseFloat(String(b.spent || 0)), 0);
      rows.push(['', '', '', '', '', '']);
      rows.push(['TOTAL', totalBudget.toFixed(2), totalSpent.toFixed(2), (totalBudget - totalSpent).toFixed(2),
        totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0, '']);
      csvContent = toCsv(headers, rows);
    } else if (report.type === "transaction" || report.type === "Transaction Report") {
      const filtered = filterByDate(transactions);
      const headers = ['Date', 'Description', 'Type', 'Amount', 'Currency', 'Status', 'Reference'];
      const rows = filtered.map((t: any) => [
        t.date || '', t.description || '', t.type || '', t.amount || 0,
        t.currency || 'USD', t.status || '', t.reference || ''
      ]);
      const total = filtered.reduce((s: number, t: any) => s + parseFloat(String(t.amount || 0)), 0);
      rows.push(['', '', '', '', '', '', '']);
      rows.push(['TOTAL', '', '', total.toFixed(2), '', `${filtered.length} records`, '']);
      csvContent = toCsv(headers, rows);
    } else if (report.type === "payroll" || report.type === "Payroll Report") {
      const filtered = filterByDate(payroll, 'payDate');
      const headers = ['Employee', 'Pay Date', 'Gross Salary', 'Deductions', 'Net Pay', 'Status'];
      const rows = filtered.map((p: any) => [
        p.employeeName || '', p.payDate || '', p.salary || p.grossSalary || 0,
        p.deductions || 0, p.netPay || 0, p.status || ''
      ]);
      const totalGross = filtered.reduce((s: number, p: any) => s + parseFloat(String(p.salary || p.grossSalary || 0)), 0);
      const totalDeductions = filtered.reduce((s: number, p: any) => s + parseFloat(String(p.deductions || 0)), 0);
      const totalNet = filtered.reduce((s: number, p: any) => s + parseFloat(String(p.netPay || 0)), 0);
      rows.push(['', '', '', '', '', '']);
      rows.push(['TOTAL', '', totalGross.toFixed(2), totalDeductions.toFixed(2), totalNet.toFixed(2), `${filtered.length} employees`]);
      csvContent = toCsv(headers, rows);
    } else {
      const filteredExpenses = filterByDate(expenses);
      const filteredTx = filterByDate(transactions);
      csvContent = `COMPREHENSIVE FINANCIAL REPORT\nGenerated: ${new Date().toISOString()}\nPeriod: ${report.dateRange || 'All time'}\n\n`;
      csvContent += `EXPENSES\n`;
      csvContent += toCsv(
        ['Date', 'Description', 'Category', 'Amount', 'Status'],
        filteredExpenses.map((e: any) => [e.date || '', e.description || '', e.category || '', e.amount || 0, e.status || ''])
      );
      csvContent += `\n\nTRANSACTIONS\n`;
      csvContent += toCsv(
        ['Date', 'Description', 'Type', 'Amount', 'Status'],
        filteredTx.map((t: any) => [t.date || '', t.description || '', t.type || '', t.amount || 0, t.status || ''])
      );
      csvContent += `\n\nBUDGETS\n`;
      csvContent += toCsv(
        ['Category', 'Limit', 'Spent', 'Remaining'],
        budgets.map((b: any) => {
          const limit = parseFloat(String(b.limit || 0));
          const spent = parseFloat(String(b.spent || 0));
          return [b.category || '', limit.toFixed(2), spent.toFixed(2), (limit - spent).toFixed(2)];
        })
      );
    }

    if (format === 'json') {
      let reportData: any = { generatedAt: new Date().toISOString(), report: report.name };
      if (report.type === "expense" || report.type === "Expense Summary") {
        reportData.expenses = filterByDate(expenses);
      } else if (report.type === "transaction" || report.type === "Transaction Report") {
        reportData.transactions = filterByDate(transactions);
      } else {
        reportData.expenses = filterByDate(expenses);
        reportData.transactions = filterByDate(transactions);
        reportData.budgets = budgets;
      }
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.json"`);
      return res.json(reportData);
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.csv"`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ error: "Failed to download report" });
  }
});

export default router;
