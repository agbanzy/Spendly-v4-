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

interface PayrollEntry {
  id: number;
  employeeName: string;
  employeeEmail: string;
  salary: number;
  bonus: number;
  deductions: number;
  netPay: number;
  status: string;
  payDate: string;
  department: string;
}

export default function PayrollScreen() {
  const { data: payroll, isLoading, refetch } = useQuery({
    queryKey: ['payroll'],
    queryFn: () => api.get<PayrollEntry[]>('/api/payroll'),
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

  const totalPayroll = payroll?.reduce((sum, p) => sum + (p.netPay || p.salary), 0) || 0;
  const paidCount = payroll?.filter((p) => p.status.toLowerCase() === 'paid').length || 0;
  const pendingCount = payroll?.filter((p) => p.status.toLowerCase() === 'pending').length || 0;

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return styles.statusPaid;
      case 'pending':
        return styles.statusPending;
      case 'processing':
        return styles.statusProcessing;
      default:
        return styles.statusPending;
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer} testID="loading-payroll">
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
      testID="payroll-screen"
    >
      <View style={styles.header}>
        <Text style={styles.subtitle}>Manage your</Text>
        <Text style={styles.title}>Payroll</Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Payroll</Text>
        <Text style={styles.summaryAmount} testID="text-total-payroll">{formatCurrency(totalPayroll)}</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <View style={[styles.summaryDot, { backgroundColor: '#34D399' }]} />
            <Text style={styles.summaryItemLabel}>Paid</Text>
            <Text style={styles.summaryItemValue} testID="text-paid-count">{paidCount}</Text>
          </View>
          <View style={styles.summaryItem}>
            <View style={[styles.summaryDot, { backgroundColor: '#FBBF24' }]} />
            <Text style={styles.summaryItemLabel}>Pending</Text>
            <Text style={styles.summaryItemValue} testID="text-pending-count">{pendingCount}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Payroll Entries</Text>
          <TouchableOpacity testID="button-run-payroll">
            <View style={styles.runButton}>
              <Ionicons name="play" size={14} color="#FFFFFF" />
              <Text style={styles.runButtonText}>Run Payroll</Text>
            </View>
          </TouchableOpacity>
        </View>

        {payroll?.map((entry) => (
          <TouchableOpacity key={entry.id} style={styles.payrollItem} testID={`payroll-entry-${entry.id}`}>
            <View style={styles.payrollIcon}>
              <Ionicons name="person-outline" size={20} color="#94A3B8" />
            </View>
            <View style={styles.payrollDetails}>
              <Text style={styles.employeeName}>{entry.employeeName}</Text>
              {entry.department && (
                <Text style={styles.department}>{entry.department}</Text>
              )}
              <Text style={styles.payDate}>
                Pay date: {new Date(entry.payDate).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.payrollRight}>
              <Text style={styles.salaryAmount}>{formatCurrency(entry.netPay || entry.salary)}</Text>
              <View style={[styles.statusBadge, getStatusStyle(entry.status)]}>
                <Text style={styles.statusText}>{entry.status}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {(!payroll || payroll.length === 0) && !isLoading && (
          <View style={styles.emptyContainer} testID="empty-payroll">
            <Ionicons name="cash-outline" size={48} color="#334155" />
            <Text style={styles.emptyText}>No payroll entries</Text>
            <Text style={styles.emptySubtext}>Run your first payroll cycle</Text>
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
  summaryCard: {
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  summaryAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 24,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryItemLabel: {
    fontSize: 13,
    color: '#94A3B8',
  },
  summaryItemValue: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
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
  runButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  runButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  payrollItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  payrollIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payrollDetails: {
    flex: 1,
    marginLeft: 12,
  },
  employeeName: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  department: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  payDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  payrollRight: {
    alignItems: 'flex-end',
  },
  salaryAmount: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  statusPaid: {
    backgroundColor: '#065F46',
  },
  statusPending: {
    backgroundColor: '#92400E',
  },
  statusProcessing: {
    backgroundColor: '#1E40AF',
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
