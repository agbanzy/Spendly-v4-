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

interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  status: string;
  avatar?: string;
}

export default function TeamScreen() {
  const { data: team, isLoading, refetch } = useQuery({
    queryKey: ['team'],
    queryFn: () => api.get<TeamMember[]>('/api/team'),
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role.toUpperCase()) {
      case 'OWNER':
        return styles.roleOwner;
      case 'ADMIN':
        return styles.roleAdmin;
      case 'MANAGER':
        return styles.roleManager;
      case 'EMPLOYEE':
        return styles.roleEmployee;
      default:
        return styles.roleEmployee;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return '#34D399';
      case 'invited':
        return '#FBBF24';
      case 'inactive':
        return '#F87171';
      default:
        return '#94A3B8';
    }
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
      <View style={styles.loadingContainer} testID="loading-team">
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
      testID="team-screen"
    >
      <View style={styles.header}>
        <Text style={styles.subtitle}>Manage your</Text>
        <Text style={styles.title}>Team</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue} testID="text-total-members">{team?.length || 0}</Text>
          <Text style={styles.statLabel}>Members</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#34D399' }]} testID="text-active-members">
            {team?.filter((m) => m.status.toLowerCase() === 'active').length || 0}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#FBBF24' }]} testID="text-invited-members">
            {team?.filter((m) => m.status.toLowerCase() === 'invited').length || 0}
          </Text>
          <Text style={styles.statLabel}>Invited</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All Members</Text>
          <TouchableOpacity testID="button-invite-member">
            <View style={styles.inviteButton}>
              <Ionicons name="person-add" size={16} color="#FFFFFF" />
              <Text style={styles.inviteButtonText}>Invite</Text>
            </View>
          </TouchableOpacity>
        </View>

        {team?.map((member) => (
          <TouchableOpacity key={member.id} style={styles.memberItem} testID={`team-member-${member.id}`}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(member.name)}</Text>
            </View>
            <View style={styles.memberDetails}>
              <View style={styles.nameRow}>
                <Text style={styles.memberName}>{member.name}</Text>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(member.status) }]} />
              </View>
              <Text style={styles.memberEmail}>{member.email}</Text>
              {member.department && (
                <Text style={styles.memberDepartment}>{member.department}</Text>
              )}
              <View style={styles.badgeRow}>
                <View style={[styles.roleBadge, getRoleBadgeStyle(member.role)]}>
                  <Text style={styles.roleText}>{member.role}</Text>
                </View>
                <Text style={[styles.statusLabel, { color: getStatusColor(member.status) }]}>
                  {member.status}
                </Text>
              </View>
            </View>
            <TouchableOpacity testID={`button-member-options-${member.id}`}>
              <Ionicons name="ellipsis-vertical" size={20} color="#64748B" />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        {(!team || team.length === 0) && !isLoading && (
          <View style={styles.emptyContainer} testID="empty-team">
            <Ionicons name="people-outline" size={48} color="#334155" />
            <Text style={styles.emptyText}>No team members</Text>
            <Text style={styles.emptySubtext}>Invite your first team member</Text>
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
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statLabel: {
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
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  inviteButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  memberItem: {
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
  memberDetails: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  memberEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  memberDepartment: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleOwner: {
    backgroundColor: '#581C87',
  },
  roleAdmin: {
    backgroundColor: '#991B1B',
  },
  roleManager: {
    backgroundColor: '#1E40AF',
  },
  roleEmployee: {
    backgroundColor: '#334155',
  },
  roleText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusLabel: {
    fontSize: 11,
    textTransform: 'capitalize',
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
