import { Platform, ViewStyle } from 'react-native';

/**
 * Cross-platform shadow presets for premium elevation.
 * iOS uses shadowColor/shadowOffset/shadowOpacity/shadowRadius.
 * Android uses elevation.
 */

type ShadowPreset = ViewStyle;

export const shadows = {
  /** Subtle shadow for small elements, inputs, list items */
  subtle: Platform.select<ShadowPreset>({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
    },
    android: {
      elevation: 2,
    },
  }) as ShadowPreset,

  /** Standard card shadow with primary color tint */
  card: Platform.select<ShadowPreset>({
    ios: {
      shadowColor: '#6B2346',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
    },
    android: {
      elevation: 4,
    },
  }) as ShadowPreset,

  /** Medium elevation for floating elements, modals */
  medium: Platform.select<ShadowPreset>({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
    },
    android: {
      elevation: 8,
    },
  }) as ShadowPreset,

  /** Hero-level shadow for balance cards, featured elements */
  hero: Platform.select<ShadowPreset>({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.15,
      shadowRadius: 30,
    },
    android: {
      elevation: 12,
    },
  }) as ShadowPreset,

  /** Dramatic shadow for virtual card visualizations */
  dramatic: Platform.select<ShadowPreset>({
    ios: {
      shadowColor: '#6B2346',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.2,
      shadowRadius: 40,
    },
    android: {
      elevation: 16,
    },
  }) as ShadowPreset,
};

/** Monospace font family for numeric displays (amounts, balances, stats) */
export const monoFont = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
