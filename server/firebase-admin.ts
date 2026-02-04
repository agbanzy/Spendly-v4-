import admin from 'firebase-admin';

let isInitialized = false;

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('⚠️  Firebase Admin SDK not initialized: Missing environment variables');
    console.warn('   Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    console.warn('   Authentication middleware will not work until these are configured.');
    isInitialized = false;
  } else {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'), // Handle escaped newlines
        }),
      });
      console.log('✅ Firebase Admin SDK initialized successfully');
      isInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Admin SDK:', error);
      isInitialized = false;
    }
  }
} else {
  isInitialized = true;
}

// Export auth only if initialized, otherwise null
export const auth = isInitialized ? admin.auth() : null;
export const isFirebaseInitialized = isInitialized;
export default admin;
