import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

interface Expense {
  id: number;
  description: string;
  amount: number;
  category: string;
  status: string;
  date: string;
  merchant?: string;
  currency?: string;
}

const categories = ['Software', 'Travel', 'Office', 'Marketing', 'Food', 'Equipment', 'Utilities', 'Legal', 'Other'];
const statusFilters = ['all', 'pending', 'approved', 'rejected'];

export default function ExpensesScreen() {
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other');
  const [merchant, setMerchant] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: expenses, isLoading, refetch } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api.get<Expense[]>('/api/expenses'),
  });

  const createExpense = useMutation({
    mutationFn: (data: { description: string; amount: number; category: string; merchant?: string }) =>
      api.post('/api/expenses', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      closeModal();
      Alert.alert('Success', 'Expense created successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to create expense');
    },
  });

  const updateExpense = useMutation({
    mutationFn: (data: { id: number; description: string; amount: number; category: string; merchant?: string }) =>
      api.put(`/api/expenses/${data.id}`, { description: data.description, amount: data.amount, category: data.category, merchant: data.merchant }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      closeModal();
      Alert.alert('Success', 'Expense updated successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to update expense');
    },
  });

  const deleteExpense = useMutation({
    mutationFn: (id: number) => api.delete(`/api/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      Alert.alert('Success', 'Expense deleted');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to delete expense');
    },
  });

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCategory('Other');
    setMerchant('');
    setEditingExpense(null);
  };

  const closeModal = () => {
    setModalVisible(false);
    resetForm();
  };

  const openCreateModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setDescription(expense.description);
    setAmount(String(expense.amount));
    setCategory(expense.category);
    setMerchant(expense.merchant || '');
    setModalVisible(true);
  };

  const handleDelete = (expense: Expense) => {
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete "${expense.description}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteExpense.mutate(expense.id) },
      ]
    );
  };

  const handleSubmit = () => {
    if (!description || !amount) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (editingExpense) {
      updateExpense.mutate({
        id: editingExpense.id,
        description,
        amount: parseFloat(amount),
        category,
        merchant: merchant || undefined,
      });
    } else {
      createExpense.mutate({
        description,
        amount: parseFloat(amount),
        category,
        merchant: merchant || undefined,
      });
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved': return '#10B981';
      case 'pending': return '#F59E0B';
      case 'rejected': return '#EF4444';
      default: return '#94A3B8';
    }
  };

  const filteredExpenses = (expenses || []).filter((expense) => {
    const matchesSearch = searchQuery === '' ||
      expense.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.merchant?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || expense.status?.toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const isPending = createExpense.isPending || updateExpense.isPending;

  const renderExpense = ({ item }: { item: Expense }) => (
    <TouchableOpacity style={styles.expenseCard} onPress={() => openEditModal(item)} onLongPress={() => handleDelete(item)}>
      <View style={styles.expenseIcon}>
        <Ionicons name="receipt-outline" size={20} color="#818CF8" />
      </View>
      <View style={styles.expenseContent}>
        <Text style={styles.expenseDescription}>{item.description}</Text>
        <Text style={styles.expenseMeta}>
          {item.category}{item.merchant ? ` - ${item.merchant}` : ''}
        </Text>
      </View>
      <View style={styles.expenseRight}>
        <Text style={styles.expenseAmount}>{formatCurrency(item.amount, item.currency)}</Text>
        <View style={styles.expenseStatusRow}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
          <Text style={[styles.expenseStatus, { color: getStatusColor(item.status) }]}>{item.status}</Text>
        </View>
        <Text style={styles.expenseDate}>{formatDate(item.date)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Expenses</Text>
        <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#64748B" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search expenses..."
          placeholderTextColor="#64748B"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#64748B" />
          </TouchableOpacity>
        )}
      </View>

      {/* Status Filters */}
      <View style={styles.filterRow}>
        {statusFilters.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, statusFilter === f && styles.filterChipActive]}
            onPress={() => setStatusFilter(f)}
          >
            <Text style={[styles.filterChipText, statusFilter === f && styles.filterChipTextActive]}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderExpense}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#818CF8" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={48} color="#334155" />
            <Text style={styles.emptyText}>No expenses found</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery || statusFilter !== 'all' ? 'Try different filters' : 'Tap + to add your first expense'}
            </Text>
          </View>
        }
      />

      {/* Create/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeModal}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingExpense ? 'Edit Expense' : 'New Expense'}</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={styles.input}
              placeholder="What did you spend on?"
              placeholderTextColor="#64748B"
              value={description}
              onChangeText={setDescription}
            />

            <Text style={styles.label}>Amount *</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor="#64748B"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryContainer}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, category === cat && styles.categoryChipSelected]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.categoryText, category === cat && styles.categoryTextSelected]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Merchant (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Store or vendor name"
              placeholderTextColor="#64748B"
              value={merchant}
              onChangeText={setMerchant}
            />

            <TouchableOpacity
              style={[styles.submitButton, isPending && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isPending}
            >
              {isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {editingExpense ? 'Update Expense' : 'Create Expense'}
                </Text>
              )}
            </TouchableOpacity>

            {editingExpense && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  closeModal();
                  handleDelete(editingExpense);
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                <Text style={styles.deleteButtonText}>Delete Expense</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: '#FFFFFF' },
  addButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E293B', borderRadius: 12,
    marginHorizontal: 20, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#334155',
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#FFFFFF' },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155',
  },
  filterChipActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  filterChipText: { fontSize: 13, color: '#94A3B8' },
  filterChipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  listContent: { padding: 20, paddingTop: 0 },
  expenseCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E293B', borderRadius: 12,
    padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#334155',
  },
  expenseIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center',
  },
  expenseContent: { flex: 1, marginLeft: 12 },
  expenseDescription: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  expenseMeta: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  expenseRight: { alignItems: 'flex-end' },
  expenseAmount: { fontSize: 14, color: '#F87171', fontWeight: '600' },
  expenseStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  expenseStatus: { fontSize: 11, fontWeight: '500', textTransform: 'capitalize' },
  expenseDate: { fontSize: 11, color: '#64748B', marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, color: '#94A3B8', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#64748B', marginTop: 4 },
  modalContainer: { flex: 1, backgroundColor: '#0F172A' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#334155',
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#FFFFFF' },
  form: { padding: 20 },
  label: { fontSize: 14, color: '#94A3B8', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#1E293B', borderRadius: 12, padding: 16,
    fontSize: 16, color: '#FFFFFF', borderWidth: 1, borderColor: '#334155',
  },
  categoryContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155',
  },
  categoryChipSelected: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  categoryText: { fontSize: 14, color: '#94A3B8' },
  categoryTextSelected: { color: '#FFFFFF' },
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
