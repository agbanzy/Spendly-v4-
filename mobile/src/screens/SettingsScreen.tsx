import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth-context';

interface SettingsItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}

function SettingsItem({ icon, label, value, onPress, danger }: SettingsItemProps) {
  return (
    <TouchableOpacity
      style={styles.settingsItem}
      onPress={onPress}
      disabled={!onPress}
      testID={`settings-item-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <View style={[styles.iconContainer, danger && styles.iconContainerDanger]}>
        <Ionicons name={icon} size={20} color={danger ? '#EF4444' : '#94A3B8'} />
      </View>
      <View style={styles.settingsContent}>
        <Text style={[styles.settingsLabel, danger && styles.settingsLabelDanger]}>{label}</Text>
        {value && <Text style={styles.settingsValue}>{value}</Text>}
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={20} color="#64748B" />
      )}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { user, logout } = useAuth();

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

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.displayName || 'User'}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.sectionContent}>
          <SettingsItem
            icon="person-outline"
            label="Profile"
            onPress={() => {}}
          />
          <SettingsItem
            icon="shield-checkmark-outline"
            label="Security"
            onPress={() => {}}
          />
          <SettingsItem
            icon="notifications-outline"
            label="Notifications"
            onPress={() => {}}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.sectionContent}>
          <SettingsItem
            icon="globe-outline"
            label="Currency"
            value="USD"
            onPress={() => {}}
          />
          <SettingsItem
            icon="moon-outline"
            label="Theme"
            value="Dark"
            onPress={() => {}}
          />
          <SettingsItem
            icon="language-outline"
            label="Language"
            value="English"
            onPress={() => {}}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.sectionContent}>
          <SettingsItem
            icon="help-circle-outline"
            label="Help Center"
            onPress={() => {}}
          />
          <SettingsItem
            icon="chatbubble-outline"
            label="Contact Support"
            onPress={() => {}}
          />
          <SettingsItem
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() => {}}
          />
          <SettingsItem
            icon="lock-closed-outline"
            label="Privacy Policy"
            onPress={() => {}}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionContent}>
          <SettingsItem
            icon="log-out-outline"
            label="Sign Out"
            onPress={handleLogout}
            danger
          />
        </View>
      </View>

      <Text style={styles.version}>Spendly v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  profileEmail: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionContent: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  settingsContent: {
    flex: 1,
    marginLeft: 12,
  },
  settingsLabel: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  settingsLabelDanger: {
    color: '#EF4444',
  },
  settingsValue: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  version: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 12,
    paddingVertical: 24,
  },
});
