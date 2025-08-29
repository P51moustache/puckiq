# Feedback System Setup

## Overview
The feedback tab allows users to submit feedback (feature requests, bug reports, general comments) with built-in spam protection.

## Features
- ✅ Three feedback categories: Feature Requests, Bug Reports, General Comments
- ✅ Form validation with character limits
- ✅ Spam protection (10 submissions per day, 30-second intervals)
- ✅ Optional email field for follow-up
- ✅ Local storage backup
- ✅ Rate limiting with user-friendly error messages

## Spam Protection
- **Daily Limit**: 10 submissions per day per device
- **Time Interval**: 30 seconds between submissions
- **Validation**: Subject (max 100 chars), Message (10-2000 chars), Valid email format
- **Storage**: Submission counters stored in AsyncStorage

## Current Implementation
Currently, feedback is stored locally using AsyncStorage. For production, you'll want to implement a backend service.

## Production Setup (Recommended)

### Option 1: Simple Email Service
```typescript
// Replace the sendEmail function in feedback.tsx with:
const sendEmail = async (feedbackData: FeedbackData): Promise<boolean> => {
  try {
    const response = await fetch('https://your-backend.com/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(feedbackData),
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to send feedback:', error);
    return false;
  }
};
```

### Option 2: Email Service Integration
You can integrate with services like:
- **EmailJS**: Client-side email sending
- **SendGrid**: Professional email API
- **Resend**: Modern email API
- **AWS SES**: Amazon email service

### Option 3: Firebase Functions
```typescript
// Cloud function to send emails
exports.sendFeedback = functions.https.onCall(async (data, context) => {
  const { type, subject, message, email, timestamp } = data;
  
  // Send email using your preferred service
  const emailContent = {
    to: 'zachlonsdale@gmail.com',
    subject: `PuckIQ Feedback: ${subject}`,
    html: `
      <h3>New Feedback from PuckIQ</h3>
      <p><strong>Type:</strong> ${type}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>User Email:</strong> ${email || 'Not provided'}</p>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
      <p><strong>Timestamp:</strong> ${new Date(timestamp).toISOString()}</p>
    `
  };
  
  // Use your email service here
  return await sendEmail(emailContent);
});
```

## Security Considerations
- ✅ Input validation and sanitization
- ✅ Rate limiting to prevent spam
- ✅ Character limits to prevent oversized submissions
- ✅ Email validation for optional email field
- ✅ No sensitive data exposure
- ✅ Local storage encryption (AsyncStorage is secure on device)

## User Experience
- **Visual Feedback**: Loading states, success/error messages
- **Form Validation**: Real-time character counts, clear error messages
- **Accessibility**: Proper keyboard types, auto-complete hints
- **Responsive**: Works on all screen sizes
- **Intuitive**: Clear categorization and helpful descriptions

## Future Enhancements
- [ ] Attachment support for bug reports
- [ ] Feedback status tracking
- [ ] In-app feedback history
- [ ] Push notification confirmations
- [ ] Integration with issue tracking systems
