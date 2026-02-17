import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import { ColorTokens } from '../lib/colors';
import { api } from '../lib/api';
import { isBiometricAvailable, getBiometricType, isBiometricEnabled, setBiometricEnabled, authenticateWithBiometric } from '../lib/biometric';
import { isNotificationsEnabled, setNotificationsEnabled } from '../lib/notifications';

const CURRENCIES = ['USD', 'GBP', 'EUR', 'NGN', 'GHS', 'KES', 'ZAR', 'CAD', 'AUD'];
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'pt', label: 'Portuguese' },
];

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { colors, theme, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const [biometricAvail, setBiometricAvail] = useState(false);
  const [biometricOn, setBiometricOn] = useState(false);
  const [bioType, setBioType] = useState('Biometric');
  const [notificationsOn, setNotificationsOn] = useState(true);

  // Profile edit state
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(user?.displayName || '');
  const [editPhone, setEditPhone] = useState('');

  // Currency/Language picker
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);

  // Security modal
  const [securityModalVisible, setSecurityModalVisible] = useState(false);

  // Fetch settings from backend
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<{ currency?: string; language?: string; companyName?: string }>('/api/settings'),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patch('/api/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message || 'Failed to update settings');
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.patch(`/api/user-profile/${user?.uid}`, data),
    onSuccess: () => {
      Alert.alert('Success', 'Profile updated');
      setProfileModalVisible(false);
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message || 'Failed to update profile');
    },
  });

  useEffect(() => {
    (async () => {
      const avail = await isBiometricAvailable();
      setBiometricAvail(avail);
      if (avail) {
        const type = await getBiometricType();
        setBioType(type);
        const enabled = await isBiometricEnabled();
        setBiometricOn(enabled);
      }
    })();
    isNotificationsEnabled().then(setNotificationsOn);
  }, []);

  const currentCurrency = settings?.currency || 'USD';
  const currentLanguage = LANGUAGES.find((l) => l.code === settings?.language)?.label || 'English';

  const toggleBiometric = async (value: boolean) => {
    if (value) {
      const success = await authenticateWithBiometric();
      if (success) {
        await setBiometricEnabled(true);
        setBiometricOn(true);
        Alert.alert('Enabled', `${bioType} login has been enabled.`);
      }
    } else {
      await setBiometricEnabled(false);
      await AsyncStorage.removeItem('biometric_email');
      await AsyncStorage.removeItem('biometric_password');
      setBiometricOn(false);
      Alert.alert('Disabled', `${bioType} login has been disabled.`);
    }
  };

  const toggleNotifications = async (value: boolean) => {
    await setNotificationsEnabled(value);
    setNotificationsOn(value);
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  const handleCurrencySelect = (currency: string) => {
    updateSettingsMutation.mutate({ currency });
    setCurrencyPickerVisible(false);
  };

  const handleLanguageSelect = (langCode: string) => {
    updateSettingsMutation.mutate({ language: langCode });
    setLanguagePickerVisible(false);
  };

  const handleSaveProfile = () => {
    if (!editDisplayName.trim()) {
      Alert.alert('Error', 'Display name cannot be empty');
      return;
    }
    updateProfileMutation.mutate({
      displayName: editDisplayName.trim(),
      phone: editPhone.trim() || undefined,
    });
  };

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open the link');
    });
  };

  const renderSettingsItem = ({
    icon,
    label,
    value,
    onPress,
    danger,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value?: string;
    onPress?: () => void;
    danger?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.settingsItem}
      onPress={onPress}
      disabled={!onPress}
      testID={`settings-item-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <View style={[styles.iconContainer, danger && styles.iconContainerDanger]}>
        <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.textSecondary} />
      </View>
      <View style={styles.settingsContent}>
        <Text style={[styles.settingsLabel, danger && styles.settingsLabelDanger]}>{label}</Text>
        {value && <Text style={styles.settingsValue}>{value}</Text>}
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>More</Text>
      </View>

      <TouchableOpacity style={styles.profileCard} onPress={() => {
        setEditDisplayName(user?.displayName || '');
        setProfileModalVisible(true);
      }}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.displayName || 'User'}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
        </View>
        <Ionicons name="create-outline" size={20} color={colors.textTertiary} />
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Finance</Text>
        <View style={styles.sectionContent}>
          {renderSettingsItem({
            icon: 'swap-horizontal',
            label: 'Transactions',
            onPress: () => navigation.navigate('Transactions'),
          })}
          {renderSettingsItem({
            icon: 'pie-chart',
            label: 'Budget',
            onPress: () => navigation.navigate('Budget'),
          })}
          {renderSettingsItem({
            icon: 'card',
            label: 'Cards',
            onPress: () => navigation.navigate('Cards'),
          })}
          {renderSettingsItem({
            icon: 'document-text',
            label: 'Invoices',
            onPress: () => navigation.navigate('Invoices'),
          })}
          {renderSettingsItem({
            icon: 'bar-chart',
            label: 'Analytics',
            onPress: () => navigation.navigate('Analytics'),
          })}
          {renderSettingsItem({
            icon: 'clipboard',
            label: 'Reports',
            onPress: () => navigation.navigate('Reports'),
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Business</Text>
        <View style={styles.sectionContent}>
          {renderSettingsItem({
            icon: 'people',
            label: 'Team',
            onPress: () => navigation.navigate('Team'),
          })}
          {renderSettingsItem({
            icon: 'briefcase',
            label: 'Vendors',
            onPress: () => navigation.navigate('Vendors'),
          })}
          {renderSettingsItem({
            icon: 'cash',
            label: 'Payroll',
            onPress: () => navigation.navigate('Payroll'),
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.sectionContent}>
          {renderSettingsItem({
            icon: 'person-outline',
            label: 'Profile',
            onPress: () => {
              setEditDisplayName(user?.displayName || '');
              setProfileModalVisible(true);
            },
          })}
          {renderSettingsItem({
            icon: 'shield-checkmark-outline',
            label: 'Security',
            onPress: () => setSecurityModalVisible(true),
          })}
          {biometricAvail && (
            <View style={styles.settingsItem}>
              <View style={styles.iconContainer}>
                <Ionicons name="finger-print-outline" size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.settingsContent}>
                <Text style={styles.settingsLabel}>{bioType} Login</Text>
              </View>
              <Switch
                value={biometricOn}
                onValueChange={toggleBiometric}
                trackColor={{ false: colors.switchTrackInactive, true: colors.primary }}
                thumbColor={biometricOn ? colors.accent : colors.textTertiary}
              />
            </View>
          )}
          <View style={styles.settingsItem}>
            <View style={styles.iconContainer}>
              <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
            </View>
            <View style={styles.settingsContent}>
              <Text style={styles.settingsLabel}>Notifications</Text>
            </View>
            <Switch
              value={notificationsOn}
              onValueChange={toggleNotifications}
              trackColor={{ false: colors.switchTrackInactive, true: colors.primary }}
              thumbColor={notificationsOn ? colors.accent : colors.textTertiary}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.sectionContent}>
          {renderSettingsItem({
            icon: 'globe-outline',
            label: 'Currency',
            value: currentCurrency,
            onPress: () => setCurrencyPickerVisible(true),
          })}
          <View style={styles.settingsItem}>
            <View style={styles.iconContainer}>
              <Ionicons name="moon-outline" size={20} color={colors.textSecondary} />
            </View>
            <View style={styles.settingsContent}>
              <Text style={styles.settingsLabel}>Dark Mode</Text>
            </View>
            <Switch
              value={theme === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.switchTrackInactive, true: colors.primary }}
              thumbColor={theme === 'dark' ? colors.accent : colors.textTertiary}
            />
          </View>
          {renderSettingsItem({
            icon: 'language-outline',
            label: 'Language',
            value: currentLanguage,
            onPress: () => setLanguagePickerVisible(true),
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.sectionContent}>
          {renderSettingsItem({
            icon: 'help-circle-outline',
            label: 'Help Center',
            onPress: () => openUrl('https://spendlymanager.com/help'),
          })}
          {renderSettingsItem({
            icon: 'document-text-outline',
            label: 'Terms of Service',
            onPress: () => openUrl('https://spendlymanager.com/terms'),
          })}
          {renderSettingsItem({
            icon: 'lock-closed-outline',
            label: 'Privacy Policy',
            onPress: () => openUrl('https://spendlymanager.com/privacy'),
          })}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionContent}>
          {renderSettingsItem({
            icon: 'log-out-outline',
            label: 'Sign Out',
            onPress: handleLogout,
            danger: true,
          })}
        </View>
      </View>

      <Text style={styles.version}>Spendly v1.0.0</Text>

      {/* Profile Edit Modal */}
      <Modal visible={profileModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setProfileModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setProfileModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.modalLabel}>Display Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editDisplayName}
              onChangeText={setEditDisplayName}
              placeholder="Your name"
              placeholderTextColor={colors.placeholderText}
            />
            <Text style={styles.modalLabel}>Phone (optional)</Text>
            <TextInput
              style={styles.modalInput}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="+1 234 567 8900"
              placeholderTextColor={colors.placeholderText}
              keyboardType="phone-pad"
            />
            <Text style={styles.modalLabel}>Email</Text>
            <View style={[styles.modalInput, { opacity: 0.6 }]}>
              <Text style={{ color: colors.inputText, fontSize: 16 }}>{user?.email}</Text>
            </View>
            <TouchableOpacity
              style={[styles.modalSubmitButton, updateProfileMutation.isPending && { opacity: 0.7 }]}
              onPress={handleSaveProfile}
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={styles.modalSubmitText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Security Modal */}
      <Modal visible={securityModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSecurityModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSecurityModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Security</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.modalBody}>
            <TouchableOpacity
              style={styles.securityItem}
              onPress={() => {
                setSecurityModalVisible(false);
                Alert.alert(
                  'Change Password',
                  'We will send a password reset email to your registered email address.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Send Email',
                      onPress: async () => {
                        try {
                          const { resetPassword } = require('../lib/firebase');
                          await resetPassword(user?.email || '');
                          Alert.alert('Sent', 'Check your email for the password reset link.');
                        } catch {
                          Alert.alert('Error', 'Failed to send password reset email.');
                        }
                      },
                    },
                  ]
                );
              }}
            >
              <Ionicons name="key-outline" size={22} color={colors.accent} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.securityItemLabel}>Change Password</Text>
                <Text style={styles.securityItemDesc}>Reset password via email</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>

            {biometricAvail && (
              <View style={styles.securityItem}>
                <Ionicons name="finger-print-outline" size={22} color={colors.accent} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.securityItemLabel}>{bioType} Login</Text>
                  <Text style={styles.securityItemDesc}>{biometricOn ? 'Enabled' : 'Disabled'}</Text>
                </View>
                <Switch
                  value={biometricOn}
                  onValueChange={toggleBiometric}
                  trackColor={{ false: colors.switchTrackInactive, true: colors.primary }}
                  thumbColor={biometricOn ? colors.accent : colors.textTertiary}
                />
              </View>
            )}

            <View style={styles.securityItem}>
              <Ionicons name="shield-checkmark" size={22} color={colors.colorGreen} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.securityItemLabel}>Two-Factor Auth</Text>
                <Text style={styles.securityItemDesc}>Coming soon</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Currency Picker Modal */}
      <Modal visible={currencyPickerVisible} animationType="slide" transparent onRequestClose={() => setCurrencyPickerVisible(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Currency</Text>
              <TouchableOpacity onPress={() => setCurrencyPickerVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {CURRENCIES.map((currency) => (
              <TouchableOpacity
                key={currency}
                style={[styles.pickerItem, currentCurrency === currency && styles.pickerItemActive]}
                onPress={() => handleCurrencySelect(currency)}
              >
                <Text style={[styles.pickerItemText, currentCurrency === currency && styles.pickerItemTextActive]}>
                  {currency}
                </Text>
                {currentCurrency === currency && (
                  <Ionicons name="checkmark" size={20} color={colors.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Language Picker Modal */}
      <Modal visible={languagePickerVisible} animationType="slide" transparent onRequestClose={() => setLanguagePickerVisible(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Language</Text>
              <TouchableOpacity onPress={() => setLanguagePickerVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[styles.pickerItem, settings?.language === lang.code && styles.pickerItemActive]}
                onPress={() => handleLanguageSelect(lang.code)}
              >
                <Text style={[styles.pickerItemText, settings?.language === lang.code && styles.pickerItemTextActive]}>
                  {lang.label}
                </Text>
                {settings?.language === lang.code && (
                  <Ionicons name="checkmark" size={20} color={colors.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 20,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.textPrimary,
    },
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      marginHorizontal: 20,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.primaryForeground,
    },
    profileInfo: {
      marginLeft: 16,
      flex: 1,
    },
    profileName: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    profileEmail: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
    },
    section: {
      marginBottom: 24,
      paddingHorizontal: 20,
    },
    sectionTitle: {
      fontSize: 14,
      color: colors.textTertiary,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    sectionContent: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      overflow: 'hidden',
    },
    settingsItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    iconContainer: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconContainerDanger: {
      backgroundColor: colors.dangerSubtleBg,
    },
    settingsContent: {
      flex: 1,
      marginLeft: 12,
    },
    settingsLabel: {
      fontSize: 16,
      color: colors.textPrimary,
    },
    settingsLabelDanger: {
      color: colors.danger,
    },
    settingsValue: {
      fontSize: 14,
      color: colors.textTertiary,
      marginTop: 2,
    },
    version: {
      textAlign: 'center',
      color: colors.textTertiary,
      fontSize: 12,
      paddingVertical: 24,
    },
    // Modal styles
    modalContainer: { flex: 1, backgroundColor: colors.background },
    modalHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    modalTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
    modalBody: { padding: 20 },
    modalLabel: { fontSize: 14, color: colors.textSecondary, marginBottom: 8, marginTop: 16 },
    modalInput: {
      backgroundColor: colors.inputBackground, borderRadius: 12, padding: 16,
      fontSize: 16, color: colors.inputText, borderWidth: 1, borderColor: colors.inputBorder,
    },
    modalSubmitButton: {
      backgroundColor: colors.primary, borderRadius: 12, padding: 16,
      alignItems: 'center', marginTop: 32,
    },
    modalSubmitText: { color: colors.primaryForeground, fontSize: 16, fontWeight: '600' },
    // Security modal
    securityItem: {
      flexDirection: 'row', alignItems: 'center', padding: 16,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    securityItemLabel: { fontSize: 16, color: colors.textPrimary, fontWeight: '500' },
    securityItemDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    // Picker modals
    pickerOverlay: {
      flex: 1, backgroundColor: colors.modalOverlay, justifyContent: 'flex-end',
    },
    pickerContent: {
      backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, paddingBottom: 40, maxHeight: '60%',
    },
    pickerHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 16,
    },
    pickerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
    pickerItem: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: 16, borderRadius: 12, marginBottom: 4,
    },
    pickerItemActive: { backgroundColor: colors.accentBackground },
    pickerItemText: { fontSize: 16, color: colors.textPrimary },
    pickerItemTextActive: { color: colors.accent, fontWeight: '600' },
  });
}
