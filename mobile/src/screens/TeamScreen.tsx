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

interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  status: string;
  avatar?: string;
}

const ROLES = ['EMPLOYEE', 'MANAGER', 'ADMIN', 'OWNER'] as const;

export default function TeamScreen() {
  const queryClient = useQueryClient();

  const { data: team, isLoading, refetch } = useQuery({
    queryKey: ['team'],
    queryFn: () => api.get<TeamMember[]>('/api/team'),
  });

  const [refreshing, setRefreshing] = React.useState(false);
  const [inviteModalVisible, setInviteModalVisible] = React.useState(false);
  const [roleModalVisible, setRoleModalVisible] = React.useState(false);
  const [selectedMember, setSelectedMember] = React.useState<TeamMember | null>(null);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState('EMPLOYEE');
  const [inviteDepartment, setInviteDepartment] = React.useState('');
  const [newRole, setNewRole] = React.useState('');

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: string; department: string }) =>
      api.post('/api/team', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setInviteModalVisible(false);
      resetInviteForm();
    },
    onError: () => {
      Alert.alert('Error', 'Failed to invite team member. Please try again.');
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) =>
      api.put(`/api/team/${id}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setRoleModalVisible(false);
      setSelectedMember(null);
      setNewRole('');
    },
    onError: () => {
      Alert.alert('Error', 'Failed to update role. Please try again.');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/team/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
    },
    onError: () => {
      Alert.alert('Error', 'Failed to remove team member. Please try again.');
    },
  });

  const resetInviteForm = () => {
    setInviteEmail('');
    setInviteRole('EMPLOYEE');
    setInviteDepartment('');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleInvite = () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Validation', 'Please enter an email address.');
      return;
    }
    inviteMutation.mutate({
      email: inviteEmail.trim(),
      role: inviteRole,
      department: inviteDepartment.trim(),
    });
  };

  const handleRoleUpdate = () => {
    if (!selectedMember || !newRole) return;
    updateRoleMutation.mutate({ id: selectedMember.id, role: newRole });
  };

  const handleRemoveMember = (member: TeamMember) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.name || member.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeMemberMutation.mutate(member.id),
        },
      ]
    );
  };

  const openRoleModal = (member: TeamMember) => {
    setSelectedMember(member);
    setNewRole(member.role);
    setRoleModalVisible(true);
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
    if (!name) return '??';
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
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
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
            <TouchableOpacity
              onPress={() => setInviteModalVisible(true)}
              testID="button-invite-member"
            >
              <View style={styles.inviteButton}>
                <Ionicons name="person-add" size={16} color="#FFFFFF" />
                <Text style={styles.inviteButtonText}>Invite</Text>
              </View>
            </TouchableOpacity>
          </View>

          {team?.map((member) => (
            <View key={member.id} style={styles.memberItem} testID={`team-member-${member.id}`}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(member.name)}</Text>
              </View>
              <View style={styles.memberDetails}>
                <View style={styles.nameRow}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(member.status) }]} />
                </View>
                <Text style={styles.memberEmail}>{member.email}</Text>
                {member.department ? (
                  <Text style={styles.memberDepartment}>{member.department}</Text>
                ) : null}
                <View style={styles.badgeRow}>
                  <View style={[styles.roleBadge, getRoleBadgeStyle(member.role)]}>
                    <Text style={styles.roleText}>{member.role}</Text>
                  </View>
                  <Text style={[styles.statusLabel, { color: getStatusColor(member.status) }]}>
                    {member.status}
                  </Text>
                </View>
              </View>
              <View style={styles.memberActions}>
                <TouchableOpacity
                  onPress={() => openRoleModal(member)}
                  style={styles.actionButton}
                  testID={`button-edit-role-${member.id}`}
                >
                  <Ionicons name="shield-outline" size={18} color="#818CF8" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleRemoveMember(member)}
                  style={styles.actionButton}
                  testID={`button-remove-member-${member.id}`}
                >
                  <Ionicons name="trash-outline" size={18} color="#F87171" />
                </TouchableOpacity>
              </View>
            </View>
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

      {/* Invite Member Modal */}
      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInviteModalVisible(false)}
        testID="modal-invite-member"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Member</Text>
              <TouchableOpacity
                onPress={() => {
                  setInviteModalVisible(false);
                  resetInviteForm();
                }}
                testID="button-close-invite-modal"
              >
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter email address"
              placeholderTextColor="#64748B"
              keyboardType="email-address"
              autoCapitalize="none"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              testID="input-invite-email"
            />

            <Text style={styles.inputLabel}>Role</Text>
            <View style={styles.roleSelector}>
              {ROLES.map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleSelectorItem,
                    inviteRole === role && styles.roleSelectorItemActive,
                  ]}
                  onPress={() => setInviteRole(role)}
                  testID={`select-role-${role.toLowerCase()}`}
                >
                  <Text
                    style={[
                      styles.roleSelectorText,
                      inviteRole === role && styles.roleSelectorTextActive,
                    ]}
                  >
                    {role}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Department</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter department (optional)"
              placeholderTextColor="#64748B"
              value={inviteDepartment}
              onChangeText={setInviteDepartment}
              testID="input-invite-department"
            />

            <TouchableOpacity
              style={[styles.submitButton, inviteMutation.isPending && styles.submitButtonDisabled]}
              onPress={handleInvite}
              disabled={inviteMutation.isPending}
              testID="button-submit-invite"
            >
              {inviteMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>Send Invite</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Role Management Modal */}
      <Modal
        visible={roleModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRoleModalVisible(false)}
        testID="modal-role-management"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Role</Text>
              <TouchableOpacity
                onPress={() => {
                  setRoleModalVisible(false);
                  setSelectedMember(null);
                  setNewRole('');
                }}
                testID="button-close-role-modal"
              >
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {selectedMember && (
              <View style={styles.selectedMemberInfo}>
                <View style={styles.avatarSmall}>
                  <Text style={styles.avatarSmallText}>{getInitials(selectedMember.name)}</Text>
                </View>
                <View>
                  <Text style={styles.selectedMemberName}>{selectedMember.name}</Text>
                  <Text style={styles.selectedMemberEmail}>{selectedMember.email}</Text>
                </View>
              </View>
            )}

            <Text style={styles.inputLabel}>Select New Role</Text>
            <View style={styles.roleSelector}>
              {ROLES.map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleSelectorItem,
                    newRole === role && styles.roleSelectorItemActive,
                  ]}
                  onPress={() => setNewRole(role)}
                  testID={`update-role-${role.toLowerCase()}`}
                >
                  <Text
                    style={[
                      styles.roleSelectorText,
                      newRole === role && styles.roleSelectorTextActive,
                    ]}
                  >
                    {role}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, updateRoleMutation.isPending && styles.submitButtonDisabled]}
              onPress={handleRoleUpdate}
              disabled={updateRoleMutation.isPending}
              testID="button-submit-role-update"
            >
              {updateRoleMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>Update Role</Text>
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
    borderWidth: 1,
    borderColor: '#334155',
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
  memberActions: {
    flexDirection: 'column',
    gap: 8,
    marginLeft: 8,
  },
  actionButton: {
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
  roleSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  roleSelectorItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  roleSelectorItemActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  roleSelectorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  roleSelectorTextActive: {
    color: '#FFFFFF',
  },
  selectedMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#312E81',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmallText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#818CF8',
  },
  selectedMemberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectedMemberEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
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
