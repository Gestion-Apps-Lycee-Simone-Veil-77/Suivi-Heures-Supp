// À exécuter une seule fois avant la première utilisation : "npm run setup"
// Crée les onglets manquants sur la feuille (ConfigAdmin, ConfigPersonnel,
// ConfigHSE, ConfigPACTE, BudgetHSE, HSE/PACTE/HNF + onglets de workflow).
import { setupWorkflowSheets } from './service.js';

setupWorkflowSheets()
  .then(() => {
    console.log('OK — pensez à remplir manuellement ConfigAdmin, ConfigPersonnel, ConfigHSE et ConfigPACTE.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Échec de l\'installation :', err);
    process.exit(1);
  });
