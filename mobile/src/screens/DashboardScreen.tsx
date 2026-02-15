import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

// Type definitions
interface Balance {
  id: string;
  local: string | number;
  usd: string | number;
  escrow: string | number;
  localCurrency: string;
}

interface Expense {
  id: string;
  merchant: string;
  amount: number;
  category: string;
  status: string;
  date: string;
  currency: string;
  department?: string;
}

interface KPIData {
  totalRevenue: number;
  totalExpenses: number;
  totalOutflow: number;
  netCashFlow: number;
  profitMargin: number;
  burnRate: number;
  runwayMonths: number;
  totalBudget: number;
  totalBudgetSpent: number;
  budgetUtilization: number;
  totalPayroll: number;
  totalBillsPaid: number;
  totalBillsPending: number;
  invoiceRevenue: number;
  invoicePending: number;
  totalWalletBalance: number;
  activeVendors: number;
  totalVendorPayments: number;
  expenseGrowthRate: number;
  expenseCount: number;
  pendingExpenses: number;
  approvedExpenses: number;
  transactionCount: number;
  overdueBills: number;
}

interface Insight {
  title: string;
  summary: string;
  category: string;
  severity: string;
  recommendation: string;
  metric: string;
  metricValue: number | string;
}

interface InsightsResponse {
  insights: Insight[];
}

