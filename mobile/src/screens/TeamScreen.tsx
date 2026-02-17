import React, { useMemo, useCallback } from 'react';
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
  SectionList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useTheme } from '../lib/theme-context';
import { useCompany } from '../lib/company-context';
import { ColorTokens } from '../lib/colors';

// ==================== TYPES ====================

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: string;
  avatar?: string;
  joinedAt?: string;
  permissions?: string[];
}

interface CompanyMember {
  id: string;
  companyId: string;
  userId: string | null;
  email: string;
  role: string;
  status: string;
  invitedAt: string;
  joinedAt: string | null;
}

interface CompanyInvitation {
  id: string;
  companyId: string;
  email: string;
  role: string;
  department?: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

const ROLES = ['EMPLOYEE', 'VIEWER', 'EDITOR', 'MANAGER', 'ADMIN', 'OWNER'] as const;
const DEPARTMENTS = ['Engineering', 'Design', 'Marketing', 'Sales', 'Finance', 'Operations', 'HR', 'Legal', 'General'] as const;

// ==================== SCREEN ====================

export default function TeamScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { activeCompany, canManageTeam, isOwner, isAdmin } = useCompany();

  const queryClient = useQueryClient();
  const companyId = activeCompany?.id;

  // Fetch team members (legacy + company members)
  const { data: team, isLoading, refetch } = useQuery({
    queryKey: ['team', companyId],
    queryFn: () => api.get<TeamMember[]>('/api/team'),
  });

  // Fetch company members (multi-business)
  const { data: companyMembers } = useQuery({
    queryKey: ['company-members', companyId],
    queryFn: () => companyId ? api.get<CompanyMember[]>(`/api/companies/${companyId}/members`) : Promise.resolve([]),
    enabled: !!companyId,
  });

  // Fetch pending invitations
  const { data: invitations } = useQuery({
    queryKey: ['company-invitations', companyId],
    queryFn: () => companyId ? api.get<CompanyInvitation[]>(`/api/companies/${companyId}/invitations`) : Promise.resolve([]),
    enabled: !!companyId && canManageTeam,
  });

