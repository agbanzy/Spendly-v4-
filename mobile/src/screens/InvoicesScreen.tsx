import React, { useMemo } from 'react';
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
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useTheme } from '../lib/theme-context';
import { useCompany } from '../lib/company-context';
import { ColorTokens } from '../lib/colors';

interface InvoiceItem {
  description: string;
  amount: number;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  status: string;
  dueDate: string;
  createdAt: string;
  items?: InvoiceItem[];
}

const emptyItem = { description: '', amount: '' };

const emptyForm = {
  clientName: '',
  clientEmail: '',
  dueDate: '',
  items: [{ ...emptyItem }],
};

export default function InvoicesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { activeCompany } = useCompany();

  const queryClient = useQueryClient();
  const companyId = activeCompany?.id;

  const { data: invoices, isLoading, refetch } = useQuery({
    queryKey: ['invoices', companyId],
    queryFn: () => api.get<Invoice[]>('/api/invoices'),
  });

  const [refreshing, setRefreshing] = React.useState(false);
  const [modalVisible, setModalVisible] = React.useState(false);
  const [editingInvoice, setEditingInvoice] = React.useState<Invoice | null>(null);
  const [form, setForm] = React.useState(emptyForm);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Invoice>('/api/invoices', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      closeModal();
    },
    onError: (error: Error) => Alert.alert('Error', error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.patch<Invoice>(`/api/invoices/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      closeModal();
    },
    onError: (error: Error) => Alert.alert('Error', error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error: Error) => Alert.alert('Error', error.message),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const openCreateModal = () => {
    setEditingInvoice(null);
    setForm({ ...emptyForm, items: [{ ...emptyItem }] });
    setModalVisible(true);
  };

  const openEditModal = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setForm({
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail || '',
      dueDate: invoice.dueDate ? invoice.dueDate.split('T')[0] : '',
      items:
        invoice.items && invoice.items.length > 0
          ? invoice.items.map((item) => ({
              description: item.description,
              amount: String(item.amount),
            }))
          : [{ description: '', amount: String(invoice.amount) }],
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingInvoice(null);
    setForm({ ...emptyForm, items: [{ ...emptyItem }] });
  };

  const updateItem = (index: number, field: 'description' | 'amount', value: string) => {
    const newItems = [...form.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setForm({ ...form, items: newItems });
  };

  const addItem = () => {
    setForm({ ...form, items: [...form.items, { ...emptyItem }] });
  };

  const removeItem = (index: number) => {
    if (form.items.length <= 1) return;
    const newItems = form.items.filter((_, i) => i !== index);
    setForm({ ...form, items: newItems });
  };

  const handleSave = () => {
    if (!form.clientName.trim()) {
      Alert.alert('Validation', 'Please enter a client name.');
      return;
    }

    const validItems = form.items.filter(
      (item) => item.description.trim() && item.amount.trim()
    );

    if (validItems.length === 0) {
      Alert.alert('Validation', 'Please add at least one item with description and amount.');
      return;
    }

    const items = validItems.map((item) => ({
      description: item.description.trim(),
      amount: parseFloat(item.amount),
    }));

    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

    if (form.clientEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.clientEmail.trim())) {
      Alert.alert('Validation', 'Please enter a valid email address.');
      return;
    }
    if (items.some(item => isNaN(item.amount) || item.amount <= 0)) {
      Alert.alert('Validation', 'All item amounts must be greater than zero.');
      return;
    }

    const payload: Record<string, unknown> = {
      client: form.clientName.trim(),
      clientEmail: form.clientEmail.trim() || undefined,
      dueDate: form.dueDate || undefined,
      items,
      amount: totalAmount,
    };

    if (editingInvoice) {
      updateMutation.mutate({ id: editingInvoice.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (invoice: Invoice) => {
    Alert.alert(
      'Delete Invoice',
      `Are you sure you want to delete this invoice for ${invoice.clientName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(invoice.id) },
      ]
    );
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
      case 'sent':
        return styles.statusSent;
      case 'overdue':
        return styles.statusOverdue;
      case 'draft':
        return styles.statusDraft;
      default:
        return styles.statusDraft;
    }
  };

  const totalInvoiced = invoices?.reduce((sum, inv) => sum + inv.amount, 0) || 0;
  const totalPaid =
    invoices
      ?.filter((inv) => inv.status.toLowerCase() === 'paid')
      .reduce((sum, inv) => sum + inv.amount, 0) || 0;
  const totalOutstanding = totalInvoiced - totalPaid;

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const formTotal = form.items.reduce((sum, item) => {
    const amt = parseFloat(item.amount);
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer} testID="loading-invoices">
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        testID="invoices-screen"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.subtitle}>{activeCompany ? activeCompany.name : 'Manage your'}</Text>
            <Text style={styles.title}>Invoices</Text>
          </View>
          <TouchableOpacity
            style={styles.headerAddButton}
            onPress={openCreateModal}
            testID="button-create-invoice-header"
          >
            <Ionicons name="add" size={24} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="document-text" size={20} color={colors.accent} />
            <Text style={styles.statLabel}>Total Invoiced</Text>
            <Text style={styles.statValue} testID="text-total-invoiced">
              {formatCurrency(totalInvoiced)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={20} color={colors.colorGreen} />
            <Text style={styles.statLabel}>Paid</Text>
            <Text style={styles.statValue} testID="text-total-paid">
              {formatCurrency(totalPaid)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time" size={20} color={colors.warningLight} />
            <Text style={styles.statLabel}>Outstanding</Text>
            <Text style={styles.statValue} testID="text-total-outstanding">
              {formatCurrency(totalOutstanding)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>All Invoices</Text>
            <TouchableOpacity onPress={openCreateModal} testID="button-create-invoice">
              <View style={styles.addButton}>
                <Ionicons name="add" size={18} color={colors.primaryForeground} />
                <Text style={styles.addButtonText}>New</Text>
              </View>
            </TouchableOpacity>
          </View>

          {invoices?.map((invoice) => (
            <TouchableOpacity
              key={invoice.id}
              style={styles.invoiceItem}
              onPress={() => openEditModal(invoice)}
              onLongPress={() => handleDelete(invoice)}
              testID={`invoice-item-${invoice.id}`}
            >
              <View style={styles.invoiceIcon}>
                <Ionicons name="receipt-outline" size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.invoiceDetails}>
                <Text style={styles.invoiceClient}>{invoice.clientName}</Text>
                <Text style={styles.invoiceNumber}>
                  INV-{String(invoice.invoiceNumber || invoice.id).padStart(3, '0')}
                </Text>
                <Text style={styles.invoiceDue}>
                  Due: {new Date(invoice.dueDate).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.invoiceRight}>
                <Text style={styles.invoiceAmount}>{formatCurrency(invoice.amount)}</Text>
                <View style={[styles.statusBadge, getStatusStyle(invoice.status)]}>
                  <Text style={styles.statusText}>{invoice.status}</Text>
                </View>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    onPress={() => openEditModal(invoice)}
                    testID={`button-edit-invoice-${invoice.id}`}
                  >
                    <Ionicons name="create-outline" size={18} color={colors.accent} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(invoice)}
                    testID={`button-delete-invoice-${invoice.id}`}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {(!invoices || invoices.length === 0) && !isLoading && (
            <View style={styles.emptyContainer} testID="empty-invoices">
              <Ionicons name="receipt-outline" size={48} color={colors.border} />
              <Text style={styles.emptyText}>No invoices yet</Text>
              <Text style={styles.emptySubtext}>Create your first invoice</Text>
              <TouchableOpacity style={styles.emptyAddButton} onPress={openCreateModal}>
                <Ionicons name="add" size={20} color={colors.primaryForeground} />
                <Text style={styles.emptyAddButtonText}>Create Invoice</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Create / Edit Invoice Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent testID="invoice-modal">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingInvoice ? 'Edit Invoice' : 'New Invoice'}
              </Text>
              <TouchableOpacity onPress={closeModal} testID="button-close-modal">
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Client Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Acme Corp"
                placeholderTextColor={colors.placeholderText}
                value={form.clientName}
                onChangeText={(val) => setForm({ ...form, clientName: val })}
                testID="input-client-name"
              />

              <Text style={styles.inputLabel}>Client Email</Text>
              <TextInput
                style={styles.input}
                placeholder="client@example.com"
                placeholderTextColor={colors.placeholderText}
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.clientEmail}
                onChangeText={(val) => setForm({ ...form, clientEmail: val })}
                testID="input-client-email"
              />

              <Text style={styles.inputLabel}>Due Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="2026-03-01"
                placeholderTextColor={colors.placeholderText}
                value={form.dueDate}
                onChangeText={(val) => setForm({ ...form, dueDate: val })}
                testID="input-due-date"
              />

              <View style={styles.itemsHeader}>
                <Text style={styles.itemsSectionTitle}>Line Items</Text>
                <TouchableOpacity onPress={addItem} testID="button-add-item">
                  <View style={styles.addItemButton}>
                    <Ionicons name="add" size={16} color={colors.primaryForeground} />
                    <Text style={styles.addItemText}>Add</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {form.items.map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <View style={styles.itemInputs}>
                    <TextInput
                      style={[styles.input, styles.itemDescInput]}
                      placeholder="Description"
                      placeholderTextColor={colors.placeholderText}
                      value={item.description}
                      onChangeText={(val) => updateItem(index, 'description', val)}
                      testID={`input-item-desc-${index}`}
                    />
                    <TextInput
                      style={[styles.input, styles.itemAmountInput]}
                      placeholder="0.00"
                      placeholderTextColor={colors.placeholderText}
                      keyboardType="decimal-pad"
                      value={item.amount}
                      onChangeText={(val) => updateItem(index, 'amount', val)}
                      testID={`input-item-amount-${index}`}
                    />
                  </View>
                  {form.items.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeItem(index)}
                      style={styles.removeItemButton}
                      testID={`button-remove-item-${index}`}
                    >
                      <Ionicons name="close-circle" size={22} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatCurrency(formTotal)}</Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeModal}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={isSaving}
                testID="button-save-invoice"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingInvoice ? 'Update' : 'Create'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      backgroundColor: colors.background,
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
      color: colors.textSecondary,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginTop: 4,
    },
    headerAddButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statsRow: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      gap: 10,
      marginBottom: 24,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statLabel: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    statValue: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
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
      color: colors.textPrimary,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 4,
    },
    addButtonText: {
      fontSize: 13,
      color: colors.primaryForeground,
      fontWeight: '500',
    },
    invoiceItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    invoiceIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    invoiceDetails: {
      flex: 1,
      marginLeft: 12,
    },
    invoiceClient: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    invoiceNumber: {
      fontSize: 12,
      color: colors.accent,
      marginTop: 2,
    },
    invoiceDue: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
    },
    invoiceRight: {
      alignItems: 'flex-end',
    },
    invoiceAmount: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      marginTop: 4,
    },
    statusPaid: {
      backgroundColor: colors.successSubtle,
    },
    statusSent: {
      backgroundColor: colors.infoSubtle,
    },
    statusOverdue: {
      backgroundColor: colors.dangerSubtle,
    },
    statusDraft: {
      backgroundColor: colors.border,
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
      color: colors.textSecondary,
      fontSize: 16,
      marginTop: 12,
    },
    emptySubtext: {
      color: colors.textTertiary,
      fontSize: 13,
      marginTop: 4,
    },
    emptyAddButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 10,
      marginTop: 20,
      gap: 6,
    },
    emptyAddButtonText: {
      color: colors.primaryForeground,
      fontSize: 14,
      fontWeight: '600',
    },

    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.modalOverlay,
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '92%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    modalBody: {
      padding: 20,
    },
    inputLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 6,
      marginTop: 12,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 14,
      fontSize: 15,
      color: colors.inputText,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    itemsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 10,
    },
    itemsSectionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    addItemButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      gap: 4,
    },
    addItemText: {
      fontSize: 12,
      color: colors.primaryForeground,
      fontWeight: '500',
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 8,
    },
    itemInputs: {
      flex: 1,
      flexDirection: 'row',
      gap: 8,
    },
    itemDescInput: {
      flex: 2,
    },
    itemAmountInput: {
      flex: 1,
    },
    removeItemButton: {
      padding: 4,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    totalLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    totalValue: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    modalFooter: {
      flexDirection: 'row',
      padding: 20,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: colors.border,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    cancelButtonText: {
      color: colors.textSecondary,
      fontSize: 15,
      fontWeight: '600',
    },
    saveButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      color: colors.primaryForeground,
      fontSize: 15,
      fontWeight: '600',
    },
  });
}
