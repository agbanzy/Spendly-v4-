import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface Transaction {
  id: string;
  type: string;
  amount: string;
  fee: string;
  status: string;
  date: string;
  description: string;
  currency: string;
}

const TransactionItem = ({ item }: { item: Transaction }) => {
  const isCredit = item.type === 'Funding' || item.type === 'Credit';
  const amount = parseFloat(item.amount);
  
  const getIcon = () => {
    switch (item.type) {
      case 'Funding':
        return 'arrow-down-circle';
      case 'Withdrawal':
      case 'Payout':
        return 'arrow-up-circle';
      case 'Transfer':
        return 'swap-horizontal';
      default:
        return 'cash';
    }
  };

  const getColor = () => {
    if (item.status === 'Failed') return '#ef4444';
    if (item.status === 'Pending') return '#f59e0b';
    return isCredit ? '#22c55e' : '#ef4444';
  };

  return (
    <TouchableOpacity style={styles.transactionItem}>
      <View style={[styles.iconContainer, { backgroundColor: `${getColor()}20` }]}>
        <Ionicons name={getIcon()} size={24} color={getColor()} />
      </View>
      <View style={styles.transactionInfo}>
        <Text style={styles.transactionType}>{item.type}</Text>
        <Text style={styles.transactionDesc}>{item.description}</Text>
        <Text style={styles.transactionDate}>{item.date}</Text>
      </View>
      <View style={styles.amountContainer}>
        <Text style={[styles.amount, { color: getColor() }]}>
          {isCredit ? '+' : '-'}${amount.toFixed(2)}
        </Text>
        <Text style={[styles.status, { color: getColor() }]}>{item.status}</Text>
      </View>
    </TouchableOpacity>
  );
};

export default function TransactionsScreen() {
  const [filter, setFilter] = useState<string>('all');
  
  const { data: transactions = [], isLoading, refetch, isRefetching } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions'],
    queryFn: () => api.get('/api/transactions'),
  });

  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'all') return true;
    if (filter === 'in') return tx.type === 'Funding' || tx.type === 'Credit';
    if (filter === 'out') return tx.type === 'Withdrawal' || tx.type === 'Payout';
    return true;
  });

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'in', label: 'Money In' },
    { key: 'out', label: 'Money Out' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
      </View>

      <View style={styles.filterContainer}>
        {filters.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterButton,
              filter === f.key && styles.filterButtonActive,
            ]}
            onPress={() => setFilter(f.key)}
          >
            <Text
              style={[
                styles.filterText,
                filter === f.key && styles.filterTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TransactionItem item={item} />}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={64} color="#94a3b8" />
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 20,
    backgroundColor: '#4F46E5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
  },
  filterButtonActive: {
    backgroundColor: '#4F46E5',
  },
  filterText: {
    fontSize: 14,
    color: '#64748b',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  transactionDesc: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
  },
  status: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 12,
  },
});
