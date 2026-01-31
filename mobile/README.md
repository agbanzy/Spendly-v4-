# Spendly Mobile App

The official mobile app for Spendly - Global Expense Management Platform.

**Website:** [spendlymanager.com](https://spendlymanager.com)

## Features

- Dashboard with real-time financial overview
- Expense tracking and management
- Virtual card management
- Budget monitoring
- Team management
- Biometric authentication
- Push notifications
- Offline support

## Tech Stack

- **Framework:** React Native with Expo
- **Navigation:** React Navigation
- **State Management:** TanStack Query (React Query)
- **Authentication:** Firebase Auth
- **Build Service:** EAS Build
- **Language:** TypeScript

## Getting Started

### Prerequisites

1. Node.js 18+ installed
2. Expo CLI: `npm install -g expo-cli`
3. EAS CLI: `npm install -g eas-cli`
4. Expo Go app on your device (for development)

### Installation

```bash
cd mobile
npm install
```

### Environment Setup

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Update the `.env` file with your Firebase credentials.

### Development

```bash
npm start
```

This will open the Expo development server. You can:
- Scan the QR code with Expo Go (Android)
- Scan the QR code with Camera app (iOS)
- Press `a` for Android emulator
- Press `i` for iOS simulator

## Building for Production

### Configure EAS

1. Login to Expo:
```bash
eas login
```

2. Configure the project (first time only):
```bash
eas build:configure
```

3. Update `app.json` with your EAS project ID.

### Build Android APK (for testing)

```bash
npm run build:android
# Or for APK specifically:
eas build --platform android --profile preview
```

### Build Android App Bundle (for Play Store)

```bash
eas build --platform android --profile production
```

### Build iOS (requires Apple Developer account)

```bash
npm run build:ios
```

## App Store Submission

### Google Play Store

1. Build production app bundle:
```bash
eas build --platform android --profile production
```

2. Submit to Play Store:
```bash
eas submit --platform android
```

3. Or manually upload the `.aab` file to Google Play Console.

### Apple App Store

1. Build production iOS app:
```bash
eas build --platform ios --profile production
```

2. Submit to App Store:
```bash
eas submit --platform ios
```

3. Or manually upload via Transporter app.

## Project Structure

```
mobile/
├── App.tsx                 # Main app entry point
├── app.json               # Expo configuration
├── eas.json               # EAS Build configuration
├── package.json           # Dependencies
├── assets/                # App icons and splash screen
└── src/
    ├── components/        # Reusable UI components
    ├── hooks/             # Custom React hooks
    ├── lib/               # Utilities and API client
    ├── navigation/        # Navigation configuration
    ├── screens/           # App screens
    ├── services/          # Business logic services
    └── utils/             # Helper functions
```

## API Configuration

The app connects to the Spendly backend at:
- **Production:** https://spendlymanager.com

Update `EXPO_PUBLIC_API_URL` in `.env` to point to a different server.

## App Store Links (Coming Soon)

- **iOS App Store:** https://apps.apple.com/app/spendly-expense-manager
- **Google Play Store:** https://play.google.com/store/apps/details?id=com.spendly.app

## Support

For issues and feature requests, contact support@spendlymanager.com
