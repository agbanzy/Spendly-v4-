import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
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
  AlertTriangle
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
import type { Expense, Budget, Transaction } from "@shared/schema";

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export default function AnalyticsPage() {
  const [timePeriod, setTimePeriod] = useState("30d");

  const { data: expenses, isLoading: loadingExpenses } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"]
  });

  const { data: budgets, isLoading: loadingBudgets } = useQuery<Budget[]>({
    queryKey: ["/api/budgets"]
  });

  const { data: transactions, isLoading: loadingTransactions } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"]
  });

  const isLoading = loadingExpenses || loadingBudgets || loadingTransactions;

  const totalSpent = expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0;
  const totalBudget = budgets?.reduce((sum, b) => sum + b.limit, 0) || 0;
  const budgetUsed = budgets?.reduce((sum, b) => sum + b.spent, 0) || 0;
  const pendingExpenses = expenses?.filter(e => e.status === "PENDING").length || 0;
  const approvedExpenses = expenses?.filter(e => e.status === "APPROVED" || e.status === "PAID").length || 0;

  const categoryBreakdown = useMemo(() => {
    if (!expenses) return [];
    const breakdown: Record<string, number> = {};
    expenses.forEach(exp => {
      breakdown[exp.category] = (breakdown[exp.category] || 0) + exp.amount;
    });
    return Object.entries(breakdown)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  const departmentBreakdown = useMemo(() => {
    if (!expenses) return [];
    const breakdown: Record<string, number> = {};
    expenses.forEach(exp => {
      const dept = exp.department || "Other";
      breakdown[dept] = (breakdown[dept] || 0) + exp.amount;
    });
    return Object.entries(breakdown)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  const monthlyTrendData = useMemo(() => {
    if (!expenses || !transactions) return [];
    
    const now = new Date();
    const months: { month: string; expenses: number; income: number; budget: number }[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleString('default', { month: 'short' });
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const monthExpenses = expenses
        .filter(e => {
          const expDate = new Date(e.date);
          return expDate >= monthStart && expDate <= monthEnd;
        })
        .reduce((sum, e) => sum + e.amount, 0);
      
      const monthIncome = transactions
        .filter(t => {
          const tDate = new Date(t.date);
          return tDate >= monthStart && tDate <= monthEnd && 
                 (t.type === 'Deposit' || t.type === 'Funding' || t.type === 'Refund');
        })
        .reduce((sum, t) => sum + t.amount, 0);
      
      months.push({
        month: monthName,
        expenses: monthExpenses,
        income: monthIncome,
        budget: totalBudget / 12,
      });
    }
    
    return months;
  }, [expenses, transactions, totalBudget]);

  const cashFlowData = useMemo(() => {
    if (!transactions) return [];
    const inflow = transactions.filter(t => t.type === 'Deposit' || t.type === 'Funding' || t.type === 'Refund')
      .reduce((sum, t) => sum + t.amount, 0);
    const outflow = transactions.filter(t => t.type === 'Payout' || t.type === 'Bill')
      .reduce((sum, t) => sum + t.amount, 0);
    return [
      { name: 'Inflow', value: inflow, fill: '#10b981' },
      { name: 'Outflow', value: outflow, fill: '#ef4444' },
    ];
  }, [transactions]);

  const budgetComparisonData = useMemo(() => {
    if (!budgets) return [];
    return budgets.map(b => ({
      name: b.name.substring(0, 12),
      budget: b.limit,
      spent: b.spent,
      remaining: Math.max(0, b.limit - b.spent),
    }));
  }, [budgets]);

  const weeklySpendingData = useMemo(() => {
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
        .filter(e => e.date === dayStr)
        .reduce((sum, e) => sum + e.amount, 0);
      
      return { day, amount: dayExpenses };
    });
  }, [expenses]);

  const savingsRate = useMemo(() => {
    if (!transactions) return 0;
    const income = transactions
      .filter(t => t.type === 'Deposit' || t.type === 'Funding')
      .reduce((sum, t) => sum + t.amount, 0);
    const outflow = transactions
      .filter(t => t.type === 'Payout' || t.type === 'Bill')
      .reduce((sum, t) => sum + t.amount, 0);
    if (income === 0) return 0;
    return Math.round(((income - outflow) / income) * 100);
  }, [transactions]);

  const budgetUtilization = totalBudget > 0 ? Math.round((budgetUsed / totalBudget) * 100) : 0;

  const statsCards = [
    {
      title: "Total Expenses",
      value: `$${totalSpent.toLocaleString()}`,
      change: `${expenses?.length || 0} items`,
      trend: "up" as const,
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/30"
    },
    {
      title: "Budget Utilization",
      value: `${budgetUtilization}%`,
      change: budgetUtilization > 80 ? "Over limit" : "On track",
      trend: budgetUtilization > 80 ? "up" as const : "down" as const,
      icon: Target,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100 dark:bg-indigo-900/30"
    },
    {
      title: "Pending Approvals",
      value: pendingExpenses.toString(),
      change: `${approvedExpenses} approved`,
      trend: pendingExpenses > 5 ? "up" as const : "down" as const,
      icon: Receipt,
      color: "text-amber-600",
      bgColor: "bg-amber-100 dark:bg-amber-900/30"
    },
    {
      title: "Savings Rate",
      value: `${savingsRate}%`,
      change: savingsRate > 0 ? "Positive" : "Negative",
      trend: savingsRate > 0 ? "up" as const : "down" as const,
      icon: Wallet,
      color: "text-cyan-600",
      bgColor: "bg-cyan-100 dark:bg-cyan-900/30"
    }
  ];

  const exportAnalytics = () => {
    const data = {
      totalExpenses: totalSpent,
      budgetUtilization: totalBudget > 0 ? Math.round((budgetUsed / totalBudget) * 100) : 0,
      categoryBreakdown,
      departmentBreakdown,
      generatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 texture-mesh min-h-screen">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 texture-mesh min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight" data-testid="text-analytics-title">Analytics</h1>
          <p className="text-muted-foreground">Track spending patterns and financial insights</p>
        </div>
        <div className="flex items-center gap-2">
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
              <div className="flex items-center justify-between">
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
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Activity className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="spending" data-testid="tab-spending">
            <BarChart2 className="mr-2 h-4 w-4" />
            Spending
          </TabsTrigger>
          <TabsTrigger value="categories" data-testid="tab-categories">
            <PieChartIcon className="mr-2 h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">
            <TrendingUp className="mr-2 h-4 w-4" />
            Trends
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Income vs Expenses</CardTitle>
                <CardDescription>Compare income and expenses over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={monthlyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Legend />
                    <Bar dataKey="income" fill="#10b981" name="Income" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" fill="#6366f1" name="Expenses" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="budget" stroke="#f59e0b" strokeWidth={2} dot={false} name="Budget" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cash Flow</CardTitle>
                <CardDescription>Inflow vs outflow analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={cashFlowData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {cashFlowData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Budget vs Actual Spending</CardTitle>
              <CardDescription>How well you're staying within budget limits</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={budgetComparisonData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="name" type="category" width={100} className="text-xs" />
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Legend />
                  <Bar dataKey="budget" fill="#94a3b8" name="Budget" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="spent" fill="#6366f1" name="Spent" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="spending" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Spending Pattern</CardTitle>
                <CardDescription>Daily spending distribution this week</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={weeklySpendingData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="#6366f1" 
                      fill="url(#colorAmount)" 
                      strokeWidth={2}
                    />
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

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
                    <YAxis className="text-xs" />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                      {departmentBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Spending by Category</CardTitle>
                <CardDescription>Distribution of expenses across categories</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={true}
                    >
                      {categoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Category Details</CardTitle>
                <CardDescription>Detailed breakdown with percentages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {categoryBreakdown.slice(0, 8).map((cat, index) => {
                    const percentage = totalSpent > 0 ? Math.round((cat.value / totalSpent) * 100) : 0;
                    return (
                      <div key={cat.name} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="font-medium text-sm">{cat.name}</span>
                          </div>
                          <span className="text-sm font-semibold">${cat.value.toLocaleString()}</span>
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
                        <p className="text-xs text-muted-foreground">{percentage}% of total spending</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Spending Trend</CardTitle>
                <CardDescription>6-month spending trajectory</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="expenses" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Expenses"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="income" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Income"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Financial Health Score</CardTitle>
                <CardDescription>Based on spending habits and budget adherence</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-8">
                {(() => {
                  const budgetScore = totalBudget > 0 ? Math.max(0, 100 - budgetUtilization) : 50;
                  const savingsScore = Math.max(0, Math.min(100, savingsRate + 50));
                  const spendingScore = approvedExpenses > 0 ? Math.min(100, (approvedExpenses / (expenses?.length || 1)) * 100) : 50;
                  const healthScore = Math.round((budgetScore + savingsScore + spendingScore) / 3);
                  const healthLabel = healthScore >= 80 ? "Excellent" : healthScore >= 60 ? "Good" : healthScore >= 40 ? "Fair" : "Needs Work";
                  const healthColor = healthScore >= 80 ? "#10b981" : healthScore >= 60 ? "#3b82f6" : healthScore >= 40 ? "#f59e0b" : "#ef4444";
                  const budgetGrade = budgetScore >= 90 ? "A+" : budgetScore >= 80 ? "A" : budgetScore >= 70 ? "B+" : budgetScore >= 60 ? "B" : "C";
                  const savingsGrade = savingsScore >= 90 ? "A+" : savingsScore >= 80 ? "A" : savingsScore >= 70 ? "B+" : savingsScore >= 60 ? "B" : "C";
                  const spendingGrade = spendingScore >= 90 ? "A+" : spendingScore >= 80 ? "A" : spendingScore >= 70 ? "B+" : spendingScore >= 60 ? "B" : "C";
                  
                  return (
                    <>
                      <div className="relative w-40 h-40">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            fill="none"
                            stroke="hsl(var(--muted))"
                            strokeWidth="12"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            fill="none"
                            stroke={healthColor}
                            strokeWidth="12"
                            strokeDasharray={`${healthScore * 2.51} ${100 * 2.51}`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                          <span className="text-4xl font-bold" style={{ color: healthColor }}>{healthScore}</span>
                          <span className="text-sm text-muted-foreground">{healthLabel}</span>
                        </div>
                      </div>
                      <div className="mt-6 grid grid-cols-3 gap-4 text-center w-full">
                        <div>
                          <p className="text-lg font-bold text-emerald-600">{budgetGrade}</p>
                          <p className="text-xs text-muted-foreground">Budget</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-amber-600">{savingsGrade}</p>
                          <p className="text-xs text-muted-foreground">Savings</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-indigo-600">{spendingGrade}</p>
                          <p className="text-xs text-muted-foreground">Spending</p>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Insights & Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {(() => {
                  const overBudgetCategories = budgets?.filter(b => b.spent > b.limit * 0.8) || [];
                  const topCategory = categoryBreakdown[0];
                  const pendingCount = expenses?.filter(e => e.status === 'PENDING').length || 0;
                  
                  return (
                    <>
                      <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                        <h4 className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {savingsRate > 0 ? "Positive Savings" : "Spending Analysis"}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {savingsRate > 0 
                            ? `You're saving ${savingsRate}% of your income. Great job maintaining positive cash flow!`
                            : `Your total expenses are $${totalSpent.toLocaleString()} across ${expenses?.length || 0} transactions.`}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                        <h4 className="font-semibold text-amber-700 dark:text-amber-400">
                          {overBudgetCategories.length > 0 ? "Budget Alert" : "Budget Status"}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {overBudgetCategories.length > 0 
                            ? `${overBudgetCategories.length} budget${overBudgetCategories.length > 1 ? 's are' : ' is'} at 80%+ utilization: ${overBudgetCategories.map(b => b.category).join(', ')}`
                            : `All ${budgets?.length || 0} budgets are within healthy limits. Keep tracking!`}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                        <h4 className="font-semibold text-indigo-700 dark:text-indigo-400">
                          {pendingCount > 0 ? "Action Required" : "Top Category"}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {pendingCount > 0 
                            ? `You have ${pendingCount} expense${pendingCount > 1 ? 's' : ''} pending approval. Review them soon.`
                            : topCategory 
                              ? `Highest spending: ${topCategory.name} at $${topCategory.value.toLocaleString()}`
                              : "No expense data available yet."}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
