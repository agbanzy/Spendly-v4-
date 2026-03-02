import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme-context';
import { ColorTokens } from '../lib/colors';
import { shadows } from '../lib/shadows';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/auth-context';

interface InviteDetails {
  email: string;
  role: string;
  department?: string;
  companyName: string;
  companyLogo?: string;
  invitedByName?: string;
  expiresAt: string;
}

interface InviteAcceptScreenProps {
  route?: { params?: { token?: string } };
  navigation?: any;
  token?: string; // Can be passed directly as prop
}

export default function InviteAcceptScreen({ route, navigation, token: propToken }: InviteAcceptScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();

  const inviteToken = propToken || route?.params?.token;

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!inviteToken) {
      setError('No invitation token provided.');
      setLoading(false);
      return;
    }
    fetchInvite();
  }, [inviteToken]);

  const fetchInvite = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<InviteDetails>('GET', `/api/invitations/${inviteToken}`);
      setInvite(data);
    } catch (err: any) {
      setError(err?.message || 'This invitation is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!inviteToken) return;
    setAccepting(true);
    try {
      await apiRequest('POST', `/api/invitations/${inviteToken}/accept`, {});
      setAccepted(true);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to accept invitation. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      'Decline Invitation',
      `Are you sure you want to decline the invitation to join ${invite?.companyName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => {
            if (navigation?.canGoBack()) navigation.goBack();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Validating invitation...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.errorIcon}>
          <Ionicons name="alert-circle" size={48} color={colors.danger} />
        </View>
        <Text style={styles.errorTitle}>Invalid Invitation</Text>
        <Text style={styles.errorText}>{error}</Text>
        {navigation?.canGoBack() && (
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (accepted) {
    return (
      <View style={styles.centerContainer}>
        <View style={[styles.successIcon]}>
          <Ionicons name="checkmark-circle" size={64} color={colors.success} />
        </View>
        <Text style={styles.successTitle}>You're In! 🎉</Text>
        <Text style={styles.successText}>
          You've successfully joined <Text style={{ fontWeight: '700' }}>{invite?.companyName}</Text> as {invite?.role || 'a member'}.
        </Text>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => {
            if (navigation?.canGoBack()) navigation.goBack();
          }}
        >
          <Text style={styles.doneButtonText}>Go to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!invite) return null;

  const daysUntilExpiry = Math.max(0, Math.ceil((new Date(invite.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Company Info */}
        <View style={styles.companySection}>
          <View style={styles.companyAvatar}>
            <Text style={styles.companyAvatarText}>
              {invite.companyName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.companyName}>{invite.companyName}</Text>
          {invite.invitedByName && (
            <Text style={styles.invitedBy}>
              Invited by {invite.invitedByName}
            </Text>
          )}
        </View>

        {/* Invite Details */}
        <View style={styles.detailsSection}>
          <DetailRow icon="mail-outline" label="Email" value={invite.email} colors={colors} />
          <DetailRow icon="briefcase-outline" label="Role" value={invite.role || 'Member'} colors={colors} />
          {invite.department && (
            <DetailRow icon="grid-outline" label="Department" value={invite.department} colors={colors} />
          )}
          <DetailRow icon="time-outline" label="Expires" value={`${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`} colors={colors} />
        </View>

        {/* Email mismatch warning */}
        {user?.email && invite.email.toLowerCase() !== user.email.toLowerCase() && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={18} color={colors.warningLight} />
            <Text style={styles.warningText}>
              This invitation was sent to {invite.email}. You are signed in as {user.email}. You may need to sign in with the correct account.
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.acceptButton, accepting && styles.buttonDisabled]}
            onPress={handleAccept}
            disabled={accepting}
          >
            {accepting ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color={colors.primaryForeground} />
                <Text style={styles.acceptButtonText}>Accept Invitation</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.declineButton} onPress={handleDecline} disabled={accepting}>
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function DetailRow({ icon, label, value, colors }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; colors: ColorTokens }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
      <Ionicons name={icon} size={20} color={colors.textTertiary} style={{ width: 28 }} />
      <Text style={{ fontSize: 13, color: colors.textTertiary, width: 80 }}>{label}</Text>
      <Text style={{ fontSize: 15, color: colors.textPrimary, fontWeight: '500', flex: 1 }}>{value}</Text>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: {
      flex: 1, backgroundColor: colors.background,
      justifyContent: 'center', padding: 24,
    },
    centerContainer: {
      flex: 1, backgroundColor: colors.background,
      justifyContent: 'center', alignItems: 'center', padding: 24,
    },
    loadingText: { fontSize: 15, color: colors.textSecondary, marginTop: 16 },

    card: {
      backgroundColor: colors.surface, borderRadius: 20, padding: 28,
      ...shadows.card,
    },

    companySection: { alignItems: 'center', marginBottom: 24 },
    companyAvatar: {
      width: 64, height: 64, borderRadius: 32,
      backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
      marginBottom: 12,
    },
    companyAvatarText: { fontSize: 28, fontWeight: '700', color: colors.primaryForeground },
    companyName: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
    invitedBy: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },

    detailsSection: { marginBottom: 20 },

    warningBanner: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      backgroundColor: colors.kycPendingBg, borderRadius: 12, padding: 14, marginBottom: 20,
    },
    warningText: { fontSize: 13, color: colors.textBody, flex: 1, lineHeight: 19 },

    actionsSection: { gap: 12 },
    acceptButton: {
      backgroundColor: colors.primary, borderRadius: 14, padding: 16,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      ...shadows.card,
    },
    acceptButtonText: { color: colors.primaryForeground, fontSize: 16, fontWeight: '700' },
    declineButton: { padding: 14, alignItems: 'center' },
    declineButtonText: { color: colors.textTertiary, fontSize: 14, fontWeight: '500' },
    buttonDisabled: { opacity: 0.6 },

    // Error state
    errorIcon: { marginBottom: 16 },
    errorTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
    errorText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
    backButton: { marginTop: 24, padding: 14 },
    backButtonText: { color: colors.primary, fontSize: 15, fontWeight: '600' },

    // Success state
    successIcon: { marginBottom: 16 },
    successTitle: { fontSize: 24, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
    successText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
    doneButton: {
      backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14,
      ...shadows.card,
    },
    doneButtonText: { color: colors.primaryForeground, fontSize: 16, fontWeight: '700' },
  });
}
