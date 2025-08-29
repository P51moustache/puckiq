import React, { useState, useRef } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedView } from '@/components/ThemedView';
import { makeStyles } from '@/constants/theme';

type FeedbackType = 'feature' | 'bug' | 'comment';

interface FeedbackData {
  type: FeedbackType;
  subject: string;
  message: string;
  email?: string;
  timestamp: number;
}

export default function FeedbackScreen() {
  const styles = makeStyles();
  
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('feature');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmissionTime, setLastSubmissionTime] = useState<number>(0);
  
  const submissionCount = useRef(0);
  const dailySubmissionCount = useRef(0);
  const lastResetDate = useRef(new Date().toDateString());

  // Spam protection constants
  const MIN_SUBMISSION_INTERVAL = 30000; // 30 seconds between submissions
  const MAX_DAILY_SUBMISSIONS = 10; // Max 10 submissions per day
  const MIN_MESSAGE_LENGTH = 10;
  const MAX_MESSAGE_LENGTH = 2000;

    // Reset daily counter if it's a new day
  const checkAndResetDailyCounter = () => {
    const today = new Date().toDateString();
    if (lastResetDate.current !== today) {
      dailySubmissionCount.current = 0;
      lastResetDate.current = today;
    }
  };

  // Load stored submission data (only for spam protection tracking)
  React.useEffect(() => {
    async function loadSpamProtectionData() {
      try {
        const storedLastTime = await AsyncStorage.getItem('lastFeedbackSubmission');
        const storedDailyCount = await AsyncStorage.getItem('dailyFeedbackCount');
        const storedResetDate = await AsyncStorage.getItem('lastFeedbackReset');

        if (storedLastTime) {
          setLastSubmissionTime(parseInt(storedLastTime));
        }
        
        if (storedDailyCount) {
          dailySubmissionCount.current = parseInt(storedDailyCount);
        }
        
        if (storedResetDate) {
          lastResetDate.current = storedResetDate;
        }
        
        checkAndResetDailyCounter();
      } catch (error) {
        console.warn('Failed to load spam protection data:', error);
      }
    }
    loadSpamProtectionData();
  }, []);

  const validateForm = (): string | null => {
    if (!subject.trim()) {
      return 'Please enter a subject';
    }
    if (subject.length > 100) {
      return 'Subject must be less than 100 characters';
    }
    if (!message.trim()) {
      return 'Please enter your feedback message';
    }
    if (message.length < MIN_MESSAGE_LENGTH) {
      return `Message must be at least ${MIN_MESSAGE_LENGTH} characters`;
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return `Message must be less than ${MAX_MESSAGE_LENGTH} characters`;
    }
    if (email && !isValidEmail(email)) {
      return 'Please enter a valid email address';
    }
    return null;
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const checkSpamProtection = (): string | null => {
    const now = Date.now();
    
    // Check time interval
    if (now - lastSubmissionTime < MIN_SUBMISSION_INTERVAL) {
      const remaining = Math.ceil((MIN_SUBMISSION_INTERVAL - (now - lastSubmissionTime)) / 1000);
      return `Please wait ${remaining} seconds before submitting again`;
    }
    
    // Check daily limit
    if (dailySubmissionCount.current >= MAX_DAILY_SUBMISSIONS) {
      return 'You have reached the daily submission limit. Please try again tomorrow.';
    }
    
    return null;
  };

  const sendEmail = async (feedbackData: FeedbackData): Promise<boolean> => {
    try {
      // Option 1: Use EmailJS (recommended for direct email sending)
      // Requires: npm install emailjs-com
      /* 
      const emailjs = require('emailjs-com');
      
      const templateParams = {
        feedback_type: feedbackData.type,
        subject: feedbackData.subject,
        message: feedbackData.message,
        user_email: feedbackData.email || 'Not provided',
        timestamp: new Date(feedbackData.timestamp).toLocaleString(),
        to_email: 'zachlonsdale@gmail.com'
      };

      await emailjs.send(
        'YOUR_SERVICE_ID',  // Get from EmailJS dashboard
        'YOUR_TEMPLATE_ID', // Get from EmailJS dashboard
        templateParams,
        'YOUR_PUBLIC_KEY'   // Get from EmailJS dashboard
      );
      */

      // Option 2: Use your own backend API
      /*
      const response = await fetch('https://your-backend.com/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...feedbackData,
          to: 'zachlonsdale@gmail.com'
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to send feedback');
      }
      */

      // Option 3: Use Formspree (simple form backend)
      /*
      const response = await fetch('https://formspree.io/f/YOUR_FORM_ID', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feedback_type: feedbackData.type,
          subject: feedbackData.subject,
          message: feedbackData.message,
          email: feedbackData.email || 'Not provided',
          timestamp: new Date(feedbackData.timestamp).toLocaleString(),
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to send feedback');
      }
      */

      // Temporary: Log the feedback data that would be sent
      console.log('Feedback to be sent to zachlonsdale@gmail.com:', feedbackData);
      
      // Remove this when you implement one of the above options
      Alert.alert(
        'Setup Required',
        'To send emails, please choose one of the integration options in the code comments and configure it with your credentials.',
        [{ text: 'OK' }]
      );
      
      return true;
    } catch (error) {
      console.error('Failed to send feedback email:', error);
      return false;
    }
  };

  const handleSubmit = async () => {
    await checkAndResetDailyCounter();
    
    // Validate form
    const validationError = validateForm();
    if (validationError) {
      Alert.alert('Validation Error', validationError);
      return;
    }

    // Check spam protection
    const spamError = checkSpamProtection();
    if (spamError) {
      Alert.alert('Rate Limited', spamError);
      return;
    }

    setIsSubmitting(true);

    try {
      const feedbackData: FeedbackData = {
        type: feedbackType,
        subject: subject.trim(),
        message: message.trim(),
        email: email.trim() || undefined,
        timestamp: Date.now(),
      };

      const success = await sendEmail(feedbackData);

      if (success) {
        // Update spam protection counters
        const now = Date.now();
        setLastSubmissionTime(now);
        dailySubmissionCount.current += 1;
        
        await AsyncStorage.setItem('lastFeedbackSubmission', now.toString());
        await AsyncStorage.setItem('dailyFeedbackCount', dailySubmissionCount.current.toString());

        // Clear form
        setSubject('');
        setMessage('');
        setEmail('');
        
        Alert.alert(
          'Feedback Sent!',
          'Thank you for your feedback! We\'ll review it and get back to you if needed.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Error',
          'Failed to send feedback. Please try again later.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFeedbackTypeDescription = (type: FeedbackType): string => {
    switch (type) {
      case 'feature':
        return 'Suggest new features or improvements';
      case 'bug':
        return 'Report issues or unexpected behavior';
      case 'comment':
        return 'General feedback or questions';
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, width: '100%' }}
      >
        <ScrollView
          style={{ flex: 1, width: '100%' }}
          contentContainerStyle={[styles.scrollContainer, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        <View style={styles.header}>
          <Text style={styles.title}>Feedback</Text>
          <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 8, fontSize: 16 }]}>
            Help us improve PuckIQ
          </Text>
        </View>

        {/* Feedback Type Selection */}
        <View style={[styles.card, { alignSelf: 'stretch', width: '100%' }]}>
          <Text style={[styles.greeting, { marginBottom: 16 }]}>What type of feedback?</Text>
          
          {(['feature', 'bug', 'comment'] as FeedbackType[]).map((type) => (
            <Pressable
              key={type}
              style={[
                styles.factboxOne,
                { 
                  marginVertical: 4,
                  borderWidth: 2,
                  borderColor: feedbackType === type ? styles.nameAccent.color : 'transparent',
                }
              ]}
              onPress={() => setFeedbackType(type)}
            >
              <Text style={[styles.boxtitle, { fontSize: 16, marginBottom: 4 }]}>
                {type === 'feature' ? 'Feature Request' : 
                 type === 'bug' ? 'Bug Report' : 
                 'General Feedback'}
              </Text>
              <Text style={[styles.subtextSmall, { fontSize: 12 }]}>
                {getFeedbackTypeDescription(type)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Subject Input */}
        <View style={[styles.card, { alignSelf: 'stretch', width: '100%' }]}>
          <Text style={[styles.greeting, { marginBottom: 8 }]}>Subject</Text>
          <TextInput
            style={[
              styles.factboxOne,
              { 
                color: styles.greeting.color,
                fontSize: 16,
                minHeight: 50,
                textAlignVertical: 'center',
              }
            ]}
            value={subject}
            onChangeText={setSubject}
            placeholder="Brief description of your feedback"
            placeholderTextColor={styles.subtext.color}
            maxLength={100}
          />
          <Text style={[styles.subtextSmall, { textAlign: 'right', marginTop: 4 }]}>
            {subject.length}/100
          </Text>
        </View>

        {/* Message Input */}
        <View style={[styles.card, { alignSelf: 'stretch', width: '100%' }]}>
          <Text style={[styles.greeting, { marginBottom: 8 }]}>Your Feedback</Text>
          <TextInput
            style={[
              styles.factboxOne,
              { 
                color: styles.greeting.color,
                fontSize: 16,
                minHeight: 120,
                textAlignVertical: 'top',
              }
            ]}
            value={message}
            onChangeText={setMessage}
            placeholder="Tell us more about your feedback, suggestions, or issue..."
            placeholderTextColor={styles.subtext.color}
            multiline
            maxLength={MAX_MESSAGE_LENGTH}
          />
          <Text style={[styles.subtextSmall, { textAlign: 'right', marginTop: 4 }]}>
            {message.length}/{MAX_MESSAGE_LENGTH}
          </Text>
        </View>

        {/* Email Input (Optional) */}
        <View style={[styles.card, { alignSelf: 'stretch', width: '100%' }]}>
          <Text style={[styles.greeting, { marginBottom: 8 }]}>Your Email (Optional)</Text>
          <TextInput
            style={[
              styles.factboxOne,
              { 
                color: styles.greeting.color,
                fontSize: 16,
                minHeight: 50,
                textAlignVertical: 'center',
              }
            ]}
            value={email}
            onChangeText={setEmail}
            placeholder="your.email@example.com"
            placeholderTextColor={styles.subtext.color}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[styles.subtextSmall, { marginTop: 4 }]}>
            We'll only use this to respond to your feedback if needed
          </Text>
        </View>

        {/* Submit Button */}
        <Pressable
          style={[
            styles.card,
            {
              alignSelf: 'stretch',
              width: '100%',
              backgroundColor: isSubmitting || !subject.trim() || !message.trim() 
                ? styles.factbox.backgroundColor 
                : styles.nameAccent.color,
              opacity: isSubmitting || !subject.trim() || !message.trim() ? 0.6 : 1,
            }
          ]}
          onPress={handleSubmit}
          disabled={isSubmitting || !subject.trim() || !message.trim()}
        >
          {isSubmitting ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="small" color={styles.greeting.color} style={{ marginRight: 8 }} />
              <Text style={[styles.greeting, { color: styles.greeting.color }]}>Sending...</Text>
            </View>
          ) : (
            <Text style={[styles.greeting, { color: styles.greeting.color }]}>Send Feedback</Text>
          )}
        </Pressable>

        {/* Rate Limiting Info */}
        <View style={[styles.card, { alignSelf: 'stretch', width: '100%' }]}>
          <Text style={[styles.subtextSmall, { textAlign: 'center', lineHeight: 16 }]}>
            Feedback is sent directly to zachlonsdale@gmail.com{'\n'}
            You can submit up to {MAX_DAILY_SUBMISSIONS} feedbacks per day{'\n'}
            Please wait 30 seconds between submissions
          </Text>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}
