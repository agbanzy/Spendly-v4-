import React, { useState, useMemo } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import { api } from '../lib/api';
import { useTheme } from '../lib/theme-context';
import { ColorTokens } from '../lib/colors';

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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other');
  const [merchant, setMerchant] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);

  const { data: expenses, isLoading, refetch } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api.get<Expense[]>('/api/expenses'),
  });

  const createExpense = useMutation({
    mutationFn: (data: { description: string; amount: number; category: string; merchant?: string }) =>
      api.post('/api/expenses', { description: data.description, amount: data.amount, category: data.category, merchant: data.merchant || undefined }),
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
      api.patch(`/api/expenses/${data.id}`, { description: data.description, amount: data.amount, category: data.category, merchant: data.merchant || undefined }),
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
    setReceiptUri(null);
    setEditingExpense(null);
  };

  const closeModal = () => {
    setModalVisible(false);
    resetForm();
  };

  const pickReceipt = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setReceiptUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setReceiptUri(result.assets[0].uri);
    }
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
    if (!description.trim() || !amount.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount greater than zero');
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
      case 'approved': return colors.success;
      case 'pending': return colors.warning;
      case 'rejected': return colors.danger;
      default: return colors.textSecondary;
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
        <Ionicons name="receipt-outline" size={20} color={colors.accent} />
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
          <Ionicons name="add" size={24} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search expenses..."
          placeholderTextColor={colors.placeholderText}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
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
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={48} color={colors.border} />
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
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingExpense ? 'Edit Expense' : 'New Expense'}</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={styles.input}
              placeholder="What did you spend on?"
              placeholderTextColor={colors.placeholderText}
              value={description}
              onChangeText={setDescription}
            />

            <Text style={styles.label}>Amount *</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={colors.placeholderText}
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
              placeholderTextColor={colors.placeholderText}
              value={merchant}
              onChangeText={setMerchant}
            />

            <Text style={styles.label}>Receipt (Optional)</Text>
            <View style={styles.receiptSection}>
              {receiptUri ? (
                <View style={styles.receiptPreview}>
                  <Ionicons name="document-attach" size={24} color={colors.accent} />
                  <Text style={styles.receiptFileName} numberOfLines={1}>Receipt attached</Text>
                  <TouchableOpacity onPress={() => setReceiptUri(null)}>
                    <Ionicons name="close-circle" size={20} color={colors.dangerLight} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.receiptButtons}>
                  <TouchableOpacity style={styles.receiptButton} onPress={takePhoto}>
                    <Ionicons name="camera-outline" size={20} color={colors.accent} />
                    <Text style={styles.receiptButtonText}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.receiptButton} onPress={pickReceipt}>
                    <Ionicons name="image-outline" size={20} color={colors.accent} />
                    <Text style={styles.receiptButtonText}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isPending && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isPending}
            >
              {isPending ? (
                <ActivityIndicator color={colors.primaryForeground} />
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
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={styles.deleteButtonText}>Delete Expense</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 16,
    },
    title: { fontSize: 28, fontWeight: 'bold', color: colors.textPrimary },
    addButton: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    },
    searchContainer: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.surface, borderRadius: 12,
      marginHorizontal: 20, marginBottom: 12,
      paddingHorizontal: 14, paddingVertical: 10,
      borderWidth: 1, borderColor: colors.border,
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: colors.inputText },
    filterRow: {
      flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 12,
    },
    filterChip: {
      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterChipText: { fontSize: 13, color: colors.textSecondary },
    filterChipTextActive: { color: colors.primaryForeground, fontWeight: '600' },
    listContent: { padding: 20, paddingTop: 0 },
    expenseCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.surface, borderRadius: 12,
      padding: 16, marginBottom: 8, borderWidth: 1, borderColor: colors.border,
    },
    expenseIcon: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center',
    },
    expenseContent: { flex: 1, marginLeft: 12 },
    expenseDescription: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
    expenseMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    expenseRight: { alignItems: 'flex-end' },
    expenseAmount: { fontSize: 14, color: colors.colorRed, fontWeight: '600' },
    expenseStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    expenseStatus: { fontSize: 11, fontWeight: '500', textTransform: 'capitalize' },
    expenseDate: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { fontSize: 16, color: colors.textSecondary, marginTop: 16 },
    emptySubtext: { fontSize: 14, color: colors.textTertiary, marginTop: 4 },
    modalContainer: { flex: 1, backgroundColor: colors.background },
    modalHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    modalTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
    form: { padding: 20 },
    label: { fontSize: 14, color: colors.textSecondary, marginBottom: 8, marginTop: 16 },
    input: {
      backgroundColor: colors.inputBackground, borderRadius: 12, padding: 16,
      fontSize: 16, color: colors.inputText, borderWidth: 1, borderColor: colors.inputBorder,
    },
    categoryContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    categoryChip: {
      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    categoryChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    categoryText: { fontSize: 14, color: colors.textSecondary },
    categoryTextSelected: { color: colors.primaryForeground },
    submitButton: {
      backgroundColor: colors.primary, borderRadius: 12, padding: 16,
      alignItems: 'center', marginTop: 32,
    },
    submitButtonDisabled: { opacity: 0.7 },
    submitButtonText: { color: colors.primaryForeground, fontSize: 16, fontWeight: '600' },
    deleteButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, marginTop: 16, padding: 16,
    },
    deleteButtonText: { color: colors.danger, fontSize: 14, fontWeight: '500' },
    receiptSection: {
      marginTop: 4,
    },
    receiptButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    receiptButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    receiptButtonText: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: '500',
    },
    receiptPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    receiptFileName: {
      flex: 1,
      color: colors.textSoft,
      fontSize: 14,
    },
  });
}
