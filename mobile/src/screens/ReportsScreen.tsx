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

interface Report {
  id: number;
  title: string;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
}

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
  const { data: reports, isLoading, refetch } = useQuery({
    queryKey: ['reports'],
    queryFn: () => api.get<Report[]>('/api/reports'),
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
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

  if (isLoading) {
    return (
      <View style={styles.loadingContainer} testID="loading-reports">
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
            style={[styles.filterChip, type === 'All' && styles.filterChipActive]}
            testID={`filter-${type.toLowerCase()}`}
          >
            <Text style={[styles.filterText, type === 'All' && styles.filterTextActive]}>
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All Reports</Text>
          <TouchableOpacity testID="button-generate-report">
            <View style={styles.generateButton}>
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.generateButtonText}>Generate</Text>
            </View>
          </TouchableOpacity>
        </View>

        {reports?.map((report) => (
          <TouchableOpacity key={report.id} style={styles.reportItem} testID={`report-item-${report.id}`}>
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
              <TouchableOpacity style={styles.downloadBtn} testID={`button-download-report-${report.id}`}>
                <Ionicons name="download-outline" size={18} color="#818CF8" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}

        {(!reports || reports.length === 0) && !isLoading && (
          <View style={styles.emptyContainer} testID="empty-reports">
            <Ionicons name="document-text-outline" size={48} color="#334155" />
            <Text style={styles.emptyText}>No reports generated</Text>
            <Text style={styles.emptySubtext}>Generate your first financial report</Text>
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
  downloadBtn: {
    padding: 4,
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
