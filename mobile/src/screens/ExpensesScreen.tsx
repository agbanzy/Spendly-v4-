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
}

const categories = ['Food', 'Transport', 'Office', 'Travel', 'Software', 'Other'];

export default function ExpensesScreen() {
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other');
  const [merchant, setMerchant] = useState('');

  const { data: expenses, isLoading, refetch } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api.get<Expense[]>('/api/expenses'),
  });

  const createExpense = useMutation({
    mutationFn: (data: { description: string; amount: number; category: string; merchant?: string }) =>
      api.post('/api/expenses', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setModalVisible(false);
      resetForm();
      Alert.alert('Success', 'Expense created successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to create expense');
    },
  });

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCategory('Other');
    setMerchant('');
  };

  const handleSubmit = () => {
    if (!description || !amount) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    createExpense.mutate({
      description,
      amount: parseFloat(amount),
      category,
      merchant: merchant || undefined,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const renderExpense = ({ item }: { item: Expense }) => (
    <View style={styles.expenseCard}>
      <View style={styles.expenseIcon}>
        <Ionicons name="receipt-outline" size={20} color="#94A3B8" />
      </View>
      <View style={styles.expenseContent}>
        <Text style={styles.expenseDescription}>{item.description}</Text>
        <Text style={styles.expenseMeta}>
          {item.category} {item.merchant ? `- ${item.merchant}` : ''}
        </Text>
      </View>
      <View style={styles.expenseRight}>
        <Text style={styles.expenseAmount}>{formatCurrency(item.amount)}</Text>
        <Text style={styles.expenseDate}>{formatDate(item.date)}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Expenses</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
          testID="button-add-expense"
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderExpense}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#818CF8" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={48} color="#64748B" />
            <Text style={styles.emptyText}>No expenses yet</Text>
            <Text style={styles.emptySubtext}>Tap + to add your first expense</Text>
          </View>
        }
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)} testID="button-close-modal">
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Expense</Text>
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
              testID="input-description"
            />

            <Text style={styles.label}>Amount *</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor="#64748B"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              testID="input-amount"
            />

            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryContainer}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, category === cat && styles.categoryChipSelected]}
                  onPress={() => setCategory(cat)}
                  testID={`button-category-${cat.toLowerCase()}`}
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
              testID="input-merchant"
            />

            <TouchableOpacity
              style={[styles.submitButton, createExpense.isPending && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={createExpense.isPending}
              testID="button-submit-expense"
            >
              {createExpense.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Create Expense</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 20,
    paddingTop: 0,
  },
  expenseCard: {
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
  expenseContent: {
    flex: 1,
    marginLeft: 12,
  },
  expenseDescription: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  expenseMeta: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 14,
    color: '#F87171',
    fontWeight: '600',
  },
  expenseDate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  form: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryChipSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  categoryText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  categoryTextSelected: {
    color: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
