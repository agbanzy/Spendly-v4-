import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Calendar,
  PieChart as PieChartIcon,
  BarChart2,
  Activity,
  Target,
  Wallet,
  Receipt,
  AlertTriangle,
  Users,
  Building2,
  Lightbulb,
  ShieldAlert,
  Info,
  CheckCircle2,
  FileText,
  Clock,
  Flame,
  Percent
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart
} from "recharts";
import type { CompanySettings } from "@shared/schema";

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px'
};

export default function AnalyticsPage() {
  const [timePeriod, setTimePeriod] = useState("30d");

  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/settings"],
  });

  const { data: kpis, isLoading: loadingKpis } = useQuery<any>({
    queryKey: ["/api/analytics/kpis"],
  });

  const { data: cashFlowData, isLoading: loadingCashFlow } = useQuery<any>({
    queryKey: ["/api/analytics/cash-flow"],
  });

  const { data: vendorData, isLoading: loadingVendors } = useQuery<any>({
    queryKey: ["/api/analytics/vendor-performance"],
  });

  const { data: payrollData, isLoading: loadingPayroll } = useQuery<any>({
    queryKey: ["/api/analytics/payroll-summary"],
  });

  const { data: insightsData, isLoading: loadingInsights } = useQuery<any>({
    queryKey: ["/api/analytics/insights"],
  });

  const { data: expenses } = useQuery<any[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: budgets } = useQuery<any[]>({
    queryKey: ["/api/budgets"],
  });

  const currencySymbols: Record<string, string> = {
    USD: "$", EUR: "\u20ac", GBP: "\u00a3", NGN: "\u20a6", KES: "KSh", GHS: "\u20b5", ZAR: "R"
  };
  const currency = settings?.currency || "USD";
  const currencySymbol = currencySymbols[currency] || "$";

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
    return `${currencySymbol}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatCompact = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
    if (num >= 1000000) return `${currencySymbol}${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${currencySymbol}${(num / 1000).toFixed(1)}K`;
    return formatCurrency(num);
  };

  const isLoading = loadingKpis || loadingCashFlow;

  const exportAnalytics = () => {
    const data = {
      kpis,
      cashFlow: cashFlowData,
      vendors: vendorData,
      payroll: payrollData,
      insights: insightsData,
      generatedAt: new Date().toISOString(),
      period: timePeriod,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const statsCards = [
    {
      title: "Total Revenue",
      value: formatCompact(kpis?.totalRevenue || 0),
      change: `${kpis?.profitMargin?.toFixed(1) || 0}% margin`,
      trend: (kpis?.profitMargin || 0) >= 0 ? "up" as const : "down" as const,
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/30"
    },
    {
      title: "Total Expenses",
      value: formatCompact(kpis?.totalExpenses || 0),
      change: `${kpis?.expenseCount || 0} items`,
      trend: (kpis?.expenseGrowthRate || 0) > 0 ? "up" as const : "down" as const,
      icon: Receipt,
      color: "text-red-600",
      bgColor: "bg-red-100 dark:bg-red-900/30"
    },
    {
      title: "Net Cash Flow",
      value: formatCompact(kpis?.netCashFlow || 0),
      change: (kpis?.netCashFlow || 0) >= 0 ? "Positive" : "Negative",
      trend: (kpis?.netCashFlow || 0) >= 0 ? "up" as const : "down" as const,
      icon: TrendingUp,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100 dark:bg-indigo-900/30"
    },
    {
      title: "Budget Utilization",
      value: `${(kpis?.budgetUtilization || 0).toFixed(0)}%`,
      change: (kpis?.budgetUtilization || 0) > 80 ? "Over limit" : "On track",
      trend: (kpis?.budgetUtilization || 0) > 80 ? "up" as const : "down" as const,
      icon: Target,
      color: "text-amber-600",
      bgColor: "bg-amber-100 dark:bg-amber-900/30"
    },
    {
      title: "Burn Rate",
      value: formatCompact(kpis?.burnRate || 0),
      change: `${(kpis?.runwayMonths || 0).toFixed(1)} mo runway`,
      trend: (kpis?.runwayMonths || 0) > 6 ? "down" as const : "up" as const,
      icon: Flame,
      color: "text-orange-600",
      bgColor: "bg-orange-100 dark:bg-orange-900/30"
    },
    {
      title: "Total Payroll",
      value: formatCompact(kpis?.totalPayroll || 0),
      change: `${kpis?.totalBillsPaid || 0} bills paid`,
      trend: "down" as const,
      icon: Users,
      color: "text-cyan-600",
      bgColor: "bg-cyan-100 dark:bg-cyan-900/30"
    },
    {
      title: "Wallet Balance",
      value: formatCompact(kpis?.totalWalletBalance || 0),
      change: `${kpis?.transactionCount || 0} txns`,
      trend: (kpis?.totalWalletBalance || 0) > 0 ? "up" as const : "down" as const,
      icon: Wallet,
      color: "text-violet-600",
      bgColor: "bg-violet-100 dark:bg-violet-900/30"
    },
    {
      title: "Active Vendors",
      value: (kpis?.activeVendors || 0).toString(),
      change: formatCompact(kpis?.totalVendorPayments || 0),
      trend: "up" as const,
      icon: Building2,
      color: "text-pink-600",
      bgColor: "bg-pink-100 dark:bg-pink-900/30"
    }
  ];

  const cashFlowDonut = [
    { name: 'Inflow', value: cashFlowData?.totalInflow || 0, fill: '#10b981' },
    { name: 'Outflow', value: cashFlowData?.totalOutflow || 0, fill: '#ef4444' },
  ];

  const categoryBreakdown = (() => {
    if (!expenses) return [];
    const breakdown: Record<string, number> = {};
    expenses.forEach((exp: any) => {
      breakdown[exp.category] = (breakdown[exp.category] || 0) + exp.amount;
    });
    return Object.entries(breakdown)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  })();

  const departmentBreakdown = (() => {
    if (!expenses) return [];
    const breakdown: Record<string, number> = {};
    expenses.forEach((exp: any) => {
      const dept = exp.department || "Other";
      breakdown[dept] = (breakdown[dept] || 0) + exp.amount;
    });
    return Object.entries(breakdown)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  })();

  const totalSpent = expenses?.reduce((sum: number, exp: any) => sum + exp.amount, 0) || 0;

  const weeklySpendingData = (() => {
    if (!expenses) return [];
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return days.map((day, i) => {
      const dayDate = new Date(startOfWeek);
      dayDate.setDate(startOfWeek.getDate() + i);
      const dayStr = dayDate.toISOString().split('T')[0];
      const dayExpenses = expenses
        .filter((e: any) => e.date === dayStr)
        .reduce((sum: number, e: any) => sum + e.amount, 0);
      return { day, amount: dayExpenses };
    });
  })();

  const budgetComparisonData = (() => {
    if (!budgets) return [];
    return budgets.map((b: any) => ({
      name: b.name.substring(0, 15),
      budget: b.limit,
      spent: b.spent,
    }));
  })();

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500" data-testid="analytics-loading">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Skeleton className="h-9 w-48" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-10 w-full max-w-xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[380px]" />
          <Skeleton className="h-[380px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500" data-testid="analytics-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight" data-testid="text-analytics-title">Analytics</h1>
          <p className="text-muted-foreground">Comprehensive financial insights and performance metrics</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-36" data-testid="select-time-period">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportAnalytics} data-testid="button-export">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat, index) => (
          <Card key={index} className="glass card-hover" data-testid={`card-stat-${index}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-2">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <Badge variant={stat.trend === "up" ? "default" : "secondary"} className="text-xs">
                  {stat.trend === "up" ? (
                    <ArrowUpRight className="mr-1 h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="mr-1 h-3 w-3" />
                  )}
                  {stat.change}
                </Badge>
              </div>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-2xl font-bold" data-testid={`stat-value-${index}`}>{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList data-testid="analytics-tabs">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Activity className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="cashflow" data-testid="tab-cashflow">
            <TrendingUp className="mr-2 h-4 w-4" />
            Cash Flow
          </TabsTrigger>
          <TabsTrigger value="spending" data-testid="tab-spending">
            <BarChart2 className="mr-2 h-4 w-4" />
            Spending
          </TabsTrigger>
          <TabsTrigger value="vendors" data-testid="tab-vendors">
            <Building2 className="mr-2 h-4 w-4" />
            Vendors
          </TabsTrigger>
          <TabsTrigger value="payroll" data-testid="tab-payroll">
            <Users className="mr-2 h-4 w-4" />
            Payroll
          </TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">
            <Lightbulb className="mr-2 h-4 w-4" />
            Insights
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-4" data-testid="content-overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Income vs Expenses</CardTitle>
                <CardDescription>Revenue and expense comparison over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={cashFlowData?.monthlyData || []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => formatCompact(v)} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    />
                    <Legend />
                    <Bar dataKey="invoiceIncome" fill="#10b981" name="Income" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" fill="#6366f1" name="Expenses" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="net" stroke="#f59e0b" strokeWidth={2} dot={false} name="Net" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cash Flow Distribution</CardTitle>
                <CardDescription>Total inflow vs outflow breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={cashFlowDonut}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {cashFlowDonut.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), '']}
                      contentStyle={tooltipStyle}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-6 mt-2">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Inflow</p>
                    <p className="font-semibold text-emerald-600" data-testid="text-total-inflow">{formatCompact(cashFlowData?.totalInflow || 0)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Outflow</p>
                    <p className="font-semibold text-red-600" data-testid="text-total-outflow">{formatCompact(cashFlowData?.totalOutflow || 0)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Net</p>
                    <p className="font-semibold" data-testid="text-net-cashflow">{formatCompact(cashFlowData?.netCashFlow || 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <FileText className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Invoice Revenue</p>
                    <p className="text-xl font-bold" data-testid="text-invoice-revenue">{formatCompact(kpis?.invoiceRevenue || 0)}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{formatCompact(kpis?.invoicePending || 0)} pending</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Bills</p>
                    <p className="text-xl font-bold" data-testid="text-pending-bills">{kpis?.totalBillsPending || 0}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{kpis?.overdueBills || 0} overdue</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                    <Percent className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Expense Growth</p>
                    <p className="text-xl font-bold" data-testid="text-expense-growth">{(kpis?.expenseGrowthRate || 0).toFixed(1)}%</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{kpis?.pendingExpenses || 0} pending, {kpis?.approvedExpenses || 0} approved</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* CASH FLOW TAB */}
        <TabsContent value="cashflow" className="space-y-4" data-testid="content-cashflow">
          {loadingCashFlow ? (
            <Skeleton className="h-[450px]" />
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>12-Month Cash Flow</CardTitle>
                  <CardDescription>Inflow, outflow, and net cash flow trends</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={cashFlowData?.monthlyData || []}>
                      <defs>
                        <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(v) => formatCompact(v)} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      />
                      <Legend />
                      <Area type="monotone" dataKey="inflow" stroke="#10b981" fill="url(#colorInflow)" strokeWidth={2} name="Inflow" />
                      <Area type="monotone" dataKey="outflow" stroke="#ef4444" fill="url(#colorOutflow)" strokeWidth={2} name="Outflow" />
                      <Area type="monotone" dataKey="net" stroke="#6366f1" fill="url(#colorNet)" strokeWidth={2} name="Net" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cash Flow Waterfall</CardTitle>
                  <CardDescription>Revenue through expenses to net cash flow</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={cashFlowData?.waterfall || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(v) => formatCompact(v)} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number) => [formatCurrency(Math.abs(value)), '']}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {(cashFlowData?.waterfall || []).map((entry: any, index: number) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.type === 'positive' ? '#10b981' : entry.type === 'negative' ? '#ef4444' : '#6366f1'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-4">
                {(cashFlowData?.monthlyData || []).length > 0 && (
                  <>
                    <Card>
                      <CardContent className="p-6 text-center">
                        <p className="text-sm text-muted-foreground">Avg Monthly Inflow</p>
                        <p className="text-xl font-bold text-emerald-600" data-testid="text-avg-inflow">
                          {formatCompact((cashFlowData?.monthlyData || []).reduce((s: number, d: any) => s + (d.inflow || 0), 0) / Math.max((cashFlowData?.monthlyData || []).length, 1))}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-6 text-center">
                        <p className="text-sm text-muted-foreground">Avg Monthly Outflow</p>
                        <p className="text-xl font-bold text-red-600" data-testid="text-avg-outflow">
                          {formatCompact((cashFlowData?.monthlyData || []).reduce((s: number, d: any) => s + (d.outflow || 0), 0) / Math.max((cashFlowData?.monthlyData || []).length, 1))}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-6 text-center">
                        <p className="text-sm text-muted-foreground">Total Payroll</p>
                        <p className="text-xl font-bold" data-testid="text-cf-payroll">
                          {formatCompact((cashFlowData?.monthlyData || []).reduce((s: number, d: any) => s + (d.payroll || 0), 0))}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-6 text-center">
                        <p className="text-sm text-muted-foreground">Total Bills</p>
                        <p className="text-xl font-bold" data-testid="text-cf-bills">
                          {formatCompact((cashFlowData?.monthlyData || []).reduce((s: number, d: any) => s + (d.bills || 0), 0))}
                        </p>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* SPENDING TAB */}
        <TabsContent value="spending" className="space-y-4" data-testid="content-spending">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Spending Pattern</CardTitle>
                <CardDescription>Daily spending distribution this week</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={weeklySpendingData}>
                    <defs>
                      <linearGradient id="colorSpending" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => formatCompact(v)} />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Amount']}
                      contentStyle={tooltipStyle}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#6366f1" fill="url(#colorSpending)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Budget vs Actual</CardTitle>
                <CardDescription>Budget utilization by category</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={budgetComparisonData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" tickFormatter={(v) => formatCompact(v)} />
                    <YAxis dataKey="name" type="category" width={100} className="text-xs" />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), '']}
                      contentStyle={tooltipStyle}
                    />
                    <Legend />
                    <Bar dataKey="budget" fill="#94a3b8" name="Budget" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="spent" fill="#6366f1" name="Spent" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Department Spending</CardTitle>
                <CardDescription>Spending breakdown by department</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={departmentBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => formatCompact(v)} />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Amount']}
                      contentStyle={tooltipStyle}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {departmentBreakdown.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Category Breakdown</CardTitle>
                <CardDescription>Distribution of expenses across categories</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={categoryBreakdown.slice(0, 8)}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                      >
                        {categoryBreakdown.slice(0, 8).map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), '']}
                        contentStyle={tooltipStyle}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3">
                    {categoryBreakdown.slice(0, 6).map((cat, index) => {
                      const percentage = totalSpent > 0 ? Math.round((cat.value / totalSpent) * 100) : 0;
                      return (
                        <div key={cat.name} className="space-y-1" data-testid={`category-item-${index}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="text-sm truncate">{cat.name}</span>
                            </div>
                            <span className="text-sm font-semibold whitespace-nowrap">{formatCompact(cat.value)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: COLORS[index % COLORS.length]
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* VENDORS TAB */}
        <TabsContent value="vendors" className="space-y-4" data-testid="content-vendors">
          {loadingVendors ? (
            <Skeleton className="h-[450px]" />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">Total Vendors</p>
                    <p className="text-2xl font-bold" data-testid="text-total-vendors">{vendorData?.totalVendors || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">{vendorData?.activeVendors || 0} active</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">Total Paid</p>
                    <p className="text-2xl font-bold text-emerald-600" data-testid="text-vendor-total-paid">{formatCompact(vendorData?.totalPaid || 0)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">Total Pending</p>
                    <p className="text-2xl font-bold text-amber-600" data-testid="text-vendor-total-pending">{formatCompact(vendorData?.totalPending || 0)}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Vendors by Payment</CardTitle>
                    <CardDescription>Vendors sorted by total payments made</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(vendorData?.vendors || []).slice(0, 10).map((vendor: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-3 py-2 border-b last:border-0" data-testid={`vendor-row-${index}`}>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{vendor.name}</p>
                            <p className="text-xs text-muted-foreground">{vendor.category} - {vendor.expenseCount} expenses</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-semibold text-sm">{formatCompact(vendor.totalPaid)}</p>
                            {vendor.pendingPayments > 0 && (
                              <p className="text-xs text-amber-600">{formatCompact(vendor.pendingPayments)} pending</p>
                            )}
                          </div>
                        </div>
                      ))}
                      {(vendorData?.vendors || []).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">No vendor data available</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Vendor Categories</CardTitle>
                    <CardDescription>Spending distribution by vendor category</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {vendorData?.categoryBreakdown && Object.keys(vendorData.categoryBreakdown).length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={Object.entries(vendorData.categoryBreakdown).map(([name, value]) => ({ name, value: value as number }))}
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              labelLine={true}
                            >
                              {Object.keys(vendorData.categoryBreakdown).map((_key, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: number) => [formatCurrency(value), '']}
                              contentStyle={tooltipStyle}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2 mt-4">
                          {Object.entries(vendorData.categoryBreakdown).map(([name, value], index) => (
                            <div key={name} className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                <span className="text-sm">{name}</span>
                              </div>
                              <span className="text-sm font-semibold">{formatCompact(value as number)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No category data available</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* PAYROLL TAB */}
        <TabsContent value="payroll" className="space-y-4" data-testid="content-payroll">
          {loadingPayroll ? (
            <Skeleton className="h-[450px]" />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">Total Employees</p>
                    <p className="text-2xl font-bold" data-testid="text-employee-count">{payrollData?.employeeCount || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">Total Net Pay</p>
                    <p className="text-2xl font-bold text-emerald-600" data-testid="text-total-netpay">{formatCompact(payrollData?.totals?.totalNetPay || 0)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">Avg Salary</p>
                    <p className="text-2xl font-bold" data-testid="text-avg-salary">{formatCompact(payrollData?.avgSalary || 0)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">Payroll Entries</p>
                    <p className="text-2xl font-bold" data-testid="text-payroll-entries">{payrollData?.payrollEntries || 0}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Department Payroll</CardTitle>
                    <CardDescription>Net pay breakdown by department</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={payrollData?.departments || []}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis className="text-xs" tickFormatter={(v) => formatCompact(v)} />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(value: number, name: string) => [formatCurrency(value), name]}
                        />
                        <Legend />
                        <Bar dataKey="totalSalary" fill="#6366f1" name="Salary" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="totalBonus" fill="#10b981" name="Bonus" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="totalDeductions" fill="#ef4444" name="Deductions" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Monthly Payroll Trend</CardTitle>
                    <CardDescription>Payroll components over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={payrollData?.monthlyPayroll || []}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis className="text-xs" tickFormatter={(v) => formatCompact(v)} />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(value: number, name: string) => [formatCurrency(value), name]}
                        />
                        <Legend />
                        <Bar dataKey="salary" stackId="a" fill="#6366f1" name="Salary" />
                        <Bar dataKey="bonus" stackId="a" fill="#10b981" name="Bonus" />
                        <Bar dataKey="deductions" stackId="a" fill="#f59e0b" name="Deductions" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Department Details</CardTitle>
                  <CardDescription>Headcount and salary breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(payrollData?.departments || []).map((dept: any, index: number) => (
                      <div key={index} className="flex items-center justify-between gap-4 py-3 border-b last:border-0" data-testid={`payroll-dept-${index}`}>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{dept.name}</p>
                          <p className="text-xs text-muted-foreground">{dept.headcount} employees - Avg: {formatCompact(dept.avgSalary)}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-right text-sm shrink-0">
                          <div>
                            <p className="text-muted-foreground text-xs">Salary</p>
                            <p className="font-semibold">{formatCompact(dept.totalSalary)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Bonus</p>
                            <p className="font-semibold text-emerald-600">{formatCompact(dept.totalBonus)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Net Pay</p>
                            <p className="font-semibold">{formatCompact(dept.totalNetPay)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(payrollData?.departments || []).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">No payroll data available</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* INSIGHTS TAB */}
        <TabsContent value="insights" className="space-y-4" data-testid="content-insights">
          {loadingInsights ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-semibold">Business Insights</h2>
                  <p className="text-sm text-muted-foreground">{(insightsData?.insights || []).length} insights generated from your financial data</p>
                </div>
              </div>

              <div className="space-y-4">
                {(insightsData?.insights || []).map((insight: any, index: number) => {
                  const severityConfig: Record<string, { color: string; bgColor: string; icon: any }> = {
                    critical: { color: "text-red-700 dark:text-red-400", bgColor: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400", icon: ShieldAlert },
                    warning: { color: "text-amber-700 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400", icon: AlertTriangle },
                    info: { color: "text-blue-700 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400", icon: Info },
                    success: { color: "text-emerald-700 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400", icon: CheckCircle2 },
                  };
                  const config = severityConfig[insight.severity] || severityConfig.info;
                  const SeverityIcon = config.icon;

                  return (
                    <Card key={index} data-testid={`insight-card-${index}`}>
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className={`p-2 rounded-lg shrink-0 ${config.bgColor.split(' ').slice(0, 2).join(' ')}`}>
                            <SeverityIcon className={`h-5 w-5 ${config.color}`} />
                          </div>
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <h3 className="font-semibold" data-testid={`insight-title-${index}`}>{insight.title}</h3>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-xs no-default-active-elevate">
                                  {insight.category}
                                </Badge>
                                <Badge className={`text-xs ${config.bgColor} no-default-active-elevate`} data-testid={`insight-severity-${index}`}>
                                  {insight.severity}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground" data-testid={`insight-summary-${index}`}>{insight.summary}</p>
                            {insight.recommendation && (
                              <div className="bg-muted/50 rounded-md p-3 mt-2">
                                <p className="text-sm"><span className="font-medium">Recommendation:</span> {insight.recommendation}</p>
                              </div>
                            )}
                            <div className="flex items-center gap-4 flex-wrap mt-2">
                              {insight.metric && (
                                <div className="text-sm">
                                  <span className="text-muted-foreground">{insight.metric}: </span>
                                  <span className="font-semibold" data-testid={`insight-metric-${index}`}>{insight.metricValue}</span>
                                </div>
                              )}
                              {insight.metricChange !== undefined && insight.metricChange !== null && (
                                <Badge variant={insight.metricChange >= 0 ? "default" : "secondary"} className="text-xs">
                                  {insight.metricChange >= 0 ? (
                                    <ArrowUpRight className="mr-1 h-3 w-3" />
                                  ) : (
                                    <ArrowDownRight className="mr-1 h-3 w-3" />
                                  )}
                                  {Math.abs(insight.metricChange).toFixed(1)}%
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {(insightsData?.insights || []).length === 0 && (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-lg font-medium">No Insights Yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Insights will appear as more financial data is recorded</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}