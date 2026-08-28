import { Router } from 'express';
import { requireAuth } from './auth.js';
import { config } from './config.js';
import { getDriveFile } from './drive.js';
import { sendDeployNotification } from './emailTemplates.js';
import {
  isAdmin, requireAdmin, getMonIdentite, getConfigHSE, getConfigPACTE, getConfigPersonnel,
  getFormBootstrapHSE, getFormBootstrapPACTE,
  submitHSE, submitPACTE, submitHNF, adminSubmitDeclaration,
  getBudgetHSE, ajouterBudgetHSE, supprimerBudgetHSE,
  getAllPendingForAdmin, adminTraiterDeclaration, getAllToPayForAdmin, adminMarquerPayee,
  getStatsHSE, getMyRecords, clearConfigCache
} from './service.js';

export const router = Router();

// Route publique (pas d'auth) : une balise <img> ne peut pas envoyer d'en-tête
// Authorization, et un logo n'a rien de sensible. Doit être déclarée AVANT le
// router.use(requireAuth()) ci-dessous, qui protège tout le reste de /api/*.
router.get('/logo', async (req, res) => {
  if (!config.logoFileId) return res.status(404).end();
  try {
    const { mimeType, buffer } = await getDriveFile(config.logoFileId);
    res.set('Content-Type', mimeType);
    res.set('Cache-Control', 'public, max-age=21600');
    res.send(buffer);
  } catch (err) {
    console.error('Logo introuvable :', err.message);
    res.status(404).end();
  }
});

// Toutes les routes /api/* suivantes exigent un jeton Google valide (voir server/auth.js).
router.use(requireAuth());

function wrap(handler) {
  return async (req, res) => {
    try {
      res.json(await handler(req));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  };
}

// ---------- Identité ----------
router.get('/me', wrap(async req => {
  const identite = await getMonIdentite(req.userEmail);
  const admin = await isAdmin(req.userEmail);
  return { ...identite, isAdmin: admin };
}));

// ---------- Configs / bootstrap formulaires ----------
router.get('/config/hse', wrap(() => getConfigHSE()));
router.get('/config/pacte', wrap(() => getConfigPACTE()));
router.get('/bootstrap/hse', wrap(req => getFormBootstrapHSE(req.userEmail)));
router.get('/bootstrap/pacte', wrap(req => getFormBootstrapPACTE(req.userEmail)));

// ---------- Soumissions personnel ----------
router.post('/submit/hse', wrap(req => submitHSE(req.userEmail, req.body)));
router.post('/submit/pacte', wrap(req => submitPACTE(req.userEmail, req.body)));
router.post('/submit/hnf', wrap(req => submitHNF(req.userEmail, req.body)));

// ---------- Dashboard personnel ("Ma fiche") ----------
router.get('/my-records', wrap(req => getMyRecords(req.userEmail)));

// ---------- Admin ----------
router.get('/admin/personnel-list', wrap(() => getConfigPersonnel()));
router.post('/admin/submit', wrap(req => adminSubmitDeclaration(req.userEmail, req.body.type, req.body.personnel, req.body.payload)));
router.get('/admin/pending', wrap(req => getAllPendingForAdmin(req.userEmail)));
router.post('/admin/traiter', wrap(req => adminTraiterDeclaration(req.userEmail, req.body.type, req.body.id, req.body.action, req.body.payload)));
router.get('/admin/to-pay', wrap(req => getAllToPayForAdmin(req.userEmail)));
router.post('/admin/marquer-payee', wrap(req => adminMarquerPayee(req.userEmail, req.body.type, req.body.id)));
router.get('/admin/budget', wrap(req => getBudgetHSE(req.userEmail)));
router.post('/admin/budget', wrap(req => ajouterBudgetHSE(req.userEmail, req.body.description, req.body.heures)));
router.delete('/admin/budget/:id', wrap(req => supprimerBudgetHSE(req.userEmail, req.params.id)));
router.get('/admin/stats', wrap(req => getStatsHSE(req.userEmail)));
router.post('/admin/notifier-deploiement', wrap(async req => {
  await requireAdmin(req.userEmail);
  await sendDeployNotification(config.deployNotifEmails, req.body.url || '');
  return 'OK';
}));
router.post('/admin/clear-cache', wrap(async req => {
  await requireAdmin(req.userEmail);
  clearConfigCache();
  return 'OK';
}));
