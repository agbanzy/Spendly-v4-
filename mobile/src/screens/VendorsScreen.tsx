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

interface Vendor {
  id: number;
  name: string;
  email: string;
  phone: string;
  category: string;
  status: string;
  totalPaid: number;
}

export default function VendorsScreen() {
  const { data: vendors, isLoading, refetch } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get<Vendor[]>('/api/vendors'),
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer} testID="loading-vendors">
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
      testID="vendors-screen"
    >
      <View style={styles.header}>
        <Text style={styles.subtitle}>Manage your</Text>
        <Text style={styles.title}>Vendors</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue} testID="text-vendor-count">{vendors?.length || 0}</Text>
          <Text style={styles.summaryLabel}>Total Vendors</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue} testID="text-active-vendors">
            {vendors?.filter((v) => v.status?.toLowerCase() === 'active').length || 0}
          </Text>
          <Text style={styles.summaryLabel}>Active</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All Vendors</Text>
          <TouchableOpacity testID="button-add-vendor">
            <View style={styles.addButton}>
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add</Text>
            </View>
          </TouchableOpacity>
        </View>

        {vendors?.map((vendor) => (
          <TouchableOpacity key={vendor.id} style={styles.vendorItem} testID={`vendor-item-${vendor.id}`}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(vendor.name)}</Text>
            </View>
            <View style={styles.vendorDetails}>
              <Text style={styles.vendorName}>{vendor.name}</Text>
              <View style={styles.vendorMeta}>
                <Ionicons name="mail-outline" size={12} color="#64748B" />
                <Text style={styles.vendorEmail}>{vendor.email}</Text>
              </View>
              {vendor.phone && (
                <View style={styles.vendorMeta}>
                  <Ionicons name="call-outline" size={12} color="#64748B" />
                  <Text style={styles.vendorEmail}>{vendor.phone}</Text>
                </View>
              )}
              <View style={styles.vendorTags}>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{vendor.category}</Text>
                </View>
                <View style={[styles.statusDot, vendor.status?.toLowerCase() === 'active' ? styles.dotActive : styles.dotInactive]} />
                <Text style={styles.vendorStatus}>{vendor.status}</Text>
              </View>
            </View>
            <View style={styles.vendorRight}>
              <Text style={styles.totalPaidLabel}>Total Paid</Text>
              <Text style={styles.totalPaidAmount}>{formatCurrency(vendor.totalPaid || 0)}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {(!vendors || vendors.length === 0) && !isLoading && (
          <View style={styles.emptyContainer} testID="empty-vendors">
            <Ionicons name="people-outline" size={48} color="#334155" />
            <Text style={styles.emptyText}>No vendors found</Text>
            <Text style={styles.emptySubtext}>Add your first vendor</Text>
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
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#334155',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
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
  vendorItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#312E81',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#818CF8',
  },
  vendorDetails: {
    flex: 1,
    marginLeft: 12,
  },
  vendorName: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  vendorMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  vendorEmail: {
    fontSize: 12,
    color: '#64748B',
  },
  vendorTags: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  categoryBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 10,
    color: '#E2E8F0',
    textTransform: 'capitalize',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: '#34D399',
  },
  dotInactive: {
    backgroundColor: '#F87171',
  },
  vendorStatus: {
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'capitalize',
  },
  vendorRight: {
    alignItems: 'flex-end',
  },
  totalPaidLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  totalPaidAmount: {
    fontSize: 14,
    color: '#E2E8F0',
    fontWeight: '600',
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
});
