import React, { useState, useMemo } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { api } from '../lib/api';
import { useTheme } from '../lib/theme-context';
import { useAuth } from '../lib/auth-context';
import { ColorTokens } from '../lib/colors';

const AFRICAN_COUNTRIES = ['NG', 'GH', 'KE', 'ZA', 'EG', 'RW', 'CI'];
function isPaystackRegion(countryCode: string): boolean {
  return AFRICAN_COUNTRIES.includes(countryCode.toUpperCase());
}

interface Balance {
  id: string;
  local: string;
  usd: string;
  escrow: string;
  localCurrency: string;
}

interface VirtualAccount {
  id: string;
  name: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  currency: string;
  balance: string;
  type: string;
  status: string;
  createdAt: string;
}

interface Transaction {
  id: string;
  type: string;
  description: string;
  amount: string;
  fee: string;
  status: string;
  date: string;
  currency: string;
}

interface CompanySettings {
  countryCode?: string;
  currency?: string;
  companyName?: string;
}

export default function WalletScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [fundModalVisible, setFundModalVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [sendModalVisible, setSendModalVisible] = useState(false);

  // Fund state
  const [fundAmount, setFundAmount] = useState('');
  const [fundingMethod, setFundingMethod] = useState<'card' | 'bank'>('card');

  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState('');
  const [withdrawBankName, setWithdrawBankName] = useState('');

  // Send state
  const [sendAmount, setSendAmount] = useState('');
  const [sendAccountNumber, setSendAccountNumber] = useState('');
  const [sendBankName, setSendBankName] = useState('');
  const [sendNote, setSendNote] = useState('');

  const { data: balance, isLoading: balanceLoading, refetch: refetchBalance } = useQuery({
    queryKey: ['/api/balances'],
    queryFn: () => api.get<Balance>('/api/balances'),
  });

  const { data: virtualAccounts, isLoading: virtualAccountsLoading, refetch: refetchVirtualAccounts } = useQuery({
    queryKey: ['/api/virtual-accounts'],
    queryFn: () => api.get<VirtualAccount[]>('/api/virtual-accounts'),
  });

  const { data: transactions, isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery({
    queryKey: ['/api/transactions'],
    queryFn: () => api.get<Transaction[]>('/api/transactions'),
  });

  const { data: settings } = useQuery({
    queryKey: ['/api/settings'],
    queryFn: () => api.get<CompanySettings>('/api/settings'),
  });

  const countryCode = settings?.countryCode || 'US';
  const settingsCurrency = settings?.currency || 'USD';
  const isPaystack = isPaystackRegion(countryCode);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchBalance(), refetchVirtualAccounts(), refetchTransactions()]);
    setRefreshing(false);
  };

  const formatCurrency = (amount: string | number, currency: string = 'USD') => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return `${currency} 0.00`;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(numAmount);
  };

  const maskAccountNumber = (accountNumber: string): string => {
    if (accountNumber.length <= 4) return accountNumber;
    return `****${accountNumber.slice(-4)}`;
  };

  const getTransactionIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('deposit') || lowerType.includes('funding')) return 'arrow-down';
    if (lowerType.includes('payout') || lowerType.includes('bill') || lowerType.includes('transfer')) return 'arrow-up';
    return 'swap-horizontal';
  };

  const getTransactionColor = (type: string): string => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('deposit') || lowerType.includes('funding')) return colors.colorGreen;
    if (lowerType.includes('payout') || lowerType.includes('bill') || lowerType.includes('transfer')) return colors.colorRed;
    return colors.accent;
  };

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return styles.statusActive;
      case 'inactive': return styles.statusInactive;
      case 'completed': case 'success': return styles.statusCompleted;
      case 'pending': case 'processing': return styles.statusPending;
      case 'failed': return styles.statusFailed;
      default: return styles.statusPending;
    }
  };

  // Fund wallet mutation — uses real payment processing (Stripe or Paystack)
  const fundMutation = useMutation({
    mutationFn: async (amount: string) => {
      const numAmount = parseFloat(amount);

      if (fundingMethod === 'card') {
        if (isPaystack) {
          // Paystack payment flow (African countries)
          const result = await api.post<{
            authorizationUrl?: string;
            reference?: string;
            accessCode?: string;
          }>('/api/payment/create-intent', {
            amount: numAmount,
            currency: settingsCurrency,
            countryCode,
            email: user?.email || '',
            metadata: { type: 'wallet_funding' },
          });

          if (result.authorizationUrl) {
            await WebBrowser.openBrowserAsync(result.authorizationUrl);
            return { paymentInitiated: true, provider: 'paystack' };
          }
          return result;
        } else {
          // Stripe Checkout flow (US, EU, UK, AU, etc.)
          const callbackUrl = 'spendly://payment-callback';
          const result = await api.post<{
            url?: string;
            sessionId?: string;
          }>('/api/stripe/checkout-session', {
            amount: numAmount,
            currency: settingsCurrency,
            countryCode,
            successUrl: callbackUrl + '?payment=success',
            cancelUrl: callbackUrl + '?payment=cancelled',
            metadata: { type: 'wallet_funding' },
          });

          if (result.url) {
            await WebBrowser.openBrowserAsync(result.url);
            return { paymentInitiated: true, provider: 'stripe' };
          }
          return result;
        }
      } else {
        // Bank transfer — show virtual account info (balance credited via webhook)
        Alert.alert(
          'Bank Transfer',
          'Transfer funds to your virtual account to add money to your wallet. Your balance will be updated automatically once the transfer is confirmed.',
          [{ text: 'OK' }],
        );
        return { paymentInitiated: false, method: 'bank_transfer' };
      }
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/balances'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      if (data?.paymentInitiated) {
        Alert.alert(
          'Payment Processing',
          'Your payment is being processed. Your wallet balance will be updated once the payment is confirmed.',
        );
      }
      setFundModalVisible(false);
      setFundAmount('');
    },
    onError: (error: any) => {
      Alert.alert('Funding Failed', error?.message || 'Failed to initiate payment', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Retry', onPress: () => fundMutation.mutate(fundAmount) },
      ]);
    },
  });

  // Withdraw mutation
  const withdrawMutation = useMutation({
    mutationFn: async (data: { amount: string; accountNumber: string; bankName: string }) => {
      return api.post('/api/wallet/payout', {
        amount: parseFloat(data.amount),
        countryCode,
        recipientDetails: {
          accountNumber: data.accountNumber,
          bankCode: '',
          accountName: data.bankName,
        },
        reason: 'Wallet withdrawal',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/balances'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      Alert.alert('Success', 'Withdrawal initiated. Funds will arrive in 1-3 business days.');
      setWithdrawModalVisible(false);
      setWithdrawAmount('');
      setWithdrawAccountNumber('');
      setWithdrawBankName('');
    },
    onError: (error: any) => {
      Alert.alert('Withdrawal Failed', error?.message || 'Failed to withdraw', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Retry', onPress: () => withdrawMutation.mutate({ amount: withdrawAmount, accountNumber: withdrawAccountNumber.trim(), bankName: withdrawBankName.trim() }) },
      ]);
    },
  });

  // Send money mutation
  const sendMutation = useMutation({
    mutationFn: async (data: { amount: string; accountNumber: string; bankName: string; note: string }) => {
      return api.post('/api/payment/transfer', {
        amount: parseFloat(data.amount),
        countryCode,
        reason: data.note || 'Money transfer',
        recipientDetails: {
          accountNumber: data.accountNumber,
          bankCode: '',
          accountName: data.bankName,
          currency: settingsCurrency,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/balances'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      Alert.alert('Success', 'Money sent successfully');
      setSendModalVisible(false);
      setSendAmount('');
      setSendAccountNumber('');
      setSendBankName('');
      setSendNote('');
    },
    onError: (error: any) => {
      Alert.alert('Transfer Failed', error?.message || 'Failed to send money', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Retry', onPress: () => sendMutation.mutate({ amount: sendAmount, accountNumber: sendAccountNumber.trim(), bankName: sendBankName.trim(), note: sendNote.trim() }) },
      ]);
    },
  });

  const handleFund = () => {
    if (fundingMethod === 'bank') {
      // For bank transfer, show virtual account details
      if (virtualAccounts && virtualAccounts.length > 0) {
        const account = virtualAccounts[0];
        Alert.alert(
          'Transfer to Your Virtual Account',
          `Bank: ${account.bankName}\nAccount: ${account.accountNumber}\nName: ${account.name}\n\nTransfer any amount to this account. Your wallet balance will be updated automatically.`,
          [{ text: 'OK' }],
        );
      } else {
        Alert.alert(
          'No Virtual Account',
          'You need a virtual account to receive bank transfers. Please generate one from the dashboard.',
          [{ text: 'OK' }],
        );
      }
      setFundModalVisible(false);
      return;
    }

    const parsed = parseFloat(fundAmount);
    if (!fundAmount || isNaN(parsed) || parsed <= 0) {
      Alert.alert('Error', 'Please enter a valid amount greater than zero');
      return;
    }
    fundMutation.mutate(fundAmount);
  };

  const handleWithdraw = () => {
    const parsed = parseFloat(withdrawAmount);
    if (!withdrawAmount || isNaN(parsed) || parsed <= 0) {
      Alert.alert('Error', 'Please enter a valid amount greater than zero');
      return;
    }
    if (!withdrawAccountNumber.trim()) {
      Alert.alert('Error', 'Please enter your account number');
      return;
    }
    if (parsed > parseFloat(balance?.local || '0')) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }
    withdrawMutation.mutate({ amount: withdrawAmount, accountNumber: withdrawAccountNumber.trim(), bankName: withdrawBankName.trim() });
  };

  const handleSend = () => {
    const parsed = parseFloat(sendAmount);
    if (!sendAmount || isNaN(parsed) || parsed <= 0) {
      Alert.alert('Error', 'Please enter a valid amount greater than zero');
      return;
    }
    if (!sendAccountNumber.trim()) {
      Alert.alert('Error', 'Please enter recipient account number');
      return;
    }
    if (parsed > parseFloat(balance?.local || '0')) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }
    sendMutation.mutate({ amount: sendAmount, accountNumber: sendAccountNumber.trim(), bankName: sendBankName.trim(), note: sendNote.trim() });
  };

  const isLoading = balanceLoading || virtualAccountsLoading || transactionsLoading;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const localBalance = balance ? parseFloat(balance.local) : 0;
  const usdBalance = balance ? parseFloat(balance.usd) : 0;
  const escrowBalance = balance ? parseFloat(balance.escrow) : 0;
  const localCurrency = balance?.localCurrency || 'USD';

  const AMOUNT_PRESETS = [100, 500, 1000, 5000];

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.subtitle}>Your</Text>
          <Text style={styles.title}>Wallet</Text>
        </View>

        <View style={styles.mainBalanceCard}>
          <Text style={styles.balanceLabel}>Total Available</Text>
          <Text style={styles.mainBalance}>{formatCurrency(localBalance, localCurrency)}</Text>
          <Text style={styles.currencyLabel}>{localCurrency}</Text>

          {(usdBalance > 0 || escrowBalance > 0) && (
            <View style={styles.subBalancesContainer}>
              {usdBalance > 0 && (
                <View style={styles.subBalance}>
                  <Text style={styles.subBalanceLabel}>USD</Text>
                  <Text style={styles.subBalanceAmount}>{formatCurrency(usdBalance, 'USD')}</Text>
                </View>
              )}
              {escrowBalance > 0 && (
                <View style={styles.subBalance}>
                  <Text style={styles.subBalanceLabel}>Escrow</Text>
                  <Text style={styles.subBalanceAmount}>{formatCurrency(escrowBalance, localCurrency)}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => setFundModalVisible(true)}>
            <View style={[styles.actionIcon, { backgroundColor: colors.successSubtle }]}>
              <Ionicons name="add" size={24} color={colors.colorGreen} />
            </View>
            <Text style={styles.actionText}>Fund</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => setWithdrawModalVisible(true)}>
            <View style={[styles.actionIcon, { backgroundColor: colors.kycPendingBg }]}>
              <Ionicons name="arrow-up" size={24} color={colors.warningLight} />
            </View>
            <Text style={styles.actionText}>Withdraw</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => setSendModalVisible(true)}>
            <View style={[styles.actionIcon, { backgroundColor: colors.accentBackground }]}>
              <Ionicons name="send" size={24} color={colors.accent} />
            </View>
            <Text style={styles.actionText}>Send</Text>
          </TouchableOpacity>
        </View>

        {virtualAccounts && virtualAccounts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Virtual Accounts</Text>
            {virtualAccounts.map((account) => (
              <TouchableOpacity key={account.id} style={styles.virtualAccountCard}>
                <View style={styles.accountIconContainer}>
                  <Ionicons name="card" size={24} color={colors.accent} />
                </View>
                <View style={styles.accountDetailsLeft}>
                  <Text style={styles.accountName}>{account.name}</Text>
                  <Text style={styles.accountNumber}>{maskAccountNumber(account.accountNumber)}</Text>
                  <Text style={styles.accountBank}>{account.bankName}</Text>
                </View>
                <View style={styles.accountDetailsRight}>
                  <Text style={styles.accountBalance}>{formatCurrency(account.balance, account.currency)}</Text>
                  <View style={[styles.accountStatusBadge, getStatusStyle(account.status)]}>
                    <Text style={styles.accountStatusText}>{account.status}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {(!virtualAccounts || virtualAccounts.length === 0) && (
          <View style={styles.section}>
            <View style={styles.emptyContainer}>
              <Ionicons name="card-outline" size={48} color={colors.border} />
              <Text style={styles.emptyText}>No virtual accounts</Text>
              <Text style={styles.emptySubtext}>Create a virtual account to get started</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>

          {transactions && transactions.length > 0 ? (
            transactions.slice(0, 10).map((tx) => (
              <TouchableOpacity key={tx.id} style={styles.txItem}>
                <View style={[styles.txIcon, { backgroundColor: getTransactionColor(tx.type) + '20' }]}>
                  <Ionicons name={getTransactionIcon(tx.type)} size={18} color={getTransactionColor(tx.type)} />
                </View>
                <View style={styles.txDetails}>
                  <Text style={styles.txDescription}>{tx.description}</Text>
                  <Text style={styles.txType}>{tx.type}</Text>
                </View>
                <View style={styles.txRight}>
                  <Text style={[styles.txAmount, { color: getTransactionColor(tx.type) }]}>
                    {getTransactionColor(tx.type) === colors.colorGreen ? '+' : '-'}
                    {formatCurrency(Math.abs(parseFloat(tx.amount)), tx.currency)}
                  </Text>
                  <View style={[styles.txStatusBadge, getStatusStyle(tx.status)]}>
                    <Text style={styles.txStatusText}>{tx.status}</Text>
                  </View>
                  <Text style={styles.txDate}>{new Date(tx.date).toLocaleDateString()}</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="wallet-outline" size={48} color={colors.border} />
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubtext}>Fund your wallet to get started</Text>
            </View>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Fund Wallet Modal */}
      <Modal visible={fundModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Fund Wallet</Text>
                <TouchableOpacity onPress={() => setFundModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBalanceCard}>
                <Text style={styles.modalBalanceLabel}>Current Balance</Text>
                <Text style={styles.modalBalanceAmount}>{formatCurrency(localBalance, localCurrency)}</Text>
              </View>

              {/* Payment Method Selection */}
              <Text style={styles.modalInputLabel}>Payment Method</Text>
              <View style={styles.fundingMethodRow}>
                <TouchableOpacity
                  style={[styles.fundingMethodButton, fundingMethod === 'card' && styles.fundingMethodActive]}
                  onPress={() => setFundingMethod('card')}
                >
                  <Ionicons
                    name="card"
                    size={20}
                    color={fundingMethod === 'card' ? colors.primaryForeground : colors.textSecondary}
                  />
                  <Text style={[styles.fundingMethodText, fundingMethod === 'card' && styles.fundingMethodTextActive]}>
                    {isPaystack ? 'Card / Bank' : 'Card'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.fundingMethodButton, fundingMethod === 'bank' && styles.fundingMethodActive]}
                  onPress={() => setFundingMethod('bank')}
                >
                  <Ionicons
                    name="business"
                    size={20}
                    color={fundingMethod === 'bank' ? colors.primaryForeground : colors.textSecondary}
                  />
                  <Text style={[styles.fundingMethodText, fundingMethod === 'bank' && styles.fundingMethodTextActive]}>
                    Bank Transfer
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalInputLabel}>Amount to Add</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0.00"
                placeholderTextColor={colors.placeholderText}
                keyboardType="numeric"
                value={fundAmount}
                onChangeText={setFundAmount}
              />

              <View style={styles.presetRow}>
                {AMOUNT_PRESETS.map((amount) => (
                  <TouchableOpacity
                    key={amount}
                    style={[styles.presetButton, fundAmount === String(amount) && styles.presetButtonActive]}
                    onPress={() => setFundAmount(String(amount))}
                  >
                    <Text style={[styles.presetText, fundAmount === String(amount) && styles.presetTextActive]}>
                      {amount.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {fundingMethod === 'card' ? (
                <View style={styles.infoRow}>
                  <Ionicons name="shield-checkmark" size={16} color={colors.colorGreen} />
                  <Text style={styles.infoText}>
                    Secure payment via {isPaystack ? 'Paystack' : 'Stripe'}. You will be redirected to complete payment.
                  </Text>
                </View>
              ) : (
                <View style={styles.infoRow}>
                  <Ionicons name="information-circle" size={16} color={colors.accent} />
                  <Text style={styles.infoText}>
                    Transfer to your virtual account. Balance updates automatically when the transfer is confirmed.
                  </Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelButton} onPress={() => setFundModalVisible(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitButton, fundMutation.isPending && styles.buttonDisabled]}
                  onPress={handleFund}
                  disabled={fundMutation.isPending}
                >
                  {fundMutation.isPending ? (
                    <ActivityIndicator color={colors.primaryForeground} size="small" />
                  ) : (
                    <Text style={styles.modalSubmitText}>
                      {fundingMethod === 'card' ? 'Pay Now' : 'View Account Details'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Withdraw Modal */}
      <Modal visible={withdrawModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Withdraw Funds</Text>
                <TouchableOpacity onPress={() => setWithdrawModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBalanceCard}>
                <Text style={styles.modalBalanceLabel}>Available Balance</Text>
                <Text style={styles.modalBalanceAmount}>{formatCurrency(localBalance, localCurrency)}</Text>
              </View>

              <Text style={styles.modalInputLabel}>Bank Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter bank name"
                placeholderTextColor={colors.placeholderText}
                value={withdrawBankName}
                onChangeText={setWithdrawBankName}
              />

              <Text style={styles.modalInputLabel}>Account Number</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter account number"
                placeholderTextColor={colors.placeholderText}
                keyboardType="numeric"
                value={withdrawAccountNumber}
                onChangeText={setWithdrawAccountNumber}
              />

              <Text style={styles.modalInputLabel}>Amount to Withdraw</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0.00"
                placeholderTextColor={colors.placeholderText}
                keyboardType="numeric"
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
              />

              <View style={styles.presetRow}>
                {[...AMOUNT_PRESETS, -1].map((amount, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.presetButton, withdrawAmount === (amount === -1 ? balance?.local || '0' : String(amount)) && styles.presetButtonActive]}
                    onPress={() => setWithdrawAmount(amount === -1 ? balance?.local || '0' : String(amount))}
                  >
                    <Text style={[styles.presetText, withdrawAmount === (amount === -1 ? balance?.local || '0' : String(amount)) && styles.presetTextActive]}>
                      {amount === -1 ? 'All' : amount.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.warningRow}>
                <Ionicons name="alert-circle" size={16} color={colors.warningLight} />
                <Text style={styles.warningText}>Withdrawals are typically processed within 1-3 business days.</Text>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelButton} onPress={() => setWithdrawModalVisible(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitButton, withdrawMutation.isPending && styles.buttonDisabled]}
                  onPress={handleWithdraw}
                  disabled={withdrawMutation.isPending}
                >
                  {withdrawMutation.isPending ? (
                    <ActivityIndicator color={colors.primaryForeground} size="small" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Withdraw</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Send Money Modal */}
      <Modal visible={sendModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Send Money</Text>
                <TouchableOpacity onPress={() => setSendModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBalanceCard}>
                <Text style={styles.modalBalanceLabel}>Available Balance</Text>
                <Text style={styles.modalBalanceAmount}>{formatCurrency(localBalance, localCurrency)}</Text>
              </View>

              <Text style={styles.modalInputLabel}>Bank Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter recipient's bank name"
                placeholderTextColor={colors.placeholderText}
                value={sendBankName}
                onChangeText={setSendBankName}
              />

              <Text style={styles.modalInputLabel}>Account Number</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter account number"
                placeholderTextColor={colors.placeholderText}
                keyboardType="numeric"
                value={sendAccountNumber}
                onChangeText={setSendAccountNumber}
              />

              <Text style={styles.modalInputLabel}>Amount</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0.00"
                placeholderTextColor={colors.placeholderText}
                keyboardType="numeric"
                value={sendAmount}
                onChangeText={setSendAmount}
              />

              <Text style={styles.modalInputLabel}>Note (optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Add a note for the recipient"
                placeholderTextColor={colors.placeholderText}
                value={sendNote}
                onChangeText={setSendNote}
              />

              {sendAmount ? (
                <View style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Amount</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(parseFloat(sendAmount) || 0, localCurrency)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Fee</Text>
                    <Text style={[styles.summaryValue, { color: colors.colorGreen }]}>{formatCurrency(0, localCurrency)}</Text>
                  </View>
                  <View style={[styles.summaryRow, styles.summaryTotal]}>
                    <Text style={styles.summaryTotalLabel}>Total</Text>
                    <Text style={styles.summaryTotalValue}>{formatCurrency(parseFloat(sendAmount) || 0, localCurrency)}</Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelButton} onPress={() => setSendModalVisible(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitButton, sendMutation.isPending && styles.buttonDisabled]}
                  onPress={handleSend}
                  disabled={sendMutation.isPending}
                >
                  {sendMutation.isPending ? (
                    <ActivityIndicator color={colors.primaryForeground} size="small" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Send Money</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
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
    mainBalanceCard: {
      backgroundColor: colors.surface,
      marginHorizontal: 20,
      borderRadius: 16,
      padding: 24,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    balanceLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    mainBalance: {
      fontSize: 40,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginTop: 8,
    },
    currencyLabel: {
      fontSize: 12,
      color: colors.accent,
      marginTop: 4,
    },
    subBalancesContainer: {
      flexDirection: 'row',
      marginTop: 16,
      gap: 12,
    },
    subBalance: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 12,
    },
    subBalanceLabel: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    subBalanceAmount: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSoft,
      marginTop: 4,
    },
    quickActions: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      gap: 12,
      marginBottom: 24,
    },
    actionButton: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    actionIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    actionText: {
      fontSize: 12,
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
    virtualAccountCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    accountIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    accountDetailsLeft: {
      flex: 1,
    },
    accountName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    accountNumber: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
      fontFamily: 'monospace',
    },
    accountBank: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
    },
    accountDetailsRight: {
      alignItems: 'flex-end',
    },
    accountBalance: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    accountStatusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      marginTop: 6,
    },
    accountStatusText: {
      fontSize: 10,
      color: colors.textPrimary,
      textTransform: 'capitalize',
      fontWeight: '500',
    },
    statusActive: { backgroundColor: colors.successSubtle },
    statusInactive: { backgroundColor: colors.badgeInactive },
    statusCompleted: { backgroundColor: colors.successSubtle },
    statusPending: { backgroundColor: colors.kycPendingBg },
    statusFailed: { backgroundColor: colors.dangerSubtle },
    txItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
    },
    txIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    txDetails: {
      flex: 1,
      marginLeft: 12,
    },
    txDescription: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    txType: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
      textTransform: 'capitalize',
    },
    txRight: {
      alignItems: 'flex-end',
    },
    txAmount: {
      fontSize: 14,
      fontWeight: '600',
    },
    txStatusBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginTop: 4,
    },
    txStatusText: {
      fontSize: 9,
      color: colors.textPrimary,
      textTransform: 'capitalize',
    },
    txDate: {
      fontSize: 10,
      color: colors.textTertiary,
      marginTop: 2,
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
    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.modalOverlay,
      justifyContent: 'flex-end',
    },
    modalScrollContent: {
      flexGrow: 1,
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 40,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textPrimary,
    },
    modalBalanceCard: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalBalanceLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    modalBalanceAmount: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.textPrimary,
    },
    modalInputLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textBody,
      marginBottom: 6,
      marginTop: 12,
    },
    modalInput: {
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.inputText,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    presetRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
      flexWrap: 'wrap',
    },
    presetButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    presetButtonActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentBackground,
    },
    presetText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    presetTextActive: {
      color: colors.accent,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 12,
      marginTop: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoText: {
      fontSize: 13,
      color: colors.textSecondary,
      flex: 1,
    },
    fundingMethodRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    fundingMethodButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    fundingMethodActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    fundingMethodText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    fundingMethodTextActive: {
      color: colors.primaryForeground,
    },
    warningRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.warningSubtle,
      borderRadius: 10,
      padding: 12,
      marginTop: 16,
    },
    warningText: {
      fontSize: 13,
      color: colors.warningLight,
      flex: 1,
    },
    summaryCard: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    summaryLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    summaryValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    summaryTotal: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
      marginBottom: 0,
    },
    summaryTotalLabel: {
      fontSize: 14,
      fontWeight: 'bold',
      color: colors.textPrimary,
    },
    summaryTotalValue: {
      fontSize: 14,
      fontWeight: 'bold',
      color: colors.accent,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 24,
    },
    modalCancelButton: {
      flex: 1,
      backgroundColor: colors.border,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    modalCancelText: {
      color: colors.textBody,
      fontSize: 16,
      fontWeight: '600',
    },
    modalSubmitButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    modalSubmitText: {
      color: colors.primaryForeground,
      fontSize: 16,
      fontWeight: '600',
    },
    buttonDisabled: {
      opacity: 0.7,
    },
  });
}
