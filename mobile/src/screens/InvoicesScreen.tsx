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

interface Invoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  status: string;
  dueDate: string;
  createdAt: string;
}

export default function InvoicesScreen() {
  const { data: invoices, isLoading, refetch } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get<Invoice[]>('/api/invoices'),
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
  const totalPaid = invoices?.filter(inv => inv.status.toLowerCase() === 'paid').reduce((sum, inv) => sum + inv.amount, 0) || 0;
  const totalOutstanding = totalInvoiced - totalPaid;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer} testID="loading-invoices">
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
      testID="invoices-screen"
    >
      <View style={styles.header}>
        <Text style={styles.subtitle}>Manage your</Text>
        <Text style={styles.title}>Invoices</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="document-text" size={20} color="#818CF8" />
          <Text style={styles.statLabel}>Total Invoiced</Text>
          <Text style={styles.statValue} testID="text-total-invoiced">{formatCurrency(totalInvoiced)}</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={20} color="#34D399" />
          <Text style={styles.statLabel}>Paid</Text>
          <Text style={styles.statValue} testID="text-total-paid">{formatCurrency(totalPaid)}</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="time" size={20} color="#FBBF24" />
          <Text style={styles.statLabel}>Outstanding</Text>
          <Text style={styles.statValue} testID="text-total-outstanding">{formatCurrency(totalOutstanding)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All Invoices</Text>
          <TouchableOpacity testID="button-create-invoice">
            <View style={styles.addButton}>
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addButtonText}>New</Text>
            </View>
          </TouchableOpacity>
        </View>

        {invoices?.map((invoice) => (
          <TouchableOpacity key={invoice.id} style={styles.invoiceItem} testID={`invoice-item-${invoice.id}`}>
            <View style={styles.invoiceIcon}>
              <Ionicons name="receipt-outline" size={20} color="#94A3B8" />
            </View>
            <View style={styles.invoiceDetails}>
              <Text style={styles.invoiceClient}>{invoice.clientName}</Text>
              <Text style={styles.invoiceNumber}>INV-{String(invoice.invoiceNumber || invoice.id).padStart(3, '0')}</Text>
              <Text style={styles.invoiceDue}>Due: {new Date(invoice.dueDate).toLocaleDateString()}</Text>
            </View>
            <View style={styles.invoiceRight}>
              <Text style={styles.invoiceAmount}>{formatCurrency(invoice.amount)}</Text>
              <View style={[styles.statusBadge, getStatusStyle(invoice.status)]}>
                <Text style={styles.statusText}>{invoice.status}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {(!invoices || invoices.length === 0) && !isLoading && (
          <View style={styles.emptyContainer} testID="empty-invoices">
            <Ionicons name="receipt-outline" size={48} color="#334155" />
            <Text style={styles.emptyText}>No invoices yet</Text>
            <Text style={styles.emptySubtext}>Create your first invoice</Text>
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
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  statLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  addButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  invoiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  invoiceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  invoiceDetails: {
    flex: 1,
    marginLeft: 12,
  },
  invoiceClient: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  invoiceNumber: {
    fontSize: 12,
    color: '#818CF8',
    marginTop: 2,
  },
  invoiceDue: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  invoiceRight: {
    alignItems: 'flex-end',
  },
  invoiceAmount: {
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
  statusSent: {
    backgroundColor: '#1E40AF',
  },
  statusOverdue: {
    backgroundColor: '#991B1B',
  },
  statusDraft: {
    backgroundColor: '#334155',
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
