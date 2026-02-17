import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { api } from '../lib/api';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../lib/theme-context';
import { ColorTokens } from '../lib/colors';

// Type definitions
interface Balance {
  id: string;
  local: string | number;
  usd: string | number;
  escrow: string | number;
  localCurrency: string;
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

interface Expense {
  id: string;
  merchant: string;
  amount: number;
  category: string;
  status: string;
  date: string;
  currency: string;
  department?: string;
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

interface KPIData {
  totalRevenue: number;
  totalExpenses: number;
  totalOutflow: number;
  netCashFlow: number;
  profitMargin: number;
  burnRate: number;
  runwayMonths: number;
  totalBudget: number;
  totalBudgetSpent: number;
  budgetUtilization: number;
  totalPayroll: number;
  totalBillsPaid: number;
  totalBillsPending: number;
  invoiceRevenue: number;
  invoicePending: number;
  totalWalletBalance: number;
  activeVendors: number;
  totalVendorPayments: number;
  expenseGrowthRate: number;
  expenseCount: number;
  pendingExpenses: number;
  approvedExpenses: number;
  transactionCount: number;
  overdueBills: number;
}

interface Insight {
  title: string;
  summary: string;
  category: string;
  severity: string;
  recommendation: string;
  metric: string;
  metricValue: number | string;
}

interface InsightsResponse {
  insights: Insight[];
}

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showBalance, setShowBalance] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: kpis,
    isLoading: kpisLoading,
    refetch: refetchKpis,
  } = useQuery({
    queryKey: ['/api/analytics/kpis'],
    queryFn: () => api.get<KPIData>('/api/analytics/kpis'),
  });

  const {
    data: balance,
    isLoading: balanceLoading,
    refetch: refetchBalance,
  } = useQuery({
    queryKey: ['/api/balances'],
    queryFn: () => api.get<Balance>('/api/balances'),
  });

  const {
    data: transactions,
    isLoading: transactionsLoading,
    refetch: refetchTransactions,
  } = useQuery({
    queryKey: ['/api/transactions'],
    queryFn: () => api.get<Transaction[]>('/api/transactions'),
  });

  const {
    data: virtualAccounts,
    refetch: refetchVirtualAccounts,
  } = useQuery({
    queryKey: ['/api/virtual-accounts'],
    queryFn: () => api.get<VirtualAccount[]>('/api/virtual-accounts'),
  });

  const {
    data: insightsResponse,
    isLoading: insightsLoading,
    refetch: refetchInsights,
  } = useQuery({
    queryKey: ['/api/analytics/insights'],
    queryFn: () => api.get<InsightsResponse>('/api/analytics/insights'),
  });

  const { data: settings } = useQuery({
    queryKey: ['/api/settings'],
    queryFn: () => api.get<{ kycStatus?: string; onboardingComplete?: boolean }>('/api/settings'),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchKpis(), refetchBalance(), refetchTransactions(), refetchVirtualAccounts(), refetchInsights()]);
    setRefreshing(false);
  };

  const formatCurrency = (amount: number | string, currency: string = 'USD') => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return `${currency} 0.00`;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(numAmount);
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const totalBalance = balance ? parseFloat(balance.local.toString()) : 0;
  const usdBalance = balance ? parseFloat(balance.usd.toString()) : 0;
  const escrowBalance = balance ? parseFloat(balance.escrow.toString()) : 0;
  const currencyCode = balance?.localCurrency || 'USD';

  const primaryVirtualAccount = virtualAccounts?.find((a: VirtualAccount) => a.status === 'active') || virtualAccounts?.[0];

  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const topInsight = insightsResponse?.insights
    ?.sort(
      (a, b) =>
        (severityOrder[a.severity as keyof typeof severityOrder] ?? 4) -
        (severityOrder[b.severity as keyof typeof severityOrder] ?? 4)
    )
    .slice(0, 1)[0];

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

  const copyToClipboard = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Copied', 'Account number copied to clipboard');
    } catch {
      Alert.alert('Error', 'Could not copy to clipboard');
    }
  };

  const isLoading = kpisLoading || balanceLoading || transactionsLoading || insightsLoading;

  if (isLoading && !kpis && !balance && !transactions && !insightsResponse) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back</Text>
        <Text style={styles.title}>Dashboard</Text>
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceLabel}>Total Wallet Balance</Text>
          <TouchableOpacity onPress={() => setShowBalance(!showBalance)}>
            <Ionicons
              name={showBalance ? 'eye-outline' : 'eye-off-outline'}
              size={22}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.balanceAmount}>
          {showBalance ? formatCurrency(totalBalance, currencyCode) : '••••••••'}
        </Text>
        <Text style={styles.currencyCode}>{currencyCode}</Text>

        {/* Sub-balances */}
        {(usdBalance > 0 || escrowBalance > 0) && (
          <View style={styles.subBalancesRow}>
            {usdBalance > 0 && (
              <View style={styles.subBalanceCard}>
                <Text style={styles.subBalanceLabel}>USD</Text>
                <Text style={styles.subBalanceAmount}>
                  {showBalance ? formatCurrency(usdBalance, 'USD') : '••••'}
                </Text>
              </View>
            )}
            {escrowBalance > 0 && (
              <View style={styles.subBalanceCard}>
                <Text style={styles.subBalanceLabel}>Escrow</Text>
                <Text style={styles.subBalanceAmount}>
                  {showBalance ? formatCurrency(escrowBalance, currencyCode) : '••••'}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* KYC Status Banner */}
      {settings && settings.kycStatus && settings.kycStatus !== 'approved' && (
        <View style={[styles.kycBanner,
          settings.kycStatus === 'pending_review' ? styles.kycPending :
          settings.kycStatus === 'rejected' ? styles.kycRejected : styles.kycDefault
        ]}>
          <Ionicons
            name={settings.kycStatus === 'pending_review' ? 'time-outline' : settings.kycStatus === 'rejected' ? 'alert-circle-outline' : 'shield-checkmark-outline'}
            size={20}
            color={colors.textPrimary}
          />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.kycTitle}>
              {settings.kycStatus === 'pending_review' ? 'Verification In Progress' :
               settings.kycStatus === 'rejected' ? 'Verification Failed' : 'Complete Verification'}
            </Text>
            <Text style={styles.kycSubtext}>
              {settings.kycStatus === 'pending_review' ? 'Your documents are being reviewed. This usually takes 1-2 business days.' :
               settings.kycStatus === 'rejected' ? 'Your verification was not approved. Please resubmit your documents.' :
               'Complete your KYC verification to unlock all features.'}
            </Text>
          </View>
        </View>
      )}

      {/* Virtual Account Card */}
      {primaryVirtualAccount && (
        <View style={styles.virtualAccountCard}>
          <View style={styles.vaHeader}>
            <View style={styles.vaIconContainer}>
              <Ionicons name="business" size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.vaTitle}>Your Virtual Account</Text>
              <Text style={styles.vaName}>{primaryVirtualAccount.name || 'Spendly Account'}</Text>
            </View>
            <View style={[styles.vaStatusBadge, primaryVirtualAccount.status === 'active' ? styles.statusActive : styles.statusInactive]}>
              <Text style={styles.vaStatusText}>{primaryVirtualAccount.status}</Text>
            </View>
          </View>
          <View style={styles.vaDetailsGrid}>
            <View style={styles.vaDetailItem}>
              <Text style={styles.vaDetailLabel}>Bank</Text>
              <Text style={styles.vaDetailValue}>{primaryVirtualAccount.bankName}</Text>
            </View>
            <View style={styles.vaDetailItem}>
              <Text style={styles.vaDetailLabel}>Account Number</Text>
              <View style={styles.vaAccountRow}>
                <Text style={styles.vaAccountNumber}>{primaryVirtualAccount.accountNumber}</Text>
                <TouchableOpacity onPress={() => copyToClipboard(primaryVirtualAccount.accountNumber)}>
                  <Ionicons name="copy-outline" size={16} color={colors.accent} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.vaDetailItem}>
              <Text style={styles.vaDetailLabel}>Currency</Text>
              <Text style={styles.vaDetailValue}>{primaryVirtualAccount.currency || 'NGN'}</Text>
            </View>
          </View>
          <Text style={styles.vaHint}>Transfer funds to this account to add money to your wallet instantly.</Text>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Expenses')}>
          <View style={styles.actionIcon}>
            <Ionicons name="add" size={24} color={colors.textPrimary} />
          </View>
          <Text style={styles.actionText}>Add Expense</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Wallet')}>
          <View style={styles.actionIcon}>
            <Ionicons name="send" size={24} color={colors.textPrimary} />
          </View>
          <Text style={styles.actionText}>Send Money</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Invoices')}>
          <View style={styles.actionIcon}>
            <Ionicons name="download" size={24} color={colors.textPrimary} />
          </View>
          <Text style={styles.actionText}>Request</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Financial Summary</Text>
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Net Cash Flow</Text>
            <Text style={[styles.kpiValue, (kpis?.netCashFlow ?? 0) >= 0 ? styles.positive : styles.negative]}>
              {showBalance ? formatCurrency(kpis?.netCashFlow || 0) : '••••'}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Pending Expenses</Text>
            <Text style={styles.kpiValue}>{kpis?.pendingExpenses || 0}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Overdue Bills</Text>
            <Text style={[styles.kpiValue, styles.warning]}>{kpis?.overdueBills || 0}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Budget Used</Text>
            <Text style={styles.kpiValue}>{formatPercent(kpis?.budgetUtilization || 0)}</Text>
          </View>
        </View>
      </View>

      {/* Top Insight Alert */}
      {topInsight && (
        <View
          style={[
            styles.section,
            styles.insightCard,
            topInsight.severity === 'critical'
              ? styles.severityCritical
              : topInsight.severity === 'high'
                ? styles.severityHigh
                : styles.severityMedium,
          ]}
        >
          <View style={styles.insightHeader}>
            <Ionicons
              name={topInsight.severity === 'critical' ? 'alert-circle' : 'information-circle'}
              size={20}
              color={colors.textPrimary}
            />
            <Text style={styles.insightTitle}>{topInsight.title}</Text>
          </View>
          <Text style={styles.insightSummary}>{topInsight.summary}</Text>
          <Text style={styles.insightRecommendation}>{topInsight.recommendation}</Text>
        </View>
      )}

      {/* Recent Activity (Transactions) */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity onPress={() => navigation.navigate('More', { screen: 'Transactions' })}>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>

        {transactions && transactions.length > 0 ? (
          transactions.slice(0, 5).map((tx) => (
            <View key={tx.id} style={styles.txItem}>
              <View style={[styles.txIcon, { backgroundColor: getTransactionColor(tx.type) + '20' }]}>
                <Ionicons
                  name={getTransactionIcon(tx.type)}
                  size={18}
                  color={getTransactionColor(tx.type)}
                />
              </View>
              <View style={styles.txDetails}>
                <Text style={styles.txDescription} numberOfLines={1}>{tx.description}</Text>
                <Text style={styles.txType}>{tx.type}</Text>
              </View>
              <View style={styles.txRight}>
                <Text style={[styles.txAmount, { color: getTransactionColor(tx.type) }]}>
                  {getTransactionColor(tx.type) === colors.colorGreen ? '+' : '-'}
                  {formatCurrency(Math.abs(parseFloat(tx.amount)), tx.currency)}
                </Text>
                <View style={[
                  styles.statusBadge,
                  tx.status?.toLowerCase() === 'completed' || tx.status?.toLowerCase() === 'success'
                    ? styles.statusCompleted
                    : tx.status?.toLowerCase() === 'pending' || tx.status?.toLowerCase() === 'processing'
                      ? styles.statusPending
                      : styles.statusFailed,
                ]}>
                  <Text style={styles.statusText}>{tx.status}</Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="swap-horizontal-outline" size={48} color={colors.border} />
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySubtext}>Start by funding your wallet</Text>
          </View>
        )}
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
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
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 20,
    },
    greeting: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginTop: 4,
    },
    // Balance Card
    balanceCard: {
      backgroundColor: colors.surface,
      marginHorizontal: 20,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    balanceHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    balanceLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    balanceAmount: {
      fontSize: 36,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginTop: 8,
    },
    currencyCode: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 4,
    },
    subBalancesRow: {
      flexDirection: 'row',
      marginTop: 16,
      gap: 12,
    },
    subBalanceCard: {
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
    // Virtual Account
    virtualAccountCard: {
      backgroundColor: colors.surface,
      marginHorizontal: 20,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    vaHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    vaIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: colors.accentBackground,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    vaTitle: {
      fontSize: 11,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    vaName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      marginTop: 2,
    },
    vaStatusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    vaStatusText: {
      fontSize: 10,
      color: colors.textPrimary,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    vaDetailsGrid: {
      flexDirection: 'row',
      gap: 8,
    },
    vaDetailItem: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 10,
    },
    vaDetailLabel: {
      fontSize: 10,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    vaDetailValue: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    vaAccountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    vaAccountNumber: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
      fontFamily: 'monospace',
    },
    vaHint: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 10,
    },
    // Quick Actions
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
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    actionText: {
      fontSize: 12,
      color: colors.textSoft,
      fontWeight: '500',
    },
    // Sections
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
      marginBottom: 12,
    },
    viewAll: {
      fontSize: 14,
      color: colors.accent,
      fontWeight: '500',
    },
    // KPI Grid
    kpiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    kpiCard: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    kpiLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    kpiValue: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.textPrimary,
    },
    positive: { color: colors.success },
    negative: { color: colors.danger },
    warning: { color: colors.warning },
    // Insight
    insightCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      borderLeftWidth: 4,
    },
    severityCritical: { borderLeftColor: colors.danger, backgroundColor: colors.severityCriticalBg },
    severityHigh: { borderLeftColor: colors.warning, backgroundColor: colors.severityHighBg },
    severityMedium: { borderLeftColor: colors.accent, backgroundColor: colors.severityMediumBg },
    insightHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 8,
    },
    insightTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      flex: 1,
    },
    insightSummary: {
      fontSize: 13,
      color: colors.textSoft,
      marginBottom: 8,
      lineHeight: 18,
    },
    insightRecommendation: {
      fontSize: 12,
      color: colors.textBody,
      fontStyle: 'italic',
    },
    // Transactions
    txItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
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
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      marginTop: 4,
    },
    statusActive: { backgroundColor: colors.successSubtle },
    statusInactive: { backgroundColor: colors.badgeInactive },
    statusCompleted: { backgroundColor: colors.successSubtle },
    statusPending: { backgroundColor: colors.kycPendingBg },
    statusFailed: { backgroundColor: colors.dangerSubtle },
    statusText: {
      fontSize: 10,
      color: colors.textPrimary,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    // Empty
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
    // KYC Banner
    kycBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 20,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    kycPending: {
      backgroundColor: colors.kycPendingBg,
    },
    kycRejected: {
      backgroundColor: colors.kycRejectedBg,
    },
    kycDefault: {
      backgroundColor: colors.kycDefaultBg,
    },
    kycTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    kycSubtext: {
      fontSize: 12,
      color: colors.textSoft,
      marginTop: 4,
      lineHeight: 16,
    },
  });
}
