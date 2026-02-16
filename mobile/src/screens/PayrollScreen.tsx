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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();

  const { data: payroll, isLoading, refetch } = useQuery({
    queryKey: ['payroll'],
    queryFn: () => api.get<PayrollEntry[]>('/api/payroll'),
  });

  const [refreshing, setRefreshing] = React.useState(false);
  const [createModalVisible, setCreateModalVisible] = React.useState(false);
  const [employeeName, setEmployeeName] = React.useState('');
  const [employeeEmail, setEmployeeEmail] = React.useState('');
  const [salary, setSalary] = React.useState('');
  const [bonus, setBonus] = React.useState('');
  const [deductions, setDeductions] = React.useState('');
  const [department, setDepartment] = React.useState('');
  const [payDate, setPayDate] = React.useState('');

  const createPayrollMutation = useMutation({
    mutationFn: (data: {
      employeeName: string;
      employeeEmail: string;
      salary: number;
      bonus: number;
      deductions: number;
      department: string;
      payDate: string;
    }) => api.post('/api/payroll', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      setCreateModalVisible(false);
      resetCreateForm();
    },
    onError: () => {
      Alert.alert('Error', 'Failed to create payroll entry. Please try again.');
    },
  });

  const processPayrollMutation = useMutation({
    mutationFn: (id: number) =>
      api.patch(`/api/payroll/${id}`, { status: 'processing' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
    onError: () => {
      Alert.alert('Error', 'Failed to process payroll. Please try again.');
    },
  });

  const payIndividualMutation = useMutation({
    mutationFn: (id: number) =>
      api.patch(`/api/payroll/${id}`, { status: 'paid' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
    onError: () => {
      Alert.alert('Error', 'Failed to process payment. Please try again.');
    },
  });

  const resetCreateForm = () => {
    setEmployeeName('');
    setEmployeeEmail('');
    setSalary('');
    setBonus('');
    setDeductions('');
    setDepartment('');
    setPayDate('');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleCreatePayroll = () => {
    if (!employeeName.trim()) {
      Alert.alert('Validation', 'Please enter the employee name.');
      return;
    }
    const parsedSalary = Number(salary);
    if (!salary.trim() || isNaN(parsedSalary) || parsedSalary <= 0) {
      Alert.alert('Validation', 'Please enter a valid salary amount greater than zero.');
      return;
    }
    if (employeeEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employeeEmail.trim())) {
      Alert.alert('Validation', 'Please enter a valid email address.');
      return;
    }
    const parsedBonus = Number(bonus) || 0;
    const parsedDeductions = Number(deductions) || 0;
    if (parsedBonus < 0 || parsedDeductions < 0) {
      Alert.alert('Validation', 'Bonus and deductions cannot be negative.');
      return;
    }
    if (payDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(payDate.trim())) {
      Alert.alert('Validation', 'Please enter pay date in YYYY-MM-DD format.');
      return;
    }
    createPayrollMutation.mutate({
      employeeName: employeeName.trim(),
      employeeEmail: employeeEmail.trim(),
      salary: parsedSalary,
      bonus: parsedBonus,
      deductions: parsedDeductions,
      department: department.trim(),
      payDate: payDate.trim() || new Date().toISOString(),
    });
  };

  const handleProcessPayroll = () => {
    const pendingEntries = payroll?.filter(
      (p) => p.status.toLowerCase() === 'pending'
    );
    if (!pendingEntries || pendingEntries.length === 0) {
      Alert.alert('No Pending Entries', 'There are no pending payroll entries to process.');
      return;
    }
    Alert.alert(
      'Process Payroll',
      `Process ${pendingEntries.length} pending payroll entries?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Process All',
          onPress: () => {
            pendingEntries.forEach((entry) => {
              processPayrollMutation.mutate(entry.id);
            });
          },
        },
      ]
    );
  };

  const handlePayIndividual = (entry: PayrollEntry) => {
    if (entry.status.toLowerCase() === 'paid') {
      Alert.alert('Already Paid', 'This payroll entry has already been paid.');
      return;
    }
    Alert.alert(
      'Pay Employee',
      `Mark payment of ${formatCurrency(entry.netPay || entry.salary)} to ${entry.employeeName} as paid?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay Now',
          onPress: () => payIndividualMutation.mutate(entry.id),
        },
      ]
    );
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
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
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
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => setCreateModalVisible(true)}
                testID="button-add-payroll"
              >
                <View style={styles.addButton}>
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.addButtonText}>Add</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleProcessPayroll}
                testID="button-run-payroll"
              >
                <View style={styles.runButton}>
                  <Ionicons name="play" size={14} color="#FFFFFF" />
                  <Text style={styles.runButtonText}>Run Payroll</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {payroll?.map((entry) => (
            <View key={entry.id} style={styles.payrollItem} testID={`payroll-entry-${entry.id}`}>
              <View style={styles.payrollIcon}>
                <Ionicons name="person-outline" size={20} color="#94A3B8" />
              </View>
              <View style={styles.payrollDetails}>
                <Text style={styles.employeeName}>{entry.employeeName}</Text>
                {entry.department ? (
                  <Text style={styles.department}>{entry.department}</Text>
                ) : null}
                <Text style={styles.payDate}>
                  Pay date: {new Date(entry.payDate).toLocaleDateString()}
                </Text>
                {(entry.bonus > 0 || entry.deductions > 0) && (
                  <View style={styles.breakdownRow}>
                    {entry.bonus > 0 && (
                      <Text style={styles.bonusText}>+{formatCurrency(entry.bonus)} bonus</Text>
                    )}
                    {entry.deductions > 0 && (
                      <Text style={styles.deductionText}>-{formatCurrency(entry.deductions)} ded.</Text>
                    )}
                  </View>
                )}
              </View>
              <View style={styles.payrollRight}>
                <Text style={styles.salaryAmount}>{formatCurrency(entry.netPay || entry.salary)}</Text>
                <View style={[styles.statusBadge, getStatusStyle(entry.status)]}>
                  <Text style={styles.statusText}>{entry.status}</Text>
                </View>
                {entry.status.toLowerCase() !== 'paid' && (
                  <TouchableOpacity
                    style={styles.payButton}
                    onPress={() => handlePayIndividual(entry)}
                    testID={`button-pay-${entry.id}`}
                  >
                    <Ionicons name="card-outline" size={14} color="#818CF8" />
                    <Text style={styles.payButtonText}>Pay</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
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

      {/* Create Payroll Entry Modal */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
        testID="modal-create-payroll"
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Payroll Entry</Text>
                <TouchableOpacity
                  onPress={() => {
                    setCreateModalVisible(false);
                    resetCreateForm();
                  }}
                  testID="button-close-create-modal"
                >
                  <Ionicons name="close" size={24} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Employee Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter employee name"
                placeholderTextColor="#64748B"
                value={employeeName}
                onChangeText={setEmployeeName}
                testID="input-employee-name"
              />

              <Text style={styles.inputLabel}>Employee Email</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter employee email"
                placeholderTextColor="#64748B"
                keyboardType="email-address"
                autoCapitalize="none"
                value={employeeEmail}
                onChangeText={setEmployeeEmail}
                testID="input-employee-email"
              />

              <Text style={styles.inputLabel}>Salary</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter salary amount"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                value={salary}
                onChangeText={setSalary}
                testID="input-salary"
              />

              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Bonus</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0.00"
                    placeholderTextColor="#64748B"
                    keyboardType="numeric"
                    value={bonus}
                    onChangeText={setBonus}
                    testID="input-bonus"
                  />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Deductions</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0.00"
                    placeholderTextColor="#64748B"
                    keyboardType="numeric"
                    value={deductions}
                    onChangeText={setDeductions}
                    testID="input-deductions"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Department</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter department (optional)"
                placeholderTextColor="#64748B"
                value={department}
                onChangeText={setDepartment}
                testID="input-department"
              />

              <Text style={styles.inputLabel}>Pay Date</Text>
              <TextInput
                style={styles.textInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#64748B"
                value={payDate}
                onChangeText={setPayDate}
                testID="input-pay-date"
              />

              {salary ? (
                <View style={styles.netPayPreview}>
                  <Text style={styles.netPayLabel}>Net Pay Preview</Text>
                  <Text style={styles.netPayValue}>
                    {formatCurrency(
                      (Number(salary) || 0) + (Number(bonus) || 0) - (Number(deductions) || 0)
                    )}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.submitButton, createPayrollMutation.isPending && styles.submitButtonDisabled]}
                onPress={handleCreatePayroll}
                disabled={createPayrollMutation.isPending}
                testID="button-submit-payroll"
              >
                {createPayrollMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.submitButtonText}>Create Entry</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollView: {
    flex: 1,
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
    borderWidth: 1,
    borderColor: '#334155',
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  addButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
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
    alignItems: 'flex-start',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
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
  breakdownRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  bonusText: {
    fontSize: 11,
    color: '#34D399',
  },
  deductionText: {
    fontSize: 11,
    color: '#F87171',
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
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  payButtonText: {
    fontSize: 11,
    color: '#818CF8',
    fontWeight: '600',
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalScroll: {
    flex: 1,
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
    borderWidth: 1,
    borderColor: '#334155',
    borderBottomWidth: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 8,
    marginTop: 4,
  },
  textInput: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputHalf: {
    flex: 1,
  },
  netPayPreview: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  netPayLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
  },
  netPayValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#818CF8',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
