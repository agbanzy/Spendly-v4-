import React from 'react';
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

interface Budget {
  id: number;
  category: string;
  limit: string;
  spent: string;
  period: string;
}

const BudgetItem = ({ item }: { item: Budget }) => {
  const limit = parseFloat(item.limit);
  const spent = parseFloat(item.spent);
  const percentage = limit > 0 ? (spent / limit) * 100 : 0;
  const remaining = limit - spent;
  
  const getColor = () => {
    if (percentage >= 100) return '#ef4444';
    if (percentage >= 80) return '#f59e0b';
    return '#22c55e';
  };

  const getCategoryIcon = () => {
    const icons: { [key: string]: any } = {
      'Software': 'code-slash',
      'Travel': 'airplane',
      'Office': 'business',
      'Marketing': 'megaphone',
      'Food': 'restaurant',
      'Equipment': 'hardware-chip',
      'Utilities': 'flash',
      'Legal': 'document-text',
    };
    return icons[item.category] || 'folder';
  };

  return (
    <View style={styles.budgetItem}>
      <View style={styles.budgetHeader}>
        <View style={styles.categoryContainer}>
          <View style={[styles.iconContainer, { backgroundColor: `${getColor()}20` }]}>
            <Ionicons name={getCategoryIcon()} size={20} color={getColor()} />
          </View>
          <View>
            <Text style={styles.categoryName}>{item.category}</Text>
            <Text style={styles.period}>{item.period}</Text>
          </View>
        </View>
        <View style={styles.amountInfo}>
          <Text style={styles.spent}>${spent.toFixed(2)}</Text>
          <Text style={styles.limit}>of ${limit.toFixed(2)}</Text>
        </View>
      </View>
      
      <View style={styles.progressContainer}>
        <View style={styles.progressBackground}>
          <View
            style={[
              styles.progressBar,
              { width: `${Math.min(percentage, 100)}%`, backgroundColor: getColor() },
            ]}
          />
        </View>
        <Text style={[styles.percentage, { color: getColor() }]}>
          {percentage.toFixed(0)}%
        </Text>
      </View>
      
      <View style={styles.remainingContainer}>
        <Text style={styles.remainingLabel}>
          {remaining >= 0 ? 'Remaining' : 'Over budget'}
        </Text>
        <Text style={[styles.remainingAmount, { color: remaining >= 0 ? '#22c55e' : '#ef4444' }]}>
          ${Math.abs(remaining).toFixed(2)}
        </Text>
      </View>
    </View>
  );
};

export default function BudgetScreen() {
  const { data: budgets = [], isLoading, refetch, isRefetching } = useQuery<Budget[]>({
    queryKey: ['/api/budgets'],
    queryFn: () => api.get('/api/budgets'),
  });

  const totalLimit = budgets.reduce((sum, b) => sum + parseFloat(b.limit), 0);
  const totalSpent = budgets.reduce((sum, b) => sum + parseFloat(b.spent), 0);
  const overallPercentage = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Budgets</Text>
        <TouchableOpacity style={styles.addButton}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Total Budget Usage</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summarySpent}>${totalSpent.toFixed(2)}</Text>
          <Text style={styles.summaryLimit}>/ ${totalLimit.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryProgress}>
          <View style={styles.progressBackground}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${Math.min(overallPercentage, 100)}%`,
                  backgroundColor: overallPercentage >= 80 ? '#ef4444' : '#4F46E5',
                },
              ]}
            />
          </View>
        </View>
        <Text style={styles.summaryPercentage}>{overallPercentage.toFixed(1)}% used</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : (
        <FlatList
          data={budgets}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => <BudgetItem item={item} />}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="pie-chart-outline" size={64} color="#94a3b8" />
              <Text style={styles.emptyText}>No budgets set</Text>
              <Text style={styles.emptySubtext}>Create a budget to track spending</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#4F46E5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  summarySpent: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  summaryLimit: {
    fontSize: 16,
    color: '#94a3b8',
    marginLeft: 4,
  },
  summaryProgress: {
    marginTop: 16,
  },
  summaryPercentage: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'right',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
    paddingTop: 0,
  },
  budgetItem: {
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
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  period: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  amountInfo: {
    alignItems: 'flex-end',
  },
  spent: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  limit: {
    fontSize: 12,
    color: '#94a3b8',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  percentage: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  remainingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  remainingLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  remainingAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
});
