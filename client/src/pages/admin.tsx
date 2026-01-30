import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Users,
  Shield,
  Activity,
  Settings,
  Building2,
  FileText,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  CreditCard,
  Receipt,
  BarChart3,
  Lock,
  UserCog,
  ScrollText,
  Wallet,
  RefreshCw,
  Trash2,
  ArrowUpDown,
  Banknote,
  Database,
} from "lucide-react";
import type { TeamMember, Expense, AuditLog } from "@shared/schema";

export default function Admin() {
  const { data: teamMembers, isLoading: loadingTeam } = useQuery<TeamMember[]>({
    queryKey: ["/api/team"],
  });

  const { data: expenses, isLoading: loadingExpenses } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: auditLogs, isLoading: loadingLogs } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-logs"],
  });

  const stats = {
    totalUsers: teamMembers?.length || 0,
    activeUsers: teamMembers?.filter(m => m.status === 'Active').length || 0,
    pendingExpenses: expenses?.filter(e => e.status === 'PENDING').length || 0,
    totalExpenseAmount: expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0,
    recentLogs: auditLogs?.slice(0, 5) || [],
  };

  const adminModules = [
    {
      title: "User Management",
      description: "Manage users, roles, and permissions",
      icon: UserCog,
      href: "/admin/users",
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      title: "Wallet Management",
      description: "View and manage user wallets",
      icon: Wallet,
      href: "/admin/wallets",
      color: "text-violet-600",
      bgColor: "bg-violet-100 dark:bg-violet-900/30",
    },
    {
      title: "Payout Management",
      description: "Process and track all payouts",
      icon: Banknote,
      href: "/admin/payouts",
      color: "text-teal-600",
      bgColor: "bg-teal-100 dark:bg-teal-900/30",
    },
    {
      title: "Exchange Rates",
      description: "Manage currency exchange rates",
      icon: ArrowUpDown,
      href: "/admin/exchange-rates",
      color: "text-cyan-600",
      bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
    },
    {
      title: "Audit Logs",
      description: "View all system activities",
      icon: ScrollText,
      href: "/admin/audit-logs",
      color: "text-amber-600",
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
    },
    {
      title: "Organization Settings",
      description: "Configure company profile",
      icon: Building2,
      href: "/admin/organization",
      color: "text-emerald-600",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    },
    {
      title: "Security & Access",
      description: "Manage security policies",
      icon: Lock,
      href: "/admin/security",
      color: "text-red-600",
      bgColor: "bg-red-100 dark:bg-red-900/30",
    },
    {
      title: "Database Management",
      description: "Purge data and manage storage",
      icon: Database,
      href: "/admin/database",
      color: "text-rose-600",
      bgColor: "bg-rose-100 dark:bg-rose-900/30",
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 texture-mesh min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3" data-testid="text-admin-title">
            <Shield className="h-8 w-8 text-primary" />
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            System administration and management
          </p>
        </div>
        <Badge variant="outline" className="text-xs font-bold uppercase tracking-wider">
          Administrator
        </Badge>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  Total Users
                </p>
                {loadingTeam ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <p className="text-2xl font-black">{stats.totalUsers}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  Active Users
                </p>
                {loadingTeam ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <p className="text-2xl font-black text-emerald-600">{stats.activeUsers}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  Pending
                </p>
                {loadingExpenses ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <p className="text-2xl font-black text-amber-600">{stats.pendingExpenses}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                <DollarSign className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  Total Expenses
                </p>
                {loadingExpenses ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <p className="text-2xl font-black">${stats.totalExpenseAmount.toLocaleString()}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {adminModules.map((module) => (
          <Link key={module.href} href={module.href}>
            <Card className="glass card-hover cursor-pointer h-full transition-all hover:scale-[1.02]" data-testid={`admin-module-${module.title.toLowerCase().replace(/\s+/g, '-')}`}>
              <CardContent className="p-6">
                <div className={`p-3 rounded-xl ${module.bgColor} w-fit mb-4`}>
                  <module.icon className={`h-6 w-6 ${module.color}`} />
                </div>
                <h3 className="font-bold text-lg mb-1">{module.title}</h3>
                <p className="text-sm text-muted-foreground">{module.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Activity and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Audit Logs */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Recent Activity
              </CardTitle>
              <Link href="/admin/audit-logs">
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingLogs ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-full mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats.recentLogs.length > 0 ? (
              <div className="divide-y divide-border">
                {stats.recentLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{log.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.userName} • {log.entityType}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Health */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              System Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                </div>
                <span className="font-medium">Database</span>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                Healthy
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                </div>
                <span className="font-medium">Authentication</span>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                Active
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                </div>
                <span className="font-medium">Payment Gateway</span>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                Connected
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                </div>
                <span className="font-medium">API Usage</span>
              </div>
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                Normal
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Distribution by Role */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Distribution by Role
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {loadingTeam ? (
            <div className="flex gap-4 flex-wrap">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 w-32" />
              ))}
            </div>
          ) : (
            <div className="flex gap-4 flex-wrap">
              {['Owner', 'Admin', 'Manager', 'Employee', 'Viewer'].map((role) => {
                const count = teamMembers?.filter(m => m.role === role).length || 0;
                return (
                  <div key={role} className="p-4 rounded-lg border bg-muted/50 min-w-[120px]">
                    <p className="text-2xl font-black">{count}</p>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{role}s</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
