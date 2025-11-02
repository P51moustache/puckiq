# Firebase Analytics Setup Guide

## ✅ UPDATED: Now Works on iOS, Android & Web!

**Major Update:** Analytics now work on **all platforms** using Firebase Measurement Protocol API!

### Quick Setup for Native (iOS/Android) Analytics:

1. **Get API Secret** from Firebase Console:
   - Go to: Analytics → Data Streams → Your Web Stream
   - Scroll to "Measurement Protocol API secrets"
   - Click "Create" and copy the secret

2. **Add to .env file**:
   ```bash
   EXPO_PUBLIC_FIREBASE_API_SECRET=your_secret_here
   ```

3. **Restart app**: `npm start`

That's it! Events will now flow to Firebase from iOS/Android apps too! 🎉

---

## 🚀 Firebase Analytics Implementation Complete!

Your React Native Expo app now has a comprehensive analytics system that will help you monitor user behavior in production. Here's what has been implemented and how to complete the setup.

## ✅ What's Already Implemented

### 1. **Analytics Service** (`services/analytics/AnalyticsService.ts`)
- Session management and user identification
- Event queuing and batch processing
- Local storage for offline analytics
- Performance, error, and user action tracking
- Firebase Analytics integration (web platform)

### 2. **React Hooks** (`hooks/useAnalytics.ts`)
- `useAnalytics()` - Screen-level analytics tracking
- `useTrackUserInteraction()` - Specialized tracking for user interactions

### 3. **Analytics Provider** (`components/analytics/AnalyticsProvider.tsx`)
- Context provider for app-wide analytics initialization

### 4. **Debug Dashboard** (`components/analytics/AnalyticsDashboard.tsx`)
- Real-time event viewing during development
- Event statistics and filtering
- Local storage management

### 5. **Automatic Tracking**
- Screen views when components mount
- Team selection in your app
- App state changes (foreground/background)
- Random image selection tracking

## 🔧 Next Steps: Firebase Configuration

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter project name: `puckiq-analytics` (or your preferred name)
4. Enable Google Analytics for this project
5. Choose or create a Google Analytics account

### Step 2: Add Web App to Firebase Project
1. In your Firebase project, click "Add app" → Web (</> icon)
2. Register app with nickname: `PuckIQ Web`
3. Copy the Firebase configuration object

### Step 3: Update Firebase Config
Replace the placeholder config in `lib/firebase.ts`:

```typescript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project.firebaseapp.com", 
  projectId: "your-actual-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456",
  measurementId: "G-XXXXXXXXXX"
};
```

### Step 4: Enable Analytics in Firebase Console
1. Go to Analytics → Events in your Firebase console
2. Analytics will start collecting data once configured
3. Custom events will appear in the Events section

## 📊 How to Monitor Analytics

### During Development
- Open your app in development mode
- Navigate to the "Player Stats" tab (Explore screen)
- Tap the "📊 Analytics" button (only visible in development)
- View real-time events and statistics

### In Production (Firebase Console)
1. **Real-time Dashboard**: Analytics → Realtime
2. **Events**: Analytics → Events
3. **User Behavior**: Analytics → Behavior flows
4. **Demographics**: Analytics → Demographics

## 🎯 What Gets Tracked

### Automatic Events
- `screen_view` - When users navigate to different screens
- `session_start` - When app becomes active
- `session_end` - When app goes to background
- `user_action` - Button presses and interactions
- `feature_usage` - Feature usage patterns

### Custom Events You Can Add
```typescript
const { trackUserAction, trackFeatureUsage, trackCustomEvent } = useAnalytics();

// Track button clicks
trackUserAction('button_press', 'navigation', 'home_to_stats');

// Track feature usage
trackFeatureUsage('team_filter', 'content', 'click', { team: 'TOR' });

// Track custom events
trackCustomEvent('game_prediction', { team: 'TOR', confidence: 0.85 });
```

## 🔍 Key Metrics You Can Monitor

### User Engagement
- Daily/Monthly Active Users
- Session duration and frequency  
- Screen views per session
- Feature adoption rates

### App Performance
- Screen load times
- Error rates and crash analytics
- User flow patterns
- Retention and churn rates

### Business Insights
- Most popular teams
- Feature usage patterns
- User journey analysis
- A/B testing results

## 🏒 Hockey-Specific Analytics Ideas

```typescript
// Track team loyalty
trackUserAction('team_selected', 'preference', teamName, undefined, {
  team_abbrev: teamAbbrev,
  selection_count: userTeamSelections
});

// Track game interest
trackFeatureUsage('game_viewed', 'content', 'view', {
  home_team: 'TOR',
  away_team: 'MTL',
  game_date: '2024-03-15'
});

// Track player searches
trackFeatureUsage('player_search', 'discovery', 'search', {
  query: 'McDavid',
  results_found: 3
});
```

## 🚦 Privacy & Compliance

- Analytics data is anonymized by default
- Users can opt-out via `analytics.setEnabled(false)`
- Local storage allows offline analytics collection
- GDPR/CCPA compliant data collection

## 🔧 Additional Features to Consider

1. **A/B Testing**: Test different UI variations
2. **Crash Reporting**: Monitor app stability
3. **Performance Monitoring**: Track app performance metrics
4. **Push Notifications**: Based on user behavior
5. **Revenue Tracking**: If you add premium features

Your analytics system is now ready to provide valuable insights into how users interact with your hockey app! 🎉