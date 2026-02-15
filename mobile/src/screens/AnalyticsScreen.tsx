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


// Type definitions
interface KPIData {
  totalRevenue: number;
  totalExpenses: number;
  totalOutflow: number;
  netCashFlow: number;
  profitMargin: number;
  burnRate: number;
  runwayMonths: number;
  totalBudget: number;
  totalBudgetSpent: number;
  budgetUtilization: number;
  totalPayroll: number;
  totalBillsPaid: number;
  totalBillsPending: number;
  invoiceRevenue: number;
  invoicePending: number;
  totalWalletBalance: number;
  activeVendors: number;
  totalVendorPayments: number;
  expenseGrowthRate: number;
  expenseCount: number;
  pendingExpenses: number;
  approvedExpenses: number;
  transactionCount: number;
  overdueBills: number;
}

interface MonthlyData {
  month: string;
  inflow: number;
  outflow: number;
  net: number;
  expenses: number;
  payroll: number;
  bills: number;
  invoiceIncome: number;
}

interface CashFlowData {
  monthlyData: MonthlyData[];
  waterfall: unknown;
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
}

interface Insight {
  title: string;
  summary: string;
  category: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  recommendation: string;
  metric: string;
  metricValue: number | string;
}

interface InsightsData {
  insights: Insight[];
}

// Stat card component
interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  color: string;
  testID?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, testID }) => (
  <View style={[styles.statCard, { borderLeftColor: color, borderLeftWidth: 3 }]} testID={testID}>
    <View style={[styles.statIconContainer, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon as any} size={24} color={color} />
    </View>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue} testID={`${testID}-value`}>{value}</Text>
  </View>
);

// Insight card component
interface InsightCardProps {
  insight: Insight;
  testID?: string;
}

const InsightCard: React.FC<InsightCardProps> = ({ insight, testID }) => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#EF4444';
      case 'warning':
        return '#F59E0B';
      case 'info':
        return '#3B82F6';
      case 'success':
        return '#10B981';
      default:
        return '#3B82F6';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'alert-circle';
      case 'warning':
        return 'warning';
      case 'info':
        return 'information-circle';
      case 'success':
        return 'checkmark-circle';
      default:
        return 'information-circle';
    }
  };

  const severityColor = getSeverityColor(insight.severity);

  return (
    <View style={styles.insightCard} testID={testID}>
      <View style={styles.insightHeader}>
        <View style={[styles.severityBadge, { backgroundColor: severityColor + '20' }]}>
          <Ionicons name={getSeverityIcon(insight.severity) as any} size={16} color={severityColor} />
          <Text style={[styles.severityText, { color: severityColor }]}>
            {insight.severity.charAt(0).toUpperCase() + insight.severity.slice(1)}
          </Text>
        </View>
      </View>
      <Text style={styles.insightTitle}>{insight.title}</Text>
      <Text style={styles.insightSummary}>{insight.summary}</Text>
      <View style={styles.insightMetric}>
        <Text style={styles.metricLabel}>{insight.metric}:</Text>
        <Text style={styles.metricValue}>{insight.metricValue}</Text>
      </View>
      <Text style={styles.insightRecommendation}>{insight.recommendation}</Text>
    </View>
  );
};

// Monthly bar chart component
interface MonthlyBarProps {
  data: MonthlyData;
  maxValue: number;
  testID?: string;
}

const MonthlyBar: React.FC<MonthlyBarProps> = ({ data, maxValue, testID }) => {
  const inflowHeight = (data.inflow / maxValue) * 100;
  const outflowHeight = (data.outflow / maxValue) * 100;

  return (
    <View style={styles.monthlyBarContainer} testID={testID}>
      <View style={styles.barsWrapper}>
        <View style={styles.barPair}>
          <View style={[styles.barColumn, { height: `${inflowHeight}%` }]}>
            <View style={[styles.bar, styles.inflowBar]} />
          </View>
          <View style={[styles.barColumn, { height: `${outflowHeight}%` }]}>
            <View style={[styles.bar, styles.outflowBar]} />
          </View>
        </View>
      </View>
      <Text style={styles.monthLabel}>{data.month.slice(0, 3)}</Text>
    </View>
  );
};

