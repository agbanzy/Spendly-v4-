import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { PageWrapper, PageHeader, MetricCard, StatusBadge, EmptyState, SectionLabel, GlassCard, ProgressRing, fadeUp, stagger } from "@/components/ui-extended";
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

const COLORS = ['#7c3aed', '#10b981', '#f59e0b', '#f43f5e', '#64748b', '#06b6d4'];
const COLOR_MAP = {
  primary: '#7c3aed',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  slate: '#64748b',
  cyan: '#06b6d4'
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-xl p-3 max-w-xs">
        <p className="text-xs font-medium text-foreground">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
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
      <PageWrapper>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <Skeleton className="h-9 w-48" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-36" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-10 w-full max-w-xl" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-[380px] rounded-2xl" />
            <Skeleton className="h-[380px] rounded-2xl" />
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="space-y-8 animate-in fade-in duration-500" data-testid="analytics-page">
      <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-2">
        <PageHeader
          title="Analytics"
          subtitle="Comprehensive financial insights and performance metrics"
          data-testid="text-analytics-title"
        />
      </motion.div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-36 rounded-xl" data-testid="select-time-period">
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
          <Button
            variant="outline"
            onClick={exportAnalytics}
            className="rounded-xl"
            data-testid="button-export"
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        {statsCards.map((stat, index) => (
          <motion.div key={index} variants={fadeUp}>
            <MetricCard
              title={stat.title}
              value={stat.value}
              icon={stat.icon}
              trend={stat.trend}
              change={stat.change}
              className="h-full"
              data-testid={`card-stat-${index}`}
            />
          </motion.div>
        ))}
      </motion.div>

      <Tabs defaultValue="overview" className="space-y-6">
        <motion.div initial="hidden" animate="visible" variants={fadeUp}>
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 h-auto bg-transparent gap-2 p-0" data-testid="analytics-tabs">
            <TabsTrigger
              value="overview"
              className="rounded-xl py-2 px-4 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=inactive]:bg-muted"
              data-testid="tab-overview"
            >
              <Activity className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger
              value="cashflow"
              className="rounded-xl py-2 px-4 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=inactive]:bg-muted"
              data-testid="tab-cashflow"
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Cash Flow</span>
            </TabsTrigger>
            <TabsTrigger
              value="spending"
              className="rounded-xl py-2 px-4 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=inactive]:bg-muted"
              data-testid="tab-spending"
            >
              <BarChart2 className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Spending</span>
            </TabsTrigger>
            <TabsTrigger
              value="vendors"
              className="rounded-xl py-2 px-4 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=inactive]:bg-muted"
              data-testid="tab-vendors"
            >
              <Building2 className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Vendors</span>
            </TabsTrigger>
            <TabsTrigger
              value="payroll"
              className="rounded-xl py-2 px-4 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=inactive]:bg-muted"
              data-testid="tab-payroll"
            >
              <Users className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Payroll</span>
            </TabsTrigger>
            <TabsTrigger
              value="insights"
              className="rounded-xl py-2 px-4 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=inactive]:bg-muted"
              data-testid="tab-insights"
            >
              <Lightbulb className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Insights</span>
            </TabsTrigger>
          </TabsList>
        </motion.div>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6" data-testid="content-overview">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="grid gap-4 md:grid-cols-2">
            <motion.div variants={fadeUp}>
              <GlassCard className="rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-border">
                  <SectionLabel>Monthly Income vs Expenses</SectionLabel>
                  <p className="text-sm text-muted-foreground mt-1">Revenue and expense comparison over time</p>
                </div>
                <div className="p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={cashFlowData?.monthlyData || []}>
                      <defs>
                        <linearGradient id="overviewIncome" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLOR_MAP.emerald} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={COLOR_MAP.emerald} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" className="text-xs" fill="hsl(var(--muted-foreground))" />
                      <YAxis className="text-xs" tickFormatter={(v) => formatCompact(v)} fill="hsl(var(--muted-foreground))" />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Bar dataKey="invoiceIncome" fill={COLOR_MAP.emerald} name="Income" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" fill={COLOR_MAP.primary} name="Expenses" radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="net" stroke={COLOR_MAP.amber} strokeWidth={2} dot={false} name="Net" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            </motion.div>

            <motion.div variants={fadeUp}>
              <GlassCard className="rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-border">
                  <SectionLabel>Cash Flow Distribution</SectionLabel>
                  <p className="text-sm text-muted-foreground mt-1">Total inflow vs outflow breakdown</p>
                </div>
                <div className="p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={cashFlowDonut}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {cashFlowDonut.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-6 mt-4">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Inflow</p>
                      <p className="font-semibold text-emerald-600" data-testid="text-total-inflow">
                        {formatCompact(cashFlowData?.totalInflow || 0)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Outflow</p>
                      <p className="font-semibold text-rose-600" data-testid="text-total-outflow">
                        {formatCompact(cashFlowData?.totalOutflow || 0)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Net</p>
                      <p className="font-semibold" data-testid="text-net-cashflow">
                        {formatCompact(cashFlowData?.netCashFlow || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>

          <motion.div initial="hidden" animate="visible" variants={stagger} className="grid gap-4 md:grid-cols-3">
            <motion.div variants={fadeUp}>
              <GlassCard className="rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <FileText className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Invoice Revenue</p>
                    <p className="text-xl font-bold" data-testid="text-invoice-revenue">
                      {formatCompact(kpis?.invoiceRevenue || 0)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{formatCompact(kpis?.invoicePending || 0)} pending</p>
              </GlassCard>
            </motion.div>
            <motion.div variants={fadeUp}>
              <GlassCard className="rounded-2xl p-6">
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
              </GlassCard>
            </motion.div>
            <motion.div variants={fadeUp}>
              <GlassCard className="rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Percent className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Expense Growth</p>
                    <p className="text-xl font-bold" data-testid="text-expense-growth">
                      {(kpis?.expenseGrowthRate || 0).toFixed(1)}%
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {kpis?.pendingExpenses || 0} pending, {kpis?.approvedExpenses || 0} approved
                </p>
              </GlassCard>
            </motion.div>
          </motion.div>
        </TabsContent>

        {/* CASH FLOW TAB */}
        <TabsContent value="cashflow" className="space-y-6" data-testid="content-cashflow">
          {loadingCashFlow ? (
            <Skeleton className="h-[450px] rounded-2xl" />
          ) : (
            <>
              <motion.div initial="hidden" animate="visible" variants={fadeUp}>
                <GlassCard className="rounded-2xl overflow-hidden">
                  <div className="p-6 border-b border-border">
                    <SectionLabel>12-Month Cash Flow</SectionLabel>
                    <p className="text-sm text-muted-foreground mt-1">Inflow, outflow, and net cash flow trends</p>
                  </div>
                  <div className="p-6">
                    <ResponsiveContainer width="100%" height={400}>
                      <AreaChart data={cashFlowData?.monthlyData || []}>
                        <defs>
                          <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLOR_MAP.emerald} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={COLOR_MAP.emerald} stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLOR_MAP.rose} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={COLOR_MAP.rose} stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLOR_MAP.primary} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={COLOR_MAP.primary} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" className="text-xs" fill="hsl(var(--muted-foreground))" />
                        <YAxis className="text-xs" tickFormatter={(v) => formatCompact(v)} fill="hsl(var(--muted-foreground))" />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Area type="monotone" dataKey="inflow" stroke={COLOR_MAP.emerald} fill="url(#colorInflow)" strokeWidth={2} name="Inflow" />
                        <Area type="monotone" dataKey="outflow" stroke={COLOR_MAP.rose} fill="url(#colorOutflow)" strokeWidth={2} name="Outflow" />
                        <Area type="monotone" dataKey="net" stroke={COLOR_MAP.primary} fill="url(#colorNet)" strokeWidth={2} name="Net" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>
              </motion.div>

              <motion.div initial="hidden" animate="visible" variants={fadeUp}>
                <GlassCard className="rounded-2xl overflow-hidden">
                  <div className="p-6 border-b border-border">
                    <SectionLabel>Cash Flow Waterfall</SectionLabel>
                    <p className="text-sm text-muted-foreground mt-1">Revenue through expenses to net cash flow</p>
                  </div>
                  <div className="p-6">
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={cashFlowData?.waterfall || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" className="text-xs" fill="hsl(var(--muted-foreground))" />
                        <YAxis className="text-xs" tickFormatter={(v) => formatCompact(v)} fill="hsl(var(--muted-foreground))" />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {(cashFlowData?.waterfall || []).map((entry: any, index: number) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.type === 'positive' ? COLOR_MAP.emerald : entry.type === 'negative' ? COLOR_MAP.rose : COLOR_MAP.primary}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>
              </motion.div>

              <motion.div initial="hidden" animate="visible" variants={stagger} className="grid gap-4 md:grid-cols-4">
                {(cashFlowData?.monthlyData || []).length > 0 && (
                  <>
                    <motion.div variants={fadeUp}>
                      <GlassCard className="rounded-2xl p-6 text-center">
                        <p className="text-sm text-muted-foreground">Avg Monthly Inflow</p>
                        <p className="text-xl font-bold text-emerald-600 mt-2" data-testid="text-avg-inflow">
                          {formatCompact((cashFlowData?.monthlyData || []).reduce((s: number, d: any) => s + (d.inflow || 0), 0) / Math.max((cashFlowData?.monthlyData || []).length, 1))}
                        </p>
                      </GlassCard>
                    </motion.div>
                    <motion.div variants={fadeUp}>
                      <GlassCard className="rounded-2xl p-6 text-center">
                        <p className="text-sm text-muted-foreground">Avg Monthly Outflow</p>
                        <p className="text-xl font-bold text-rose-600 mt-2" data-testid="text-avg-outflow">
                          {formatCompact((cashFlowData?.monthlyData || []).reduce((s: number, d: any) => s + (d.outflow || 0), 0) / Math.max((cashFlowData?.monthlyData || []).length, 1))}
                        </p>
                      </GlassCard>
                    </motion.div>
                    <motion.div variants={fadeUp}>
                      <GlassCard className="rounded-2xl p-6 text-center">
                        <p className="text-sm text-muted-foreground">Total Payroll</p>
                        <p className="text-xl font-bold mt-2" data-testid="text-cf-payroll">
                          {formatCompact((cashFlowData?.monthlyData || []).reduce((s: number, d: any) => s + (d.payroll || 0), 0))}
                        </p>
                      </GlassCard>
                    </motion.div>
                    <motion.div variants={fadeUp}>
                      <GlassCard className="rounded-2xl p-6 text-center">
                        <p className="text-sm text-muted-foreground">Total Bills</p>
                        <p className="text-xl font-bold mt-2" data-testid="text-cf-bills">
                          {formatCompact((cashFlowData?.monthlyData || []).reduce((s: number, d: any) => s + (d.bills || 0), 0))}
                        </p>
                      </GlassCard>
                    </motion.div>
                  </>
                )}
              </motion.div>
            </>
          )}
        </TabsContent>

        {/* SPENDING TAB */}
        <TabsContent value="spending" className="space-y-6" data-testid="content-spending">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="grid gap-4 md:grid-cols-2">
            <motion.div variants={fadeUp}>
              <GlassCard className="rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-border">
                  <SectionLabel>Weekly Spending Pattern</SectionLabel>
                  <p className="text-sm text-muted-foreground mt-1">Daily spending distribution this week</p>
                </div>
                <div className="p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={weeklySpendingData}>
                      <defs>
                        <linearGradient id="colorSpending" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLOR_MAP.primary} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={COLOR_MAP.primary} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" className="text-xs" fill="hsl(var(--muted-foreground))" />
                      <YAxis className="text-xs" tickFormatter={(v) => formatCompact(v)} fill="hsl(var(--muted-foreground))" />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="amount" stroke={COLOR_MAP.primary} fill="url(#colorSpending)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            </motion.div>

            <motion.div variants={fadeUp}>
              <GlassCard className="rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-border">
                  <SectionLabel>Budget vs Actual</SectionLabel>
                  <p className="text-sm text-muted-foreground mt-1">Budget utilization by category</p>
                </div>
                <div className="p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={budgetComparisonData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" className="text-xs" tickFormatter={(v) => formatCompact(v)} fill="hsl(var(--muted-foreground))" />
                      <YAxis dataKey="name" type="category" width={100} className="text-xs" fill="hsl(var(--muted-foreground))" />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Bar dataKey="budget" fill={COLOR_MAP.slate} name="Budget" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="spent" fill={COLOR_MAP.primary} name="Spent" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>

          <motion.div initial="hidden" animate="visible" variants={stagger} className="grid gap-4 md:grid-cols-2">
            <motion.div variants={fadeUp}>
              <GlassCard className="rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-border">
                  <SectionLabel>Department Spending</SectionLabel>
                  <p className="text-sm text-muted-foreground mt-1">Spending breakdown by department</p>
                </div>
                <div className="p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={departmentBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" className="text-xs" fill="hsl(var(--muted-foreground))" />
                      <YAxis className="text-xs" tickFormatter={(v) => formatCompact(v)} fill="hsl(var(--muted-foreground))" />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {departmentBreakdown.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            </motion.div>

            <motion.div variants={fadeUp}>
              <GlassCard className="rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-border">
                  <SectionLabel>Category Breakdown</SectionLabel>
                  <p className="text-sm text-muted-foreground mt-1">Distribution of expenses across categories</p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={categoryBreakdown.slice(0, 8)}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          dataKey="value"
                        >
                          {categoryBreakdown.slice(0, 8).map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
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
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        </TabsContent>

        {/* VENDORS TAB */}
        <TabsContent value="vendors" className="space-y-6" data-testid="content-vendors">
          {loadingVendors ? (
            <Skeleton className="h-[450px] rounded-2xl" />
          ) : (
            <>
              <motion.div initial="hidden" animate="visible" variants={stagger} className="grid gap-4 md:grid-cols-3">
                <motion.div variants={fadeUp}>
                  <GlassCard className="rounded-2xl p-6 text-center">
                    <p className="text-sm text-muted-foreground">Total Vendors</p>
                    <p className="text-2xl font-bold mt-2" data-testid="text-total-vendors">
                      {vendorData?.totalVendors || 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{vendorData?.activeVendors || 0} active</p>
                  </GlassCard>
                </motion.div>
                <motion.div variants={fadeUp}>
                  <GlassCard className="rounded-2xl p-6 text-center">
                    <p className="text-sm text-muted-foreground">Total Paid</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-2" data-testid="text-vendor-total-paid">
                      {formatCompact(vendorData?.totalPaid || 0)}
                    </p>
                  </GlassCard>
                </motion.div>
                <motion.div variants={fadeUp}>
                  <GlassCard className="rounded-2xl p-6 text-center">
                    <p className="text-sm text-muted-foreground">Total Pending</p>
                    <p className="text-2xl font-bold text-amber-600 mt-2" data-testid="text-vendor-total-pending">
                      {formatCompact(vendorData?.totalPending || 0)}
                    </p>
                  </GlassCard>
                </motion.div>
              </motion.div>

              <motion.div initial="hidden" animate="visible" variants={stagger} className="grid gap-4 md:grid-cols-2">
                <motion.div variants={fadeUp}>
                  <GlassCard className="rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-border">
                      <SectionLabel>Top Vendors by Payment</SectionLabel>
                      <p className="text-sm text-muted-foreground mt-1">Vendors sorted by total payments made</p>
                    </div>
                    <div className="p-6">
                      <div className="space-y-3">
                        {(vendorData?.vendors || []).slice(0, 10).map((vendor: any, index: number) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center justify-between gap-3 py-2 border-b last:border-0"
                            data-testid={`vendor-row-${index}`}
                          >
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
                          </motion.div>
                        ))}
                        {(vendorData?.vendors || []).length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-8">No vendor data available</p>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>

                <motion.div variants={fadeUp}>
                  <GlassCard className="rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-border">
                      <SectionLabel>Vendor Categories</SectionLabel>
                      <p className="text-sm text-muted-foreground mt-1">Spending distribution by vendor category</p>
                    </div>
                    <div className="p-6">
                      {vendorData?.categoryBreakdown && Object.keys(vendorData.categoryBreakdown).length > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={Object.entries(vendorData.categoryBreakdown).map(([name, value]) => ({ name, value: value as number }))}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={90}
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                labelLine={true}
                              >
                                {Object.keys(vendorData.categoryBreakdown).map((_key, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip content={<CustomTooltip />} />
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
                    </div>
                  </GlassCard>
                </motion.div>
              </motion.div>
            </>
          )}
        </TabsContent>

        {/* PAYROLL TAB */}
        <TabsContent value="payroll" className="space-y-6" data-testid="content-payroll">
          {loadingPayroll ? (
            <Skeleton className="h-[450px] rounded-2xl" />
          ) : (
            <>
              <motion.div initial="hidden" animate="visible" variants={stagger} className="grid gap-4 md:grid-cols-4">
                <motion.div variants={fadeUp}>
                  <GlassCard className="rounded-2xl p-6 text-center">
                    <p className="text-sm text-muted-foreground">Total Employees</p>
                    <p className="text-2xl font-bold mt-2" data-testid="text-employee-count">
                      {payrollData?.employeeCount || 0}
                    </p>
                  </GlassCard>
                </motion.div>
                <motion.div variants={fadeUp}>
                  <GlassCard className="rounded-2xl p-6 text-center">
                    <p className="text-sm text-muted-foreground">Total Net Pay</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-2" data-testid="text-total-netpay">
                      {formatCompact(payrollData?.totals?.totalNetPay || 0)}
                    </p>
                  </GlassCard>
                </motion.div>
                <motion.div variants={fadeUp}>
                  <GlassCard className="rounded-2xl p-6 text-center">
                    <p className="text-sm text-muted-foreground">Avg Salary</p>
                    <p className="text-2xl font-bold mt-2" data-testid="text-avg-salary">
                      {formatCompact(payrollData?.avgSalary || 0)}
                    </p>
                  </GlassCard>
                </motion.div>
                <motion.div variants={fadeUp}>
                  <GlassCard className="rounded-2xl p-6 text-center">
                    <p className="text-sm text-muted-foreground">Payroll Entries</p>
                    <p className="text-2xl font-bold mt-2" data-testid="text-payroll-entries">
                      {payrollData?.payrollEntries || 0}
                    </p>
                  </GlassCard>
                </motion.div>
              </motion.div>

              <motion.div initial="hidden" animate="visible" variants={stagger} className="grid gap-4 md:grid-cols-2">
                <motion.div variants={fadeUp}>
                  <GlassCard className="rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-border">
                      <SectionLabel>Department Payroll</SectionLabel>
                      <p className="text-sm text-muted-foreground mt-1">Net pay breakdown by department</p>
                    </div>
                    <div className="p-6">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={payrollData?.departments || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" className="text-xs" fill="hsl(var(--muted-foreground))" />
                          <YAxis className="text-xs" tickFormatter={(v) => formatCompact(v)} fill="hsl(var(--muted-foreground))" />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ paddingTop: '20px' }} />
                          <Bar dataKey="totalSalary" fill={COLOR_MAP.primary} name="Salary" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="totalBonus" fill={COLOR_MAP.emerald} name="Bonus" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="totalDeductions" fill={COLOR_MAP.rose} name="Deductions" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </GlassCard>
                </motion.div>

                <motion.div variants={fadeUp}>
                  <GlassCard className="rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-border">
                      <SectionLabel>Monthly Payroll Trend</SectionLabel>
                      <p className="text-sm text-muted-foreground mt-1">Payroll components over time</p>
                    </div>
                    <div className="p-6">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={payrollData?.monthlyPayroll || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="month" className="text-xs" fill="hsl(var(--muted-foreground))" />
                          <YAxis className="text-xs" tickFormatter={(v) => formatCompact(v)} fill="hsl(var(--muted-foreground))" />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ paddingTop: '20px' }} />
                          <Bar dataKey="salary" stackId="a" fill={COLOR_MAP.primary} name="Salary" />
                          <Bar dataKey="bonus" stackId="a" fill={COLOR_MAP.emerald} name="Bonus" />
                          <Bar dataKey="deductions" stackId="a" fill={COLOR_MAP.amber} name="Deductions" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </GlassCard>
                </motion.div>
              </motion.div>

              <motion.div initial="hidden" animate="visible" variants={fadeUp}>
                <GlassCard className="rounded-2xl overflow-hidden">
                  <div className="p-6 border-b border-border">
                    <SectionLabel>Department Details</SectionLabel>
                    <p className="text-sm text-muted-foreground mt-1">Headcount and salary breakdown</p>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      {(payrollData?.departments || []).map((dept: any, index: number) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-center justify-between gap-4 py-3 border-b last:border-0"
                          data-testid={`payroll-dept-${index}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{dept.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {dept.headcount} employees - Avg: {formatCompact(dept.avgSalary)}
                            </p>
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
                        </motion.div>
                      ))}
                      {(payrollData?.departments || []).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">No payroll data available</p>
                      )}
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            </>
          )}
        </TabsContent>

        {/* INSIGHTS TAB */}
        <TabsContent value="insights" className="space-y-6" data-testid="content-insights">
          {loadingInsights ? (
            <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-32 rounded-2xl" />
              ))}
            </motion.div>
          ) : (
            <>
              <motion.div initial="hidden" animate="visible" variants={fadeUp}>
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold">Business Insights</h2>
                  <p className="text-sm text-muted-foreground">
                    {(insightsData?.insights || []).length} insights generated from your financial data
                  </p>
                </div>
              </motion.div>

              <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-4">
                {(insightsData?.insights || []).map((insight: any, index: number) => {
                  const severityConfig: Record<string, { color: string; bgColor: string; borderColor: string; icon: any }> = {
                    critical: {
                      color: "text-rose-700 dark:text-rose-400",
                      bgColor: "bg-rose-100 dark:bg-rose-900/30",
                      borderColor: "border-l-4 border-l-rose-600",
                      icon: ShieldAlert
                    },
                    warning: {
                      color: "text-amber-700 dark:text-amber-400",
                      bgColor: "bg-amber-100 dark:bg-amber-900/30",
                      borderColor: "border-l-4 border-l-amber-600",
                      icon: AlertTriangle
                    },
                    info: {
                      color: "text-cyan-700 dark:text-cyan-400",
                      bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
                      borderColor: "border-l-4 border-l-cyan-600",
                      icon: Info
                    },
                    success: {
                      color: "text-emerald-700 dark:text-emerald-400",
                      bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
                      borderColor: "border-l-4 border-l-emerald-600",
                      icon: CheckCircle2
                    },
                  };
                  const config = severityConfig[insight.severity] || severityConfig.info;
                  const SeverityIcon = config.icon;

                  return (
                    <motion.div key={index} variants={fadeUp} data-testid={`insight-card-${index}`}>
                      <GlassCard className={`rounded-2xl overflow-hidden ${config.borderColor}`}>
                        <div className="p-6">
                          <div className="flex items-start gap-4">
                            <div className={`p-2 rounded-lg shrink-0 ${config.bgColor}`}>
                              <SeverityIcon className={`h-5 w-5 ${config.color}`} />
                            </div>
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-center justify-between gap-3 flex-wrap">
                                <h3 className="font-semibold" data-testid={`insight-title-${index}`}>
                                  {insight.title}
                                </h3>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="text-xs rounded-full">
                                    {insight.category}
                                  </Badge>
                                  <Badge
                                    className={`text-xs rounded-full ${config.color} ${config.bgColor}`}
                                    data-testid={`insight-severity-${index}`}
                                  >
                                    {insight.severity}
                                  </Badge>
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground" data-testid={`insight-summary-${index}`}>
                                {insight.summary}
                              </p>
                              {insight.recommendation && (
                                <div className="bg-primary/5 rounded-lg p-3 mt-2 border border-primary/10">
                                  <p className="text-sm">
                                    <span className="font-medium">Recommendation:</span> {insight.recommendation}
                                  </p>
                                </div>
                              )}
                              <div className="flex items-center gap-4 flex-wrap mt-2">
                                {insight.metric && (
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">{insight.metric}: </span>
                                    <span className="font-semibold" data-testid={`insight-metric-${index}`}>
                                      {insight.metricValue}
                                    </span>
                                  </div>
                                )}
                                {insight.metricChange !== undefined && insight.metricChange !== null && (
                                  <Badge
                                    variant={insight.metricChange >= 0 ? "default" : "secondary"}
                                    className="text-xs rounded-full"
                                  >
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
                        </div>
                      </GlassCard>
                    </motion.div>
                  );
                })}
                {(insightsData?.insights || []).length === 0 && (
                  <motion.div variants={fadeUp}>
                    <GlassCard className="rounded-2xl p-12">
                      <div className="text-center">
                        <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-lg font-medium">No Insights Yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Insights will appear as more financial data is recorded
                        </p>
                      </div>
                    </GlassCard>
                  </motion.div>
                )}
              </motion.div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </PageWrapper>
  );
}