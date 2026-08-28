import { Analytics, getAnalytics, isSupported } from 'firebase/analytics';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
};

const firebaseReady = Boolean(
  firebaseConfig.projectId && firebaseConfig.apiKey && firebaseConfig.appId
);

let app: FirebaseApp | undefined;
if (firebaseReady) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

let analytics: Analytics | undefined;
if (firebaseReady && app && Platform.OS === 'web') {
  const readyApp = app;
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(readyApp);
      }
    })
    .catch(() => {
      // Preview / missing measurementId — keep the app usable.
    });
}

export { analytics, app };