export default function AnalyticsScreen() {
  const [refreshing, setRefreshing] = React.useState(false);

  // Fetch KPI data
  const { data: kpiData, isLoading: kpiLoading, refetch: refetchKPI } = useQuery({
    queryKey: ['/api/analytics/kpis'],
    queryFn: () => api.get<KPIData>('/api/analytics/kpis'),
  });

  // Fetch cash flow data
  const { data: cashFlowData, isLoading: cashFlowLoading, refetch: refetchCashFlow } = useQuery({
    queryKey: ['/api/analytics/cash-flow'],
    queryFn: () => api.get<CashFlowData>('/api/analytics/cash-flow'),
  });

  // Fetch insights data
  const { data: insightsData, isLoading: insightsLoading, refetch: refetchInsights } = useQuery({
    queryKey: ['/api/analytics/insights'],
    queryFn: () => api.get<InsightsData>('/api/analytics/insights'),
  });

  const isLoading = kpiLoading || cashFlowLoading || insightsLoading;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchKPI(), refetchCashFlow(), refetchInsights()]);
    setRefreshing(false);
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const formatRunway = (value: number) => {
    return `${value.toFixed(1)} months`;
  };

  // Calculate max value for cash flow bars
  const maxCashFlowValue = React.useMemo(() => {
    if (!cashFlowData?.monthlyData || cashFlowData.monthlyData.length === 0) return 1;
    return Math.max(
      ...cashFlowData.monthlyData.map((d) => Math.max(d.inflow, d.outflow))
    );
  }, [cashFlowData]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer} testID="loading-analytics">
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
      testID="analytics-screen"
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.subtitle}>Business Performance</Text>
        <Text style={styles.title}>Analytics</Text>
      </View>

      {/* Section 1: KPI Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Key Performance Indicators</Text>

        {kpiData ? (
          <View style={styles.statGrid}>
            <StatCard
              icon="trending-up"
              label="Total Revenue"
              value={formatCurrency(kpiData.totalRevenue)}
              color="#10B981"
              testID="kpi-revenue"
            />
            <StatCard
              icon="trending-down"
              label="Total Expenses"
              value={formatCurrency(kpiData.totalExpenses)}
              color="#EF4444"
              testID="kpi-expenses"
            />
            <StatCard
              icon="cash"
              label="Net Cash Flow"
              value={formatCurrency(kpiData.netCashFlow)}
              color={kpiData.netCashFlow >= 0 ? '#10B981' : '#EF4444'}
              testID="kpi-cash-flow"
            />
            <StatCard
              icon="percent"
              label="Profit Margin"
              value={formatPercent(kpiData.profitMargin)}
              color="#3B82F6"
              testID="kpi-margin"
            />
            <StatCard
              icon="flash"
              label="Burn Rate"
              value={formatCurrency(kpiData.burnRate)}
              color="#F59E0B"
              testID="kpi-burn-rate"
            />
            <StatCard
              icon="hourglass"
              label="Runway"
              value={formatRunway(kpiData.runwayMonths)}
              color="#818CF8"
              testID="kpi-runway"
            />
          </View>
        ) : (
          <Text style={styles.emptyText}>No KPI data available</Text>
        )}
      </View>

      {/* Section 2: Cash Flow Trend */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cash Flow Trend (12 Months)</Text>

        {cashFlowData?.monthlyData && cashFlowData.monthlyData.length > 0 ? (
          <View>
            <View style={styles.cashFlowLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, styles.inflowColor]} />
                <Text style={styles.legendText}>Inflow</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, styles.outflowColor]} />
                <Text style={styles.legendText}>Outflow</Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
              testID="cash-flow-scroll"
            >
              <View style={styles.cashFlowContainer}>
                {cashFlowData.monthlyData.map((month, index) => (
                  <MonthlyBar
                    key={index}
                    data={month}
                    maxValue={maxCashFlowValue}
                    testID={`monthly-bar-${index}`}
                  />
                ))}
              </View>
            </ScrollView>

            {/* Cash Flow Summary */}
            <View style={styles.cashFlowSummary}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Inflow</Text>
                <Text style={[styles.summaryValue, styles.inflowText]}>
                  {formatCurrency(cashFlowData.totalInflow)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Outflow</Text>
                <Text style={[styles.summaryValue, styles.outflowText]}>
                  {formatCurrency(cashFlowData.totalOutflow)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Net Cash Flow</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    cashFlowData.netCashFlow >= 0 ? styles.positiveText : styles.negativeText,
                  ]}
                >
                  {formatCurrency(cashFlowData.netCashFlow)}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <Text style={styles.emptyText}>No cash flow data available</Text>
        )}
      </View>

      {/* Section 3: Business Insights */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Business Insights</Text>

        {insightsData?.insights && insightsData.insights.length > 0 ? (
          <View>
            {insightsData.insights.map((insight, index) => (
              <InsightCard
                key={index}
                insight={insight}
                testID={`insight-card-${index}`}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer} testID="empty-insights">
            <Ionicons name="insights-outline" size={48} color="#334155" />
            <Text style={styles.emptyText}>No insights available</Text>
          </View>
        )}
      </View>

      {/* Bottom padding */}
      <View style={styles.bottomPadding} />
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
    paddingBottom: 24,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '400',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },

  // KPI Grid
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
    marginBottom: 6,
    textTransform: 'capitalize',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Cash Flow
  cashFlowLegend: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  inflowColor: {
    backgroundColor: '#10B981',
  },
  outflowColor: {
    backgroundColor: '#EF4444',
  },
  legendText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  horizontalScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  cashFlowContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 20,
  },
  monthlyBarContainer: {
    width: 60,
    height: 140,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barsWrapper: {
    height: 110,
    width: '100%',
    justifyContent: 'flex-end',
  },
  barPair: {
    flexDirection: 'row',
    gap: 4,
    height: '100%',
    alignItems: 'flex-end',
  },
  barColumn: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 2,
  },
  inflowBar: {
    backgroundColor: '#10B981',
  },
  outflowBar: {
    backgroundColor: '#EF4444',
  },
  monthLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 8,
    fontWeight: '500',
  },
  cashFlowSummary: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  inflowText: {
    color: '#10B981',
  },
  outflowText: {
    color: '#EF4444',
  },
  positiveText: {
    color: '#10B981',
  },
  negativeText: {
    color: '#EF4444',
  },

  // Insights
  insightCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#334155',
  },
  insightHeader: {
    marginBottom: 12,
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  severityText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  insightSummary: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 18,
    marginBottom: 10,
  },
  insightMetric: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  metricLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 12,
    color: '#818CF8',
    fontWeight: '700',
  },
  insightRecommendation: {
    fontSize: 12,
    color: '#A1A5B4',
    lineHeight: 16,
    fontStyle: 'italic',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#64748B',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
  },

  // Bottom padding
  bottomPadding: {
    height: 40,
  },
});
