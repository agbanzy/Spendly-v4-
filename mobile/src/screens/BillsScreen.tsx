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
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useTheme } from '../lib/theme-context';
import { ColorTokens } from '../lib/colors';

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

type UtilityType = 'airtime' | 'data' | 'electricity' | 'cable' | 'internet';

const utilityActions: { label: string; icon: keyof typeof Ionicons.glyphMap; type: UtilityType; testID: string }[] = [
  { label: 'Airtime', icon: 'call-outline', type: 'airtime', testID: 'button-airtime' },
  { label: 'Data', icon: 'wifi-outline', type: 'data', testID: 'button-data' },
  { label: 'Electricity', icon: 'flash-outline', type: 'electricity', testID: 'button-electricity' },
  { label: 'Cable', icon: 'tv-outline', type: 'cable', testID: 'button-cable' },
  { label: 'Internet', icon: 'globe-outline', type: 'internet', testID: 'button-internet' },
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

const emptyUtilityForm = {
  provider: '',
  amount: '',
  phoneNumber: '',
  meterNumber: '',
  smartCardNumber: '',
  countryCode: 'US',
};

// Provider options per utility type (African — most common usage)
const providerOptions: Record<UtilityType, string[]> = {
  airtime: ['MTN', 'Glo', 'Airtel', '9Mobile', 'Safaricom', 'Vodacom'],
  data: ['MTN-Data', 'Glo-Data', 'Airtel-Data', '9Mobile-Data', 'Spectranet', 'Smile'],
  electricity: ['Eko', 'Ikeja', 'Abuja', 'Ibadan', 'KPLC', 'Eskom'],
  cable: ['DSTV', 'GOtv', 'StarTimes', 'Showmax'],
  internet: ['Spectranet', 'Smile', 'Swift', 'Ntel'],
};

export default function BillsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const queryClient = useQueryClient();

  const { data: bills, isLoading, refetch } = useQuery({
    queryKey: ['bills'],
    queryFn: () => api.get<Bill[]>('/api/bills'),
  });

  const { data: settings } = useQuery({
    queryKey: ['/api/settings'],
    queryFn: () => api.get<{ countryCode?: string; currency?: string }>('/api/settings'),
  });

  const [refreshing, setRefreshing] = React.useState(false);
  const [modalVisible, setModalVisible] = React.useState(false);
  const [editingBill, setEditingBill] = React.useState<Bill | null>(null);
  const [form, setForm] = React.useState(emptyForm);

  // Utility payment state
  const [utilityModalVisible, setUtilityModalVisible] = React.useState(false);
  const [utilityType, setUtilityType] = React.useState<UtilityType>('airtime');
  const [utilityForm, setUtilityForm] = React.useState(emptyUtilityForm);

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

  // Utility payment mutation
  const utilityMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<{ success: boolean; message: string; reference: string }>('/api/payments/utility', data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setUtilityModalVisible(false);
      setUtilityForm(emptyUtilityForm);
      Alert.alert('Success', result.message || 'Payment processed successfully');
    },
    onError: (error: Error) => Alert.alert('Payment Failed', error.message),
  });

  // Bill pay mutation
  const billPayMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<{ success: boolean; message: string }>('/api/bills/pay', data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      Alert.alert('Success', result.message || 'Bill paid successfully');
    },
    onError: (error: Error) => Alert.alert('Payment Failed', error.message),
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

  // Open utility payment modal
  const openUtilityModal = (type: UtilityType) => {
    setUtilityType(type);
    setUtilityForm({ ...emptyUtilityForm, countryCode: settings?.countryCode || 'US', provider: providerOptions[type][0] || '' });
    setUtilityModalVisible(true);
  };

  // Submit utility payment
  const handleUtilityPayment = () => {
    if (!utilityForm.provider) {
      Alert.alert('Validation', 'Please select a provider.');
      return;
    }
    const parsedAmount = parseFloat(utilityForm.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Validation', 'Please enter a valid amount.');
      return;
    }

    // Determine the customer reference field based on type
    let customerRef = '';
    if (utilityType === 'airtime' || utilityType === 'data') {
      customerRef = utilityForm.phoneNumber.replace(/[\s\-\(\)]/g, '');
      if (!customerRef) {
        Alert.alert('Validation', 'Please enter a phone number.');
        return;
      }
    } else if (utilityType === 'electricity' || utilityType === 'internet') {
      customerRef = utilityForm.meterNumber;
      if (!customerRef) {
        Alert.alert('Validation', 'Please enter a meter/account number.');
        return;
      }
    } else if (utilityType === 'cable') {
      customerRef = utilityForm.smartCardNumber;
      if (!customerRef) {
        Alert.alert('Validation', 'Please enter a smart card number.');
        return;
      }
    }

    Alert.alert(
      'Confirm Payment',
      `Pay ${utilityForm.amount} for ${utilityType} (${utilityForm.provider}) to ${customerRef}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay Now',
          onPress: () => {
            utilityMutation.mutate({
              type: utilityType,
              provider: utilityForm.provider.toLowerCase(),
              amount: parsedAmount,
              reference: customerRef,
              phoneNumber: utilityType === 'airtime' || utilityType === 'data' ? customerRef : undefined,
              meterNumber: utilityType === 'electricity' || utilityType === 'internet' ? customerRef : undefined,
              smartCardNumber: utilityType === 'cable' ? customerRef : undefined,
              countryCode: utilityForm.countryCode,
            });
          },
        },
      ]
    );
  };

  // Pay an existing bill
  const handlePayBill = (bill: Bill) => {
    Alert.alert(
      'Pay Bill',
      `Pay ${formatCurrency(bill.amount)} for "${bill.name}" from your wallet?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay from Wallet',
          onPress: () => {
            billPayMutation.mutate({
              billId: bill.id,
              paymentMethod: 'wallet',
              countryCode: settings?.countryCode || 'US',
            });
          },
        },
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

  const getUtilityInputLabel = (): string => {
    switch (utilityType) {
      case 'airtime':
      case 'data':
        return 'Phone Number';
      case 'electricity':
      case 'internet':
        return 'Meter / Account Number';
      case 'cable':
        return 'Smart Card Number';
      default:
        return 'Reference';
    }
  };

  const getUtilityInputPlaceholder = (): string => {
    switch (utilityType) {
      case 'airtime':
      case 'data':
        return '08012345678';
      case 'electricity':
        return '12345678901';
      case 'cable':
        return '1234567890';
      case 'internet':
        return 'Account number';
      default:
        return 'Reference number';
    }
  };

  const getUtilityFormField = (): 'phoneNumber' | 'meterNumber' | 'smartCardNumber' => {
    if (utilityType === 'airtime' || utilityType === 'data') return 'phoneNumber';
    if (utilityType === 'electricity' || utilityType === 'internet') return 'meterNumber';
    return 'smartCardNumber';
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer} testID="loading-bills">
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
        testID="bills-screen"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.subtitle}>Manage your</Text>
            <Text style={styles.title}>Bills & Payments</Text>
          </View>
          <TouchableOpacity style={styles.headerAddButton} onPress={openCreateModal} testID="button-create-bill">
            <Ionicons name="add" size={24} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.utilityRow}
        >
          {utilityActions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.utilityButton}
              onPress={() => openUtilityModal(action.type)}
              testID={action.testID}
            >
              <View style={styles.utilityIcon}>
                <Ionicons name={action.icon} size={24} color={colors.primary} />
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
                <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.billDetails}>
                <Text style={styles.billName}>{bill.name}</Text>
                <Text style={styles.billProvider}>{bill.provider}</Text>
                <Text style={styles.billDue}>Due: {new Date(bill.dueDate).toLocaleDateString()}</Text>
                {bill.recurring && (
                  <View style={styles.recurringBadge}>
                    <Ionicons name="repeat" size={10} color={colors.accent} />
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
                  {bill.status?.toLowerCase() !== 'paid' && (
                    <TouchableOpacity
                      onPress={() => handlePayBill(bill)}
                      testID={`button-pay-bill-${bill.id}`}
                      disabled={billPayMutation.isPending}
                    >
                      <Ionicons name="wallet-outline" size={18} color={colors.success} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => openEditModal(bill)} testID={`button-edit-bill-${bill.id}`}>
                    <Ionicons name="create-outline" size={18} color={colors.accent} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(bill)} testID={`button-delete-bill-${bill.id}`}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {(!bills || bills.length === 0) && !isLoading && (
            <View style={styles.emptyContainer} testID="empty-bills">
              <Ionicons name="document-text-outline" size={48} color={colors.border} />
              <Text style={styles.emptyText}>No bills found</Text>
              <Text style={styles.emptySubtext}>Your bills will appear here</Text>
              <TouchableOpacity style={styles.emptyAddButton} onPress={openCreateModal}>
                <Ionicons name="add" size={20} color={colors.primaryForeground} />
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
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Bill Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Netflix Subscription"
                placeholderTextColor={colors.placeholderText}
                value={form.name}
                onChangeText={(val) => setForm({ ...form, name: val })}
                testID="input-bill-name"
              />

              <Text style={styles.inputLabel}>Provider</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Netflix"
                placeholderTextColor={colors.placeholderText}
                value={form.provider}
                onChangeText={(val) => setForm({ ...form, provider: val })}
                testID="input-bill-provider"
              />

              <Text style={styles.inputLabel}>Amount</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={colors.placeholderText}
                keyboardType="decimal-pad"
                value={form.amount}
                onChangeText={(val) => setForm({ ...form, amount: val })}
                testID="input-bill-amount"
              />

              <Text style={styles.inputLabel}>Due Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="2026-03-01"
                placeholderTextColor={colors.placeholderText}
                value={form.dueDate}
                onChangeText={(val) => setForm({ ...form, dueDate: val })}
                testID="input-bill-due-date"
              />

              <View style={styles.switchRow}>
                <Text style={styles.inputLabel}>Recurring</Text>
                <Switch
                  value={form.recurring}
                  onValueChange={(val) => setForm({ ...form, recurring: val })}
                  trackColor={{ false: colors.switchTrackInactive, true: colors.primary }}
                  thumbColor={form.recurring ? colors.accent : colors.textTertiary}
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
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.saveButtonText}>{editingBill ? 'Update' : 'Create'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Utility Payment Modal (Airtime, Data, Electricity, Cable, Internet) */}
      <Modal visible={utilityModalVisible} animationType="slide" transparent testID="utility-modal">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {utilityType.charAt(0).toUpperCase() + utilityType.slice(1)} Payment
              </Text>
              <TouchableOpacity
                onPress={() => { setUtilityModalVisible(false); setUtilityForm(emptyUtilityForm); }}
                testID="button-close-utility-modal"
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Provider</Text>
              <View style={styles.frequencyRow}>
                {(providerOptions[utilityType] || []).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.frequencyChip,
                      utilityForm.provider === p.toLowerCase() && styles.frequencyChipActive,
                    ]}
                    onPress={() => setUtilityForm({ ...utilityForm, provider: p.toLowerCase() })}
                    testID={`chip-provider-${p}`}
                  >
                    <Text
                      style={[
                        styles.frequencyChipText,
                        utilityForm.provider === p.toLowerCase() && styles.frequencyChipTextActive,
                      ]}
                    >
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>{getUtilityInputLabel()}</Text>
              <TextInput
                style={styles.input}
                placeholder={getUtilityInputPlaceholder()}
                placeholderTextColor={colors.placeholderText}
                keyboardType={utilityType === 'airtime' || utilityType === 'data' ? 'phone-pad' : 'number-pad'}
                value={utilityForm[getUtilityFormField()]}
                onChangeText={(val) => setUtilityForm({ ...utilityForm, [getUtilityFormField()]: val })}
                testID="input-utility-reference"
              />

              <Text style={styles.inputLabel}>Amount</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={colors.placeholderText}
                keyboardType="decimal-pad"
                value={utilityForm.amount}
                onChangeText={(val) => setUtilityForm({ ...utilityForm, amount: val })}
                testID="input-utility-amount"
              />

              {/* Quick amount buttons for airtime/data */}
              {(utilityType === 'airtime' || utilityType === 'data') && (
                <View style={styles.quickAmounts}>
                  {[100, 200, 500, 1000, 2000, 5000].map((amt) => (
                    <TouchableOpacity
                      key={amt}
                      style={[
                        styles.quickAmountChip,
                        utilityForm.amount === String(amt) && styles.frequencyChipActive,
                      ]}
                      onPress={() => setUtilityForm({ ...utilityForm, amount: String(amt) })}
                      testID={`quick-amount-${amt}`}
                    >
                      <Text
                        style={[
                          styles.frequencyChipText,
                          utilityForm.amount === String(amt) && styles.frequencyChipTextActive,
                        ]}
                      >
                        {amt >= 1000 ? `${amt / 1000}K` : amt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.inputLabel}>Country</Text>
              <View style={styles.frequencyRow}>
                {['NG', 'GH', 'KE', 'ZA'].map((cc) => (
                  <TouchableOpacity
                    key={cc}
                    style={[
                      styles.frequencyChip,
                      utilityForm.countryCode === cc && styles.frequencyChipActive,
                    ]}
                    onPress={() => setUtilityForm({ ...utilityForm, countryCode: cc })}
                    testID={`chip-country-${cc}`}
                  >
                    <Text
                      style={[
                        styles.frequencyChipText,
                        utilityForm.countryCode === cc && styles.frequencyChipTextActive,
                      ]}
                    >
                      {cc}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => { setUtilityModalVisible(false); setUtilityForm(emptyUtilityForm); }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, utilityMutation.isPending && styles.saveButtonDisabled]}
                onPress={handleUtilityPayment}
                disabled={utilityMutation.isPending}
                testID="button-pay-utility"
              >
                {utilityMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.saveButtonText}>Pay Now</Text>
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
    utilityRow: {
      paddingHorizontal: 20,
      gap: 12,
      marginBottom: 24,
    },
    utilityButton: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      width: 80,
    },
    utilityIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.accentBackground,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    utilityLabel: {
      fontSize: 11,
      color: colors.textSoft,
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
    viewAll: {
      fontSize: 14,
      color: colors.accent,
    },
    billItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    billIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    billDetails: {
      flex: 1,
      marginLeft: 12,
    },
    billName: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    billProvider: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    billDue: {
      fontSize: 11,
      color: colors.textTertiary,
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
      color: colors.accent,
      textTransform: 'capitalize',
    },
    billRight: {
      alignItems: 'flex-end',
    },
    billAmount: {
      fontSize: 14,
      color: colors.textPrimary,
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
      backgroundColor: colors.successSubtle,
    },
    statusUnpaid: {
      backgroundColor: colors.kycPendingBg,
    },
    statusOverdue: {
      backgroundColor: colors.dangerSubtle,
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

    // Quick amounts
    quickAmounts: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    quickAmountChip: {
      backgroundColor: colors.background,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.inputBorder,
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
      maxHeight: '90%',
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
      backgroundColor: colors.background,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    frequencyChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    frequencyChipText: {
      fontSize: 12,
      color: colors.textSecondary,
      textTransform: 'capitalize',
    },
    frequencyChipTextActive: {
      color: colors.primaryForeground,
      fontWeight: '600',
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
