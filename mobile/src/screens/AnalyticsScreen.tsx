import React, { useMemo } from 'react';
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
import { useTheme } from '../lib/theme-context';
import { ColorTokens } from '../lib/colors';


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
  colors: ColorTokens;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, testID, colors }) => {
  const cardStyles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[cardStyles.statCard, { borderLeftColor: color, borderLeftWidth: 3 }]} testID={testID}>
      <View style={[cardStyles.statIconContainer, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <Text style={cardStyles.statLabel}>{label}</Text>
      <Text style={cardStyles.statValue} testID={`${testID}-value`}>{value}</Text>
    </View>
  );
};

// Insight card component
interface InsightCardProps {
  insight: Insight;
  testID?: string;
  colors: ColorTokens;
}

const InsightCard: React.FC<InsightCardProps> = ({ insight, testID, colors }) => {
  const cardStyles = useMemo(() => createStyles(colors), [colors]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return colors.danger;
      case 'warning':
        return colors.warning;
      case 'info':
        return colors.info;
      case 'success':
        return colors.success;
      default:
        return colors.info;
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
    <View style={cardStyles.insightCard} testID={testID}>
      <View style={cardStyles.insightHeader}>
        <View style={[cardStyles.severityBadge, { backgroundColor: severityColor + '20' }]}>
          <Ionicons name={getSeverityIcon(insight.severity) as any} size={16} color={severityColor} />
          <Text style={[cardStyles.severityText, { color: severityColor }]}>
            {insight.severity.charAt(0).toUpperCase() + insight.severity.slice(1)}
          </Text>
        </View>
      </View>
      <Text style={cardStyles.insightTitle}>{insight.title}</Text>
      <Text style={cardStyles.insightSummary}>{insight.summary}</Text>
      <View style={cardStyles.insightMetric}>
        <Text style={cardStyles.metricLabel}>{insight.metric}:</Text>
        <Text style={cardStyles.metricValue}>{insight.metricValue}</Text>
      </View>
      <Text style={cardStyles.insightRecommendation}>{insight.recommendation}</Text>
    </View>
  );
};

// Monthly bar chart component
interface MonthlyBarProps {
  data: MonthlyData;
  maxValue: number;
  testID?: string;
  colors: ColorTokens;
}

const MonthlyBar: React.FC<MonthlyBarProps> = ({ data, maxValue, testID, colors }) => {
  const barStyles = useMemo(() => createStyles(colors), [colors]);
  const inflowHeight = (data.inflow / maxValue) * 100;
  const outflowHeight = (data.outflow / maxValue) * 100;

  return (
    <View style={barStyles.monthlyBarContainer} testID={testID}>
      <View style={barStyles.barsWrapper}>
        <View style={barStyles.barPair}>
          <View style={[barStyles.barColumn, { height: `${inflowHeight}%` }]}>
            <View style={[barStyles.bar, barStyles.inflowBar]} />
          </View>
          <View style={[barStyles.barColumn, { height: `${outflowHeight}%` }]}>
            <View style={[barStyles.bar, barStyles.outflowBar]} />
          </View>
        </View>
      </View>
      <Text style={barStyles.monthLabel}>{data.month.slice(0, 3)}</Text>
    </View>
  );
};

export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
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
              color={colors.success}
              testID="kpi-revenue"
              colors={colors}
            />
            <StatCard
              icon="trending-down"
              label="Total Expenses"
              value={formatCurrency(kpiData.totalExpenses)}
              color={colors.danger}
              testID="kpi-expenses"
              colors={colors}
            />
            <StatCard
              icon="cash"
              label="Net Cash Flow"
              value={formatCurrency(kpiData.netCashFlow)}
              color={kpiData.netCashFlow >= 0 ? colors.success : colors.danger}
              testID="kpi-cash-flow"
              colors={colors}
            />
            <StatCard
              icon="percent"
              label="Profit Margin"
              value={formatPercent(kpiData.profitMargin)}
              color={colors.info}
              testID="kpi-margin"
              colors={colors}
            />
            <StatCard
              icon="flash"
              label="Burn Rate"
              value={formatCurrency(kpiData.burnRate)}
              color={colors.warning}
              testID="kpi-burn-rate"
              colors={colors}
            />
            <StatCard
              icon="hourglass"
              label="Runway"
              value={formatRunway(kpiData.runwayMonths)}
              color={colors.accent}
              testID="kpi-runway"
              colors={colors}
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
                    colors={colors}
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
                colors={colors}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer} testID="empty-insights">
            <Ionicons name="bulb-outline" size={48} color={colors.border} />
            <Text style={styles.emptyText}>No insights available</Text>
          </View>
        )}
      </View>

      {/* Bottom padding */}
      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
      paddingBottom: 24,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '400',
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginTop: 8,
    },
    section: {
      paddingHorizontal: 20,
      marginBottom: 32,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
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
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
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
      color: colors.textSecondary,
      fontWeight: '500',
      marginBottom: 6,
      textTransform: 'capitalize',
    },
    statValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
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
      backgroundColor: colors.success,
    },
    outflowColor: {
      backgroundColor: colors.danger,
    },
    legendText: {
      fontSize: 12,
      color: colors.textSecondary,
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
      backgroundColor: colors.success,
    },
    outflowBar: {
      backgroundColor: colors.danger,
    },
    monthLabel: {
      fontSize: 10,
      color: colors.textSecondary,
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
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    summaryLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '500',
      marginBottom: 4,
    },
    summaryValue: {
      fontSize: 14,
      fontWeight: '700',
    },
    inflowText: {
      color: colors.success,
    },
    outflowText: {
      color: colors.danger,
    },
    positiveText: {
      color: colors.success,
    },
    negativeText: {
      color: colors.danger,
    },

    // Insights
    insightCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
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
      color: colors.textPrimary,
      marginBottom: 6,
    },
    insightSummary: {
      fontSize: 13,
      color: colors.textBody,
      lineHeight: 18,
      marginBottom: 10,
    },
    insightMetric: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: colors.background,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 10,
      marginBottom: 10,
    },
    metricLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    metricValue: {
      fontSize: 12,
      color: colors.accent,
      fontWeight: '700',
    },
    insightRecommendation: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 16,
      fontStyle: 'italic',
    },

    // Empty state
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 40,
    },
    emptyText: {
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: 12,
      fontSize: 14,
    },

    // Bottom padding
    bottomPadding: {
      height: 40,
    },
  });
}
