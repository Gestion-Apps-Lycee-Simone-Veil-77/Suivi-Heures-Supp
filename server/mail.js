import { readFileSync } from 'fs';
import { JWT } from 'google-auth-library';
import { google } from 'googleapis';
import { config } from './config.js';

// Envoi via l'API Gmail, en se faisant passer pour GMAIL_SENDER_ADDRESS grâce à
// la délégation "domain-wide" (voir README.md, section 4) : ainsi les mails
// partent bien d'une adresse @établissement, comme MailApp.sendEmail() le
// faisait côté Apps Script.
function getGmailClient() {
  const key = JSON.parse(readFileSync(config.serviceAccountKeyFile, 'utf-8'));
  const authClient = new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: config.gmailSender
  });
  return google.gmail({ version: 'v1', auth: authClient });
}

function encodeSubject(subject) {
  return `=?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;
}

function buildRawMessage({ to, subject, text, html }) {
  const boundary = 'mixed_' + Date.now();
  const lines = [
    `From: ${config.gmailSender}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(text, 'utf-8').toString('base64'),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(html, 'utf-8').toString('base64'),
    '',
    `--${boundary}--`
  ].join('\r\n');
  return Buffer.from(lines, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Équivalent de MailApp.sendEmail({ to, subject, body, htmlBody }) — n'envoie
// rien et ne fait pas planter l'appelant si `to` est vide ou si l'envoi échoue
// (même comportement défensif que côté Apps Script).
export async function sendEmail({ to, subject, text, html }) {
  if (!to) return;
  try {
    const gmail = getGmailClient();
    const raw = buildRawMessage({ to, subject, text, html });
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
  } catch (err) {
    console.error(`Échec envoi email vers ${to} : ${err.message}`);
  }
}
