import React, { useState } from 'react';
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

export default function WalletScreen() {
  const queryClient = useQueryClient();
  const [fundModalVisible, setFundModalVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [sendModalVisible, setSendModalVisible] = useState(false);

  // Fund state
  const [fundAmount, setFundAmount] = useState('');

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
    if (lowerType.includes('deposit') || lowerType.includes('funding')) return '#34D399';
    if (lowerType.includes('payout') || lowerType.includes('bill') || lowerType.includes('transfer')) return '#F87171';
    return '#818CF8';
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

  // Fund wallet mutation
  const fundMutation = useMutation({
    mutationFn: async (amount: string) => {
      return api.post('/api/balances/fund', { amount: parseFloat(amount) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/balances'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      Alert.alert('Success', `Wallet funded successfully`);
      setFundModalVisible(false);
      setFundAmount('');
    },
    onError: (error: any) => {
      Alert.alert('Error', error?.message || 'Failed to fund wallet');
    },
  });

  // Withdraw mutation
  const withdrawMutation = useMutation({
    mutationFn: async (data: { amount: string; accountNumber: string; bankName: string }) => {
      return api.post('/api/wallet/payout', {
        amount: parseFloat(data.amount),
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
      Alert.alert('Error', error?.message || 'Failed to withdraw');
    },
  });

  // Send money mutation
  const sendMutation = useMutation({
    mutationFn: async (data: { amount: string; accountNumber: string; bankName: string; note: string }) => {
      return api.post('/api/payment/transfer', {
        amount: parseFloat(data.amount),
        reason: data.note || 'Money transfer',
        recipientDetails: {
          accountNumber: data.accountNumber,
          bankCode: '',
          accountName: data.bankName,
          currency: balance?.localCurrency || 'USD',
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
      Alert.alert('Error', error?.message || 'Failed to send money');
    },
  });

  const handleFund = () => {
    if (!fundAmount || parseFloat(fundAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    fundMutation.mutate(fundAmount);
  };

  const handleWithdraw = () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!withdrawAccountNumber) {
      Alert.alert('Error', 'Please enter your account number');
      return;
    }
    if (parseFloat(withdrawAmount) > parseFloat(balance?.local || '0')) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }
    withdrawMutation.mutate({ amount: withdrawAmount, accountNumber: withdrawAccountNumber, bankName: withdrawBankName });
  };

  const handleSend = () => {
    if (!sendAmount || parseFloat(sendAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!sendAccountNumber) {
      Alert.alert('Error', 'Please enter recipient account number');
      return;
    }
    if (parseFloat(sendAmount) > parseFloat(balance?.local || '0')) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }
    sendMutation.mutate({ amount: sendAmount, accountNumber: sendAccountNumber, bankName: sendBankName, note: sendNote });
  };

  const isLoading = balanceLoading || virtualAccountsLoading || transactionsLoading;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#818CF8" />
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818CF8" />
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
            <View style={[styles.actionIcon, { backgroundColor: '#065F46' }]}>
              <Ionicons name="add" size={24} color="#34D399" />
            </View>
            <Text style={styles.actionText}>Fund</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => setWithdrawModalVisible(true)}>
            <View style={[styles.actionIcon, { backgroundColor: '#92400E' }]}>
              <Ionicons name="arrow-up" size={24} color="#FBBF24" />
            </View>
            <Text style={styles.actionText}>Withdraw</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => setSendModalVisible(true)}>
            <View style={[styles.actionIcon, { backgroundColor: '#312E81' }]}>
              <Ionicons name="send" size={24} color="#818CF8" />
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
                  <Ionicons name="card" size={24} color="#818CF8" />
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
              <Ionicons name="card-outline" size={48} color="#334155" />
              <Text style={styles.emptyText}>No virtual accounts</Text>
              <Text style={styles.emptySubtext}>Create a virtual account to get started</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity>
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
                    {getTransactionColor(tx.type) === '#34D399' ? '+' : '-'}
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
              <Ionicons name="wallet-outline" size={48} color="#334155" />
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Fund Wallet</Text>
              <TouchableOpacity onPress={() => setFundModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBalanceCard}>
              <Text style={styles.modalBalanceLabel}>Current Balance</Text>
              <Text style={styles.modalBalanceAmount}>{formatCurrency(localBalance, localCurrency)}</Text>
            </View>

            <Text style={styles.modalInputLabel}>Amount to Add</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="0.00"
              placeholderTextColor="#64748B"
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

            <View style={styles.infoRow}>
              <Ionicons name="checkmark-circle" size={16} color="#34D399" />
              <Text style={styles.infoText}>Instant funding with zero fees.</Text>
            </View>

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
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>Fund Wallet</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
                  <Ionicons name="close" size={24} color="#94A3B8" />
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
                placeholderTextColor="#64748B"
                value={withdrawBankName}
                onChangeText={setWithdrawBankName}
              />

              <Text style={styles.modalInputLabel}>Account Number</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter account number"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                value={withdrawAccountNumber}
                onChangeText={setWithdrawAccountNumber}
              />

              <Text style={styles.modalInputLabel}>Amount to Withdraw</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0.00"
                placeholderTextColor="#64748B"
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
                <Ionicons name="alert-circle" size={16} color="#FBBF24" />
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
                    <ActivityIndicator color="#FFFFFF" size="small" />
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
                  <Ionicons name="close" size={24} color="#94A3B8" />
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
                placeholderTextColor="#64748B"
                value={sendBankName}
                onChangeText={setSendBankName}
              />

              <Text style={styles.modalInputLabel}>Account Number</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter account number"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                value={sendAccountNumber}
                onChangeText={setSendAccountNumber}
              />

              <Text style={styles.modalInputLabel}>Amount</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0.00"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                value={sendAmount}
                onChangeText={setSendAmount}
              />

              <Text style={styles.modalInputLabel}>Note (optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Add a note for the recipient"
                placeholderTextColor="#64748B"
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
                    <Text style={[styles.summaryValue, { color: '#34D399' }]}>{formatCurrency(0, localCurrency)}</Text>
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
                    <ActivityIndicator color="#FFFFFF" size="small" />
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
  mainBalanceCard: {
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  mainBalance: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  currencyLabel: {
    fontSize: 12,
    color: '#818CF8',
    marginTop: 4,
  },
  subBalancesContainer: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  subBalance: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
  },
  subBalanceLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  subBalanceAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E2E8F0',
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
    backgroundColor: '#1E293B',
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
  virtualAccountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  accountIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0F172A',
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
    color: '#FFFFFF',
  },
  accountNumber: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  accountBank: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  accountDetailsRight: {
    alignItems: 'flex-end',
  },
  accountBalance: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  accountStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  accountStatusText: {
    fontSize: 10,
    color: '#FFFFFF',
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  statusActive: { backgroundColor: '#065F46' },
  statusInactive: { backgroundColor: '#4B5563' },
  statusCompleted: { backgroundColor: '#065F46' },
  statusPending: { backgroundColor: '#92400E' },
  statusFailed: { backgroundColor: '#991B1B' },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
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
    color: '#FFFFFF',
    fontWeight: '500',
  },
  txType: {
    fontSize: 12,
    color: '#94A3B8',
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
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  txDate: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
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
    color: '#FFFFFF',
  },
  modalBalanceCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalBalanceLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
  },
  modalBalanceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#CBD5E1',
    marginBottom: 6,
    marginTop: 12,
  },
  modalInput: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#334155',
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
    borderColor: '#475569',
    backgroundColor: '#0F172A',
  },
  presetButtonActive: {
    borderColor: '#818CF8',
    backgroundColor: '#312E81',
  },
  presetText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  presetTextActive: {
    color: '#818CF8',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#064E3B',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
  infoText: {
    fontSize: 13,
    color: '#34D399',
    flex: 1,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#78350F',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
  warningText: {
    fontSize: 13,
    color: '#FBBF24',
    flex: 1,
  },
  summaryCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 8,
    marginBottom: 0,
  },
  summaryTotalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  summaryTotalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#818CF8',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '600',
  },
  modalSubmitButton: {
    flex: 1,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
