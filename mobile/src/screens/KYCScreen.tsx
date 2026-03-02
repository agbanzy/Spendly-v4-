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
import { useAuth } from '../lib/auth-context';

// Country → ID types mapping (matches server VALID_ID_TYPES_BY_COUNTRY)
const ID_TYPES_BY_COUNTRY: Record<string, { value: string; label: string }[]> = {
  NG: [
    { value: 'BVN', label: 'Bank Verification Number (BVN)' },
    { value: 'NIN', label: 'National ID (NIN)' },
    { value: 'VOTERS_CARD', label: "Voter's Card" },
    { value: 'DRIVERS_LICENSE', label: "Driver's License" },
    { value: 'INTERNATIONAL_PASSPORT', label: 'International Passport' },
  ],
  GH: [
    { value: 'GHANA_CARD', label: 'Ghana Card' },
    { value: 'VOTERS_ID', label: "Voter's ID" },
    { value: 'DRIVERS_LICENSE', label: "Driver's License" },
    { value: 'PASSPORT', label: 'Passport' },
  ],
  ZA: [
    { value: 'SOUTH_AFRICAN_ID', label: 'South African ID' },
    { value: 'PASSPORT', label: 'Passport' },
    { value: 'DRIVERS_LICENSE', label: "Driver's License" },
  ],
  KE: [
    { value: 'NATIONAL_ID', label: 'National ID' },
    { value: 'PASSPORT', label: 'Passport' },
    { value: 'DRIVERS_LICENSE', label: "Driver's License" },
  ],
  US: [
    { value: 'SSN', label: 'Social Security Number' },
    { value: 'DRIVERS_LICENSE', label: "Driver's License" },
    { value: 'PASSPORT', label: 'Passport' },
    { value: 'STATE_ID', label: 'State ID' },
  ],
  GB: [
    { value: 'PASSPORT', label: 'Passport' },
    { value: 'DRIVERS_LICENSE', label: "Driver's License" },
  ],
  CA: [
    { value: 'PASSPORT', label: 'Passport' },
    { value: 'DRIVERS_LICENSE', label: "Driver's License" },
  ],
  AU: [
    { value: 'PASSPORT', label: 'Passport' },
    { value: 'DRIVERS_LICENSE', label: "Driver's License" },
  ],
};

// Default ID types for countries not in the map
const DEFAULT_ID_TYPES = [
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'DRIVERS_LICENSE', label: "Driver's License" },
];

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

interface KYCScreenProps {
  navigation?: any;
}

