import { Analytics, getAnalytics, isSupported } from 'firebase/analytics';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Platform } from 'react-native';

// Your Firebase config - Replace with your actual Firebase project config
const firebaseConfig = {
  // TODO: Replace these placeholder values with your actual Firebase config
  // Get this from: Firebase Console > Project Settings > General > Your apps > Web app
  apiKey: "REDACTED_FIREBASE_KEY",
  authDomain: "puckiq.firebaseapp.com",
  projectId: "puckiq",
  storageBucket: "puckiq.firebasestorage.app",
  messagingSenderId: "706163499801",
  appId: "1:706163499801:web:bba324101765a60a219b88",
  measurementId: "G-N37EWT11T5"
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
