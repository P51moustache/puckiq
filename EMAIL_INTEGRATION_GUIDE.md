# Email Integration Guide for Feedback System

The feedback system is now configured to send emails directly to `zachlonsdale@gmail.com` instead of storing locally. You need to choose and implement one of the following options:

## Option 1: EmailJS (Recommended for Client-Side)

**Pros**: Easy setup, no backend required, free tier available
**Cons**: API keys visible in client code

### Setup Steps:
1. Install EmailJS:
   ```bash
   npm install emailjs-com
   ```

2. Create account at [emailjs.com](https://www.emailjs.com/)

3. Create email service (Gmail, Outlook, etc.)

4. Create email template with these variables:
   - `{{feedback_type}}`
   - `{{subject}}`
   - `{{message}}`
   - `{{user_email}}`
   - `{{timestamp}}`

5. Get your credentials and uncomment the EmailJS code in `feedback.tsx`

## Option 2: Formspree (Simplest)

**Pros**: No backend code needed, free tier, spam protection
**Cons**: Limited customization

### Setup Steps:
1. Go to [formspree.io](https://formspree.io/)
2. Create account and form
3. Get your form endpoint
4. Uncomment the Formspree code in `feedback.tsx`

## Option 3: Custom Backend API

**Pros**: Full control, secure, scalable
**Cons**: Requires backend development

### Setup Steps:
1. Create API endpoint that accepts POST requests
2. Use nodemailer, SendGrid, or similar service
3. Implement email sending logic
4. Uncomment the custom API code in `feedback.tsx`

## Current Status

The feedback form is ready to use but currently shows a setup alert. Once you implement one of the above options, remove the temporary alert code and uncomment your chosen integration method.

## Security Notes

- Keep API keys secure (use environment variables in production)
- Implement rate limiting on your backend
- Validate input data on both client and server
- Consider using CAPTCHA for additional spam protection
