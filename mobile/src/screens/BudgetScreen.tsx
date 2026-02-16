import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

interface Budget {
  id: number;
  name?: string;
  category: string;
  limit: string;
  spent: string;
  period: string;
}

const categories = ['Software', 'Travel', 'Office', 'Marketing', 'Food', 'Equipment', 'Utilities', 'Legal', 'Other'];
const periods = ['monthly', 'quarterly', 'yearly'];

export default function BudgetScreen() {
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [budgetName, setBudgetName] = useState('');
  const [budgetCategory, setBudgetCategory] = useState('Other');
  const [budgetLimit, setBudgetLimit] = useState('');
  const [budgetPeriod, setBudgetPeriod] = useState('monthly');

  const { data: budgets = [], isLoading, refetch, isRefetching } = useQuery<Budget[]>({
    queryKey: ['/api/budgets'],
    queryFn: () => api.get('/api/budgets'),
  });

  const createBudget = useMutation({
    mutationFn: (data: { name?: string; category: string; limit: number; period: string }) =>
      api.post('/api/budgets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/budgets'] });
      closeModal();
      Alert.alert('Success', 'Budget created successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to create budget');
    },
  });

  const updateBudget = useMutation({
    mutationFn: (data: { id: number; name?: string; category: string; limit: number; period: string }) =>
      api.put(`/api/budgets/${data.id}`, { name: data.name, category: data.category, limit: data.limit, period: data.period }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/budgets'] });
      closeModal();
      Alert.alert('Success', 'Budget updated successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to update budget');
    },
  });

  const deleteBudget = useMutation({
    mutationFn: (id: number) => api.delete(`/api/budgets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/budgets'] });
      Alert.alert('Success', 'Budget deleted');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to delete budget');
    },
  });

  const resetForm = () => {
    setBudgetName('');
    setBudgetCategory('Other');
    setBudgetLimit('');
    setBudgetPeriod('monthly');
    setEditingBudget(null);
  };

  const closeModal = () => {
    setModalVisible(false);
    resetForm();
  };

  const openCreateModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (budget: Budget) => {
    setEditingBudget(budget);
    setBudgetName(budget.name || '');
    setBudgetCategory(budget.category);
    setBudgetLimit(budget.limit);
    setBudgetPeriod(budget.period);
    setModalVisible(true);
  };

  const handleDelete = (budget: Budget) => {
    Alert.alert(
      'Delete Budget',
      `Are you sure you want to delete the ${budget.category} budget?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteBudget.mutate(budget.id) },
      ]
    );
  };

  const handleSubmit = () => {
    if (!budgetLimit || parseFloat(budgetLimit) <= 0) {
      Alert.alert('Error', 'Please enter a valid budget limit');
      return;
    }

    const data = {
      name: budgetName || undefined,
      category: budgetCategory,
      limit: parseFloat(budgetLimit),
      period: budgetPeriod,
    };

    if (editingBudget) {
      updateBudget.mutate({ ...data, id: editingBudget.id });
    } else {
      createBudget.mutate(data);
    }
  };

  const isPending = createBudget.isPending || updateBudget.isPending;

  const totalLimit = budgets.reduce((sum, b) => sum + parseFloat(b.limit), 0);
  const totalSpent = budgets.reduce((sum, b) => sum + parseFloat(b.spent), 0);
  const overallPercentage = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;

  const getCategoryIcon = (category: string): keyof typeof Ionicons.glyphMap => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
      'Software': 'code-slash',
      'Travel': 'airplane',
      'Office': 'business',
      'Marketing': 'megaphone',
      'Food': 'restaurant',
      'Equipment': 'hardware-chip',
      'Utilities': 'flash',
      'Legal': 'document-text',
    };
    return icons[category] || 'folder';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return '#EF4444';
    if (percentage >= 80) return '#F59E0B';
    return '#10B981';
  };

  const renderBudget = ({ item }: { item: Budget }) => {
    const limit = parseFloat(item.limit);
    const spent = parseFloat(item.spent);
    const percentage = limit > 0 ? (spent / limit) * 100 : 0;
    const remaining = limit - spent;
    const color = getProgressColor(percentage);

    return (
      <TouchableOpacity style={styles.budgetCard} onPress={() => openEditModal(item)} onLongPress={() => handleDelete(item)}>
        <View style={styles.budgetHeader}>
          <View style={styles.budgetCategoryRow}>
            <View style={[styles.budgetIconContainer, { backgroundColor: color + '20' }]}>
              <Ionicons name={getCategoryIcon(item.category)} size={18} color={color} />
            </View>
            <View>
              <Text style={styles.budgetCategoryName}>{item.name || item.category}</Text>
              <Text style={styles.budgetPeriod}>{item.period}</Text>
            </View>
          </View>
          <View style={styles.budgetAmounts}>
            <Text style={styles.budgetSpent}>${spent.toFixed(2)}</Text>
            <Text style={styles.budgetLimit}>of ${limit.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.progressRow}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${Math.min(percentage, 100)}%`, backgroundColor: color }]} />
          </View>
          <Text style={[styles.progressPct, { color }]}>{percentage.toFixed(0)}%</Text>
        </View>

        <View style={styles.remainingRow}>
          <Text style={styles.remainingLabel}>{remaining >= 0 ? 'Remaining' : 'Over budget'}</Text>
          <Text style={[styles.remainingAmount, { color: remaining >= 0 ? '#10B981' : '#EF4444' }]}>
            ${Math.abs(remaining).toFixed(2)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Budgets</Text>
        <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Total Budget Usage</Text>
        <View style={styles.summaryAmountRow}>
          <Text style={styles.summarySpent}>${totalSpent.toFixed(2)}</Text>
          <Text style={styles.summaryLimit}>/ ${totalLimit.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryProgressRow}>
          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(overallPercentage, 100)}%`,
                  backgroundColor: overallPercentage >= 80 ? '#EF4444' : '#818CF8',
                },
              ]}
            />
          </View>
        </View>
        <Text style={styles.summaryPct}>{overallPercentage.toFixed(1)}% used</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#818CF8" />
        </View>
      ) : (
        <FlatList
          data={budgets}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderBudget}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#818CF8" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="pie-chart-outline" size={48} color="#334155" />
              <Text style={styles.emptyText}>No budgets set</Text>
              <Text style={styles.emptySubtext}>Create a budget to track spending</Text>
            </View>
          }
        />
      )}

      {/* Create/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeModal}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingBudget ? 'Edit Budget' : 'New Budget'}</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalLabel}>Budget Name (Optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Q1 Marketing Budget"
              placeholderTextColor="#64748B"
              value={budgetName}
              onChangeText={setBudgetName}
            />

            <Text style={styles.modalLabel}>Category</Text>
            <View style={styles.chipContainer}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, budgetCategory === cat && styles.chipActive]}
                  onPress={() => setBudgetCategory(cat)}
                >
                  <Text style={[styles.chipText, budgetCategory === cat && styles.chipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Budget Limit *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="0.00"
              placeholderTextColor="#64748B"
              value={budgetLimit}
              onChangeText={setBudgetLimit}
              keyboardType="decimal-pad"
            />

            <Text style={styles.modalLabel}>Period</Text>
            <View style={styles.chipContainer}>
              {periods.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.chip, budgetPeriod === p && styles.chipActive]}
                  onPress={() => setBudgetPeriod(p)}
                >
                  <Text style={[styles.chipText, budgetPeriod === p && styles.chipTextActive]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isPending && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isPending}
            >
              {isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {editingBudget ? 'Update Budget' : 'Create Budget'}
                </Text>
              )}
            </TouchableOpacity>

            {editingBudget && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  closeModal();
                  handleDelete(editingBudget);
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                <Text style={styles.deleteButtonText}>Delete Budget</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF' },
  addButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center',
  },
  summaryCard: {
    backgroundColor: '#1E293B', marginHorizontal: 20, marginBottom: 16,
    padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#334155',
  },
  summaryTitle: { fontSize: 14, color: '#94A3B8', marginBottom: 8 },
  summaryAmountRow: { flexDirection: 'row', alignItems: 'baseline' },
  summarySpent: { fontSize: 28, fontWeight: 'bold', color: '#FFFFFF' },
  summaryLimit: { fontSize: 16, color: '#64748B', marginLeft: 4 },
  summaryProgressRow: { marginTop: 16 },
  summaryPct: { fontSize: 12, color: '#94A3B8', marginTop: 8, textAlign: 'right' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContainer: { padding: 20, paddingTop: 0 },
  budgetCard: {
    backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#334155',
  },
  budgetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  budgetCategoryRow: { flexDirection: 'row', alignItems: 'center' },
  budgetIconContainer: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  budgetCategoryName: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  budgetPeriod: { fontSize: 12, color: '#64748B', marginTop: 2, textTransform: 'capitalize' },
  budgetAmounts: { alignItems: 'flex-end' },
  budgetSpent: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  budgetLimit: { fontSize: 12, color: '#64748B' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressBg: {
    flex: 1, height: 8, backgroundColor: '#334155', borderRadius: 4, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  progressPct: { fontSize: 12, fontWeight: '600', minWidth: 40, textAlign: 'right' },
  remainingRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 12,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155',
  },
  remainingLabel: { fontSize: 13, color: '#94A3B8' },
  remainingAmount: { fontSize: 14, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#94A3B8', marginTop: 12 },
  emptySubtext: { fontSize: 14, color: '#64748B', marginTop: 4 },
  // Modal
  modalContainer: { flex: 1, backgroundColor: '#0F172A' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#334155',
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#FFFFFF' },
  modalForm: { padding: 20 },
  modalLabel: { fontSize: 14, color: '#94A3B8', marginBottom: 8, marginTop: 16 },
  modalInput: {
    backgroundColor: '#1E293B', borderRadius: 12, padding: 16,
    fontSize: 16, color: '#FFFFFF', borderWidth: 1, borderColor: '#334155',
  },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155',
  },
  chipActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  chipText: { fontSize: 14, color: '#94A3B8' },
  chipTextActive: { color: '#FFFFFF' },
  submitButton: {
    backgroundColor: '#4F46E5', borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 32,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  deleteButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 16, padding: 16,
  },
  deleteButtonText: { color: '#EF4444', fontSize: 14, fontWeight: '500' },
});
