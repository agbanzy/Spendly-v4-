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
  Activity
} from "lucide-react";
import type { Expense, Budget } from "@shared/schema";

export default function AnalyticsPage() {
  const { data: expenses, isLoading: loadingExpenses } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"]
  });

  const { data: budgets, isLoading: loadingBudgets } = useQuery<Budget[]>({
    queryKey: ["/api/budgets"]
  });

  const isLoading = loadingExpenses || loadingBudgets;

  const totalSpent = expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0;
  const totalBudget = budgets?.reduce((sum, b) => sum + b.limit, 0) || 0;
  const budgetUsed = budgets?.reduce((sum, b) => sum + b.spent, 0) || 0;

  const categoryBreakdown = expenses?.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>) || {};

  const departmentBreakdown = expenses?.reduce((acc, exp) => {
    const dept = exp.department || "Other";
    acc[dept] = (acc[dept] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>) || {};

  const statsCards = [
    {
      title: "Total Expenses",
      value: `$${totalSpent.toLocaleString()}`,
      change: "+12.5%",
      trend: "up",
      icon: DollarSign,
      color: "text-emerald-600"
    },
    {
      title: "Budget Utilization",
      value: `${totalBudget > 0 ? Math.round((budgetUsed / totalBudget) * 100) : 0}%`,
      change: "+5.2%",
      trend: "up",
      icon: PieChartIcon,
      color: "text-indigo-600"
    },
    {
      title: "Active Cards",
      value: "12",
      change: "+2",
      trend: "up",
      icon: CreditCard,
      color: "text-amber-600"
    },
    {
      title: "Team Members",
      value: "24",
      change: "+4",
      trend: "up",
      icon: Users,
      color: "text-cyan-600"
    }
  ];

  const topCategories = Object.entries(categoryBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topDepartments = Object.entries(departmentBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const categoryColors: Record<string, string> = {
    "Software": "bg-indigo-500",
    "Marketing": "bg-emerald-500",
    "Travel": "bg-amber-500",
    "Office": "bg-rose-500",
    "Other": "bg-slate-500"
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
          <Select defaultValue="30d">
            <SelectTrigger className="w-32" data-testid="select-time-period">
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
          <Button variant="outline" data-testid="button-export">
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
                <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
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
          <TabsTrigger value="categories" data-testid="tab-categories">
            <PieChartIcon className="mr-2 h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="departments" data-testid="tab-departments">
            <BarChart2 className="mr-2 h-4 w-4" />
            Departments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Spending Trend</CardTitle>
                <CardDescription>Monthly spending over the past 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-end justify-between gap-2 px-4">
                  {[65, 45, 78, 52, 89, 72].map((height, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2">
                      <div 
                        className="w-full bg-indigo-500 rounded-t-md transition-all hover:bg-indigo-600"
                        style={{ height: `${height * 2.5}px` }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {["Aug", "Sep", "Oct", "Nov", "Dec", "Jan"][index]}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Budget Performance</CardTitle>
                <CardDescription>Budget utilization by category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {budgets?.slice(0, 5).map((budget, index) => {
                    const percentage = Math.round((budget.spent / budget.limit) * 100);
                    const isOverBudget = percentage > 100;
                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{budget.name}</span>
                          <span className={isOverBudget ? "text-rose-600" : "text-muted-foreground"}>
                            ${budget.spent.toLocaleString()} / ${budget.limit.toLocaleString()}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              isOverBudget ? "bg-rose-500" : percentage > 80 ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Spending by Category</CardTitle>
                <CardDescription>Breakdown of expenses by category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-8">
                  <div className="relative w-48 h-48">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      {topCategories.reduce((acc, [category, amount], index) => {
                        const percentage = (amount / totalSpent) * 100;
                        const offset = acc.offset;
                        acc.elements.push(
                          <circle
                            key={category}
                            cx="50"
                            cy="50"
                            r="40"
                            fill="none"
                            stroke={["#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#64748b"][index]}
                            strokeWidth="20"
                            strokeDasharray={`${percentage * 2.51} ${251 - percentage * 2.51}`}
                            strokeDashoffset={-offset * 2.51}
                          />
                        );
                        acc.offset += percentage;
                        return acc;
                      }, { elements: [] as JSX.Element[], offset: 0 }).elements}
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <span className="text-2xl font-bold">${(totalSpent / 1000).toFixed(1)}K</span>
                      <span className="text-xs text-muted-foreground">Total</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topCategories.map(([category, amount], index) => {
                    const percentage = Math.round((amount / totalSpent) * 100);
                    return (
                      <div key={category} className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${categoryColors[category] || "bg-slate-500"}`} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{category}</span>
                            <span className="text-muted-foreground">${amount.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>{percentage}% of total</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="departments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Spending by Department</CardTitle>
              <CardDescription>How each department contributes to total spend</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {topDepartments.map(([department, amount], index) => {
                  const percentage = Math.round((amount / totalSpent) * 100);
                  return (
                    <div key={department} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                            <Users className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{department}</p>
                            <p className="text-sm text-muted-foreground">{percentage}% of total spend</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">${amount.toLocaleString()}</p>
                          <Badge variant="secondary" className="text-xs">
                            <TrendingUp className="mr-1 h-3 w-3" />
                            +8%
                          </Badge>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