  const pendingInvitations = invitations?.filter((i) => i.status === 'pending') || [];

  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilterValue, setStatusFilterValue] = React.useState('all');
  const [departmentFilter, setDepartmentFilter] = React.useState('all');
  const [refreshing, setRefreshing] = React.useState(false);
  const [inviteModalVisible, setInviteModalVisible] = React.useState(false);
  const [roleModalVisible, setRoleModalVisible] = React.useState(false);
  const [selectedMember, setSelectedMember] = React.useState<TeamMember | null>(null);
  const [inviteName, setInviteName] = React.useState('');
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState('EMPLOYEE');
  const [inviteDepartment, setInviteDepartment] = React.useState('General');
  const [newRole, setNewRole] = React.useState('');
  const [viewMode, setViewMode] = React.useState<'list' | 'department'>('list');

  // ==================== MUTATIONS ====================

  const inviteMutation = useMutation({
    mutationFn: (data: { name: string; email: string; role: string; department: string }) => {
      if (companyId) {
        return api.post<{ inviteEmailSent?: boolean }>(
          `/api/companies/${companyId}/invitations`,
          data,
        );
      }
      return api.post<{ inviteEmailSent?: boolean }>('/api/team', data);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['company-members'] });
      queryClient.invalidateQueries({ queryKey: ['company-invitations'] });
      setInviteModalVisible(false);
      resetInviteForm();
      if (response?.inviteEmailSent === false) {
        Alert.alert(
          'Member Added',
          'Team member was added but the invitation email could not be sent. Please share the invite link manually.',
        );
      } else {
        Alert.alert('Success', 'Team invitation sent successfully.');
      }
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message || 'Failed to invite team member. Please try again.');
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.patch(`/api/team/${id}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['company-members'] });
      setRoleModalVisible(false);
      setSelectedMember(null);
      setNewRole('');
    },
    onError: () => {
      Alert.alert('Error', 'Failed to update role. Please try again.');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/team/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['company-members'] });
    },
    onError: () => {
      Alert.alert('Error', 'Failed to remove team member. Please try again.');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/team/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
    },
    onError: () => {
      Alert.alert('Error', 'Failed to update member status.');
    },
  });

  const revokeInvitationMutation = useMutation({
    mutationFn: (invitationId: string) =>
      companyId ? api.delete(`/api/companies/${companyId}/invitations/${invitationId}`) : Promise.resolve(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-invitations'] });
    },
    onError: () => {
      Alert.alert('Error', 'Failed to revoke invitation.');
    },
  });

  // ==================== HANDLERS ====================

  const handleToggleStatus = useCallback((member: TeamMember) => {
    const newStatus = member.status.toLowerCase() === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'active' ? 'activate' : 'deactivate';
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Member`,
      `Are you sure you want to ${action} ${member.name || member.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: action.charAt(0).toUpperCase() + action.slice(1), onPress: () => toggleStatusMutation.mutate({ id: member.id, status: newStatus }) },
      ]
    );
  }, [toggleStatusMutation]);

  const resetInviteForm = () => {
    setInviteName('');
    setInviteEmail('');
    setInviteRole('EMPLOYEE');
    setInviteDepartment('General');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleInvite = () => {
    if (!inviteName.trim()) {
      Alert.alert('Validation', 'Please enter a name.');
      return;
    }
    if (!inviteEmail.trim()) {
      Alert.alert('Validation', 'Please enter an email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      Alert.alert('Validation', 'Please enter a valid email address.');
      return;
    }
    inviteMutation.mutate({
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      role: inviteRole,
      department: inviteDepartment,
    });
  };

  const handleRoleUpdate = () => {
    if (!selectedMember || !newRole) return;
    if (selectedMember.role === 'OWNER' && !isOwner) {
      Alert.alert('Permission Denied', 'Only the owner can change owner roles.');
      return;
    }
    updateRoleMutation.mutate({ id: selectedMember.id, role: newRole });
  };

  const handleRemoveMember = (member: TeamMember) => {
    if (member.role === 'OWNER') {
      Alert.alert('Cannot Remove', 'The company owner cannot be removed.');
      return;
    }
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.name || member.email}? This action cannot be undone.`,
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

  const handleRevokeInvitation = (invitation: CompanyInvitation) => {
    Alert.alert(
      'Revoke Invitation',
      `Revoke the invitation sent to ${invitation.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Revoke', style: 'destructive', onPress: () => revokeInvitationMutation.mutate(invitation.id) },
      ]
    );
  };

  const openRoleModal = (member: TeamMember) => {
    setSelectedMember(member);
    setNewRole(member.role);
    setRoleModalVisible(true);
  };

  // ==================== HELPERS ====================

  const getRoleBadgeStyle = (role: string) => {
    switch (role.toUpperCase()) {
      case 'OWNER': return styles.roleOwner;
      case 'ADMIN': return styles.roleAdmin;
      case 'MANAGER': return styles.roleManager;
      case 'VIEWER': return styles.roleViewer;
      case 'EDITOR': return styles.roleEditor;
      default: return styles.roleEmployee;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return colors.colorGreen;
      case 'invited': return colors.warningLight;
      case 'inactive': return colors.dangerLight;
      default: return colors.textSecondary;
    }
  };

  const getInitials = (name: string) => {
    if (!name) return '??';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // ==================== FILTERED DATA ====================

  const allMembers = team || [];
  const departments = useMemo(() => {
    const deptSet = new Set(allMembers.map((m) => m.department || 'General'));
    return ['all', ...Array.from(deptSet).sort()];
  }, [allMembers]);

  const filteredTeam = useMemo(() => {
    return allMembers.filter((member) => {
      const matchesSearch = searchQuery === '' ||
        member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.department?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilterValue === 'all' || member.status.toLowerCase() === statusFilterValue;
      const matchesDept = departmentFilter === 'all' || (member.department || 'General') === departmentFilter;
      return matchesSearch && matchesStatus && matchesDept;
    });
  }, [allMembers, searchQuery, statusFilterValue, departmentFilter]);

  // Group by department for section view
  const departmentSections = useMemo(() => {
    const groups: Record<string, TeamMember[]> = {};
    filteredTeam.forEach((m) => {
      const dept = m.department || 'General';
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(m);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dept, members]) => ({ title: dept, data: members, count: members.length }));
  }, [filteredTeam]);

  const activeCount = allMembers.filter((m) => m.status.toLowerCase() === 'active').length;
  const invitedCount = allMembers.filter((m) => m.status.toLowerCase() === 'invited').length;
  const inactiveCount = allMembers.filter((m) => m.status.toLowerCase() === 'inactive').length;

  // ==================== RENDER MEMBER ROW ====================

  const renderMemberRow = useCallback((member: TeamMember) => (
    <View key={member.id} style={styles.memberItem} testID={`team-member-${member.id}`}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{getInitials(member.name)}</Text>
      </View>
      <View style={styles.memberDetails}>
        <View style={styles.nameRow}>
          <Text style={styles.memberName} numberOfLines={1}>{member.name}</Text>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(member.status) }]} />
        </View>
        <Text style={styles.memberEmail} numberOfLines={1}>{member.email}</Text>
        {member.department && member.department !== 'General' ? (
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
        {member.joinedAt ? (
          <Text style={styles.joinedDate}>Joined {new Date(member.joinedAt).toLocaleDateString()}</Text>
        ) : null}
      </View>
      {canManageTeam && (
        <View style={styles.memberActions}>
          <TouchableOpacity
            onPress={() => openRoleModal(member)}
            style={styles.actionButton}
            testID={`button-edit-role-${member.id}`}
          >
            <Ionicons name="shield-outline" size={18} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleToggleStatus(member)}
            style={styles.actionButton}
          >
            <Ionicons
              name={member.status.toLowerCase() === 'active' ? 'pause-outline' : 'play-outline'}
              size={18}
              color={member.status.toLowerCase() === 'active' ? colors.warning : colors.colorGreen}
            />
          </TouchableOpacity>
          {member.role !== 'OWNER' && (
            <TouchableOpacity
              onPress={() => handleRemoveMember(member)}
              style={styles.actionButton}
              testID={`button-remove-member-${member.id}`}
            >
              <Ionicons name="trash-outline" size={18} color={colors.dangerLight} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  ), [canManageTeam, colors, styles, handleToggleStatus]);

  // ==================== LOADING STATE ====================

  if (isLoading) {
    return (
      <View style={styles.loadingContainer} testID="loading-team">
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // ==================== MAIN RENDER ====================

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        testID="team-screen"
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.subtitle}>Manage your</Text>
            <Text style={styles.title}>Team</Text>
          </View>
          {activeCompany && (
            <View style={styles.companyBadge}>
              <Ionicons name="business-outline" size={14} color={colors.accent} />
              <Text style={styles.companyBadgeText} numberOfLines={1}>{activeCompany.name}</Text>
            </View>
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue} testID="text-total-members">{allMembers.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.colorGreen }]} testID="text-active-members">{activeCount}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.warningLight }]} testID="text-invited-members">{invitedCount}</Text>
            <Text style={styles.statLabel}>Invited</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.dangerLight }]}>{inactiveCount}</Text>
            <Text style={styles.statLabel}>Inactive</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={colors.placeholderText} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search members..."
            placeholderTextColor={colors.placeholderText}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.placeholderText} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filters Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {['all', 'active', 'invited', 'inactive'].map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, statusFilterValue === f && styles.filterChipActive]}
              onPress={() => setStatusFilterValue(f)}
            >
              <Text style={[styles.filterChipText, statusFilterValue === f && styles.filterChipTextActive]}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.filterDivider} />
          {/* View Toggle */}
          <TouchableOpacity
            style={[styles.filterChip, viewMode === 'list' && styles.filterChipActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons name="list" size={14} color={viewMode === 'list' ? colors.primaryForeground : colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, viewMode === 'department' && styles.filterChipActive]}
            onPress={() => setViewMode('department')}
          >
            <Ionicons name="grid" size={14} color={viewMode === 'department' ? colors.primaryForeground : colors.textSecondary} />
          </TouchableOpacity>
        </ScrollView>

        {/* Department Filter (in department view) */}
        {viewMode === 'department' && departments.length > 2 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deptFilterRow}>
            {departments.map((dept) => (
              <TouchableOpacity
                key={dept}
                style={[styles.deptChip, departmentFilter === dept && styles.deptChipActive]}
                onPress={() => setDepartmentFilter(dept)}
              >
                <Text style={[styles.deptChipText, departmentFilter === dept && styles.deptChipTextActive]}>
                  {dept === 'all' ? 'All Depts' : dept}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && canManageTeam && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Invitations ({pendingInvitations.length})</Text>
            {pendingInvitations.map((inv) => (
              <View key={inv.id} style={styles.invitationItem}>
                <View style={styles.invitationIcon}>
                  <Ionicons name="mail-outline" size={18} color={colors.warningLight} />
                </View>
                <View style={styles.invitationDetails}>
                  <Text style={styles.invitationEmail}>{inv.email}</Text>
                  <View style={styles.invitationMeta}>
                    <View style={[styles.roleBadge, getRoleBadgeStyle(inv.role)]}>
                      <Text style={styles.roleText}>{inv.role}</Text>
                    </View>
                    {inv.department ? <Text style={styles.invitationDept}>{inv.department}</Text> : null}
                  </View>
                  <Text style={styles.invitationExpiry}>
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.revokeBtn}
                  onPress={() => handleRevokeInvitation(inv)}
                >
                  <Ionicons name="close-circle-outline" size={20} color={colors.dangerLight} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Team Members Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {viewMode === 'department' ? 'By Department' : 'All Members'} ({filteredTeam.length})
            </Text>
            {canManageTeam && (
              <TouchableOpacity
                onPress={() => setInviteModalVisible(true)}
                testID="button-invite-member"
              >
                <View style={styles.inviteButton}>
                  <Ionicons name="person-add" size={16} color={colors.primaryForeground} />
                  <Text style={styles.inviteButtonText}>Invite</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {viewMode === 'department' ? (
            // Grouped by department
            departmentSections.map((section) => (
              <View key={section.title} style={styles.departmentGroup}>
                <View style={styles.departmentHeader}>
                  <Ionicons name="people-outline" size={16} color={colors.accent} />
                  <Text style={styles.departmentTitle}>{section.title}</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{section.count}</Text>
                  </View>
                </View>
                {section.data.map(renderMemberRow)}
              </View>
            ))
          ) : (
            // Flat list
            filteredTeam.map(renderMemberRow)
          )}

          {filteredTeam.length === 0 && !isLoading && (
            <View style={styles.emptyContainer} testID="empty-team">
              <Ionicons name="people-outline" size={48} color={colors.border} />
              <Text style={styles.emptyText}>
                {searchQuery || statusFilterValue !== 'all' || departmentFilter !== 'all'
                  ? 'No members match your filters'
                  : 'No team members yet'}
              </Text>
              <Text style={styles.emptySubtext}>
                {canManageTeam ? 'Invite your first team member' : 'Ask an admin to invite team members'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ==================== INVITE MODAL ==================== */}
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
              <Text style={styles.modalTitle}>Invite Team Member</Text>
              <TouchableOpacity
                onPress={() => { setInviteModalVisible(false); resetInviteForm(); }}
                testID="button-close-invite-modal"
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {activeCompany && (
              <View style={styles.modalCompanyTag}>
                <Ionicons name="business-outline" size={14} color={colors.accent} />
                <Text style={styles.modalCompanyText}>Inviting to {activeCompany.name}</Text>
              </View>
            )}

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter full name"
              placeholderTextColor={colors.placeholderText}
              value={inviteName}
              onChangeText={setInviteName}
              autoCapitalize="words"
              testID="input-invite-name"
            />

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter email address"
              placeholderTextColor={colors.placeholderText}
              keyboardType="email-address"
              autoCapitalize="none"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              testID="input-invite-email"
            />

            <Text style={styles.inputLabel}>Role</Text>
            <View style={styles.roleSelector}>
              {ROLES.filter((r) => {
                // Can't assign OWNER role unless you're OWNER
                if (r === 'OWNER' && !isOwner) return false;
                // Can't assign ADMIN unless you're admin+
                if (r === 'ADMIN' && !isAdmin) return false;
                return true;
              }).map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[styles.roleSelectorItem, inviteRole === role && styles.roleSelectorItemActive]}
                  onPress={() => setInviteRole(role)}
                  testID={`select-role-${role.toLowerCase()}`}
                >
                  <Text style={[styles.roleSelectorText, inviteRole === role && styles.roleSelectorTextActive]}>
                    {role}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Department</Text>
            <View style={styles.roleSelector}>
              {DEPARTMENTS.map((dept) => (
                <TouchableOpacity
                  key={dept}
                  style={[styles.roleSelectorItem, inviteDepartment === dept && styles.roleSelectorItemActive]}
                  onPress={() => setInviteDepartment(dept)}
                >
                  <Text style={[styles.roleSelectorText, inviteDepartment === dept && styles.roleSelectorTextActive]}>
                    {dept}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, inviteMutation.isPending && styles.submitButtonDisabled]}
              onPress={handleInvite}
              disabled={inviteMutation.isPending}
              testID="button-submit-invite"
            >
              {inviteMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Ionicons name="send" size={18} color={colors.primaryForeground} />
                  <Text style={styles.submitButtonText}>Send Invite</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================== ROLE MODAL ==================== */}
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
                onPress={() => { setRoleModalVisible(false); setSelectedMember(null); setNewRole(''); }}
                testID="button-close-role-modal"
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedMember && (
              <View style={styles.selectedMemberInfo}>
                <View style={styles.avatarSmall}>
                  <Text style={styles.avatarSmallText}>{getInitials(selectedMember.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedMemberName}>{selectedMember.name}</Text>
                  <Text style={styles.selectedMemberEmail}>{selectedMember.email}</Text>
                  <Text style={styles.selectedMemberDept}>{selectedMember.department || 'General'}</Text>
                </View>
              </View>
            )}

            <Text style={styles.inputLabel}>Select New Role</Text>
            <View style={styles.roleSelector}>
              {ROLES.filter((r) => {
                if (r === 'OWNER' && !isOwner) return false;
                if (r === 'ADMIN' && !isAdmin) return false;
                return true;
              }).map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[styles.roleSelectorItem, newRole === role && styles.roleSelectorItemActive]}
                  onPress={() => setNewRole(role)}
                  testID={`update-role-${role.toLowerCase()}`}
                >
                  <Text style={[styles.roleSelectorText, newRole === role && styles.roleSelectorTextActive]}>
                    {role}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Role description */}
            {newRole && (
              <View style={styles.roleDescriptionBox}>
                <Ionicons name="information-circle-outline" size={16} color={colors.accent} />
                <Text style={styles.roleDescriptionText}>
                  {newRole === 'OWNER' && 'Full control. Can delete the company and transfer ownership.'}
                  {newRole === 'ADMIN' && 'Can manage team, payroll, settings, and all business operations.'}
                  {newRole === 'MANAGER' && 'Can manage team members, approve expenses, and run payroll.'}
                  {newRole === 'EDITOR' && 'Can create and edit expenses, invoices, and vendors.'}
                  {newRole === 'VIEWER' && 'Read-only access. Can view dashboards and reports.'}
                  {newRole === 'EMPLOYEE' && 'Can submit expenses and view own transactions.'}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitButton, updateRoleMutation.isPending && styles.submitButtonDisabled]}
              onPress={handleRoleUpdate}
              disabled={updateRoleMutation.isPending}
              testID="button-submit-role-update"
            >
              {updateRoleMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={18} color={colors.primaryForeground} />
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

// ==================== STYLES ====================

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollView: { flex: 1 },
    loadingContainer: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
    header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    subtitle: { fontSize: 14, color: colors.textSecondary },
    title: { fontSize: 28, fontWeight: 'bold', color: colors.textPrimary, marginTop: 4 },
    companyBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, maxWidth: 160 },
    companyBadgeText: { fontSize: 12, color: colors.accent, fontWeight: '600' },
    statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 20 },
    statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    statValue: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
    statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, marginHorizontal: 20, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colors.border },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: colors.textPrimary },
    filterRow: { paddingHorizontal: 20, gap: 8, marginBottom: 12, alignItems: 'center' },
    filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterChipText: { fontSize: 13, color: colors.textSecondary },
    filterChipTextActive: { color: colors.primaryForeground, fontWeight: '600' },
    filterDivider: { width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: 4 },
    deptFilterRow: { paddingHorizontal: 20, gap: 8, marginBottom: 16 },
    deptChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    deptChipActive: { backgroundColor: colors.accentBackground, borderColor: colors.accent },
    deptChipText: { fontSize: 12, color: colors.textSecondary },
    deptChipTextActive: { color: colors.accent, fontWeight: '600' },
    section: { paddingHorizontal: 20, marginBottom: 24 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
    inviteButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
    inviteButtonText: { fontSize: 13, color: colors.primaryForeground, fontWeight: '500' },
    departmentGroup: { marginBottom: 20 },
    departmentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
    departmentTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
    countBadge: { backgroundColor: colors.accentBackground, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
    countBadgeText: { fontSize: 11, fontWeight: '600', color: colors.accent },
    memberItem: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentBackground, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 14, fontWeight: '700', color: colors.accent },
    memberDetails: { flex: 1, marginLeft: 12 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    memberName: { fontSize: 14, color: colors.textPrimary, fontWeight: '500', flex: 1 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    memberEmail: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
    memberDepartment: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    badgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
    roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    roleOwner: { backgroundColor: '#581C87' },
    roleAdmin: { backgroundColor: '#991B1B' },
    roleManager: { backgroundColor: colors.infoSubtle },
    roleViewer: { backgroundColor: colors.successSubtle },
    roleEditor: { backgroundColor: '#854D0E' },
    roleEmployee: { backgroundColor: colors.border },
    roleText: { fontSize: 10, color: colors.textPrimary, fontWeight: '600', textTransform: 'uppercase' },
    statusLabel: { fontSize: 11, textTransform: 'capitalize' },
    joinedDate: { fontSize: 10, color: colors.textTertiary, marginTop: 4 },
    memberActions: { flexDirection: 'column', gap: 6, marginLeft: 8 },
    actionButton: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    // Invitation items
    invitationItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.warningLight + '40', borderLeftWidth: 3, borderLeftColor: colors.warningLight },
    invitationIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.warningLight + '20', alignItems: 'center', justifyContent: 'center' },
    invitationDetails: { flex: 1, marginLeft: 12 },
    invitationEmail: { fontSize: 13, fontWeight: '500', color: colors.textPrimary },
    invitationMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    invitationDept: { fontSize: 11, color: colors.textSecondary },
    invitationExpiry: { fontSize: 10, color: colors.textTertiary, marginTop: 4 },
    revokeBtn: { padding: 8 },
    emptyContainer: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { color: colors.textSecondary, fontSize: 16, marginTop: 12, textAlign: 'center' },
    emptySubtext: { color: colors.textTertiary, fontSize: 13, marginTop: 4 },
    // Modal styles
    modalOverlay: { flex: 1, backgroundColor: colors.modalOverlay, justifyContent: 'flex-end' },
    modalContent: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: colors.border, borderBottomWidth: 0, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
    modalCompanyTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accentBackground, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16 },
    modalCompanyText: { fontSize: 13, color: colors.accent, fontWeight: '500' },
    inputLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, marginTop: 4 },
    textInput: { backgroundColor: colors.background, borderRadius: 10, padding: 14, fontSize: 15, color: colors.inputText, borderWidth: 1, borderColor: colors.inputBorder, marginBottom: 16 },
    roleSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    roleSelectorItem: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.inputBorder },
    roleSelectorItemActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    roleSelectorText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' },
    roleSelectorTextActive: { color: colors.primaryForeground },
    roleDescriptionBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.accentBackground, borderRadius: 10, padding: 12, marginBottom: 16 },
    roleDescriptionText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
    selectedMemberInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 12, padding: 12, marginBottom: 20, gap: 12, borderWidth: 1, borderColor: colors.border },
    avatarSmall: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentBackground, alignItems: 'center', justifyContent: 'center' },
    avatarSmallText: { fontSize: 12, fontWeight: '700', color: colors.accent },
    selectedMemberName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    selectedMemberEmail: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
    selectedMemberDept: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, gap: 8, marginTop: 8 },
    submitButtonDisabled: { opacity: 0.6 },
    submitButtonText: { fontSize: 15, fontWeight: '600', color: colors.primaryForeground },
  });
}
