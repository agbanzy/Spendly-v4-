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

interface Wallet {
  id: number;
  name: string;
  currency: string;
  balance: number;
  status: string;
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

export default function WalletScreen() {
  const { data: wallets, isLoading: walletsLoading, refetch: refetchWallets } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => api.get<Wallet[]>('/api/wallets'),
  });

  const { data: transactions, isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery({
    queryKey: ['wallet-transactions'],
    queryFn: () => api.get<Transaction[]>('/api/transactions'),
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchWallets(), refetchTransactions()]);
    setRefreshing(false);
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const totalBalance = wallets?.reduce((sum, w) => sum + w.balance, 0) || 0;
  const primaryWallet = wallets?.[0];

  const getTransactionIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type.toLowerCase()) {
      case 'credit':
      case 'deposit':
      case 'fund':
        return 'arrow-down';
      case 'debit':
      case 'withdrawal':
      case 'withdraw':
        return 'arrow-up';
      case 'transfer':
      case 'send':
        return 'swap-horizontal';
      default:
        return 'ellipse-outline';
    }
  };

  const getTransactionColor = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'credit':
      case 'deposit':
      case 'fund':
        return '#34D399';
      case 'debit':
      case 'withdrawal':
      case 'withdraw':
        return '#F87171';
      default:
        return '#818CF8';
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'success':
        return styles.statusCompleted;
      case 'pending':
        return styles.statusPending;
      case 'failed':
        return styles.statusFailed;
      default:
        return styles.statusPending;
    }
  };

  const isLoading = walletsLoading || transactionsLoading;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer} testID="loading-wallet">
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
      testID="wallet-screen"
    >
      <View style={styles.header}>
        <Text style={styles.subtitle}>Your</Text>
        <Text style={styles.title}>Wallet</Text>
      </View>

      <View style={styles.walletCard}>
        <Text style={styles.walletLabel}>Available Balance</Text>
        <Text style={styles.walletBalance} testID="text-wallet-balance">
          {formatCurrency(totalBalance, primaryWallet?.currency)}
        </Text>
        {wallets && wallets.length > 1 && (
          <View style={styles.walletRow}>
            {wallets.slice(0, 3).map((wallet, index) => (
              <View key={index} style={styles.walletItem}>
                <Text style={styles.walletCurrency}>{wallet.currency}</Text>
                <Text style={styles.walletAmount}>
                  {formatCurrency(wallet.balance, wallet.currency)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionButton} testID="button-fund-wallet">
          <View style={[styles.actionIcon, { backgroundColor: '#065F46' }]}>
            <Ionicons name="add" size={24} color="#34D399" />
          </View>
          <Text style={styles.actionText}>Fund</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} testID="button-withdraw">
          <View style={[styles.actionIcon, { backgroundColor: '#92400E' }]}>
            <Ionicons name="arrow-up" size={24} color="#FBBF24" />
          </View>
          <Text style={styles.actionText}>Withdraw</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} testID="button-send">
          <View style={[styles.actionIcon, { backgroundColor: '#312E81' }]}>
            <Ionicons name="send" size={24} color="#818CF8" />
          </View>
          <Text style={styles.actionText}>Send</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity testID="link-view-all-wallet-transactions">
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>

        {transactions?.slice(0, 10).map((tx) => (
          <TouchableOpacity key={tx.id} style={styles.txItem} testID={`wallet-tx-${tx.id}`}>
            <View style={[styles.txIcon, { backgroundColor: getTransactionColor(tx.type) + '20' }]}>
              <Ionicons
                name={getTransactionIcon(tx.type)}
                size={18}
                color={getTransactionColor(tx.type)}
              />
            </View>
            <View style={styles.txDetails}>
              <Text style={styles.txDescription}>{tx.description}</Text>
              <Text style={styles.txType}>{tx.type}</Text>
            </View>
            <View style={styles.txRight}>
              <Text style={[styles.txAmount, { color: getTransactionColor(tx.type) }]}>
                {tx.type === 'credit' || tx.type === 'deposit' || tx.type === 'fund'
                  ? '+'
                  : '-'}
                {formatCurrency(Math.abs(tx.amount))}
              </Text>
              <View style={[styles.txStatusBadge, getStatusStyle(tx.status)]}>
                <Text style={styles.txStatusText}>{tx.status}</Text>
              </View>
              <Text style={styles.txDate}>{new Date(tx.date).toLocaleDateString()}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {(!transactions || transactions.length === 0) && (
          <View style={styles.emptyContainer} testID="empty-wallet-transactions">
            <Ionicons name="wallet-outline" size={48} color="#334155" />
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySubtext}>Fund your wallet to get started</Text>
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
  walletCard: {
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  walletLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  walletBalance: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  walletRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 16,
  },
  walletItem: {
    flex: 1,
  },
  walletCurrency: {
    fontSize: 12,
    color: '#64748B',
  },
  walletAmount: {
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
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  txStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 4,
  },
  statusCompleted: {
    backgroundColor: '#065F46',
  },
  statusPending: {
    backgroundColor: '#92400E',
  },
  statusFailed: {
    backgroundColor: '#991B1B',
  },
  txStatusText: {
    fontSize: 9,
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  txDate: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 16,
    marginTop: 12,
  },
  emptySubtext: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 4,
  },
});
