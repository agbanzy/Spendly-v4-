import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../lib/theme-context';
import { apiRequest } from '../lib/api';
import { shadows, monoFont } from '../lib/shadows';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data?: { actionUrl?: string };
  createdAt: string;
}

function getNotificationIcon(type: string): keyof typeof Ionicons.glyphMap {
  const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
    expense_submitted: 'receipt-outline',
    expense_approved: 'checkmark-circle-outline',
    expense_rejected: 'close-circle-outline',
    payment_received: 'arrow-down-circle-outline',
    payment_sent: 'arrow-up-circle-outline',
    bill_due: 'alarm-outline',
    bill_overdue: 'warning-outline',
    bill_paid: 'checkmark-done-outline',
    budget_warning: 'trending-up-outline',
    budget_exceeded: 'alert-circle-outline',
    payout_processed: 'send-outline',
    team_invite: 'people-outline',
    system_alert: 'information-circle-outline',
    card_transaction: 'card-outline',
  };
  return iconMap[type] || 'notifications-outline';
}

function getNotificationColor(type: string): string {
  if (type.includes('approved') || type.includes('received') || type.includes('paid') || type === 'payout_processed') return '#22c55e';
  if (type.includes('rejected') || type.includes('failed') || type.includes('overdue') || type.includes('exceeded')) return '#ef4444';
  if (type.includes('warning') || type.includes('due')) return '#f59e0b';
  return '#0EA5E9';
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => apiRequest<Notification[]>('GET', '/api/notifications'),
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['notifications-unread-count'],
    queryFn: () => apiRequest<{ count: number }>('GET', '/api/notifications/unread-count'),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => apiRequest('PATCH', `/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/notifications/mark-all-read'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    await queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    setRefreshing(false);
  }, [queryClient]);

  const handleNotificationPress = (notification: Notification) => {
    if (!notification.read) {
      markReadMutation.mutate(notification.id);
    }
    // Navigate based on action URL
    const actionUrl = notification.data?.actionUrl;
    if (actionUrl) {
      const screenMap: Record<string, string> = {
        '/expenses': 'Expenses',
        '/transactions': 'Transactions',
        '/bills': 'Bills',
        '/team': 'Team',
        '/dashboard': 'Home',
        '/settings': 'Settings',
      };
      const screen = screenMap[actionUrl];
      if (screen) {
        navigation.navigate(screen);
      }
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const iconColor = getNotificationColor(item.type);
    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          {
            backgroundColor: item.read ? colors.surface : (colors.surface + 'E6'),
            borderLeftColor: item.read ? 'transparent' : iconColor,
            borderLeftWidth: item.read ? 0 : 3,
          },
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: iconColor + '15' }]}>
          <Ionicons name={getNotificationIcon(item.type)} size={22} color={iconColor} />
        </View>
        <View style={styles.contentContainer}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.textPrimary }, !item.read && styles.unreadTitle]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.time, { color: colors.textSecondary }]}>
              {formatTimeAgo(item.createdAt)}
            </Text>
          </View>
          <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.message}
          </Text>
        </View>
        {!item.read && <View style={[styles.unreadDot, { backgroundColor: iconColor }]} />}
      </TouchableOpacity>
    );
  };

  const unreadCount = unreadData?.count || 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.headerTint} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerTint }]}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={() => markAllReadMutation.mutate()} style={styles.markAllButton}>
            <Text style={[styles.markAllText, { color: colors.accent }]}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No notifications</Text>
          <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
            You're all caught up! Notifications will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderNotification}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: { marginRight: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', flex: 1 },
  markAllButton: { paddingVertical: 4, paddingHorizontal: 8 },
  markAllText: { fontSize: 14, fontWeight: '600' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptyMessage: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  listContent: { paddingVertical: 8 },
  separator: { height: 1, marginLeft: 72 },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...shadows.subtle,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentContainer: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 15, fontWeight: '500', flex: 1, marginRight: 8 },
  unreadTitle: { fontWeight: '700' },
  time: { fontSize: 12 },
  message: { fontSize: 13, lineHeight: 18 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
});