export default function KYCScreen({ navigation }: KYCScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, userProfile, refreshProfile } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showIdTypePicker, setShowIdTypePicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);

  // Step 1: Personal Info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [nationality, setNationality] = useState('');

  // Step 2: Address
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Step 3: Identity
  const [idType, setIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [idExpiryDate, setIdExpiryDate] = useState('');
  const [bvnNumber, setBvnNumber] = useState('');

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Derive country from user profile
  const country = userProfile?.country || 'US';
  const availableIdTypes = ID_TYPES_BY_COUNTRY[country] || DEFAULT_ID_TYPES;
  const isNigerian = country === 'NG';

  // Pre-fill from profile
  useEffect(() => {
    if (userProfile) {
      if (userProfile.displayName) {
        const parts = userProfile.displayName.split(' ');
        if (parts.length >= 2) {
          setFirstName(parts[0]);
          setLastName(parts.slice(1).join(' '));
        } else {
          setFirstName(parts[0]);
        }
      }
      if (userProfile.nationality) setNationality(userProfile.nationality);
      else setNationality(country);
      if (userProfile.phoneNumber) {
        // Phone is already set from onboarding
      }
      if (userProfile.city) setCity(userProfile.city);
      if (userProfile.state) setState(userProfile.state);
      if (userProfile.postalCode) setPostalCode(userProfile.postalCode);
      if (userProfile.address) setAddressLine1(userProfile.address);
    }
  }, [userProfile]);

  const animateTransition = (nextStep: number) => {
    const direction = nextStep > step ? -20 : 20;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: direction, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(-direction);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
      ]).start();
    });
  };

  const formatDateInput = (text: string) => {
    // Auto-format as YYYY-MM-DD
    const digits = text.replace(/\D/g, '');
    let formatted = '';
    if (digits.length <= 4) formatted = digits;
    else if (digits.length <= 6) formatted = `${digits.slice(0, 4)}-${digits.slice(4)}`;
    else formatted = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    return formatted;
  };

  const validateStep1 = () => {
    if (!firstName.trim()) { Alert.alert('Required', 'First name is required.'); return false; }
    if (!lastName.trim()) { Alert.alert('Required', 'Last name is required.'); return false; }
    if (!dateOfBirth.trim()) { Alert.alert('Required', 'Date of birth is required.'); return false; }
    // Validate DOB format and age
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) { Alert.alert('Invalid', 'Please enter a valid date (YYYY-MM-DD).'); return false; }
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 18) { Alert.alert('Age Requirement', 'You must be at least 18 years old.'); return false; }
    if (age > 120) { Alert.alert('Invalid', 'Please check your date of birth.'); return false; }
    if (!nationality.trim()) { Alert.alert('Required', 'Nationality is required.'); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (!addressLine1.trim()) { Alert.alert('Required', 'Street address is required.'); return false; }
    if (!city.trim()) { Alert.alert('Required', 'City is required.'); return false; }
    if (!state.trim()) { Alert.alert('Required', 'State/Province is required.'); return false; }
    if (!postalCode.trim()) { Alert.alert('Required', 'Postal/ZIP code is required.'); return false; }
    return true;
  };

  const validateStep3 = () => {
    if (!idType) { Alert.alert('Required', 'Please select an ID type.'); return false; }
    if (!idNumber.trim()) { Alert.alert('Required', 'ID number is required.'); return false; }
    if (isNigerian && idType === 'BVN' && !bvnNumber.trim()) {
      Alert.alert('Required', 'BVN number is required for Nigerian BVN verification.');
      return false;
    }
    // Validate expiry if provided
    if (idExpiryDate.trim()) {
      const expiry = new Date(idExpiryDate);
      if (isNaN(expiry.getTime())) { Alert.alert('Invalid', 'Please enter a valid expiry date.'); return false; }
      if (expiry < new Date()) { Alert.alert('Expired', 'Your ID document appears to be expired.'); return false; }
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) animateTransition(2);
    else if (step === 2 && validateStep2()) animateTransition(3);
    else if (step === 3 && validateStep3()) animateTransition(4);
  };

  const handleBack = () => {
    if (step > 1) animateTransition(step - 1);
    else if (navigation?.canGoBack()) navigation.goBack();
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        cognitoSub: user?.sub,
        email: user?.email,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        middleName: middleName.trim() || undefined,
        dateOfBirth: dateOfBirth.trim(),
        gender: gender || undefined,
        nationality: nationality.trim(),
        phoneNumber: userProfile?.phoneNumber || '',
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim(),
        state: state.trim(),
        country,
        postalCode: postalCode.trim(),
        idType,
        idNumber: idNumber.trim(),
        idExpiryDate: idExpiryDate.trim() || undefined,
        isBusinessAccount: false,
        acceptTerms: true,
      };

      if (isNigerian && bvnNumber.trim()) {
        payload.bvnNumber = bvnNumber.trim();
      }

      await apiRequest('POST', '/api/kyc', payload);

      // Refresh profile to get updated KYC status
      await refreshProfile();

      Alert.alert(
        'Verification Submitted! 🎉',
        isNigerian && bvnNumber
          ? 'Your BVN is being verified. This usually takes just a few seconds.'
          : 'Your identity verification is being processed. We\'ll notify you once it\'s approved.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (navigation?.canGoBack()) navigation.goBack();
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Submission Failed', error?.message || 'Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedIdTypeLabel = availableIdTypes.find(t => t.value === idType)?.label || '';
  const selectedGenderLabel = GENDERS.find(g => g.value === gender)?.label || '';

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {[1, 2, 3, 4].map((s) => (
        <View key={s} style={[styles.progressSegment, s <= step && styles.progressSegmentActive]} />
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <View style={styles.iconCircle}>
          <Ionicons name="person-outline" size={26} color={colors.primary} />
        </View>
        <Text style={styles.stepTitle}>Personal Information</Text>
        <Text style={styles.stepDescription}>
          We need your legal name and details for identity verification.
        </Text>
      </View>

      <View style={styles.fieldRow}>
        <View style={[styles.fieldGroup, { flex: 1 }]}>
          <Text style={styles.label}>First Name <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="John"
            placeholderTextColor={colors.placeholderText}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />
        </View>
        <View style={[styles.fieldGroup, { flex: 1 }]}>
          <Text style={styles.label}>Last Name <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="Doe"
            placeholderTextColor={colors.placeholderText}
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Middle Name <Text style={styles.optionalLabel}>(Optional)</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="Middle name"
          placeholderTextColor={colors.placeholderText}
          value={middleName}
          onChangeText={setMiddleName}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Date of Birth <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.placeholderText}
          value={dateOfBirth}
          onChangeText={(text) => setDateOfBirth(formatDateInput(text))}
          keyboardType="numeric"
          maxLength={10}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Gender <Text style={styles.optionalLabel}>(Optional)</Text></Text>
        <TouchableOpacity style={styles.pickerButton} onPress={() => setShowGenderPicker(true)}>
          {gender ? (
            <Text style={styles.pickerValueText}>{selectedGenderLabel}</Text>
          ) : (
            <Text style={styles.pickerPlaceholder}>Select gender</Text>
          )}
          <Ionicons name="chevron-down" size={20} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Nationality <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Nigerian, American"
          placeholderTextColor={colors.placeholderText}
          value={nationality}
          onChangeText={setNationality}
          autoCapitalize="words"
        />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <View style={styles.iconCircle}>
          <Ionicons name="location-outline" size={26} color={colors.primary} />
        </View>
        <Text style={styles.stepTitle}>Residential Address</Text>
        <Text style={styles.stepDescription}>
          Your current residential address for compliance purposes.
        </Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Street Address <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="123 Main Street"
          placeholderTextColor={colors.placeholderText}
          value={addressLine1}
          onChangeText={setAddressLine1}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Address Line 2 <Text style={styles.optionalLabel}>(Optional)</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="Apartment, suite, unit, etc."
          placeholderTextColor={colors.placeholderText}
          value={addressLine2}
          onChangeText={setAddressLine2}
        />
      </View>

      <View style={styles.fieldRow}>
        <View style={[styles.fieldGroup, { flex: 1 }]}>
          <Text style={styles.label}>City <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="City"
            placeholderTextColor={colors.placeholderText}
            value={city}
            onChangeText={setCity}
            autoCapitalize="words"
          />
        </View>
        <View style={[styles.fieldGroup, { flex: 1 }]}>
          <Text style={styles.label}>State/Province <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="State"
            placeholderTextColor={colors.placeholderText}
            value={state}
            onChangeText={setState}
            autoCapitalize="words"
          />
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Postal / ZIP Code <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="Postal code"
          placeholderTextColor={colors.placeholderText}
          value={postalCode}
          onChangeText={setPostalCode}
          keyboardType="default"
          autoCapitalize="characters"
        />
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <View style={styles.iconCircle}>
          <Ionicons name="id-card-outline" size={26} color={colors.primary} />
        </View>
        <Text style={styles.stepTitle}>Identity Document</Text>
        <Text style={styles.stepDescription}>
          Provide a valid government-issued ID for verification.
        </Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>ID Type <Text style={styles.required}>*</Text></Text>
        <TouchableOpacity style={styles.pickerButton} onPress={() => setShowIdTypePicker(true)}>
          {idType ? (
            <Text style={styles.pickerValueText}>{selectedIdTypeLabel}</Text>
          ) : (
            <Text style={styles.pickerPlaceholder}>Select ID type</Text>
          )}
          <Ionicons name="chevron-down" size={20} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>ID Number <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.input}
          placeholder={idType === 'BVN' ? '22XXXXXXXXX' : 'Enter your ID number'}
          placeholderTextColor={colors.placeholderText}
          value={idNumber}
          onChangeText={setIdNumber}
          autoCapitalize="characters"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Expiry Date <Text style={styles.optionalLabel}>(If applicable)</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.placeholderText}
          value={idExpiryDate}
          onChangeText={(text) => setIdExpiryDate(formatDateInput(text))}
          keyboardType="numeric"
          maxLength={10}
        />
      </View>

      {isNigerian && (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>BVN Number</Text>
          <Text style={styles.fieldHint}>
            For instant verification via Paystack. This speeds up approval.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your 11-digit BVN"
            placeholderTextColor={colors.placeholderText}
            value={bvnNumber}
            onChangeText={setBvnNumber}
            keyboardType="numeric"
            maxLength={11}
          />
        </View>
      )}

      <View style={styles.infoBanner}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.info} />
        <Text style={styles.infoText}>
          Your data is encrypted and securely stored. We only use it for identity verification as required by financial regulations.
        </Text>
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <View style={[styles.iconCircle, { backgroundColor: colors.successSubtle }]}>
          <Ionicons name="checkmark-done-outline" size={26} color={colors.success} />
        </View>
        <Text style={styles.stepTitle}>Review & Submit</Text>
        <Text style={styles.stepDescription}>
          Please review your information before submitting.
        </Text>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>Personal Details</Text>
        <ReviewRow label="Name" value={`${firstName} ${middleName ? middleName + ' ' : ''}${lastName}`} colors={colors} />
        <ReviewRow label="Date of Birth" value={dateOfBirth} colors={colors} />
        {gender ? <ReviewRow label="Gender" value={selectedGenderLabel} colors={colors} /> : null}
        <ReviewRow label="Nationality" value={nationality} colors={colors} />
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>Address</Text>
        <ReviewRow label="Street" value={addressLine1 + (addressLine2 ? `, ${addressLine2}` : '')} colors={colors} />
        <ReviewRow label="City / State" value={`${city}, ${state}`} colors={colors} />
        <ReviewRow label="Postal Code" value={postalCode} colors={colors} />
        <ReviewRow label="Country" value={country} colors={colors} />
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>Identity</Text>
        <ReviewRow label="ID Type" value={selectedIdTypeLabel} colors={colors} />
        <ReviewRow label="ID Number" value={idNumber.length > 4 ? `${idNumber.slice(0, 4)}${'•'.repeat(idNumber.length - 4)}` : idNumber} colors={colors} />
        {idExpiryDate ? <ReviewRow label="Expiry" value={idExpiryDate} colors={colors} /> : null}
        {bvnNumber ? <ReviewRow label="BVN" value={`${bvnNumber.slice(0, 4)}${'•'.repeat(7)}`} colors={colors} /> : null}
      </View>

      <View style={styles.termsContainer}>
        <Ionicons name="checkbox" size={22} color={colors.primary} />
        <Text style={styles.termsText}>
          By submitting, I confirm that all information provided is accurate and I agree to the verification terms.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.primaryForeground} size="small" />
        ) : (
          <>
            <Ionicons name="shield-checkmark" size={20} color={colors.primaryForeground} />
            <Text style={styles.submitButtonText}>Submit Verification</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderPickerOverlay = (
    title: string,
    items: { value: string; label: string }[],
    selected: string,
    onSelect: (value: string) => void,
    onClose: () => void
  ) => (
    <View style={styles.pickerOverlay}>
      <TouchableOpacity style={styles.pickerOverlayBg} onPress={onClose} activeOpacity={1} />
      <View style={styles.pickerContainer}>
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
          {items.map((item) => (
            <TouchableOpacity
              key={item.value}
              style={[styles.pickerItem, selected === item.value && styles.pickerItemActive]}
              onPress={() => {
                onSelect(item.value);
                onClose();
              }}
            >
              <Text style={[styles.pickerItemText, selected === item.value && styles.pickerItemTextActive]}>
                {item.label}
              </Text>
              {selected === item.value && (
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
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topBarBack} onPress={handleBack}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Identity Verification</Text>
          <View style={{ width: 40 }} />
        </View>

        {renderProgressBar()}

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </Animated.View>

        {step < 4 && (
          <View style={styles.navigationRow}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>{step === 3 ? 'Review' : 'Continue'}</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.primaryForeground} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {showIdTypePicker && renderPickerOverlay(
        'Select ID Type',
        availableIdTypes,
        idType,
        setIdType,
        () => setShowIdTypePicker(false)
      )}

      {showGenderPicker && renderPickerOverlay(
        'Select Gender',
        GENDERS,
        gender,
        setGender,
        () => setShowGenderPicker(false)
      )}
    </KeyboardAvoidingView>
  );
}

function ReviewRow({ label, value, colors }: { label: string; value: string; colors: ColorTokens }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
      <Text style={{ fontSize: 14, color: colors.textTertiary, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: '500', flex: 2, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { flexGrow: 1, padding: 24, paddingTop: 56 },

    topBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 16,
    },
    topBarBack: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    },
    topBarTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },

    progressContainer: { flexDirection: 'row', gap: 6, marginBottom: 28 },
    progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
    progressSegmentActive: { backgroundColor: colors.primary },

    stepContent: { marginBottom: 24 },
    stepHeader: { alignItems: 'center', marginBottom: 24 },
    iconCircle: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: colors.accentBackground,
      alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    },
    stepTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
    stepDescription: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },

    fieldGroup: { marginBottom: 16 },
    fieldRow: { flexDirection: 'row', gap: 12 },
    label: { fontSize: 13, fontWeight: '600', color: colors.textBody, marginBottom: 6 },
    required: { color: colors.danger, fontWeight: '700' },
    optionalLabel: { fontWeight: '400', color: colors.textTertiary, fontSize: 11 },
    fieldHint: { fontSize: 12, color: colors.textTertiary, marginBottom: 8, lineHeight: 17 },
    input: {
      backgroundColor: colors.inputBackground, borderRadius: 12, padding: 14,
      fontSize: 15, color: colors.inputText, borderWidth: 1, borderColor: colors.inputBorder,
    },

    pickerButton: {
      backgroundColor: colors.inputBackground, borderRadius: 12, padding: 14,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderWidth: 1, borderColor: colors.inputBorder,
    },
    pickerValueText: { fontSize: 15, color: colors.inputText, fontWeight: '500' },
    pickerPlaceholder: { fontSize: 15, color: colors.placeholderText },

    infoBanner: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginTop: 8,
    },
    infoText: { fontSize: 13, color: colors.textSecondary, flex: 1, lineHeight: 19 },

    // Review step
    reviewSection: {
      backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 16,
    },
    reviewSectionTitle: {
      fontSize: 14, fontWeight: '700', color: colors.primary, marginBottom: 8,
      textTransform: 'uppercase', letterSpacing: 0.5,
    },
    termsContainer: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      marginBottom: 20, marginTop: 8,
    },
    termsText: { fontSize: 13, color: colors.textSecondary, flex: 1, lineHeight: 19 },

    submitButton: {
      backgroundColor: colors.primary, borderRadius: 14, padding: 16,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      ...shadows.card,
    },
    submitButtonText: { color: colors.primaryForeground, fontSize: 16, fontWeight: '700' },
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

    // Picker overlay
    pickerOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
    },
    pickerOverlayBg: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    pickerContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      maxHeight: '60%', paddingBottom: 34,
    },
    pickerHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: 20, paddingBottom: 12,
    },
    pickerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
    pickerList: { paddingHorizontal: 8 },
    pickerItem: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, marginHorizontal: 4,
    },
    pickerItemActive: { backgroundColor: colors.accentBackground },
    pickerItemText: { fontSize: 15, color: colors.textPrimary, fontWeight: '500', flex: 1 },
    pickerItemTextActive: { color: colors.primary },
  });
}
