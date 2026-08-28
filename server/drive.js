import { google } from 'googleapis';
import { config } from './config.js';

const auth = new google.auth.GoogleAuth({
  keyFile: config.serviceAccountKeyFile,
  scopes: ['https://www.googleapis.com/auth/drive.readonly']
});

const drive = google.drive({ version: 'v3', auth });

// Récupère un fichier Drive (le logo) sous forme de buffer + type MIME, pour le
// retransmettre directement au navigateur via /api/logo. Le fichier doit être
// partagé avec l'email du compte de service (voir README, section 3) — pas
// besoin qu'il soit public.
// `supportsAllDrives` est nécessaire si le fichier vit dans un Drive partagé
// (Drive d'équipe) plutôt que "Mon Drive" : sans ça, l'API Drive v3 renvoie
// "File not found" même avec un partage pourtant correct.
export async function getDriveFile(fileId) {
  const meta = await drive.files.get({ fileId, fields: 'mimeType', supportsAllDrives: true });
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  );
  return { mimeType: meta.data.mimeType, buffer: Buffer.from(res.data) };
}
