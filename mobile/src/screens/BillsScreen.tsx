import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface Bill {
  id: number;
  name: string;
  provider: string;
  amount: number;
  status: string;
  dueDate: string;
  category: string;
}

const utilityActions = [
  { label: 'Airtime', icon: 'call-outline' as const, testID: 'button-airtime' },
  { label: 'Data', icon: 'wifi-outline' as const, testID: 'button-data' },
  { label: 'Electricity', icon: 'flash-outline' as const, testID: 'button-electricity' },
  { label: 'Cable', icon: 'tv-outline' as const, testID: 'button-cable' },
  { label: 'Internet', icon: 'globe-outline' as const, testID: 'button-internet' },
];

export default function BillsScreen() {
  const { data: bills, isLoading, refetch } = useQuery({
    queryKey: ['bills'],
    queryFn: () => api.get<Bill[]>('/api/bills'),
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
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

  if (isLoading) {
    return (
      <View style={styles.loadingContainer} testID="loading-bills">
        <ActivityIndicator size="large" color="#818CF8" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818CF8" />
      }
      testID="bills-screen"
    >
      <View style={styles.header}>
        <Text style={styles.subtitle}>Manage your</Text>
        <Text style={styles.title}>Bills & Payments</Text>
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
          <TouchableOpacity testID="link-view-all-bills">
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>

        {bills?.map((bill) => (
          <TouchableOpacity key={bill.id} style={styles.billItem} testID={`bill-item-${bill.id}`}>
            <View style={styles.billIcon}>
              <Ionicons name="document-text-outline" size={20} color="#94A3B8" />
            </View>
            <View style={styles.billDetails}>
              <Text style={styles.billName}>{bill.name}</Text>
              <Text style={styles.billProvider}>{bill.provider}</Text>
              <Text style={styles.billDue}>Due: {new Date(bill.dueDate).toLocaleDateString()}</Text>
            </View>
            <View style={styles.billRight}>
              <Text style={styles.billAmount}>{formatCurrency(bill.amount)}</Text>
              <View style={[styles.statusBadge, getStatusStyle(bill.status)]}>
                <Ionicons name={getStatusIcon(bill.status)} size={10} color="#FFFFFF" />
                <Text style={styles.statusText}>{bill.status}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {(!bills || bills.length === 0) && !isLoading && (
          <View style={styles.emptyContainer} testID="empty-bills">
            <Ionicons name="document-text-outline" size={48} color="#334155" />
            <Text style={styles.emptyText}>No bills found</Text>
            <Text style={styles.emptySubtext}>Your bills will appear here</Text>
          </View>
        )}
      </View>
    </ScrollView>
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
});
