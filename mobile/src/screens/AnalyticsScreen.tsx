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

interface Balance {
  currency: string;
  amount: number;
  change: number;
}

interface Transaction {
  id: number;
  type: string;
  description: string;
  amount: number;
  currency: string;
  status: string;
  date: string;
  category: string;
}

export default function AnalyticsScreen() {
  const { data: balances, isLoading: balancesLoading, refetch: refetchBalances } = useQuery({
    queryKey: ['balances'],
    queryFn: () => api.get<Balance[]>('/api/balances'),
  });

  const { data: transactions, isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => api.get<Transaction[]>('/api/transactions'),
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchBalances(), refetchTransactions()]);
    setRefreshing(false);
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const totalBalance = balances?.reduce((sum, b) => sum + b.amount, 0) || 0;

  const typeBreakdown = React.useMemo(() => {
    if (!transactions) return [];
    const grouped: Record<string, number> = {};
    transactions.forEach((t) => {
      const type = t.type || t.category || 'Other';
      grouped[type] = (grouped[type] || 0) + Math.abs(t.amount);
    });
    const entries = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
    const max = entries.length > 0 ? entries[0][1] : 1;
    return entries.map(([type, total]) => ({
      type,
      total,
      ratio: total / max,
    }));
  }, [transactions]);

  const isLoading = balancesLoading || transactionsLoading;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer} testID="loading-analytics">
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
      testID="analytics-screen"
    >
      <View style={styles.header}>
        <Text style={styles.subtitle}>Your spending</Text>
        <Text style={styles.title}>Analytics</Text>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={styles.balanceAmount} testID="text-total-balance">{formatCurrency(totalBalance)}</Text>
        <View style={styles.balanceRow}>
          {balances?.slice(0, 3).map((balance, index) => (
            <View key={index} style={styles.currencyItem}>
              <Text style={styles.currencyCode}>{balance.currency}</Text>
              <Text style={styles.currencyAmount}>{formatCurrency(balance.amount, balance.currency)}</Text>
              {balance.change !== undefined && (
                <Text style={[styles.changeText, balance.change >= 0 ? styles.changeUp : styles.changeDown]}>
                  {balance.change >= 0 ? '+' : ''}{balance.change.toFixed(1)}%
                </Text>
              )}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Breakdown by Type</Text>
        {typeBreakdown.length > 0 ? (
          typeBreakdown.slice(0, 8).map((item, index) => (
            <View key={item.type} style={styles.breakdownItem} testID={`breakdown-${index}`}>
              <View style={styles.breakdownHeader}>
                <Text style={styles.breakdownType}>{item.type}</Text>
                <Text style={styles.breakdownAmount}>{formatCurrency(item.total)}</Text>
              </View>
              <View style={styles.barContainer}>
                <View style={[styles.bar, { width: `${item.ratio * 100}%` }]} />
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No transaction data available</Text>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity testID="link-view-all-transactions">
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>
        {transactions?.slice(0, 5).map((tx) => (
          <View key={tx.id} style={styles.txItem} testID={`transaction-summary-${tx.id}`}>
            <View style={styles.txIcon}>
              <Ionicons
                name={tx.type === 'credit' ? 'arrow-down' : 'arrow-up'}
                size={18}
                color={tx.type === 'credit' ? '#34D399' : '#F87171'}
              />
            </View>
            <View style={styles.txDetails}>
              <Text style={styles.txDescription}>{tx.description}</Text>
              <Text style={styles.txType}>{tx.type || tx.category}</Text>
            </View>
            <View style={styles.txRight}>
              <Text style={[styles.txAmount, tx.type === 'credit' ? styles.amountCredit : styles.amountDebit]}>
                {tx.type === 'credit' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
              </Text>
              <Text style={styles.txDate}>{new Date(tx.date).toLocaleDateString()}</Text>
            </View>
          </View>
        ))}

        {(!transactions || transactions.length === 0) && (
          <View style={styles.emptyContainer} testID="empty-analytics">
            <Ionicons name="analytics-outline" size={48} color="#334155" />
            <Text style={styles.emptyText}>No data available</Text>
          </View>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  subtitle: {
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
  changeText: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  changeUp: {
    color: '#34D399',
  },
  changeDown: {
    color: '#F87171',
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
    marginBottom: 16,
  },
  viewAll: {
    fontSize: 14,
    color: '#818CF8',
  },
  breakdownItem: {
    marginBottom: 14,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  breakdownType: {
    fontSize: 13,
    color: '#E2E8F0',
    textTransform: 'capitalize',
  },
  breakdownAmount: {
    fontSize: 13,
    color: '#94A3B8',
  },
  barContainer: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: 8,
    backgroundColor: '#818CF8',
    borderRadius: 4,
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txDetails: {
    flex: 1,
    marginLeft: 12,
  },
  txDescription: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  txType: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  amountCredit: {
    color: '#34D399',
  },
  amountDebit: {
    color: '#F87171',
  },
  txDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#64748B',
    textAlign: 'center',
    padding: 20,
  },
});
