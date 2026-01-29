import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface Balance {
  currency: string;
  amount: number;
  change: number;
}

interface Expense {
  id: number;
  description: string;
  amount: number;
  category: string;
  status: string;
  date: string;
}

export default function DashboardScreen() {
  const { data: balances, isLoading: balancesLoading, refetch: refetchBalances } = useQuery({
    queryKey: ['balances'],
    queryFn: () => api.get<Balance[]>('/api/balances'),
  });

  const { data: expenses, isLoading: expensesLoading, refetch: refetchExpenses } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api.get<Expense[]>('/api/expenses'),
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchBalances(), refetchExpenses()]);
    setRefreshing(false);
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const totalBalance = balances?.reduce((sum, b) => sum + b.amount, 0) || 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818CF8" />
      }
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back</Text>
        <Text style={styles.title}>Dashboard</Text>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={styles.balanceAmount}>{formatCurrency(totalBalance)}</Text>
        <View style={styles.balanceRow}>
          {balances?.slice(0, 3).map((balance, index) => (
            <View key={index} style={styles.currencyItem}>
              <Text style={styles.currencyCode}>{balance.currency}</Text>
              <Text style={styles.currencyAmount}>{formatCurrency(balance.amount, balance.currency)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionButton} testID="button-add-expense">
          <View style={styles.actionIcon}>
            <Ionicons name="add" size={24} color="#4F46E5" />
          </View>
          <Text style={styles.actionText}>Add Expense</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} testID="button-send-money">
          <View style={styles.actionIcon}>
            <Ionicons name="send" size={24} color="#4F46E5" />
          </View>
          <Text style={styles.actionText}>Send Money</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} testID="button-request">
          <View style={styles.actionIcon}>
            <Ionicons name="download" size={24} color="#4F46E5" />
          </View>
          <Text style={styles.actionText}>Request</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Expenses</Text>
          <TouchableOpacity testID="link-view-all">
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>

        {expenses?.slice(0, 5).map((expense) => (
          <View key={expense.id} style={styles.expenseItem}>
            <View style={styles.expenseIcon}>
              <Ionicons name="receipt-outline" size={20} color="#94A3B8" />
            </View>
            <View style={styles.expenseDetails}>
              <Text style={styles.expenseDescription}>{expense.description}</Text>
              <Text style={styles.expenseCategory}>{expense.category}</Text>
            </View>
            <View style={styles.expenseAmountContainer}>
              <Text style={styles.expenseAmount}>-{formatCurrency(expense.amount)}</Text>
              <View style={[styles.statusBadge, expense.status === 'approved' ? styles.statusApproved : styles.statusPending]}>
                <Text style={styles.statusText}>{expense.status}</Text>
              </View>
            </View>
          </View>
        ))}

        {(!expenses || expenses.length === 0) && !expensesLoading && (
          <Text style={styles.emptyText}>No recent expenses</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
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
    marginBottom: 20,
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
  balanceRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 16,
  },
  currencyItem: {
    flex: 1,
  },
  currencyCode: {
    fontSize: 12,
    color: '#64748B',
  },
  currencyAmount: {
    fontSize: 14,
    color: '#E2E8F0',
    marginTop: 2,
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
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#312E81',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    color: '#E2E8F0',
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
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
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
  expenseDescription: {
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
    color: '#F87171',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  statusApproved: {
    backgroundColor: '#065F46',
  },
  statusPending: {
    backgroundColor: '#92400E',
  },
  statusText: {
    fontSize: 10,
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748B',
    padding: 20,
  },
});
