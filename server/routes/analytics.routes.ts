import express from "express";
import { storage } from "../storage";
import { requireAuth } from "../middleware/auth";
import { resolveUserCompany } from "./shared";

const router = express.Router();

// ==================== ANALYTICS API ====================

const parseNum = (v: any) => parseFloat(String(v)) || 0;

router.get("/analytics/summary", requireAuth, async (req, res) => {
  try {
    const analyticsCompany = await resolveUserCompany(req);
    const analyticsCompanyId = analyticsCompany?.companyId;
    const expenses = await storage.getExpenses(analyticsCompanyId);
    const transactions = await storage.getTransactions(analyticsCompanyId);
    const budgets = await storage.getBudgets(analyticsCompanyId);

    const totalExpenses = expenses.reduce((sum, e) => sum + parseNum(e.amount), 0);
    const totalIncome = transactions
      .filter(t => t.type === 'Deposit' || t.type === 'Funding' || t.type === 'Refund')
      .reduce((sum, t) => sum + parseNum(t.amount), 0);
    const totalOutflow = transactions
      .filter(t => t.type === 'Payout' || t.type === 'Bill')
      .reduce((sum, t) => sum + parseNum(t.amount), 0);

    const categoryBreakdown: Record<string, number> = {};
    expenses.forEach(e => {
      categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + parseNum(e.amount);
    });

    const departmentBreakdown: Record<string, number> = {};
    expenses.forEach(e => {
      departmentBreakdown[e.department || 'Other'] = (departmentBreakdown[e.department || 'Other'] || 0) + parseNum(e.amount);
    });

    const budgetUtilization = budgets.map(b => ({
      name: b.name,
      budget: parseNum(b.limit),
      spent: parseNum(b.spent),
      percentage: Math.round((parseNum(b.spent) / parseNum(b.limit)) * 100) || 0,
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

router.get("/analytics/kpis", requireAuth, async (req, res) => {
  try {
    const kpiCompany = await resolveUserCompany(req);
    const kpiCompanyId = kpiCompany?.companyId;
    const [expenses, transactions, budgets, bills, invoicesList, payroll, walletsList, vendorsList] = await Promise.all([
      storage.getExpenses(kpiCompanyId),
      storage.getTransactions(kpiCompanyId),
      storage.getBudgets(kpiCompanyId),
      storage.getBills(kpiCompanyId),
      storage.getInvoices(),
      storage.getPayroll(kpiCompanyId),
      storage.getWallets(),
      storage.getVendors(),
    ]);

    const totalExpenses = expenses.reduce((sum, e) => sum + parseNum(e.amount), 0);
    const totalIncome = transactions
      .filter(t => t.type === 'Deposit' || t.type === 'Funding' || t.type === 'Refund')
      .reduce((sum, t) => sum + parseNum(t.amount), 0);
    const totalOutflow = transactions
      .filter(t => t.type === 'Payout' || t.type === 'Bill' || t.type === 'Fee')
      .reduce((sum, t) => sum + parseNum(t.amount), 0);
    const totalBudget = budgets.reduce((sum, b) => sum + parseNum(b.limit), 0);
    const totalBudgetSpent = budgets.reduce((sum, b) => sum + parseNum(b.spent), 0);
    const totalPayroll = payroll.reduce((sum, p) => sum + parseNum(p.netPay), 0);
    const totalBillsPaid = bills.filter(b => b.status === 'Paid').reduce((sum, b) => sum + parseNum(b.amount), 0);
    const totalBillsPending = bills.filter(b => b.status === 'Unpaid' || b.status === 'Overdue').reduce((sum, b) => sum + parseNum(b.amount), 0);
    const invoiceRevenue = invoicesList.filter(i => i.status === 'paid').reduce((sum, i) => sum + parseNum(i.amount), 0);
    const invoicePending = invoicesList.filter(i => i.status === 'pending' || i.status === 'sent').reduce((sum, i) => sum + parseNum(i.amount), 0);
    const totalWalletBalance = walletsList.reduce((sum, w) => sum + parseNum(w.balance), 0);
    const activeVendors = vendorsList.filter(v => v.status === 'active').length;
    const totalVendorPayments = vendorsList.reduce((sum, v) => sum + parseNum(v.totalPaid), 0);

    const profitMargin = totalIncome > 0 ? ((totalIncome - totalOutflow) / totalIncome) * 100 : 0;
    const burnRate = totalOutflow > 0 ? totalOutflow / 6 : 0;
    const runway = burnRate > 0 ? totalWalletBalance / burnRate : 0;
    const expenseGrowthRate = (() => {
      const now = new Date();
      const thisMonth = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).reduce((sum, e) => sum + parseNum(e.amount), 0);
      const lastMonth = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === now.getMonth() - 1 && d.getFullYear() === now.getFullYear();
      }).reduce((sum, e) => sum + parseNum(e.amount), 0);
      return lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;
    })();

    res.json({
      totalRevenue: totalIncome,
      totalExpenses,
      totalOutflow,
      netCashFlow: totalIncome - totalOutflow,
      profitMargin: Math.round(profitMargin * 100) / 100,
      burnRate: Math.round(burnRate * 100) / 100,
      runwayMonths: Math.round(runway * 10) / 10,
      totalBudget,
      totalBudgetSpent,
      budgetUtilization: totalBudget > 0 ? Math.round((totalBudgetSpent / totalBudget) * 100) : 0,
      totalPayroll,
      totalBillsPaid,
      totalBillsPending,
      invoiceRevenue,
      invoicePending,
      totalWalletBalance,
      activeVendors,
      totalVendorPayments,
      expenseGrowthRate: Math.round(expenseGrowthRate * 100) / 100,
      expenseCount: expenses.length,
      pendingExpenses: expenses.filter(e => e.status === 'PENDING').length,
      approvedExpenses: expenses.filter(e => e.status === 'APPROVED' || e.status === 'PAID').length,
      transactionCount: transactions.length,
      overdueBills: bills.filter(b => b.status === 'Overdue').length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch KPIs" });
  }
});

router.get("/analytics/cash-flow", requireAuth, async (req, res) => {
  try {
    const cashFlowCompany = await resolveUserCompany(req);
    const cashFlowCompanyId = cashFlowCompany?.companyId;
    const [transactions, expenses, bills, invoicesList, payroll] = await Promise.all([
      storage.getTransactions(cashFlowCompanyId),
      storage.getExpenses(cashFlowCompanyId),
      storage.getBills(cashFlowCompanyId),
      storage.getInvoices(),
      storage.getPayroll(cashFlowCompanyId),
    ]);

    const now = new Date();
    const monthlyData: { month: string; inflow: number; outflow: number; net: number; expenses: number; payroll: number; bills: number; invoiceIncome: number }[] = [];

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleString('default', { month: 'short', year: '2-digit' });
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const isInRange = (d: string) => {
        const dt = new Date(d);
        return dt >= monthStart && dt <= monthEnd;
      };

      const monthInflow = transactions
        .filter(t => isInRange(t.date) && (t.type === 'Deposit' || t.type === 'Funding' || t.type === 'Refund'))
        .reduce((sum, t) => sum + parseNum(t.amount), 0);
      const monthOutflow = transactions
        .filter(t => isInRange(t.date) && (t.type === 'Payout' || t.type === 'Bill' || t.type === 'Fee'))
        .reduce((sum, t) => sum + parseNum(t.amount), 0);
      const monthExpenses = expenses
        .filter(e => isInRange(e.date))
        .reduce((sum, e) => sum + parseNum(e.amount), 0);
      const monthPayroll = payroll
        .filter(p => isInRange(p.payDate))
        .reduce((sum, p) => sum + parseNum(p.netPay), 0);
      const monthBills = bills
        .filter(b => b.status === 'Paid' && isInRange(b.dueDate))
        .reduce((sum, b) => sum + parseNum(b.amount), 0);
      const monthInvoiceIncome = invoicesList
        .filter(inv => inv.status === 'paid' && isInRange(inv.issuedDate))
        .reduce((sum, inv) => sum + parseNum(inv.amount), 0);

      monthlyData.push({
        month: monthName,
        inflow: monthInflow,
        outflow: monthOutflow,
        net: monthInflow - monthOutflow,
        expenses: monthExpenses,
        payroll: monthPayroll,
        bills: monthBills,
        invoiceIncome: monthInvoiceIncome,
      });
    }

    const totalInflow = transactions
      .filter(t => t.type === 'Deposit' || t.type === 'Funding' || t.type === 'Refund')
      .reduce((sum, t) => sum + parseNum(t.amount), 0);
    const totalOutflow = transactions
      .filter(t => t.type === 'Payout' || t.type === 'Bill' || t.type === 'Fee')
      .reduce((sum, t) => sum + parseNum(t.amount), 0);

    const waterfall = [
      { name: 'Opening', value: 0, type: 'neutral' },
      { name: 'Revenue', value: totalInflow, type: 'positive' },
      { name: 'Expenses', value: -expenses.reduce((sum, e) => sum + parseNum(e.amount), 0), type: 'negative' },
      { name: 'Payroll', value: -payroll.reduce((sum, p) => sum + parseNum(p.netPay), 0), type: 'negative' },
      { name: 'Bills', value: -bills.filter(b => b.status === 'Paid').reduce((sum, b) => sum + parseNum(b.amount), 0), type: 'negative' },
      { name: 'Net', value: totalInflow - totalOutflow, type: totalInflow - totalOutflow >= 0 ? 'positive' : 'negative' },
    ];

    res.json({ monthlyData, waterfall, totalInflow, totalOutflow, netCashFlow: totalInflow - totalOutflow });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch cash flow" });
  }
});

router.get("/analytics/vendor-performance", requireAuth, async (req, res) => {
  try {
    const [vendorsList, expenses] = await Promise.all([
      storage.getVendors(),
      storage.getExpenses(),
    ]);

    const vendorExpenses: Record<string, { count: number; total: number; categories: Record<string, number> }> = {};
    expenses.forEach(e => {
      if (e.vendorId) {
        if (!vendorExpenses[e.vendorId]) {
          vendorExpenses[e.vendorId] = { count: 0, total: 0, categories: {} };
        }
        vendorExpenses[e.vendorId].count++;
        vendorExpenses[e.vendorId].total += parseNum(e.amount);
        vendorExpenses[e.vendorId].categories[e.category] = (vendorExpenses[e.vendorId].categories[e.category] || 0) + parseNum(e.amount);
      }
    });

    const vendorPerformance = vendorsList.map(v => {
      const expData = vendorExpenses[v.id] || { count: 0, total: 0, categories: {} };
      return {
        id: v.id,
        name: v.name,
        category: v.category,
        status: v.status,
        totalPaid: parseNum(v.totalPaid),
        pendingPayments: parseNum(v.pendingPayments),
        lastPayment: v.lastPayment,
        expenseCount: expData.count,
        expenseTotal: expData.total,
        avgExpense: expData.count > 0 ? Math.round((expData.total / expData.count) * 100) / 100 : 0,
        topCategories: Object.entries(expData.categories)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, value]) => ({ name, value })),
      };
    }).sort((a, b) => b.totalPaid - a.totalPaid);

    const categoryTotals: Record<string, number> = {};
    vendorsList.forEach(v => {
      categoryTotals[v.category] = (categoryTotals[v.category] || 0) + parseNum(v.totalPaid);
    });

    res.json({
      vendors: vendorPerformance,
      totalVendors: vendorsList.length,
      activeVendors: vendorsList.filter(v => v.status === 'active').length,
      totalPaid: vendorsList.reduce((sum, v) => sum + parseNum(v.totalPaid), 0),
      totalPending: vendorsList.reduce((sum, v) => sum + parseNum(v.pendingPayments), 0),
      categoryBreakdown: Object.entries(categoryTotals).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch vendor performance" });
  }
});

router.get("/analytics/payroll-summary", requireAuth, async (req, res) => {
  try {
    const [payroll, team] = await Promise.all([
      storage.getPayroll(),
      storage.getTeam(),
    ]);

    const departmentSummary: Record<string, { totalSalary: number; totalBonus: number; totalDeductions: number; totalNetPay: number; headcount: number; entries: number }> = {};
    payroll.forEach(p => {
      if (!departmentSummary[p.department]) {
        departmentSummary[p.department] = { totalSalary: 0, totalBonus: 0, totalDeductions: 0, totalNetPay: 0, headcount: 0, entries: 0 };
      }
      departmentSummary[p.department].totalSalary += parseNum(p.salary);
      departmentSummary[p.department].totalBonus += parseNum(p.bonus);
      departmentSummary[p.department].totalDeductions += parseNum(p.deductions);
      departmentSummary[p.department].totalNetPay += parseNum(p.netPay);
      departmentSummary[p.department].entries++;
    });

    const deptTeamCount: Record<string, number> = {};
    team.forEach(t => {
      deptTeamCount[t.department] = (deptTeamCount[t.department] || 0) + 1;
    });

    const departments = Object.entries(departmentSummary).map(([name, data]) => ({
      name,
      ...data,
      headcount: deptTeamCount[name] || 0,
      avgSalary: data.entries > 0 ? Math.round((data.totalSalary / data.entries) * 100) / 100 : 0,
    })).sort((a, b) => b.totalNetPay - a.totalNetPay);

    const now = new Date();
    const monthlyPayroll: { month: string; salary: number; bonus: number; deductions: number; netPay: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleString('default', { month: 'short' });
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthEntries = payroll.filter(p => {
        const d = new Date(p.payDate);
        return d >= monthStart && d <= monthEnd;
      });

      monthlyPayroll.push({
        month: monthName,
        salary: monthEntries.reduce((sum, p) => sum + parseNum(p.salary), 0),
        bonus: monthEntries.reduce((sum, p) => sum + parseNum(p.bonus), 0),
        deductions: monthEntries.reduce((sum, p) => sum + parseNum(p.deductions), 0),
        netPay: monthEntries.reduce((sum, p) => sum + parseNum(p.netPay), 0),
      });
    }

    const totalSalary = payroll.reduce((sum, p) => sum + parseNum(p.salary), 0);
    const totalBonus = payroll.reduce((sum, p) => sum + parseNum(p.bonus), 0);
    const totalDeductions = payroll.reduce((sum, p) => sum + parseNum(p.deductions), 0);
    const totalNetPay = payroll.reduce((sum, p) => sum + parseNum(p.netPay), 0);

    res.json({
      departments,
      monthlyPayroll,
      totals: { totalSalary, totalBonus, totalDeductions, totalNetPay },
      employeeCount: team.length,
      payrollEntries: payroll.length,
      avgSalary: payroll.length > 0 ? Math.round((totalSalary / payroll.length) * 100) / 100 : 0,
      statusBreakdown: {
        pending: payroll.filter(p => p.status === 'pending').length,
        processed: payroll.filter(p => p.status === 'processed').length,
        paid: payroll.filter(p => p.status === 'paid').length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch payroll summary" });
  }
});

router.get("/analytics/insights", requireAuth, async (req, res) => {
  try {
    const insightsCompany = await resolveUserCompany(req);
    const insightsCompanyId = insightsCompany?.companyId;
    const [expenses, transactions, budgets, bills, invoicesList, payroll, vendorsList, walletsList] = await Promise.all([
      storage.getExpenses(insightsCompanyId),
      storage.getTransactions(insightsCompanyId),
      storage.getBudgets(insightsCompanyId),
      storage.getBills(insightsCompanyId),
      storage.getInvoices(),
      storage.getPayroll(insightsCompanyId),
      storage.getVendors(),
      storage.getWallets(),
    ]);

    const insights: Array<{
      title: string;
      summary: string;
      category: string;
      severity: string;
      recommendation: string;
      metric?: string;
      metricValue?: number;
      metricChange?: number;
    }> = [];

    const totalExpenses = expenses.reduce((sum, e) => sum + parseNum(e.amount), 0);
    const totalIncome = transactions
      .filter(t => t.type === 'Deposit' || t.type === 'Funding' || t.type === 'Refund')
      .reduce((sum, t) => sum + parseNum(t.amount), 0);
    const totalOutflow = transactions
      .filter(t => t.type === 'Payout' || t.type === 'Bill' || t.type === 'Fee')
      .reduce((sum, t) => sum + parseNum(t.amount), 0);
    const netCashFlow = totalIncome - totalOutflow;
    const totalWalletBalance = walletsList.reduce((sum, w) => sum + parseNum(w.balance), 0);

    if (netCashFlow < 0) {
      insights.push({
        title: 'Negative Cash Flow',
        summary: `Your outflow exceeds income by $${Math.abs(netCashFlow).toFixed(2)}. This trajectory requires attention.`,
        category: 'cash-flow',
        severity: 'critical',
        recommendation: 'Review recurring expenses and identify areas to cut costs or increase revenue streams.',
        metric: 'Net Cash Flow',
        metricValue: netCashFlow,
      });
    } else if (netCashFlow > 0) {
      insights.push({
        title: 'Positive Cash Flow',
        summary: `Healthy cash position with $${netCashFlow.toFixed(2)} net positive flow.`,
        category: 'cash-flow',
        severity: 'success',
        recommendation: 'Consider allocating surplus to investments or emergency reserves.',
        metric: 'Net Cash Flow',
        metricValue: netCashFlow,
      });
    }

    const overBudget = budgets.filter(b => parseNum(b.spent) > parseNum(b.limit));
    if (overBudget.length > 0) {
      insights.push({
        title: `${overBudget.length} Budget${overBudget.length > 1 ? 's' : ''} Exceeded`,
        summary: `${overBudget.map(b => b.name).join(', ')} ${overBudget.length > 1 ? 'have' : 'has'} exceeded allocated limits.`,
        category: 'budget',
        severity: 'warning',
        recommendation: 'Reallocate funds or adjust budget limits to prevent overspending.',
        metric: 'Over-budget Count',
        metricValue: overBudget.length,
      });
    }

    const nearBudget = budgets.filter(b => {
      const pct = parseNum(b.spent) / parseNum(b.limit);
      return pct >= 0.8 && pct < 1;
    });
    if (nearBudget.length > 0) {
      insights.push({
        title: `${nearBudget.length} Budget${nearBudget.length > 1 ? 's' : ''} Near Limit`,
        summary: `${nearBudget.map(b => `${b.name} (${Math.round((parseNum(b.spent)/parseNum(b.limit))*100)}%)`).join(', ')} approaching budget cap.`,
        category: 'budget',
        severity: 'warning',
        recommendation: 'Monitor spending closely or request budget increases before month-end.',
        metric: 'Near-limit Count',
        metricValue: nearBudget.length,
      });
    }

    const overdueBills = bills.filter(b => b.status === 'Overdue');
    if (overdueBills.length > 0) {
      const overdueTotal = overdueBills.reduce((sum, b) => sum + parseNum(b.amount), 0);
      insights.push({
        title: `${overdueBills.length} Overdue Bill${overdueBills.length > 1 ? 's' : ''}`,
        summary: `$${overdueTotal.toFixed(2)} in overdue bills require immediate attention.`,
        category: 'risk',
        severity: 'critical',
        recommendation: 'Settle overdue bills to avoid late fees and maintain vendor relationships.',
        metric: 'Overdue Amount',
        metricValue: overdueTotal,
      });
    }

    const pendingInvoices = invoicesList.filter(i => i.status === 'pending' || i.status === 'sent');
    if (pendingInvoices.length > 0) {
      const pendingTotal = pendingInvoices.reduce((sum, i) => sum + parseNum(i.amount), 0);
      insights.push({
        title: `$${pendingTotal.toFixed(2)} in Outstanding Invoices`,
        summary: `${pendingInvoices.length} invoice${pendingInvoices.length > 1 ? 's' : ''} pending payment from clients.`,
        category: 'cash-flow',
        severity: pendingTotal > totalWalletBalance ? 'warning' : 'info',
        recommendation: 'Follow up with clients to accelerate collections and improve cash position.',
        metric: 'Outstanding Invoices',
        metricValue: pendingTotal,
      });
    }

    const totalPayroll = payroll.reduce((sum, p) => sum + parseNum(p.netPay), 0);
    if (totalPayroll > 0 && totalIncome > 0) {
      const payrollRatio = (totalPayroll / totalIncome) * 100;
      insights.push({
        title: 'Payroll Cost Ratio',
        summary: `Payroll represents ${payrollRatio.toFixed(1)}% of total revenue.`,
        category: 'payroll',
        severity: payrollRatio > 70 ? 'warning' : payrollRatio > 50 ? 'info' : 'success',
        recommendation: payrollRatio > 70
          ? 'Payroll costs are high relative to revenue. Consider efficiency improvements.'
          : 'Payroll ratio is within healthy range.',
        metric: 'Payroll-to-Revenue',
        metricValue: Math.round(payrollRatio * 100) / 100,
      });
    }

    const pendingExpenses = expenses.filter(e => e.status === 'PENDING');
    if (pendingExpenses.length > 5) {
      insights.push({
        title: 'Expense Approval Backlog',
        summary: `${pendingExpenses.length} expenses awaiting approval totaling $${pendingExpenses.reduce((sum, e) => sum + parseNum(e.amount), 0).toFixed(2)}.`,
        category: 'risk',
        severity: 'warning',
        recommendation: 'Review and process pending expense approvals to maintain employee satisfaction.',
        metric: 'Pending Count',
        metricValue: pendingExpenses.length,
      });
    }

    const burnRate = totalOutflow > 0 ? totalOutflow / 6 : 0;
    if (burnRate > 0 && totalWalletBalance > 0) {
      const runway = totalWalletBalance / burnRate;
      insights.push({
        title: `${runway.toFixed(1)} Month Runway`,
        summary: `At current burn rate of $${burnRate.toFixed(2)}/month, your funds last ${runway.toFixed(1)} months.`,
        category: 'growth',
        severity: runway < 3 ? 'critical' : runway < 6 ? 'warning' : 'success',
        recommendation: runway < 6
          ? 'Consider securing additional funding or reducing operational costs.'
          : 'Healthy runway. Continue monitoring spending trends.',
        metric: 'Runway (months)',
        metricValue: Math.round(runway * 10) / 10,
      });
    }

    const categoryBreakdown: Record<string, number> = {};
    expenses.forEach(e => {
      categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + parseNum(e.amount);
    });
    const topCategories = Object.entries(categoryBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    if (topCategories.length > 0 && totalExpenses > 0) {
      const topPct = (topCategories[0][1] / totalExpenses) * 100;
      if (topPct > 50) {
        insights.push({
          title: 'Spending Concentration Risk',
          summary: `${topCategories[0][0]} accounts for ${topPct.toFixed(0)}% of all spending.`,
          category: 'savings',
          severity: 'info',
          recommendation: 'Diversify spending across categories to reduce concentration risk.',
          metric: 'Top Category %',
          metricValue: Math.round(topPct),
        });
      }
    }

    const savingsRate = totalIncome > 0 ? ((totalIncome - totalOutflow) / totalIncome) * 100 : 0;
    insights.push({
      title: 'Savings Rate',
      summary: `You're saving ${savingsRate.toFixed(1)}% of income after all expenditures.`,
      category: 'savings',
      severity: savingsRate > 20 ? 'success' : savingsRate > 0 ? 'info' : 'warning',
      recommendation: savingsRate < 10
        ? 'Aim to increase savings rate to at least 10-20% for financial resilience.'
        : 'Good savings rate. Consider directing surplus to growth investments.',
      metric: 'Savings Rate %',
      metricValue: Math.round(savingsRate * 100) / 100,
    });

    insights.sort((a, b) => {
      const sevOrder: Record<string, number> = { critical: 0, warning: 1, info: 2, success: 3 };
      return (sevOrder[a.severity] || 4) - (sevOrder[b.severity] || 4);
    });

    res.json({ insights });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to generate insights" });
  }
});

router.get("/analytics/snapshots", requireAuth, async (req, res) => {
  try {
    const periodType = req.query.periodType as string | undefined;
    const snapshots = await storage.getAnalyticsSnapshots(periodType);
    res.json(snapshots);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch snapshots" });
  }
});

router.get("/analytics/stored-insights", requireAuth, async (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    const insights = await storage.getBusinessInsights(category);
    res.json(insights);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch insights" });
  }
});

export default router;
