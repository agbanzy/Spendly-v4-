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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useTheme } from '../lib/theme-context';
import { ColorTokens } from '../lib/colors';

interface Report {
  id: number;
  title: string;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
}

const REPORT_TYPES = ['expense', 'revenue', 'budget', 'tax', 'custom'] as const;

const reportTypeIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  expense: 'receipt-outline',
  revenue: 'trending-up-outline',
  budget: 'pie-chart-outline',
  tax: 'document-text-outline',
  custom: 'construct-outline',
};

export default function ReportsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const reportTypeColors: Record<string, string> = {
    expense: colors.dangerLight,
    revenue: colors.colorGreen,
    budget: colors.accent,
    tax: colors.warningLight,
    custom: colors.textSecondary,
  };

  const queryClient = useQueryClient();

  const { data: reports, isLoading, refetch } = useQuery({
    queryKey: ['reports'],
    queryFn: () => api.get<Report[]>('/api/reports'),
  });

  const [refreshing, setRefreshing] = React.useState(false);
  const [generateModalVisible, setGenerateModalVisible] = React.useState(false);
  const [activeFilter, setActiveFilter] = React.useState('All');
  const [reportName, setReportName] = React.useState('');
  const [reportType, setReportType] = React.useState<string>('expense');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');

  const createReportMutation = useMutation({
    mutationFn: (data: {
      name: string;
      type: string;
      dateRange: string;
    }) => api.post('/api/reports', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setGenerateModalVisible(false);
      resetGenerateForm();
    },
    onError: () => {
      Alert.alert('Error', 'Failed to generate report. Please try again.');
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/reports/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: () => {
      Alert.alert('Error', 'Failed to delete report. Please try again.');
    },
  });

  const resetGenerateForm = () => {
    setReportName('');
    setReportType('expense');
    setStartDate('');
    setEndDate('');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleGenerateReport = () => {
    if (!reportName.trim()) {
      Alert.alert('Validation', 'Please enter a report name.');
      return;
    }
    if (!startDate.trim()) {
      Alert.alert('Validation', 'Please enter a start date.');
      return;
    }
    if (!endDate.trim()) {
      Alert.alert('Validation', 'Please enter an end date.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate.trim()) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate.trim())) {
      Alert.alert('Validation', 'Please enter dates in YYYY-MM-DD format.');
      return;
    }
    if (new Date(startDate.trim()) >= new Date(endDate.trim())) {
      Alert.alert('Validation', 'End date must be after start date.');
      return;
    }
    createReportMutation.mutate({
      name: reportName.trim(),
      type: reportType,
      dateRange: `${startDate.trim()} - ${endDate.trim()}`,
    });
  };

  const handleDownloadReport = async (report: Report) => {
    if (report.status.toLowerCase() !== 'completed') {
      Alert.alert('Not Ready', 'This report is still being generated. Please wait until it completes.');
      return;
    }
    try {
      const result = await api.get<{ url: string; message?: string }>(`/api/reports/${report.id}/download`);
      if (result.url) {
        await Linking.openURL(result.url);
      } else {
        Alert.alert('Success', result.message || 'Report download initiated.');
      }
    } catch (error: any) {
      Alert.alert('Download Failed', error?.message || 'Failed to download report. Please try again.');
    }
  };

  const handleDeleteReport = (report: Report) => {
    Alert.alert(
      'Delete Report',
      `Are you sure you want to delete "${report.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteReportMutation.mutate(report.id),
        },
      ]
    );
  };

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return styles.statusCompleted;
      case 'generating':
      case 'processing':
        return styles.statusGenerating;
      case 'draft':
        return styles.statusDraft;
      default:
        return styles.statusDraft;
    }
  };

  const getReportIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    return reportTypeIcons[type.toLowerCase()] || 'document-outline';
  };

  const getReportColor = (type: string): string => {
    return reportTypeColors[type.toLowerCase()] || colors.textSecondary;
  };

  const filteredReports = React.useMemo(() => {
    if (!reports) return [];
    if (activeFilter === 'All') return reports;
    return reports.filter(
      (r) => r.type.toLowerCase() === activeFilter.toLowerCase()
    );
  }, [reports, activeFilter]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer} testID="loading-reports">
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
        testID="reports-screen"
      >
        <View style={styles.header}>
          <Text style={styles.subtitle}>Financial</Text>
          <Text style={styles.title}>Reports</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeFilters}
        >
          {['All', 'Expense', 'Revenue', 'Budget', 'Tax', 'Custom'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterChip,
                activeFilter === type && styles.filterChipActive,
              ]}
              onPress={() => setActiveFilter(type)}
              testID={`filter-${type.toLowerCase()}`}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === type && styles.filterTextActive,
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {activeFilter === 'All' ? 'All Reports' : `${activeFilter} Reports`}
            </Text>
            <TouchableOpacity
              onPress={() => setGenerateModalVisible(true)}
              testID="button-generate-report"
            >
              <View style={styles.generateButton}>
                <Ionicons name="add" size={18} color={colors.primaryForeground} />
                <Text style={styles.generateButtonText}>Generate</Text>
              </View>
            </TouchableOpacity>
          </View>

          {filteredReports.map((report) => (
            <View key={report.id} style={styles.reportItem} testID={`report-item-${report.id}`}>
              <View style={[styles.reportIcon, { backgroundColor: getReportColor(report.type) + '20' }]}>
                <Ionicons name={getReportIcon(report.type)} size={20} color={getReportColor(report.type)} />
              </View>
              <View style={styles.reportDetails}>
                <Text style={styles.reportTitle}>{report.title}</Text>
                <View style={styles.reportMeta}>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeText}>{report.type}</Text>
                  </View>
                </View>
                <Text style={styles.reportDates}>
                  {new Date(report.startDate).toLocaleDateString()} - {new Date(report.endDate).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.reportRight}>
                <View style={[styles.statusBadge, getStatusStyle(report.status)]}>
                  <Text style={styles.statusText}>{report.status}</Text>
                </View>
                <View style={styles.reportActions}>
                  <TouchableOpacity style={styles.downloadBtn} onPress={() => handleDownloadReport(report)} testID={`button-download-report-${report.id}`}>
                    <Ionicons name="download-outline" size={18} color={colors.accent} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteReport(report)}
                    testID={`button-delete-report-${report.id}`}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.dangerLight} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

          {filteredReports.length === 0 && !isLoading && (
            <View style={styles.emptyContainer} testID="empty-reports">
              <Ionicons name="document-text-outline" size={48} color={colors.border} />
              <Text style={styles.emptyText}>No reports generated</Text>
              <Text style={styles.emptySubtext}>Generate your first financial report</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Generate Report Modal */}
      <Modal
        visible={generateModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setGenerateModalVisible(false)}
        testID="modal-generate-report"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Generate Report</Text>
              <TouchableOpacity
                onPress={() => {
                  setGenerateModalVisible(false);
                  resetGenerateForm();
                }}
                testID="button-close-generate-modal"
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Report Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter report name"
              placeholderTextColor={colors.placeholderText}
              value={reportName}
              onChangeText={setReportName}
              testID="input-report-name"
            />

            <Text style={styles.inputLabel}>Report Type</Text>
            <View style={styles.typeSelector}>
              {REPORT_TYPES.map((type) => {
                const color = getReportColor(type);
                const icon = getReportIcon(type);
                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeSelectorItem,
                      reportType === type && styles.typeSelectorItemActive,
                      reportType === type && { borderColor: color },
                    ]}
                    onPress={() => setReportType(type)}
                    testID={`select-type-${type}`}
                  >
                    <Ionicons
                      name={icon}
                      size={16}
                      color={reportType === type ? color : colors.placeholderText}
                    />
                    <Text
                      style={[
                        styles.typeSelectorText,
                        reportType === type && { color },
                      ]}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>Date Range</Text>
            <View style={styles.dateRangeRow}>
              <View style={styles.dateInputWrapper}>
                <Ionicons name="calendar-outline" size={16} color={colors.placeholderText} style={styles.dateIcon} />
                <TextInput
                  style={styles.dateInput}
                  placeholder="Start (YYYY-MM-DD)"
                  placeholderTextColor={colors.placeholderText}
                  value={startDate}
                  onChangeText={setStartDate}
                  testID="input-start-date"
                />
              </View>
              <Text style={styles.dateSeparator}>to</Text>
              <View style={styles.dateInputWrapper}>
                <Ionicons name="calendar-outline" size={16} color={colors.placeholderText} style={styles.dateIcon} />
                <TextInput
                  style={styles.dateInput}
                  placeholder="End (YYYY-MM-DD)"
                  placeholderTextColor={colors.placeholderText}
                  value={endDate}
                  onChangeText={setEndDate}
                  testID="input-end-date"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, createReportMutation.isPending && styles.submitButtonDisabled]}
              onPress={handleGenerateReport}
              disabled={createReportMutation.isPending}
              testID="button-submit-report"
            >
              {createReportMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Ionicons name="analytics" size={18} color={colors.primaryForeground} />
                  <Text style={styles.submitButtonText}>Generate Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
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
    typeFilters: {
      paddingHorizontal: 20,
      gap: 8,
      marginBottom: 24,
    },
    filterChip: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    filterTextActive: {
      color: colors.primaryForeground,
      fontWeight: '500',
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
    generateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 4,
    },
    generateButtonText: {
      fontSize: 13,
      color: colors.primaryForeground,
      fontWeight: '500',
    },
    reportItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    reportIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reportDetails: {
      flex: 1,
      marginLeft: 12,
    },
    reportTitle: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    reportMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
      gap: 6,
    },
    typeBadge: {
      backgroundColor: colors.border,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    typeText: {
      fontSize: 10,
      color: colors.textSoft,
      textTransform: 'capitalize',
    },
    reportDates: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 4,
    },
    reportRight: {
      alignItems: 'flex-end',
      gap: 8,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    statusCompleted: {
      backgroundColor: colors.successSubtle,
    },
    statusGenerating: {
      backgroundColor: colors.infoSubtle,
    },
    statusDraft: {
      backgroundColor: colors.border,
    },
    statusText: {
      fontSize: 10,
      color: colors.textPrimary,
      textTransform: 'capitalize',
    },
    reportActions: {
      flexDirection: 'row',
      gap: 8,
    },
    downloadBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    deleteBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
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
    typeSelector: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    typeSelectorItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    typeSelectorItemActive: {
      backgroundColor: colors.background,
    },
    typeSelectorText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.placeholderText,
      textTransform: 'capitalize',
    },
    dateRangeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 20,
    },
    dateInputWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      paddingHorizontal: 12,
    },
    dateIcon: {
      marginRight: 8,
    },
    dateInput: {
      flex: 1,
      paddingVertical: 14,
      fontSize: 13,
      color: colors.inputText,
    },
    dateSeparator: {
      fontSize: 13,
      color: colors.placeholderText,
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
