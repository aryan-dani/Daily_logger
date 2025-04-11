/**
 * Email Configuration for Daily Logger
 *
 * This file contains the email settings for sending notifications
 * when new entries are added to your learning journal.
 *
 * Copy this file to email-config.js and update with your actual values.
 *
 * @format
 */

// Email Configuration
module.exports = {
	enabled: true,
	host: "smtp.gmail.com",
	port: 587,
	secure: false,
	user: "your-email@gmail.com",
	password: "your-app-password", // App Password - see instructions below
	from: "Daily Logger <your-email@gmail.com>", // Sender's email address
	to: "your-email@gmail.com", // Where you want to receive notifications
};

/**
 * HOW TO SET UP:
 * 1. Set enabled to true
 * 2. Fill in your SMTP server details
 * 3. For Gmail:
 *    - host: 'smtp.gmail.com'
 *    - port: 587
 *    - secure: false
 *    - You'll need to use an App Password instead of your regular password
 *      (https://myaccount.google.com/apppasswords)
 *
 *    IMPORTANT: App passwords expire periodically for security reasons.
 *    To generate a new app password:
 *    1. Go to https://myaccount.google.com/apppasswords
 *    2. Sign in with your Google account
 *    3. Select "App" and choose "Other (Custom name)"
 *    4. Enter "Daily Logger" and click "Generate"
 *    5. Copy the 16-character password that appears
 *    6. Paste it in the password field above (replacing the empty string)
 *    7. Save this file and restart the server
 *
 * 4. For Outlook/Hotmail:
 *    - host: 'smtp.office365.com' or 'smtp-mail.outlook.com'
 *    - port: 587
 *    - secure: false
 * 5. Update the 'to' field with the email address where you want to receive notifications
 */
