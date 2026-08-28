import 'dotenv/config';

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Variable d'environnement manquante : ${name} (voir .env.example)`);
  return v;
}

export const config = {
  port: process.env.PORT || 3000,
  serviceAccountKeyFile: required('GOOGLE_SERVICE_ACCOUNT_KEY_FILE'),
  oauthClientId: required('GOOGLE_OAUTH_CLIENT_ID'),
  allowedDomain: required('ALLOWED_WORKSPACE_DOMAIN'),
  spreadsheetId: required('SPREADSHEET_ID'),
  gmailSender: required('GMAIL_SENDER_ADDRESS'),
  logoFileId: process.env.LOGO_FILE_ID || '',
  deployNotifEmails: (process.env.DEPLOY_NOTIF_EMAILS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
};
