<!-- @format -->

# Daily Logger

A beautiful daily logger application with frontend and backend, complete with automatic email notifications when new entries are added.

## Features

- Record daily learning entries with categories, importance level, and rich content
- View and filter all previous entries
- Automatic email notifications for new entries
- Responsive design works on desktop and mobile
- Fully deployable to hosting platforms with GitHub Actions integration

## Setup Local Environment

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Configure email notifications:
   - Copy `server/email-config.example.js` to `server/email-config.js`
   - Update the email settings with your SMTP server details (see comments in the file)
4. Start the development server:
   ```
   npm run dev
   ```
5. Open your browser and navigate to `http://localhost:3000`

## Deploying with GitHub Actions

This project is configured to automatically deploy to Heroku when changes are pushed to the main/master branch. Email notifications will work automatically in the deployed version.

### Setup for Deployment:

1. **Create a Heroku account** if you don't have one already: [https://signup.heroku.com/](https://signup.heroku.com/)
2. **Install the Heroku CLI** and login: [https://devcenter.heroku.com/articles/heroku-cli](https://devcenter.heroku.com/articles/heroku-cli)
3. **Create a new Heroku app**:
   ```
   heroku create your-app-name
   ```
4. **Add required GitHub secrets** in your repository settings:

   - Go to your GitHub repository
   - Click on Settings > Secrets and variables > Actions
   - Add the following repository secrets:

   | Secret Name     | Description                                                        |
   | --------------- | ------------------------------------------------------------------ |
   | HEROKU_API_KEY  | Your Heroku API key (from your Heroku account settings)            |
   | HEROKU_APP_NAME | The name of your Heroku app (e.g., "your-app-name")                |
   | HEROKU_EMAIL    | The email associated with your Heroku account                      |
   | EMAIL_ENABLED   | Set to "true" to enable email notifications                        |
   | EMAIL_HOST      | SMTP server host (e.g., "smtp.gmail.com")                          |
   | EMAIL_PORT      | SMTP server port (e.g., "587")                                     |
   | EMAIL_SECURE    | Whether to use SSL (typically "false" for port 587)                |
   | EMAIL_USER      | Your email username/address                                        |
   | EMAIL_PASSWORD  | Your email password or app-specific password                       |
   | EMAIL_FROM      | Sender email address (e.g., "Daily Logger <your-email@gmail.com>") |
   | EMAIL_TO        | Recipient email address where you want to receive notifications    |

5. **Push your code to GitHub** (to the main or master branch):

   ```
   git push origin main
   ```

6. The GitHub Actions workflow will automatically deploy your app to Heroku and set up all the environment variables for email notifications.

## Email Notification Security Notes

- Do NOT commit your actual email-config.js file to GitHub as it contains sensitive information
- For Gmail, use an App Password instead of your regular account password
- The app is configured to prioritize environment variables (set via GitHub Secrets) over the local config file

## Adding New Entries

Once deployed, anyone with access to your application can add new entries. Each time an entry is added, you'll receive an automated email notification with the entry details.

## License

MIT
