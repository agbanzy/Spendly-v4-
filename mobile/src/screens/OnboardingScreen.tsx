import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme-context';
import { ColorTokens } from '../lib/colors';
import { shadows } from '../lib/shadows';
import { apiRequest } from '../lib/api';
import { getIdToken } from '../lib/cognito';
import { useAuth } from '../lib/auth-context';

const COUNTRIES = [
  { code: 'NG', name: 'Nigeria', currency: 'NGN', flag: '🇳🇬', phonePlaceholder: '+234 XXX XXX XXXX' },
  { code: 'GH', name: 'Ghana', currency: 'GHS', flag: '🇬🇭', phonePlaceholder: '+233 XX XXX XXXX' },
  { code: 'KE', name: 'Kenya', currency: 'KES', flag: '🇰🇪', phonePlaceholder: '+254 XXX XXX XXX' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', flag: '🇿🇦', phonePlaceholder: '+27 XX XXX XXXX' },
  { code: 'EG', name: 'Egypt', currency: 'EGP', flag: '🇪🇬', phonePlaceholder: '+20 XXX XXX XXXX' },
  { code: 'RW', name: 'Rwanda', currency: 'RWF', flag: '🇷🇼', phonePlaceholder: '+250 XXX XXX XXX' },
  { code: 'CI', name: "Côte d'Ivoire", currency: 'XOF', flag: '🇨🇮', phonePlaceholder: '+225 XX XX XXX XXX' },
  { code: 'US', name: 'United States', currency: 'USD', flag: '🇺🇸', phonePlaceholder: '+1 (XXX) XXX-XXXX' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', flag: '🇬🇧', phonePlaceholder: '+44 XXXX XXXXXX' },
  { code: 'CA', name: 'Canada', currency: 'CAD', flag: '🇨🇦', phonePlaceholder: '+1 (XXX) XXX-XXXX' },
  { code: 'DE', name: 'Germany', currency: 'EUR', flag: '🇩🇪', phonePlaceholder: '+49 XXX XXXXXXXX' },
  { code: 'FR', name: 'France', currency: 'EUR', flag: '🇫🇷', phonePlaceholder: '+33 X XX XX XX XX' },
  { code: 'AU', name: 'Australia', currency: 'AUD', flag: '🇦🇺', phonePlaceholder: '+61 XXX XXX XXX' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', flag: '🇳🇱', phonePlaceholder: '+31 X XXXXXXXX' },
  { code: 'IE', name: 'Ireland', currency: 'EUR', flag: '🇮🇪', phonePlaceholder: '+353 XX XXXXXXX' },
  { code: 'SE', name: 'Sweden', currency: 'SEK', flag: '🇸🇪', phonePlaceholder: '+46 XX XXX XX XX' },
  { code: 'NO', name: 'Norway', currency: 'NOK', flag: '🇳🇴', phonePlaceholder: '+47 XXX XX XXX' },
  { code: 'DK', name: 'Denmark', currency: 'DKK', flag: '🇩🇰', phonePlaceholder: '+45 XX XX XX XX' },
  { code: 'FI', name: 'Finland', currency: 'EUR', flag: '🇫🇮', phonePlaceholder: '+358 XX XXX XXXX' },
  { code: 'PT', name: 'Portugal', currency: 'EUR', flag: '🇵🇹', phonePlaceholder: '+351 XXX XXX XXX' },
  { code: 'ES', name: 'Spain', currency: 'EUR', flag: '🇪🇸', phonePlaceholder: '+34 XXX XXX XXX' },
  { code: 'IT', name: 'Italy', currency: 'EUR', flag: '🇮🇹', phonePlaceholder: '+39 XXX XXX XXXX' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD', flag: '🇳🇿', phonePlaceholder: '+64 XX XXX XXXX' },
];

const INDUSTRIES = [
  'Technology', 'Finance & Banking', 'Healthcare', 'E-Commerce',
  'Manufacturing', 'Education', 'Real Estate', 'Logistics',
  'Agriculture', 'Media & Entertainment', 'Other',
];

const TEAM_SIZES = [
  { label: 'Just me', value: '1' },
  { label: '2–10', value: '2-10' },
  { label: '11–50', value: '11-50' },
  { label: '51–200', value: '51-200' },
  { label: '200+', value: '200+' },
];

interface OnboardingScreenProps {
  onComplete: (startKYC?: boolean) => void;
  navigation?: any;
}

export default function OnboardingScreen({ onComplete, navigation }: OnboardingScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  // Step 1: Your Details
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<typeof COUNTRIES[0] | null>(null);

  // Step 2: Your Company
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [teamSize, setTeamSize] = useState('');

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateTransition = (nextStep: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: nextStep > step ? -20 : 20, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(nextStep > step ? 20 : -20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
      ]).start();
    });
  };

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const handleNext = () => {
    if (step === 1) {
      if (!selectedCountry) {
        Alert.alert('Required', 'Please select your country.');
        return;
      }
      if (!phoneNumber.trim()) {
        Alert.alert('Required', 'Please enter your phone number.');
        return;
      }
      animateTransition(2);
    } else if (step === 2) {
      if (!companyName.trim()) {
        Alert.alert('Required', 'Please enter your company or business name.');
        return;
      }
      animateTransition(3);
    }
  };

  const handleBack = () => {
    if (step > 1) animateTransition(step - 1);
  };

  const handleComplete = async (startKYC: boolean) => {
    setLoading(true);
    try {
      // Ensure we have a fresh auth token before making the API call
      await getIdToken();

      // Save profile data
      await apiRequest('PATCH', `/api/user-profile/${user?.sub}`, {
        phoneNumber: phoneNumber.trim(),
        country: selectedCountry?.code,
        currency: selectedCountry?.currency,
        companyName: companyName.trim(),
        industry: industry || undefined,
        teamSize: teamSize || undefined,
        onboardingStep: 5,
        onboardingCompleted: true,
      });

      // Pass startKYC flag to auth context — the navigator will handle
      // deferred KYC navigation after the screen tree remounts to MainTabs
      onComplete(startKYC);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {[1, 2, 3].map((s) => (
        <View key={s} style={[styles.progressSegment, s <= step && styles.progressSegmentActive]} />
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <View style={styles.iconCircle}>
          <Ionicons name="globe-outline" size={28} color={colors.primary} />
        </View>
        <Text style={styles.stepTitle}>Where are you based?</Text>
        <Text style={styles.stepDescription}>This helps us set up the right payment methods and currency for your region.</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Country</Text>
        <TouchableOpacity style={styles.pickerButton} onPress={() => setShowCountryPicker(true)}>
          {selectedCountry ? (
            <View style={styles.pickerValue}>
              <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
              <Text style={styles.pickerValueText}>{selectedCountry.name}</Text>
              <Text style={styles.currencyBadge}>{selectedCountry.currency}</Text>
            </View>
          ) : (
            <Text style={styles.pickerPlaceholder}>Select your country</Text>
          )}
          <Ionicons name="chevron-down" size={20} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          placeholder={selectedCountry?.phonePlaceholder || '+1 (XXX) XXX-XXXX'}
          placeholderTextColor={colors.placeholderText}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
        />
      </View>

      {selectedCountry && (
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle-outline" size={18} color={colors.info} />
          <Text style={styles.infoText}>
            Your default currency will be <Text style={styles.infoBold}>{selectedCountry.currency}</Text>.
            {['NG', 'GH', 'KE', 'ZA'].includes(selectedCountry.code)
              ? ' Payments powered by Paystack.'
              : ' Payments powered by Stripe.'}
          </Text>
        </View>
      )}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <View style={styles.iconCircle}>
          <Ionicons name="business-outline" size={28} color={colors.primary} />
        </View>
        <Text style={styles.stepTitle}>Your Business</Text>
        <Text style={styles.stepDescription}>Tell us about your company so we can customize your experience.</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Company / Business Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Acme Corp"
          placeholderTextColor={colors.placeholderText}
          value={companyName}
          onChangeText={setCompanyName}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Industry <Text style={styles.optionalLabel}>(Optional)</Text></Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          <View style={styles.chipRow}>
            {INDUSTRIES.map((ind) => (
              <TouchableOpacity
                key={ind}
                style={[styles.chip, industry === ind && styles.chipActive]}
                onPress={() => setIndustry(industry === ind ? '' : ind)}
              >
                <Text style={[styles.chipText, industry === ind && styles.chipTextActive]}>{ind}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Team Size <Text style={styles.optionalLabel}>(Optional)</Text></Text>
        <View style={styles.teamSizeRow}>
          {TEAM_SIZES.map((ts) => (
            <TouchableOpacity
              key={ts.value}
              style={[styles.teamSizeButton, teamSize === ts.value && styles.teamSizeActive]}
              onPress={() => setTeamSize(teamSize === ts.value ? '' : ts.value)}
            >
              <Text style={[styles.teamSizeText, teamSize === ts.value && styles.teamSizeTextActive]}>
                {ts.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <View style={[styles.iconCircle, { backgroundColor: colors.successSubtle }]}>
          <Ionicons name="shield-checkmark-outline" size={28} color={colors.success} />
        </View>
        <Text style={styles.stepTitle}>Get Verified</Text>
        <Text style={styles.stepDescription}>
          Complete identity verification to unlock all features — virtual accounts, card payments, and transfers.
        </Text>
      </View>

      <View style={styles.verifyFeatures}>
        {[
          { icon: 'card-outline' as const, text: 'Issue virtual & physical cards' },
          { icon: 'business-outline' as const, text: 'Receive payments via virtual account' },
          { icon: 'send-outline' as const, text: 'Send & receive bank transfers' },
          { icon: 'wallet-outline' as const, text: 'Higher transaction limits' },
        ].map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Ionicons name={f.icon} size={20} color={colors.primary} />
            </View>
            <Text style={styles.featureText}>{f.text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.verifyActions}>
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={() => handleComplete(true)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <>
              <Ionicons name="shield-checkmark" size={20} color={colors.primaryForeground} />
              <Text style={styles.primaryButtonText}>Verify Now</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => handleComplete(false)}
          disabled={loading}
        >
          <Text style={styles.skipButtonText}>I'll do this later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCountryPicker = () => (
    <View style={styles.countryPickerOverlay}>
      <View style={styles.countryPickerContainer}>
        <View style={styles.countryPickerHeader}>
          <Text style={styles.countryPickerTitle}>Select Country</Text>
          <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search country..."
            placeholderTextColor={colors.placeholderText}
            value={countrySearch}
            onChangeText={setCountrySearch}
            autoFocus
          />
        </View>

        <ScrollView style={styles.countryList} keyboardShouldPersistTaps="handled">
          {filteredCountries.map((c) => (
            <TouchableOpacity
              key={c.code}
              style={[styles.countryItem, selectedCountry?.code === c.code && styles.countryItemActive]}
              onPress={() => {
                setSelectedCountry(c);
                setShowCountryPicker(false);
                setCountrySearch('');
              }}
            >
              <Text style={styles.countryItemFlag}>{c.flag}</Text>
              <View style={styles.countryItemInfo}>
                <Text style={styles.countryItemName}>{c.name}</Text>
                <Text style={styles.countryItemCurrency}>{c.currency}</Text>
              </View>
              {selectedCountry?.code === c.code && (
                <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.topSection}>
          <Text style={styles.logo}>Financiar</Text>
          <Text style={styles.welcomeText}>Let's set up your account</Text>
          {renderProgressBar()}
        </View>

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </Animated.View>

        {step < 3 && (
          <View style={styles.navigationRow}>
            {step > 1 ? (
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}
            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.primaryForeground} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {showCountryPicker && renderCountryPicker()}
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { flexGrow: 1, padding: 24, paddingTop: 60 },
    topSection: { alignItems: 'center', marginBottom: 32 },
    logo: { fontSize: 36, fontWeight: '800', color: colors.accent, letterSpacing: -1 },
    welcomeText: { fontSize: 15, color: colors.textSecondary, marginTop: 6 },
    progressContainer: { flexDirection: 'row', gap: 8, marginTop: 24, width: '100%' },
    progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
    progressSegmentActive: { backgroundColor: colors.primary },

    stepContent: { marginBottom: 24 },
    stepHeader: { alignItems: 'center', marginBottom: 28 },
    iconCircle: {
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: colors.accentBackground,
      alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    },
    stepTitle: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
    stepDescription: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 12 },

    fieldGroup: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', color: colors.textBody, marginBottom: 8 },
    optionalLabel: { fontWeight: '400', color: colors.textTertiary, fontSize: 12 },
    input: {
      backgroundColor: colors.inputBackground, borderRadius: 14, padding: 16,
      fontSize: 16, color: colors.inputText, borderWidth: 1, borderColor: colors.inputBorder,
    },

    pickerButton: {
      backgroundColor: colors.inputBackground, borderRadius: 14, padding: 16,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderWidth: 1, borderColor: colors.inputBorder,
    },
    pickerValue: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    countryFlag: { fontSize: 22 },
    pickerValueText: { fontSize: 16, color: colors.inputText, fontWeight: '500' },
    currencyBadge: {
      fontSize: 12, fontWeight: '700', color: colors.primary,
      backgroundColor: colors.accentBackground, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
    },
    pickerPlaceholder: { fontSize: 16, color: colors.placeholderText },

    infoBanner: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginTop: 4,
    },
    infoText: { fontSize: 13, color: colors.textSecondary, flex: 1, lineHeight: 19 },
    infoBold: { fontWeight: '700', color: colors.textSoft },

    chipScroll: { marginBottom: 4 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
    chipTextActive: { color: colors.primaryForeground },

    teamSizeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    teamSizeButton: {
      paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    teamSizeActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    teamSizeText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
    teamSizeTextActive: { color: colors.primaryForeground },

    verifyFeatures: { gap: 16, marginBottom: 32, marginTop: 8 },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    featureIcon: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: colors.accentBackground,
      alignItems: 'center', justifyContent: 'center',
    },
    featureText: { fontSize: 15, color: colors.textBody, flex: 1, fontWeight: '500' },

    verifyActions: { gap: 12 },
    primaryButton: {
      backgroundColor: colors.primary, borderRadius: 14, padding: 16,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      ...shadows.card,
    },
    primaryButtonText: { color: colors.primaryForeground, fontSize: 16, fontWeight: '700' },
    skipButton: {
      padding: 14, alignItems: 'center',
    },
    skipButtonText: { color: colors.textTertiary, fontSize: 14, fontWeight: '500' },
    buttonDisabled: { opacity: 0.6 },

    navigationRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginTop: 8, paddingBottom: 20,
    },
    backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12 },
    backButtonText: { fontSize: 15, color: colors.textSecondary, fontWeight: '500' },
    nextButton: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14,
      ...shadows.card,
    },
    nextButtonText: { color: colors.primaryForeground, fontSize: 16, fontWeight: '700' },

    // Country picker overlay
    countryPickerOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    countryPickerContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      maxHeight: '80%', paddingBottom: 34,
    },
    countryPickerHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: 20, paddingBottom: 12,
    },
    countryPickerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
    searchContainer: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: colors.inputBackground, marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 14,
      borderWidth: 1, borderColor: colors.inputBorder,
    },
    searchInput: { flex: 1, fontSize: 15, color: colors.inputText, paddingVertical: 12 },
    countryList: { marginTop: 8 },
    countryItem: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingHorizontal: 20, paddingVertical: 14,
    },
    countryItemActive: { backgroundColor: colors.accentBackground },
    countryItemFlag: { fontSize: 26 },
    countryItemInfo: { flex: 1 },
    countryItemName: { fontSize: 15, fontWeight: '500', color: colors.textPrimary },
    countryItemCurrency: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  });
}
