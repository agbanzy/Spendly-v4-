import React from 'react';
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

interface Vendor {
  id: number;
  name: string;
  email: string;
  phone: string;
  category: string;
  status: string;
  totalPaid: number;
}

const categoryOptions = [
  'Technology',
  'Marketing',
  'Operations',
  'Finance',
  'Logistics',
  'Consulting',
  'Other',
];

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  category: 'Other',
};

export default function VendorsScreen() {
  const queryClient = useQueryClient();

  const { data: vendors, isLoading, refetch } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get<Vendor[]>('/api/vendors'),
  });

  const [refreshing, setRefreshing] = React.useState(false);
  const [modalVisible, setModalVisible] = React.useState(false);
  const [editingVendor, setEditingVendor] = React.useState<Vendor | null>(null);
  const [form, setForm] = React.useState(emptyForm);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Vendor>('/api/vendors', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      closeModal();
    },
    onError: (error: Error) => Alert.alert('Error', error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.put<Vendor>(`/api/vendors/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      closeModal();
    },
    onError: (error: Error) => Alert.alert('Error', error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/vendors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
    onError: (error: Error) => Alert.alert('Error', error.message),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const openCreateModal = () => {
    setEditingVendor(null);
    setForm(emptyForm);
    setModalVisible(true);
  };

  const openEditModal = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setForm({
      name: vendor.name,
      email: vendor.email || '',
      phone: vendor.phone || '',
      category: vendor.category || 'Other',
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingVendor(null);
    setForm(emptyForm);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      Alert.alert('Validation', 'Please enter a vendor name.');
      return;
    }
    if (!form.email.trim()) {
      Alert.alert('Validation', 'Please enter a vendor email.');
      return;
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      category: form.category,
    };

    if (editingVendor) {
      updateMutation.mutate({ id: editingVendor.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (vendor: Vendor) => {
    Alert.alert(
      'Delete Vendor',
      `Are you sure you want to delete "${vendor.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(vendor.id) },
      ]
    );
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

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer} testID="loading-vendors">
        <ActivityIndicator size="large" color="#818CF8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818CF8" />
        }
        testID="vendors-screen"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.subtitle}>Manage your</Text>
            <Text style={styles.title}>Vendors</Text>
          </View>
          <TouchableOpacity
            style={styles.headerAddButton}
            onPress={openCreateModal}
            testID="button-add-vendor-header"
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue} testID="text-vendor-count">
              {vendors?.length || 0}
            </Text>
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
            <TouchableOpacity onPress={openCreateModal} testID="button-add-vendor">
              <View style={styles.addButton}>
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text style={styles.addButtonText}>Add</Text>
              </View>
            </TouchableOpacity>
          </View>

          {vendors?.map((vendor) => (
            <TouchableOpacity
              key={vendor.id}
              style={styles.vendorItem}
              onPress={() => openEditModal(vendor)}
              onLongPress={() => handleDelete(vendor)}
              testID={`vendor-item-${vendor.id}`}
            >
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
                  <View
                    style={[
                      styles.statusDot,
                      vendor.status?.toLowerCase() === 'active'
                        ? styles.dotActive
                        : styles.dotInactive,
                    ]}
                  />
                  <Text style={styles.vendorStatus}>{vendor.status}</Text>
                </View>
              </View>
              <View style={styles.vendorRight}>
                <Text style={styles.totalPaidLabel}>Total Paid</Text>
                <Text style={styles.totalPaidAmount}>
                  {formatCurrency(vendor.totalPaid || 0)}
                </Text>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    onPress={() => openEditModal(vendor)}
                    testID={`button-edit-vendor-${vendor.id}`}
                  >
                    <Ionicons name="create-outline" size={18} color="#818CF8" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(vendor)}
                    testID={`button-delete-vendor-${vendor.id}`}
                  >
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {(!vendors || vendors.length === 0) && !isLoading && (
            <View style={styles.emptyContainer} testID="empty-vendors">
              <Ionicons name="people-outline" size={48} color="#334155" />
              <Text style={styles.emptyText}>No vendors found</Text>
              <Text style={styles.emptySubtext}>Add your first vendor</Text>
              <TouchableOpacity style={styles.emptyAddButton} onPress={openCreateModal}>
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <Text style={styles.emptyAddButtonText}>Add Vendor</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Create / Edit Vendor Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent testID="vendor-modal">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingVendor ? 'Edit Vendor' : 'New Vendor'}
              </Text>
              <TouchableOpacity onPress={closeModal} testID="button-close-modal">
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Vendor Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Acme Supplies"
                placeholderTextColor="#64748B"
                value={form.name}
                onChangeText={(val) => setForm({ ...form, name: val })}
                testID="input-vendor-name"
              />

              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="vendor@example.com"
                placeholderTextColor="#64748B"
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.email}
                onChangeText={(val) => setForm({ ...form, email: val })}
                testID="input-vendor-email"
              />

              <Text style={styles.inputLabel}>Phone</Text>
              <TextInput
                style={styles.input}
                placeholder="+1 (555) 000-0000"
                placeholderTextColor="#64748B"
                keyboardType="phone-pad"
                value={form.phone}
                onChangeText={(val) => setForm({ ...form, phone: val })}
                testID="input-vendor-phone"
              />

              <Text style={styles.inputLabel}>Category</Text>
              <View style={styles.categoryRow}>
                {categoryOptions.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      form.category === cat && styles.categoryChipActive,
                    ]}
                    onPress={() => setForm({ ...form, category: cat })}
                    testID={`chip-category-${cat.toLowerCase()}`}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        form.category === cat && styles.categoryChipTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeModal}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={isSaving}
                testID="button-save-vendor"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingVendor ? 'Update' : 'Create'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
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
  headerAddButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
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
    borderWidth: 1,
    borderColor: '#334155',
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
    color: '#94A3B8',
    fontSize: 16,
    marginTop: 12,
  },
  emptySubtext: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 4,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 20,
    gap: 6,
  },
  emptyAddButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
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
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  categoryChip: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  categoryChipText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
