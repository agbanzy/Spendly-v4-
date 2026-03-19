import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import { setOnAuthExpired } from '../lib/api';
import OfflineBanner from '../components/OfflineBanner';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import CardsScreen from '../screens/CardsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import BudgetScreen from '../screens/BudgetScreen';
import BillsScreen from '../screens/BillsScreen';
import InvoicesScreen from '../screens/InvoicesScreen';
import VendorsScreen from '../screens/VendorsScreen';
import TeamScreen from '../screens/TeamScreen';
import PayrollScreen from '../screens/PayrollScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import ReportsScreen from '../screens/ReportsScreen';
import WalletScreen from '../screens/WalletScreen';
import VirtualAccountsScreen from '../screens/VirtualAccountsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import KYCScreen from '../screens/KYCScreen';
import InviteAcceptScreen from '../screens/InviteAcceptScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.tabBarBorder,
          height: 85,
          paddingBottom: 25,
          paddingTop: 10,
        },
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarLabelStyle: {
          fontSize: 11,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Expenses"
        component={ExpensesScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Bills"
        component={BillsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="menu" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function MoreStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.headerBackground },
        headerTintColor: colors.headerTint,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} />
      <Stack.Screen name="Budget" component={BudgetScreen} />
      <Stack.Screen name="Cards" component={CardsScreen} />
      <Stack.Screen name="Invoices" component={InvoicesScreen} />
      <Stack.Screen name="Vendors" component={VendorsScreen} />
      <Stack.Screen name="Team" component={TeamScreen} />
      <Stack.Screen name="Payroll" component={PayrollScreen} />
      <Stack.Screen name="Analytics" component={AnalyticsScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="VirtualAccounts" component={VirtualAccountsScreen} options={{ title: 'Virtual Accounts' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="KYC" component={KYCScreen} options={{ headerShown: false, title: 'Identity Verification' }} />
      <Stack.Screen name="InviteAccept" component={InviteAcceptScreen} options={{ headerShown: false, title: 'Accept Invitation' }} />
    </Stack.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}

function OnboardingWrapper() {
  const { completeOnboarding } = useAuth();
  return <OnboardingScreen onComplete={(startKYC) => completeOnboarding(startKYC)} />;
}

export default function AppNavigator() {
  const { user, loading, onboardingComplete, logout, pendingKYCNavigation, clearPendingKYCNavigation } = useAuth();
  const { colors } = useTheme();
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  // Wire up session expiration handler — forces logout on 401
  useEffect(() => {
    setOnAuthExpired(() => {
      Alert.alert(
        'Session Expired',
        'Your session has expired. Please sign in again.',
        [{ text: 'OK', onPress: () => logout() }],
      );
    });
  }, [logout]);

  // Handle deferred KYC navigation after onboarding completes
  // When user taps "Verify Now" on onboarding, the navigator remounts
  // from Onboarding → MainTabs, so we defer the KYC navigation here
  useEffect(() => {
    if (pendingKYCNavigation && onboardingComplete && user && navigationRef.current) {
      const timer = setTimeout(() => {
        try {
          navigationRef.current?.navigate('More', { screen: 'KYC' });
        } catch {
          // Navigation might not be ready yet, ignore
        }
        clearPendingKYCNavigation();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [pendingKYCNavigation, onboardingComplete, user, clearPendingKYCNavigation]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // Determine which screen tree to show
  let content;
  if (!user) {
    content = <AuthStack />;
  } else if (!onboardingComplete) {
    content = (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Onboarding" component={OnboardingWrapper} />
      </Stack.Navigator>
    );
  } else {
    content = <MainTabs />;
  }

  return (
    <>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }}>
        <OfflineBanner />
      </SafeAreaView>
      <NavigationContainer ref={navigationRef}>
        {content}
      </NavigationContainer>
    </>
  );
}
