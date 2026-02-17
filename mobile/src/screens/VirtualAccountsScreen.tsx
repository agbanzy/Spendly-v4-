import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { api } from '../lib/api';
import { useTheme } from '../lib/theme-context';
import { ColorTokens } from '../lib/colors';

interface VirtualAccount {
  id: string;
  userId: string | null;
  companyId: string | null;
  name: string;
  accountNumber: string;
  accountName: string | null;
  bankName: string;
  bankCode: string;
  currency: string;
  balance: string;
  type: string;
  status: string;
  provider: string;
  createdAt: string;
}

interface CompanySettings {
  countryCode?: string;
  currency?: string;
}

const SUPPORTED_CURRENCIES = [
  { value: 'NGN', label: 'Nigerian Naira', country: 'NG' },
  { value: 'GHS', label: 'Ghanaian Cedi', country: 'GH' },
  { value: 'USD', label: 'US Dollar', country: 'US' },
  { value: 'EUR', label: 'Euro', country: 'EU' },
  { value: 'GBP', label: 'British Pound', country: 'GB' },
];

const CURRENCY_COUNTRY_MAP: Record<string, string> = {
  NGN: 'NG',
  GHS: 'GH',
  USD: 'US',
  EUR: 'EU',
  GBP: 'GB',
  KES: 'KE',
  ZAR: 'ZA',
};

