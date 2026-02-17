import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetwork } from '../lib/network-context';
import { useTheme } from '../lib/theme-context';
import { ColorTokens } from '../lib/colors';

export default function OfflineBanner() {
  const { isConnected, pendingMutations } = useNetwork();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (isConnected && pendingMutations === 0) return null;

  return (
    <View style={[styles.banner, isConnected ? styles.syncing : styles.offline]}>
      <Ionicons
        name={isConnected ? 'sync' : 'cloud-offline-outline'}
        size={16}
        color="#FFFFFF"
      />
      <Text style={styles.text}>
        {isConnected
          ? `Syncing ${pendingMutations} pending changes...`
          : 'No internet connection — changes will sync when online'}
      </Text>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 8,
    },
    offline: {
      backgroundColor: colors.danger,
    },
    syncing: {
      backgroundColor: colors.warning,
    },
    text: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '500',
      flex: 1,
    },
  });
}
