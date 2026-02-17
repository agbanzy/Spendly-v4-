import React, { useMemo } from 'react';
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
import { useTheme } from '../lib/theme-context';
import { useCompany } from '../lib/company-context';
import { ColorTokens } from '../lib/colors';

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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { activeCompany, canManagePayroll } = useCompany();

  const queryClient = useQueryClient();
  const companyId = activeCompany?.id;

  const { data: payroll, isLoading, refetch } = useQuery({
    queryKey: ['payroll', companyId],
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

  const processPayrollMutation = useMutation<{ message: string; summary: any }, Error, void>({
    mutationFn: () =>
      api.post<{ message: string; summary: any }>('/api/payroll/process', {}),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      const summary = result.summary;
      Alert.alert(
        'Payroll Processed',
        summary
          ? `${summary.initiated} initiated, ${summary.failed} failed, ${summary.needsBankingDetails} need bank details`
          : result.message || 'Payroll processed'
      );
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message || 'Failed to process payroll. Please try again.');
    },
  });

  const payIndividualMutation = useMutation({
    mutationFn: (id: number) =>
      api.post<{ message: string; status: string; reference?: string }>(`/api/payroll/${id}/pay`, {}),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      Alert.alert('Payment Initiated', result.message || 'Transfer is being processed');
    },
    onError: (error: Error) => {
      Alert.alert('Payment Failed', error.message || 'Failed to process payment. Please try again.');
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
            processPayrollMutation.mutate();
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
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        testID="payroll-screen"
      >
        <View style={styles.header}>
          <Text style={styles.subtitle}>{activeCompany ? activeCompany.name : 'Manage your'}</Text>
          <Text style={styles.title}>Payroll</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Payroll</Text>
          <Text style={styles.summaryAmount} testID="text-total-payroll">{formatCurrency(totalPayroll)}</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryDot, { backgroundColor: colors.colorGreen }]} />
              <Text style={styles.summaryItemLabel}>Paid</Text>
              <Text style={styles.summaryItemValue} testID="text-paid-count">{paidCount}</Text>
            </View>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryDot, { backgroundColor: colors.warningLight }]} />
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
                  <Ionicons name="add" size={16} color={colors.primaryForeground} />
                  <Text style={styles.addButtonText}>Add</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleProcessPayroll}
                testID="button-run-payroll"
              >
                <View style={styles.runButton}>
                  <Ionicons name="play" size={14} color={colors.primaryForeground} />
                  <Text style={styles.runButtonText}>Run Payroll</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {payroll?.map((entry) => (
            <View key={entry.id} style={styles.payrollItem} testID={`payroll-entry-${entry.id}`}>
              <View style={styles.payrollIcon}>
                <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
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
                    <Ionicons name="card-outline" size={14} color={colors.accent} />
                    <Text style={styles.payButtonText}>Pay</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          {(!payroll || payroll.length === 0) && !isLoading && (
            <View style={styles.emptyContainer} testID="empty-payroll">
              <Ionicons name="cash-outline" size={48} color={colors.border} />
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
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Employee Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter employee name"
                placeholderTextColor={colors.placeholderText}
                value={employeeName}
                onChangeText={setEmployeeName}
                testID="input-employee-name"
              />

              <Text style={styles.inputLabel}>Employee Email</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter employee email"
                placeholderTextColor={colors.placeholderText}
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
                placeholderTextColor={colors.placeholderText}
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
                    placeholderTextColor={colors.placeholderText}
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
                    placeholderTextColor={colors.placeholderText}
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
                placeholderTextColor={colors.placeholderText}
                value={department}
                onChangeText={setDepartment}
                testID="input-department"
              />

              <Text style={styles.inputLabel}>Pay Date</Text>
              <TextInput
                style={styles.textInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.placeholderText}
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
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color={colors.primaryForeground} />
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

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
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
    summaryCard: {
      backgroundColor: colors.surface,
      marginHorizontal: 20,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    summaryAmount: {
      fontSize: 32,
      fontWeight: 'bold',
      color: colors.textPrimary,
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
      color: colors.textSecondary,
    },
    summaryItemValue: {
      fontSize: 13,
      color: colors.textPrimary,
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
      color: colors.textPrimary,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 8,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addButtonText: {
      fontSize: 13,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    runButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 6,
    },
    runButtonText: {
      fontSize: 13,
      color: colors.primaryForeground,
      fontWeight: '500',
    },
    payrollItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    payrollIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    payrollDetails: {
      flex: 1,
      marginLeft: 12,
    },
    employeeName: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    department: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    payDate: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
    },
    breakdownRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    bonusText: {
      fontSize: 11,
      color: colors.colorGreen,
    },
    deductionText: {
      fontSize: 11,
      color: colors.dangerLight,
    },
    payrollRight: {
      alignItems: 'flex-end',
    },
    salaryAmount: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      marginTop: 4,
    },
    statusPaid: {
      backgroundColor: colors.successSubtle,
    },
    statusPending: {
      backgroundColor: colors.kycPendingBg,
    },
    statusProcessing: {
      backgroundColor: colors.infoSubtle,
    },
    statusText: {
      fontSize: 10,
      color: colors.textPrimary,
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
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    payButtonText: {
      fontSize: 11,
      color: colors.accent,
      fontWeight: '600',
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
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.modalOverlay,
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
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 40,
      borderWidth: 1,
      borderColor: colors.border,
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
      color: colors.textPrimary,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
      marginTop: 4,
    },
    textInput: {
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 14,
      fontSize: 15,
      color: colors.inputText,
      borderWidth: 1,
      borderColor: colors.inputBorder,
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
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    netPayLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    netPayValue: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.accent,
    },
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
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
      color: colors.primaryForeground,
    },
  });
}