export default function DashboardScreen() {
  // Fetch KPI data
  const {
    data: kpis,
    isLoading: kpisLoading,
    refetch: refetchKpis,
  } = useQuery({
    queryKey: ['/api/analytics/kpis'],
    queryFn: () => api.get<KPIData>('/api/analytics/kpis'),
  });

  // Fetch balance data (single object, not array)
  const {
    data: balance,
    isLoading: balanceLoading,
    refetch: refetchBalance,
  } = useQuery({
    queryKey: ['/api/balances'],
    queryFn: () => api.get<Balance>('/api/balances'),
  });

  // Fetch expenses
  const {
    data: expenses,
    isLoading: expensesLoading,
    refetch: refetchExpenses,
  } = useQuery({
    queryKey: ['/api/expenses'],
    queryFn: () => api.get<Expense[]>('/api/expenses'),
  });

  // Fetch insights
  const {
    data: insightsResponse,
    isLoading: insightsLoading,
    refetch: refetchInsights,
  } = useQuery({
    queryKey: ['/api/analytics/insights'],
    queryFn: () => api.get<InsightsResponse>('/api/analytics/insights'),
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchKpis(), refetchBalance(), refetchExpenses(), refetchInsights()]);
    setRefreshing(false);
  };

  const formatCurrency = (amount: number | string, currency: string = 'USD') => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(numAmount);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Parse balance - the endpoint returns an object with local field
  const totalBalance = balance ? parseFloat(balance.local.toString()) : 0;
  const currencyCode = balance?.localCurrency || 'USD';

  // Get top insight (highest severity)
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const topInsight = insightsResponse?.insights
    ?.sort(
      (a, b) =>
        (severityOrder[a.severity as keyof typeof severityOrder] ?? 4) -
        (severityOrder[b.severity as keyof typeof severityOrder] ?? 4)
    )
    .slice(0, 1)[0];

  const isLoading = kpisLoading || balanceLoading || expensesLoading || insightsLoading;

  if (isLoading && !kpis && !balance && !expenses && !insightsResponse) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#818CF8" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818CF8" />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back</Text>
        <Text style={styles.title}>Dashboard</Text>
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCard} testID="card-balance">
        <Text style={styles.balanceLabel}>Total Wallet Balance</Text>
        <Text style={styles.balanceAmount}>{formatCurrency(totalBalance, currencyCode)}</Text>
        <Text style={styles.currencyCode}>{currencyCode}</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionButton} testID="button-add-expense">
          <View style={styles.actionIcon}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.actionText}>Add Expense</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} testID="button-send-money">
          <View style={styles.actionIcon}>
            <Ionicons name="send" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.actionText}>Send Money</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} testID="button-request">
          <View style={styles.actionIcon}>
            <Ionicons name="download" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.actionText}>Request</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Summary - 2x2 Grid */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle} testID="text-kpi-summary">
          Financial Summary
        </Text>
        <View style={styles.kpiGrid}>
          {/* Net Cash Flow */}
          <View style={styles.kpiCard} testID="card-net-cash-flow">
            <Text style={styles.kpiLabel}>Net Cash Flow</Text>
            <Text style={[styles.kpiValue, kpis?.netCashFlow >= 0 ? styles.positive : styles.negative]}>
              {formatCurrency(kpis?.netCashFlow || 0)}
            </Text>
          </View>

          {/* Pending Expenses */}
          <View style={styles.kpiCard} testID="card-pending-expenses">
            <Text style={styles.kpiLabel}>Pending Expenses</Text>
            <Text style={styles.kpiValue}>{kpis?.pendingExpenses || 0}</Text>
          </View>

          {/* Overdue Bills */}
          <View style={styles.kpiCard} testID="card-overdue-bills">
            <Text style={styles.kpiLabel}>Overdue Bills</Text>
            <Text style={[styles.kpiValue, styles.warning]}>
              {kpis?.overdueBills || 0}
            </Text>
          </View>

          {/* Budget Utilization */}
          <View style={styles.kpiCard} testID="card-budget-utilization">
            <Text style={styles.kpiLabel}>Budget Used</Text>
            <Text style={styles.kpiValue}>
              {formatPercent(kpis?.budgetUtilization || 0)}
            </Text>
          </View>
        </View>
      </View>

      {/* Top Insight Alert */}
      {topInsight && (
        <View
          style={[
            styles.section,
            styles.insightCard,
            topInsight.severity === 'critical'
              ? styles.severityCritical
              : topInsight.severity === 'high'
                ? styles.severityHigh
                : styles.severityMedium,
          ]}
          testID="card-insight"
        >
          <View style={styles.insightHeader}>
            <Ionicons
              name={topInsight.severity === 'critical' ? 'alert-circle' : 'information-circle'}
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.insightTitle}>{topInsight.title}</Text>
          </View>
          <Text style={styles.insightSummary}>{topInsight.summary}</Text>
          <Text style={styles.insightRecommendation}>💡 {topInsight.recommendation}</Text>
        </View>
      )}

      {/* Recent Expenses */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle} testID="text-recent-expenses">
            Recent Expenses
          </Text>
          <TouchableOpacity testID="link-view-all">
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>

        {expenses && expenses.length > 0 ? (
          expenses.slice(0, 5).map((expense) => (
            <View key={expense.id} style={styles.expenseItem} testID={`item-expense-${expense.id}`}>
              <View style={styles.expenseIcon}>
                <Ionicons name="receipt-outline" size={20} color="#818CF8" />
              </View>
              <View style={styles.expenseDetails}>
                <Text style={styles.expenseMerchant}>{expense.merchant}</Text>
                <Text style={styles.expenseCategory}>
                  {expense.category}
                  {expense.department ? ` • ${expense.department}` : ''}
                </Text>
              </View>
              <View style={styles.expenseAmountContainer}>
                <Text style={styles.expenseAmount}>-{formatCurrency(expense.amount, expense.currency)}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    expense.status === 'approved'
                      ? styles.statusApproved
                      : expense.status === 'pending'
                        ? styles.statusPending
                        : styles.statusRejected,
                  ]}
                  testID={`badge-status-${expense.id}`}
                >
                  <Text style={styles.statusText}>{expense.status}</Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No recent expenses</Text>
        )}
      </View>

      {/* Bottom padding */}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 14,
    color: '#94A3B8',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 4,
  },
  balanceCard: {
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  currencyCode: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#818CF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    color: '#E2E8F0',
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  viewAll: {
    fontSize: 14,
    color: '#818CF8',
    fontWeight: '500',
  },
  // KPI Grid
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  kpiLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  positive: {
    color: '#10B981',
  },
  negative: {
    color: '#EF4444',
  },
  warning: {
    color: '#F59E0B',
  },
  // Insight Card
  insightCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
  },
  severityCritical: {
    borderLeftColor: '#EF4444',
    backgroundColor: '#7F1D1D',
  },
  severityHigh: {
    borderLeftColor: '#F59E0B',
    backgroundColor: '#78350F',
  },
  severityMedium: {
    borderLeftColor: '#818CF8',
    backgroundColor: '#1E1B4B',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  insightSummary: {
    fontSize: 13,
    color: '#E2E8F0',
    marginBottom: 8,
    lineHeight: 18,
  },
  insightRecommendation: {
    fontSize: 12,
    color: '#CBD5E1',
    fontStyle: 'italic',
  },
  // Expenses
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  expenseIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseDetails: {
    flex: 1,
    marginLeft: 12,
  },
  expenseMerchant: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  expenseCategory: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  expenseAmountContainer: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  statusApproved: {
    backgroundColor: '#065F46',
  },
  statusPending: {
    backgroundColor: '#92400E',
  },
  statusRejected: {
    backgroundColor: '#7F1D1D',
  },
  statusText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748B',
    padding: 20,
    fontSize: 14,
  },
});
