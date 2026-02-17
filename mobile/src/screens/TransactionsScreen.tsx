import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useTheme } from '../lib/theme-context';
import { ColorTokens } from '../lib/colors';

interface Transaction {
  id: string;
  type: string;
  amount: string;
  fee: string;
  status: string;
  date: string;
  description: string;
  currency: string;
}

const statusFilters = ['all', 'completed', 'processing', 'pending', 'failed'];

export default function TransactionsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const { data: transactions = [], isLoading, refetch, isRefetching } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions'],
    queryFn: () => api.get('/api/transactions'),
  });

  const filteredTransactions = transactions.filter(tx => {
    const matchesFilter = filter === 'all' || tx.status?.toLowerCase() === filter;
    const matchesSearch = searchQuery === '' ||
      tx.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.type?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    const lower = type.toLowerCase();
    if (lower.includes('funding') || lower.includes('deposit')) return 'arrow-down-circle';
    if (lower.includes('withdrawal') || lower.includes('payout')) return 'arrow-up-circle';
    if (lower.includes('transfer') || lower.includes('send')) return 'send';
    return 'swap-horizontal';
  };

  const getColor = (type: string, status: string) => {
    if (status?.toLowerCase() === 'failed') return colors.danger;
    if (status?.toLowerCase() === 'pending' || status?.toLowerCase() === 'processing') return colors.warning;
    const lower = type.toLowerCase();
    if (lower.includes('funding') || lower.includes('deposit') || lower.includes('credit')) return colors.success;
    return colors.danger;
  };

  const isCredit = (type: string) => {
    const lower = type.toLowerCase();
    return lower.includes('funding') || lower.includes('deposit') || lower.includes('credit');
  };

  const formatCurrency = (amount: string | number, currency: string = 'USD') => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Math.abs(num));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getStatusStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': case 'success': return { bg: colors.successSubtle, color: colors.colorGreen };
      case 'pending': case 'processing': return { bg: colors.warningSubtle, color: colors.warningLight };
      case 'failed': return { bg: colors.dangerSubtle, color: colors.dangerLight };
      default: return { bg: colors.border, color: colors.textSecondary };
    }
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const color = getColor(item.type, item.status);
    return (
      <TouchableOpacity style={styles.txCard} onPress={() => setSelectedTransaction(item)}>
        <View style={[styles.txIcon, { backgroundColor: color + '20' }]}>
          <Ionicons name={getIcon(item.type)} size={22} color={color} />
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txType}>{item.type}</Text>
          <Text style={styles.txDesc} numberOfLines={1}>{item.description}</Text>
          <Text style={styles.txDate}>{formatDate(item.date)}</Text>
        </View>
        <View style={styles.txRight}>
          <Text style={[styles.txAmount, { color }]}>
            {isCredit(item.type) ? '+' : '-'}{formatCurrency(item.amount, item.currency)}
          </Text>
          <View style={[styles.txStatusBadge, { backgroundColor: getStatusStyle(item.status).bg }]}>
            <Text style={[styles.txStatusText, { color: getStatusStyle(item.status).color }]}>
              {item.status}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search transactions..."
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

      {/* Filters */}
      <View style={styles.filterRow}>
        {statusFilters.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => item.id}
          renderItem={renderTransaction}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="swap-horizontal-outline" size={48} color={colors.border} />
              <Text style={styles.emptyText}>No transactions found</Text>
              <Text style={styles.emptySubtext}>
                {searchQuery || filter !== 'all' ? 'Try different filters' : 'Transactions will appear here'}
              </Text>
            </View>
          }
        />
      )}

      {/* Detail Modal */}
      <Modal visible={!!selectedTransaction} animationType="slide" transparent onRequestClose={() => setSelectedTransaction(null)}>
        <View style={styles.detailOverlay}>
          <View style={styles.detailContent}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>Transaction Details</Text>
              <TouchableOpacity onPress={() => setSelectedTransaction(null)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedTransaction && (
              <View style={styles.detailBody}>
                <View style={styles.detailAmountRow}>
                  <Text style={[styles.detailAmount, { color: getColor(selectedTransaction.type, selectedTransaction.status) }]}>
                    {isCredit(selectedTransaction.type) ? '+' : '-'}{formatCurrency(selectedTransaction.amount, selectedTransaction.currency)}
                  </Text>
                  <View style={[styles.detailStatusBadge, { backgroundColor: getStatusStyle(selectedTransaction.status).bg }]}>
                    <Text style={[styles.detailStatusText, { color: getStatusStyle(selectedTransaction.status).color }]}>
                      {selectedTransaction.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type</Text>
                  <Text style={styles.detailValue}>{selectedTransaction.type}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Description</Text>
                  <Text style={styles.detailValue}>{selectedTransaction.description}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedTransaction.date)} at {formatTime(selectedTransaction.date)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Currency</Text>
                  <Text style={styles.detailValue}>{selectedTransaction.currency}</Text>
                </View>
                {selectedTransaction.fee && parseFloat(selectedTransaction.fee) > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Fee</Text>
                    <Text style={styles.detailValue}>{formatCurrency(selectedTransaction.fee, selectedTransaction.currency)}</Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Transaction ID</Text>
                  <Text style={[styles.detailValue, { fontFamily: 'monospace', fontSize: 12 }]}>{selectedTransaction.id}</Text>
                </View>
              </View>
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
    header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
    title: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary },
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
      flexWrap: 'wrap',
    },
    filterChip: {
      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { fontSize: 13, color: colors.textSecondary },
    filterTextActive: { color: colors.primaryForeground, fontWeight: '600' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContainer: { padding: 20, paddingTop: 0 },
    txCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.surface, borderRadius: 12,
      padding: 16, marginBottom: 8, borderWidth: 1, borderColor: colors.border,
    },
    txIcon: {
      width: 44, height: 44, borderRadius: 22,
      justifyContent: 'center', alignItems: 'center',
    },
    txInfo: { flex: 1, marginLeft: 12 },
    txType: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
    txDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    txDate: { fontSize: 11, color: colors.textTertiary, marginTop: 4 },
    txRight: { alignItems: 'flex-end' },
    txAmount: { fontSize: 15, fontWeight: '700' },
    txStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
    txStatusText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
    emptyContainer: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 16, color: colors.textSecondary, marginTop: 12 },
    emptySubtext: { fontSize: 13, color: colors.textTertiary, marginTop: 4 },
    // Detail Modal
    detailOverlay: {
      flex: 1, backgroundColor: colors.modalOverlay, justifyContent: 'flex-end',
    },
    detailContent: {
      backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, paddingBottom: 40,
    },
    detailHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 20,
    },
    detailTitle: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
    detailBody: { gap: 16 },
    detailAmountRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 8,
    },
    detailAmount: { fontSize: 28, fontWeight: 'bold' },
    detailStatusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    detailStatusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
    detailRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    detailLabel: { fontSize: 14, color: colors.textSecondary },
    detailValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  });
}
