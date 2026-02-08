import { Analytics, getAnalytics, isSupported } from 'firebase/analytics';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Platform } from 'react-native';

// Firebase project config — loaded from env vars
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
};

// Initialize Firebase
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Initialize Analytics
let analytics: Analytics | undefined;
if (Platform.OS === 'web') {
  // Analytics only works on web platform in development
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export { analytics, app };
