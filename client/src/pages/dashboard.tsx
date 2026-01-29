import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Wallet,
  CreditCard,
  Send,
  Plus,
  ArrowRight,
  Zap,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Link } from "wouter";
import type { Expense, Transaction, CompanyBalances, AIInsight } from "@shared/schema";

export default function Dashboard() {
  const { data: balances, isLoading: balancesLoading } = useQuery<CompanyBalances>({
    queryKey: ["/api/balances"],
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: insights } = useQuery<AIInsight[]>({
    queryKey: ["/api/insights"],
  });

  const totalBalance = balances ? balances.local + balances.usd : 0;
  const recentExpenses = expenses?.slice(0, 3) || [];
  const recentTransactions = transactions?.slice(0, 4) || [];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-xs font-bold uppercase tracking-widest">
              HQ
            </Badge>
            <Badge variant="outline" className="text-xs font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse" />
              Verified
            </Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight" data-testid="text-dashboard-title">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's your financial overview.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" data-testid="button-add-funds">
            <Plus className="h-4 w-4 mr-2" />
            Add Funds
          </Button>
          <Button data-testid="button-send-money">
            <Send className="h-4 w-4 mr-2" />
            Send Money
          </Button>
        </div>
      </div>

      {/* Hero Balance Card */}
      <Card className="bg-slate-900 dark:bg-slate-950 text-white border-0 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px]" />
        <CardContent className="p-8 md:p-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <p className="text-xs font-bold text-primary uppercase tracking-widest">
                Total Balance (USD)
              </p>
              {balancesLoading ? (
                <Skeleton className="h-14 w-64 bg-slate-800" />
              ) : (
                <h2 className="text-4xl md:text-6xl font-black tracking-tight" data-testid="text-total-balance">
                  ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
              )}
              <div className="flex items-center gap-4 pt-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Active
                </span>
                <span className="text-xs text-slate-400">
                  Updated just now
                </span>
              </div>
            </div>
            <Button 
              size="lg" 
              className="bg-white text-slate-900 hover:bg-slate-100"
              data-testid="button-withdraw"
            >
              <Wallet className="h-4 w-4 mr-2" />
              Withdraw
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Local Balance
              </p>
              <div className="p-2 bg-primary/10 rounded-lg">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
            </div>
            {balancesLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-black" data-testid="text-local-balance">
                ${balances?.local.toLocaleString() || '0'}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {balances?.localCurrency || 'USD'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                USD Treasury
              </p>
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            {balancesLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-black" data-testid="text-usd-balance">
                ${balances?.usd.toLocaleString() || '0'}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Global Treasury
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Escrow
              </p>
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <CreditCard className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            {balancesLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-black" data-testid="text-escrow-balance">
                ${balances?.escrow.toLocaleString() || '0'}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Pending settlements
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      {insights && insights.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            AI Insights
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight, idx) => (
              <Card 
                key={idx} 
                className="bg-slate-900 dark:bg-slate-950 text-white border-0 overflow-hidden relative group"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors" />
                <CardContent className="p-6 relative z-10">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${
                      insight.type === 'saving' ? 'bg-emerald-600' :
                      insight.type === 'warning' ? 'bg-amber-600' : 'bg-primary'
                    }`}>
                      {insight.type === 'saving' ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : insight.type === 'warning' ? (
                        <AlertCircle className="h-5 w-5" />
                      ) : (
                        <Zap className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">
                        {insight.type}
                      </p>
                      <h4 className="text-sm font-bold text-white truncate">
                        {insight.title}
                      </h4>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        {insight.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <CardTitle className="text-sm font-bold uppercase tracking-widest">
            Recent Activity
          </CardTitle>
          <Link href="/transactions">
            <Button variant="ghost" size="sm" className="text-xs font-bold text-primary" data-testid="link-view-all-transactions">
              View All <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {transactionsLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div>
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : recentTransactions.length > 0 ? (
            <div className="divide-y divide-border">
              {recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  data-testid={`transaction-item-${tx.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      tx.type === 'Deposit' || tx.type === 'Funding'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {tx.type === 'Deposit' || tx.type === 'Funding' ? (
                        <ArrowDownRight className="h-5 w-5" />
                      ) : (
                        <ArrowUpRight className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{tx.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${
                      tx.type === 'Deposit' || tx.type === 'Funding'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : ''
                    }`}>
                      {tx.type === 'Deposit' || tx.type === 'Funding' ? '+' : '-'}
                      ${tx.amount.toLocaleString()}
                    </p>
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${
                        tx.status === 'Completed' 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                          : tx.status === 'Processing'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : ''
                      }`}
                    >
                      {tx.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <p className="text-sm text-muted-foreground">No recent transactions</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
