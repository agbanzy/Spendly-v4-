import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

interface Bill {
  id: number;
  name: string;
  provider: string;
  amount: number;
  status: string;
  dueDate: string;
  category: string;
  recurring?: boolean;
  frequency?: string;
}

const utilityActions = [
  { label: 'Airtime', icon: 'call-outline' as const, testID: 'button-airtime' },
  { label: 'Data', icon: 'wifi-outline' as const, testID: 'button-data' },
  { label: 'Electricity', icon: 'flash-outline' as const, testID: 'button-electricity' },
  { label: 'Cable', icon: 'tv-outline' as const, testID: 'button-cable' },
  { label: 'Internet', icon: 'globe-outline' as const, testID: 'button-internet' },
];

const frequencyOptions = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];

const emptyForm = {
  name: '',
  provider: '',
  amount: '',
  dueDate: '',
  recurring: false,
  frequency: 'monthly',
};

export default function BillsScreen() {
  const queryClient = useQueryClient();

  const { data: bills, isLoading, refetch } = useQuery({
    queryKey: ['bills'],
    queryFn: () => api.get<Bill[]>('/api/bills'),
  });

  const [refreshing, setRefreshing] = React.useState(false);
  const [modalVisible, setModalVisible] = React.useState(false);
  const [editingBill, setEditingBill] = React.useState<Bill | null>(null);
  const [form, setForm] = React.useState(emptyForm);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Bill>('/api/bills', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      closeModal();
    },
    onError: (error: Error) => Alert.alert('Error', error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.patch<Bill>(`/api/bills/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      closeModal();
    },
    onError: (error: Error) => Alert.alert('Error', error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/bills/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
    },
    onError: (error: Error) => Alert.alert('Error', error.message),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const openCreateModal = () => {
    setEditingBill(null);
    setForm(emptyForm);
    setModalVisible(true);
  };

  const openEditModal = (bill: Bill) => {
    setEditingBill(bill);
    setForm({
      name: bill.name,
      provider: bill.provider,
      amount: String(bill.amount),
      dueDate: bill.dueDate ? bill.dueDate.split('T')[0] : '',
      recurring: bill.recurring || false,
      frequency: bill.frequency || 'monthly',
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingBill(null);
    setForm(emptyForm);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.provider.trim() || !form.amount.trim()) {
      Alert.alert('Validation', 'Please fill in name, provider, and amount.');
      return;
    }
    const parsedAmount = parseFloat(form.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Validation', 'Please enter a valid amount greater than zero.');
      return;
    }
    if (form.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.dueDate)) {
      Alert.alert('Validation', 'Please enter date in YYYY-MM-DD format.');
      return;
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      provider: form.provider.trim(),
      amount: parsedAmount,
      dueDate: form.dueDate || undefined,
      recurring: form.recurring,
      frequency: form.recurring ? form.frequency : undefined,
    };

    if (editingBill) {
      updateMutation.mutate({ id: editingBill.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (bill: Bill) => {
    Alert.alert('Delete Bill', `Are you sure you want to delete "${bill.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(bill.id) },
    ]);
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return styles.statusPaid;
      case 'unpaid':
        return styles.statusUnpaid;
      case 'overdue':
        return styles.statusOverdue;
      default:
        return styles.statusUnpaid;
    }
  };

  const getStatusIcon = (status: string): keyof typeof Ionicons.glyphMap => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'checkmark-circle';
      case 'overdue':
        return 'alert-circle';
      default:
        return 'time';
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer} testID="loading-bills">
        <ActivityIndicator size="large" color="#818CF8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818CF8" />
        }
        testID="bills-screen"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.subtitle}>Manage your</Text>
            <Text style={styles.title}>Bills & Payments</Text>
          </View>
          <TouchableOpacity style={styles.headerAddButton} onPress={openCreateModal} testID="button-create-bill">
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.utilityRow}
        >
          {utilityActions.map((action) => (
            <TouchableOpacity key={action.label} style={styles.utilityButton} testID={action.testID}>
              <View style={styles.utilityIcon}>
                <Ionicons name={action.icon} size={24} color="#4F46E5" />
              </View>
              <Text style={styles.utilityLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Bills</Text>
            <TouchableOpacity onPress={openCreateModal} testID="link-view-all-bills">
              <Text style={styles.viewAll}>+ Add New</Text>
            </TouchableOpacity>
          </View>

          {bills?.map((bill) => (
            <TouchableOpacity
              key={bill.id}
              style={styles.billItem}
              onPress={() => openEditModal(bill)}
              onLongPress={() => handleDelete(bill)}
              testID={`bill-item-${bill.id}`}
            >
              <View style={styles.billIcon}>
                <Ionicons name="document-text-outline" size={20} color="#94A3B8" />
              </View>
              <View style={styles.billDetails}>
                <Text style={styles.billName}>{bill.name}</Text>
                <Text style={styles.billProvider}>{bill.provider}</Text>
                <Text style={styles.billDue}>Due: {new Date(bill.dueDate).toLocaleDateString()}</Text>
                {bill.recurring && (
                  <View style={styles.recurringBadge}>
                    <Ionicons name="repeat" size={10} color="#818CF8" />
                    <Text style={styles.recurringText}>{bill.frequency || 'monthly'}</Text>
                  </View>
                )}
              </View>
              <View style={styles.billRight}>
                <Text style={styles.billAmount}>{formatCurrency(bill.amount)}</Text>
                <View style={[styles.statusBadge, getStatusStyle(bill.status)]}>
                  <Ionicons name={getStatusIcon(bill.status)} size={10} color="#FFFFFF" />
                  <Text style={styles.statusText}>{bill.status}</Text>
                </View>
                <View style={styles.actionRow}>
                  <TouchableOpacity onPress={() => openEditModal(bill)} testID={`button-edit-bill-${bill.id}`}>
                    <Ionicons name="create-outline" size={18} color="#818CF8" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(bill)} testID={`button-delete-bill-${bill.id}`}>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {(!bills || bills.length === 0) && !isLoading && (
            <View style={styles.emptyContainer} testID="empty-bills">
              <Ionicons name="document-text-outline" size={48} color="#334155" />
              <Text style={styles.emptyText}>No bills found</Text>
              <Text style={styles.emptySubtext}>Your bills will appear here</Text>
              <TouchableOpacity style={styles.emptyAddButton} onPress={openCreateModal}>
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <Text style={styles.emptyAddButtonText}>Add Bill</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Create / Edit Bill Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent testID="bill-modal">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingBill ? 'Edit Bill' : 'New Bill'}</Text>
              <TouchableOpacity onPress={closeModal} testID="button-close-modal">
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Bill Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Netflix Subscription"
                placeholderTextColor="#64748B"
                value={form.name}
                onChangeText={(val) => setForm({ ...form, name: val })}
                testID="input-bill-name"
              />

              <Text style={styles.inputLabel}>Provider</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Netflix"
                placeholderTextColor="#64748B"
                value={form.provider}
                onChangeText={(val) => setForm({ ...form, provider: val })}
                testID="input-bill-provider"
              />

              <Text style={styles.inputLabel}>Amount</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor="#64748B"
                keyboardType="decimal-pad"
                value={form.amount}
                onChangeText={(val) => setForm({ ...form, amount: val })}
                testID="input-bill-amount"
              />

              <Text style={styles.inputLabel}>Due Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="2026-03-01"
                placeholderTextColor="#64748B"
                value={form.dueDate}
                onChangeText={(val) => setForm({ ...form, dueDate: val })}
                testID="input-bill-due-date"
              />

              <View style={styles.switchRow}>
                <Text style={styles.inputLabel}>Recurring</Text>
                <Switch
                  value={form.recurring}
                  onValueChange={(val) => setForm({ ...form, recurring: val })}
                  trackColor={{ false: '#334155', true: '#4F46E5' }}
                  thumbColor={form.recurring ? '#818CF8' : '#64748B'}
                  testID="switch-recurring"
                />
              </View>

              {form.recurring && (
                <>
                  <Text style={styles.inputLabel}>Frequency</Text>
                  <View style={styles.frequencyRow}>
                    {frequencyOptions.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[
                          styles.frequencyChip,
                          form.frequency === opt && styles.frequencyChipActive,
                        ]}
                        onPress={() => setForm({ ...form, frequency: opt })}
                        testID={`chip-frequency-${opt}`}
                      >
                        <Text
                          style={[
                            styles.frequencyChipText,
                            form.frequency === opt && styles.frequencyChipTextActive,
                          ]}
                        >
                          {opt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeModal}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={isSaving}
                testID="button-save-bill"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>{editingBill ? 'Update' : 'Create'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
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
  headerAddButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  utilityRow: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  utilityButton: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: 80,
  },
  utilityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#312E81',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  utilityLabel: {
    fontSize: 11,
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
  billItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  billIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  billDetails: {
    flex: 1,
    marginLeft: 12,
  },
  billName: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  billProvider: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  billDue: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  recurringText: {
    fontSize: 10,
    color: '#818CF8',
    textTransform: 'capitalize',
  },
  billRight: {
    alignItems: 'flex-end',
  },
  billAmount: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    gap: 4,
  },
  statusPaid: {
    backgroundColor: '#065F46',
  },
  statusUnpaid: {
    backgroundColor: '#92400E',
  },
  statusOverdue: {
    backgroundColor: '#991B1B',
  },
  statusText: {
    fontSize: 10,
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
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
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 20,
    gap: 6,
  },
  emptyAddButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
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
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#334155',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  frequencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  frequencyChip: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  frequencyChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  frequencyChipText: {
    fontSize: 12,
    color: '#94A3B8',
    textTransform: 'capitalize',
  },
  frequencyChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
