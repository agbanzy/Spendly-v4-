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

const reportTypeColors: Record<string, string> = {
  expense: '#F87171',
  revenue: '#34D399',
  budget: '#818CF8',
  tax: '#FBBF24',
  custom: '#94A3B8',
};

export default function ReportsScreen() {
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
      title: string;
      type: string;
      startDate: string;
      endDate: string;
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
    createReportMutation.mutate({
      title: reportName.trim(),
      type: reportType,
      startDate: startDate.trim(),
      endDate: endDate.trim(),
    });
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
    return reportTypeColors[type.toLowerCase()] || '#94A3B8';
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
                <Ionicons name="add" size={18} color="#FFFFFF" />
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
                  <TouchableOpacity style={styles.downloadBtn} testID={`button-download-report-${report.id}`}>
                    <Ionicons name="download-outline" size={18} color="#818CF8" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteReport(report)}
                    testID={`button-delete-report-${report.id}`}
                  >
                    <Ionicons name="trash-outline" size={18} color="#F87171" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

          {filteredReports.length === 0 && !isLoading && (
            <View style={styles.emptyContainer} testID="empty-reports">
              <Ionicons name="document-text-outline" size={48} color="#334155" />
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
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Report Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter report name"
              placeholderTextColor="#64748B"
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
                      color={reportType === type ? color : '#64748B'}
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
                <Ionicons name="calendar-outline" size={16} color="#64748B" style={styles.dateIcon} />
                <TextInput
                  style={styles.dateInput}
                  placeholder="Start (YYYY-MM-DD)"
                  placeholderTextColor="#64748B"
                  value={startDate}
                  onChangeText={setStartDate}
                  testID="input-start-date"
                />
              </View>
              <Text style={styles.dateSeparator}>to</Text>
              <View style={styles.dateInputWrapper}>
                <Ionicons name="calendar-outline" size={16} color="#64748B" style={styles.dateIcon} />
                <TextInput
                  style={styles.dateInput}
                  placeholder="End (YYYY-MM-DD)"
                  placeholderTextColor="#64748B"
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
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="analytics" size={18} color="#FFFFFF" />
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
  typeFilters: {
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 24,
  },
  filterChip: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  filterText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  filterTextActive: {
    color: '#FFFFFF',
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
    color: '#FFFFFF',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  generateButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  reportItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
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
    color: '#FFFFFF',
    fontWeight: '500',
  },
  reportMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  typeBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 10,
    color: '#E2E8F0',
    textTransform: 'capitalize',
  },
  reportDates: {
    fontSize: 11,
    color: '#64748B',
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
    backgroundColor: '#065F46',
  },
  statusGenerating: {
    backgroundColor: '#1E40AF',
  },
  statusDraft: {
    backgroundColor: '#334155',
  },
  statusText: {
    fontSize: 10,
    color: '#FFFFFF',
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
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
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
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  typeSelectorItemActive: {
    backgroundColor: '#0F172A',
  },
  typeSelectorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
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
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
  },
  dateIcon: {
    marginRight: 8,
  },
  dateInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 13,
    color: '#FFFFFF',
  },
  dateSeparator: {
    fontSize: 13,
    color: '#64748B',
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
