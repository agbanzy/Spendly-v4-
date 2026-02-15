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
  id: string;
  local: string;
  usd: string;
  escrow: string;
  localCurrency: string;
}

interface VirtualAccount {
  id: string;
  name: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  currency: string;
  balance: string;
  type: string;
  status: string;
  createdAt: string;
}

interface Transaction {
  id: string;
  type: string;
  description: string;
  amount: string;
  fee: string;
  status: string;
  date: string;
  currency: string;
}

export default function WalletScreen() {
  const { data: balance, isLoading: balanceLoading, refetch: refetchBalance } = useQuery({
    queryKey: ['/api/balances'],
    queryFn: () => api.get<Balance>('/api/balances'),
  });

  const { data: virtualAccounts, isLoading: virtualAccountsLoading, refetch: refetchVirtualAccounts } = useQuery({
    queryKey: ['/api/virtual-accounts'],
    queryFn: () => api.get<VirtualAccount[]>('/api/virtual-accounts'),
  });

  const { data: transactions, isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery({
    queryKey: ['/api/transactions'],
    queryFn: () => api.get<Transaction[]>('/api/transactions'),
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchBalance(), refetchVirtualAccounts(), refetchTransactions()]);
    setRefreshing(false);
  };

  const formatCurrency = (amount: string | number, currency: string = 'USD') => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(numAmount);
  };

  const maskAccountNumber = (accountNumber: string): string => {
    if (accountNumber.length <= 4) return accountNumber;
    const lastFour = accountNumber.slice(-4);
    return `****${lastFour}`;
  };

  const getTransactionIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('deposit')) return 'arrow-down';
    if (lowerType.includes('payout') || lowerType.includes('bill')) return 'arrow-up';
    return 'swap-horizontal';
  };

  const getTransactionColor = (type: string): string => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('deposit')) return '#34D399';
    if (lowerType.includes('payout') || lowerType.includes('bill')) return '#F87171';
    return '#818CF8';
  };

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return styles.statusActive;
      case 'inactive':
        return styles.statusInactive;
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

  const isLoading = balanceLoading || virtualAccountsLoading || transactionsLoading;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer} testID="loading-wallet">
        <ActivityIndicator size="large" color="#818CF8" />
      </View>
    );
  }

  const localBalance = balance ? parseFloat(balance.local) : 0;
  const usdBalance = balance ? parseFloat(balance.usd) : 0;
  const escrowBalance = balance ? parseFloat(balance.escrow) : 0;
  const localCurrency = balance?.localCurrency || 'USD';

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

      <View style={styles.mainBalanceCard}>
        <Text style={styles.balanceLabel}>Total Available</Text>
        <Text style={styles.mainBalance} testID="text-main-balance">
          {formatCurrency(localBalance, localCurrency)}
        </Text>
        <Text style={styles.currencyLabel}>{localCurrency}</Text>

        {(usdBalance > 0 || escrowBalance > 0) && (
          <View style={styles.subBalancesContainer}>
            {usdBalance > 0 && (
              <View style={styles.subBalance}>
                <Text style={styles.subBalanceLabel}>USD</Text>
                <Text style={styles.subBalanceAmount}>{formatCurrency(usdBalance, 'USD')}</Text>
              </View>
            )}
            {escrowBalance > 0 && (
              <View style={styles.subBalance}>
                <Text style={styles.subBalanceLabel}>Escrow</Text>
                <Text style={styles.subBalanceAmount}>{formatCurrency(escrowBalance, localCurrency)}</Text>
              </View>
            )}
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

      {virtualAccounts && virtualAccounts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Virtual Accounts</Text>
          {virtualAccounts.map((account) => (
            <TouchableOpacity
              key={account.id}
              style={styles.virtualAccountCard}
              testID={`virtual-account-${account.id}`}
            >
              <View style={styles.accountIconContainer}>
                <Ionicons name="card" size={24} color="#818CF8" />
              </View>
              <View style={styles.accountDetailsLeft}>
                <Text style={styles.accountName}>{account.name}</Text>
                <Text style={styles.accountNumber}>{maskAccountNumber(account.accountNumber)}</Text>
                <Text style={styles.accountBank}>{account.bankName}</Text>
              </View>
              <View style={styles.accountDetailsRight}>
                <Text style={styles.accountBalance} testID={`account-balance-${account.id}`}>
                  {formatCurrency(account.balance, account.currency)}
                </Text>
                <View style={[styles.accountStatusBadge, getStatusStyle(account.status)]}>
                  <Text style={styles.accountStatusText}>{account.status}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {(!virtualAccounts || virtualAccounts.length === 0) && (
        <View style={styles.section}>
          <View style={styles.emptyContainer} testID="empty-virtual-accounts">
            <Ionicons name="card-outline" size={48} color="#334155" />
            <Text style={styles.emptyText}>No virtual accounts</Text>
            <Text style={styles.emptySubtext}>Create a virtual account to get started</Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity testID="link-view-all-transactions">
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>

        {transactions && transactions.length > 0 ? (
          transactions.slice(0, 10).map((tx) => (
            <TouchableOpacity key={tx.id} style={styles.txItem} testID={`transaction-${tx.id}`}>
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
                  {getTransactionColor(tx.type) === '#34D399' ? '+' : '-'}
                  {formatCurrency(Math.abs(parseFloat(tx.amount)), tx.currency)}
                </Text>
                <View style={[styles.txStatusBadge, getStatusStyle(tx.status)]}>
                  <Text style={styles.txStatusText}>{tx.status}</Text>
                </View>
                <Text style={styles.txDate}>{new Date(tx.date).toLocaleDateString()}</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyContainer} testID="empty-transactions">
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
  mainBalanceCard: {
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  mainBalance: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  currencyLabel: {
    fontSize: 12,
    color: '#818CF8',
    marginTop: 4,
  },
  subBalancesContainer: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  subBalance: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
  },
  subBalanceLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  subBalanceAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E2E8F0',
    marginTop: 4,
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
  virtualAccountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  accountIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accountDetailsLeft: {
    flex: 1,
  },
  accountName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  accountNumber: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  accountBank: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  accountDetailsRight: {
    alignItems: 'flex-end',
  },
  accountBalance: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  accountStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  accountStatusText: {
    fontSize: 10,
    color: '#FFFFFF',
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  statusActive: {
    backgroundColor: '#065F46',
  },
  statusInactive: {
    backgroundColor: '#4B5563',
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
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
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