export default function VirtualAccountsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<VirtualAccount | null>(null);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);

  const [createForm, setCreateForm] = useState({
    name: '',
    currency: 'NGN',
    type: 'collection',
    countryCode: 'NG',
  });

  const { data: accounts, isLoading, refetch } = useQuery({
    queryKey: ['virtual-accounts'],
    queryFn: () => api.get<VirtualAccount[]>('/api/virtual-accounts'),
  });

  const { data: settings } = useQuery({
    queryKey: ['/api/settings'],
    queryFn: () => api.get<CompanySettings>('/api/settings'),
  });

  const defaultCurrency = settings?.currency || 'USD';

  const createMutation = useMutation({
    mutationFn: (data: typeof createForm) =>
      api.post<VirtualAccount>('/api/virtual-accounts', data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtual-accounts'] });
      setCreateModalVisible(false);
      setCreateForm({ name: '', currency: 'NGN', type: 'collection', countryCode: 'NG' });
      Alert.alert('Success', 'Virtual account created. It may take a moment to activate.');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message || 'Failed to create virtual account');
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const formatCurrency = (amount: string | number, currency: string = 'USD') => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return `${currency} 0.00`;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(numAmount);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Copied', 'Account number copied to clipboard');
    } catch {
      Alert.alert('Error', 'Could not copy to clipboard');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return colors.colorGreen;
      case 'pending': return colors.warningLight;
      default: return colors.danger;
    }
  };

  const getProviderLabel = (provider: string) => {
    if (provider === 'paystack') return 'Paystack DVA';
    if (provider === 'stripe') return 'Stripe Treasury';
    return provider;
  };

  const openDepositModal = (account: VirtualAccount) => {
    setSelectedAccount(account);
    setDepositModalVisible(true);
  };

  const handleCreateAccount = () => {
    if (!createForm.name.trim()) {
      Alert.alert('Validation', 'Please enter an account name.');
      return;
    }
    createMutation.mutate(createForm);
  };

  const balanceByCurrency = accounts?.reduce((acc, a) => {
    const cur = a.currency || 'USD';
    const bal = parseFloat(a.balance || '0');
    acc[cur] = (acc[cur] || 0) + bal;
    return acc;
  }, {} as Record<string, number>) || {};

  const activeCount = accounts?.filter(a => a.status === 'active').length || 0;
  const pendingCount = accounts?.filter(a => a.status === 'pending').length || 0;

  if (isLoading && !accounts) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.subtitle}>Your</Text>
            <Text style={styles.title}>Virtual Accounts</Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setCreateModalVisible(true)}
            testID="button-create-virtual-account"
          >
            <Ionicons name="add" size={24} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Total Balance</Text>
            <Text style={styles.metricValue}>
              {Object.keys(balanceByCurrency).length === 0
                ? formatCurrency(0, defaultCurrency)
                : Object.entries(balanceByCurrency)
                    .map(([cur, bal]) => formatCurrency(bal, cur))
                    .join('\n')}
            </Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Active</Text>
            <Text style={styles.metricValue}>{activeCount}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Pending</Text>
            <Text style={styles.metricValue}>{pendingCount}</Text>
          </View>
        </View>

        {accounts && accounts.length > 0 ? (
          accounts.map((account) => (
            <View key={account.id} style={styles.accountCard} testID={`card-virtual-account-${account.id}`}>
              <View style={styles.accountHeader}>
                <View style={styles.accountIconContainer}>
                  <Ionicons name="business" size={22} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accountName}>{account.name}</Text>
                  <Text style={styles.accountProvider}>{getProviderLabel(account.provider)}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(account.status)}22` }]}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(account.status) }]} />
                  <Text style={[styles.statusText, { color: getStatusColor(account.status) }]}>
                    {account.status}
                  </Text>
                </View>
              </View>

              <Text style={styles.accountBalance}>
                {formatCurrency(account.balance, account.currency)}
              </Text>

              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Bank</Text>
                  <Text style={styles.detailValue}>{account.bankName}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Account No.</Text>
                  {account.accountNumber?.startsWith('pending') || account.accountNumber?.startsWith('PENDING') ? (
                    <Text style={[styles.detailValue, { color: colors.warningLight }]}>Pending</Text>
                  ) : (
                    <View style={styles.accountNumberRow}>
                      <Text style={styles.accountNumberText}>{account.accountNumber}</Text>
                      <TouchableOpacity
                        onPress={() => copyToClipboard(account.accountNumber)}
                        testID={`button-copy-account-${account.id}`}
                      >
                        <Ionicons name="copy-outline" size={14} color={colors.accent} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                {account.accountName && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Name</Text>
                    <Text style={styles.detailValue}>{account.accountName}</Text>
                  </View>
                )}
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Currency</Text>
                  <Text style={styles.detailValue}>{account.currency}</Text>
                </View>
              </View>

              <View style={styles.actionButtonsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, account.status !== 'active' && styles.actionBtnDisabled]}
                  onPress={() => openDepositModal(account)}
                  disabled={account.status !== 'active'}
                  testID={`button-deposit-${account.id}`}
                >
                  <Ionicons name="arrow-down" size={16} color={account.status === 'active' ? colors.primaryForeground : colors.textTertiary} />
                  <Text style={[styles.actionBtnText, account.status !== 'active' && styles.actionBtnTextDisabled]}>Deposit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnOutline,
                    (account.status !== 'active' || parseFloat(account.balance || '0') <= 0) && styles.actionBtnDisabled
                  ]}
                  disabled={account.status !== 'active' || parseFloat(account.balance || '0') <= 0}
                  testID={`button-withdraw-${account.id}`}
                >
                  <Ionicons name="arrow-up" size={16} color={account.status === 'active' && parseFloat(account.balance || '0') > 0 ? colors.accent : colors.textTertiary} />
                  <Text style={[styles.actionBtnOutlineText,
                    (account.status !== 'active' || parseFloat(account.balance || '0') <= 0) && styles.actionBtnTextDisabled
                  ]}>Withdraw</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="business-outline" size={64} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No virtual accounts yet</Text>
            <Text style={styles.emptySubtext}>Create a dedicated bank account to receive payments via bank transfer.</Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => setCreateModalVisible(true)}
              testID="button-create-first-account"
            >
              <Ionicons name="add" size={20} color={colors.primaryForeground} />
              <Text style={styles.createButtonText}>Create Account</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal visible={createModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Virtual Account</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Account Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Business Collections"
                placeholderTextColor={colors.placeholderText}
                value={createForm.name}
                onChangeText={(text) => setCreateForm({ ...createForm, name: text })}
                testID="input-account-name"
              />

              <Text style={styles.inputLabel}>Currency</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setCurrencyPickerVisible(true)}
                testID="select-account-currency"
              >
                <Text style={styles.pickerButtonText}>
                  {SUPPORTED_CURRENCIES.find(c => c.value === createForm.currency)?.label || createForm.currency}
                  {' '}({createForm.currency})
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Account Type</Text>
              <View style={styles.typeRow}>
                {[
                  { value: 'collection', label: 'Collection', icon: 'arrow-down' as const },
                  { value: 'settlement', label: 'Settlement', icon: 'arrow-up' as const },
                ].map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[styles.typeChip, createForm.type === type.value && styles.typeChipActive]}
                    onPress={() => setCreateForm({ ...createForm, type: type.value })}
                  >
                    <Ionicons
                      name={type.icon}
                      size={16}
                      color={createForm.type === type.value ? colors.primaryForeground : colors.textSecondary}
                    />
                    <Text style={[
                      styles.typeChipText,
                      createForm.type === type.value && styles.typeChipTextActive,
                    ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {(createForm.countryCode === 'NG' || createForm.countryCode === 'GH') && (
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle" size={18} color={colors.info} />
                  <Text style={styles.infoText}>
                    A Paystack DVA with a real NUBAN number will be created.
                    {createForm.countryCode === 'NG' ? ' Bank: Wema Bank.' : ' Bank: GCB Bank.'}
                  </Text>
                </View>
              )}

              {createForm.countryCode !== 'NG' && createForm.countryCode !== 'GH' && (
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle" size={18} color={colors.accent} />
                  <Text style={styles.infoText}>
                    A Stripe Treasury financial account will be created for {createForm.currency} transactions.
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setCreateModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, (!createForm.name.trim() || createMutation.isPending) && styles.saveButtonDisabled]}
                onPress={handleCreateAccount}
                disabled={!createForm.name.trim() || createMutation.isPending}
                testID="button-confirm-create-account"
              >
                {createMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.saveButtonText}>Create Account</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={currencyPickerVisible} animationType="fade" transparent>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCurrencyPickerVisible(false)}
        >
          <View style={styles.pickerModal}>
            <Text style={styles.pickerTitle}>Select Currency</Text>
            {SUPPORTED_CURRENCIES.map((cur) => (
              <TouchableOpacity
                key={cur.value}
                style={[styles.pickerItem, createForm.currency === cur.value && styles.pickerItemActive]}
                onPress={() => {
                  setCreateForm({
                    ...createForm,
                    currency: cur.value,
                    countryCode: cur.country,
                  });
                  setCurrencyPickerVisible(false);
                }}
              >
                <Text style={[styles.pickerItemText, createForm.currency === cur.value && styles.pickerItemTextActive]}>
                  {cur.label} ({cur.value})
                </Text>
                {createForm.currency === cur.value && (
                  <Ionicons name="checkmark" size={18} color={colors.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={depositModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Deposit to {selectedAccount?.name}</Text>
              <TouchableOpacity onPress={() => setDepositModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedAccount && (
              <View style={styles.modalBody}>
                <View style={styles.depositDetailsCard}>
                  <Text style={styles.depositDetailsTitle}>BANK TRANSFER DETAILS</Text>
                  <View style={styles.depositDetailRow}>
                    <Text style={styles.depositDetailLabel}>Bank Name</Text>
                    <Text style={styles.depositDetailValue}>{selectedAccount.bankName}</Text>
                  </View>
                  <View style={styles.depositDetailRow}>
                    <Text style={styles.depositDetailLabel}>Account Number</Text>
                    <View style={styles.accountNumberRow}>
                      <Text style={styles.depositDetailValueMono}>{selectedAccount.accountNumber}</Text>
                      <TouchableOpacity onPress={() => copyToClipboard(selectedAccount.accountNumber)}>
                        <Ionicons name="copy-outline" size={16} color={colors.accent} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.depositDetailRow}>
                    <Text style={styles.depositDetailLabel}>Account Name</Text>
                    <Text style={styles.depositDetailValue}>{selectedAccount.accountName || selectedAccount.name}</Text>
                  </View>
                  <View style={styles.depositDetailRow}>
                    <Text style={styles.depositDetailLabel}>Currency</Text>
                    <Text style={styles.depositDetailValue}>{selectedAccount.currency}</Text>
                  </View>
                </View>

                <View style={styles.successBox}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.colorGreen} />
                  <Text style={styles.successBoxText}>
                    Transfer funds to the account above. Your balance will be credited automatically when the transfer is received.
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.saveButton, { flex: 1 }]}
                onPress={() => setDepositModalVisible(false)}
              >
                <Text style={styles.saveButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    centerContent: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
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
      marginTop: 2,
    },
    addButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    metricsRow: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      gap: 10,
      marginBottom: 20,
    },
    metricCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    metricLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    metricValue: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    accountCard: {
      backgroundColor: colors.surface,
      marginHorizontal: 20,
      marginBottom: 14,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    accountHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    accountIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.accentBackground,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    accountName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    accountProvider: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      gap: 4,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    accountBalance: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 14,
    },
    detailsGrid: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 12,
      gap: 10,
      marginBottom: 14,
    },
    detailItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    detailLabel: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    detailValue: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    accountNumberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    accountNumberText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    actionButtonsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.accent,
      paddingVertical: 10,
      borderRadius: 10,
    },
    actionBtnOutline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.accent,
    },
    actionBtnDisabled: {
      backgroundColor: colors.border,
      borderColor: colors.border,
      opacity: 0.5,
    },
    actionBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primaryForeground,
    },
    actionBtnOutlineText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.accent,
    },
    actionBtnTextDisabled: {
      color: colors.textTertiary,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 60,
      paddingHorizontal: 40,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
      marginTop: 16,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 8,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.accent,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 20,
    },
    createButtonText: {
      color: colors.primaryForeground,
      fontWeight: '600',
      fontSize: 14,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.modalOverlay,
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '85%',
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
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    modalBody: {
      padding: 20,
    },
    modalFooter: {
      flexDirection: 'row',
      padding: 20,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
      marginTop: 16,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.inputText,
    },
    pickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    pickerButtonText: {
      fontSize: 15,
      color: colors.textPrimary,
    },
    typeRow: {
      flexDirection: 'row',
      gap: 12,
    },
    typeChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    typeChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    typeChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    typeChipTextActive: {
      color: colors.primaryForeground,
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: colors.accentBackground,
      borderRadius: 12,
      padding: 14,
      marginTop: 20,
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSoft,
      lineHeight: 18,
    },
    cancelButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    saveButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.accent,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primaryForeground,
    },
    pickerModal: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      marginHorizontal: 20,
      marginTop: 'auto',
      marginBottom: 'auto',
      padding: 20,
    },
    pickerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 16,
    },
    pickerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 10,
    },
    pickerItemActive: {
      backgroundColor: colors.accentBackground,
    },
    pickerItemText: {
      fontSize: 15,
      color: colors.textPrimary,
    },
    pickerItemTextActive: {
      color: colors.accent,
      fontWeight: '600',
    },
    depositDetailsCard: {
      backgroundColor: colors.background,
      borderRadius: 14,
      padding: 16,
      marginBottom: 16,
    },
    depositDetailsTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textTertiary,
      letterSpacing: 1,
      marginBottom: 14,
    },
    depositDetailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    depositDetailLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    depositDetailValue: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    depositDetailValueMono: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    successBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: colors.successSubtle,
      borderRadius: 12,
      padding: 14,
    },
    successBoxText: {
      flex: 1,
      fontSize: 13,
      color: colors.successText,
      lineHeight: 18,
    },
  });
}
