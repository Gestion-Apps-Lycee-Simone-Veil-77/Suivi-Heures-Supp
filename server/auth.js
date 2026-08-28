import { OAuth2Client } from 'google-auth-library';
import { config } from './config.js';

const client = new OAuth2Client(config.oauthClientId);

// Vérifie le jeton d'identité envoyé par le frontend (Google Identity Services)
// et renvoie l'email vérifié par Google, seulement s'il appartient au domaine
// Workspace autorisé. Équivalent de Session.getActiveUser().getEmail() côté Apps Script,
// mais ici la vérification cryptographique est faite explicitement par nos soins.
export async function verifyIdToken(idToken) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: config.oauthClientId
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.email || !payload.email_verified) {
    throw new Error('Jeton Google invalide.');
  }
  if (payload.hd !== config.allowedDomain) {
    throw new Error(`Compte hors du domaine autorisé (${config.allowedDomain}).`);
  }
  return payload.email;
}

// Middleware Express : lit l'en-tête Authorization: Bearer <idToken>, vérifie le
// jeton, et attache req.userEmail. Renvoie 401 si absent/invalide.
export function requireAuth() {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      const idToken = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (!idToken) return res.status(401).json({ error: 'Non authentifié.' });
      req.userEmail = await verifyIdToken(idToken);
      next();
    } catch (err) {
      res.status(401).json({ error: 'Authentification invalide : ' + err.message });
    }
  };
}
