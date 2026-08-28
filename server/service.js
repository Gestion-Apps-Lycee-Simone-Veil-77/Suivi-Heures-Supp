import {
  readSheetAsObjects, appendObjectRow, findRowById, updateRow, deleteRow,
  sheetExists, createSheet, ensureColumns, getHeaders
} from './sheets.js';
import { TYPE_COLUMNS, WORKFLOW_SUFFIXES, FIELD_LABELS, RECAP_EXCLUDED_FIELDS, DATE_ONLY_FIELDS } from './constants.js';
import { formatValueForDiff, formatDateISO, uuid } from './util.js';
import { cacheGet, cacheSet, cacheDel } from './cache.js';
import { sendConfirmation, sendStatusEmail, notifyNewDeclaration, notifyDecision } from './emailTemplates.js';

// ---------- Admin ----------

export async function isAdmin(email) {
  if (!email) return false;
  // Volontairement PAS mis en cache (contrairement aux Config* ci-dessous) :
  // c'est un droit d'accès, pas une simple liste déroulante — un ajout/retrait
  // dans ConfigAdmin doit être pris en compte immédiatement, sans délai.
  const { rows } = await readSheetAsObjects('ConfigAdmin');
  const admins = rows.map(r => String(r.Email || '').trim().toLowerCase()).filter(Boolean);
  return admins.includes(String(email || '').trim().toLowerCase());
}

export async function requireAdmin(email) {
  if (!(await isAdmin(email))) {
    const err = new Error('Accès refusé : réservé aux super-admins.');
    err.status = 403;
    throw err;
  }
  return email;
}

// ---------- Destinataires spéciaux (colonne "Rôle" dans ConfigAdmin) ----------
// Un admin peut avoir une ligne dans ConfigAdmin avec Rôle = "Directeur",
// "Direction" ou "Secrétariat" (en plus de sa simple présence qui donne déjà
// l'accès admin). Attention, "Directeur" et "Direction" sont bien deux rôles
// DISTINCTS, pas un synonyme l'un de l'autre :
//   - Directeur (une personne) : notifié à la création de toute déclaration,
//     et sur validation/refus HSE/PACTE, et sur refus HNF.
//   - Direction (un groupe, éventuellement plus large) : notifiée UNIQUEMENT
//     avec le secrétariat quand une HNF est "validée" (= modifiée, voir
//     adminTraiterDeclaration).
// Pas de cache (voir plus bas) : la fraîcheur immédiate compte plus ici.

function normalizeHeader(s) {
  const decomposed = String(s || '').normalize('NFD');
  let out = '';
  for (const ch of decomposed) {
    const code = ch.codePointAt(0);
    if (code >= 768 && code <= 879) continue;
    out += ch;
  }
  return out.trim().toLowerCase();
}

async function getConfigAdminRowsByRole(role) {
  const { rows, headers } = await readSheetAsObjects('ConfigAdmin');
  const roleHeader = headers.find(h => normalizeHeader(h) === 'role');
  if (!roleHeader) return { rows: [], headers, roleHeader: null };
  const target = normalizeHeader(role);
  return { rows: rows.filter(r => normalizeHeader(r[roleHeader]) === target), headers, roleHeader };
}

async function getEmailsByRole(role) {
  const { rows } = await getConfigAdminRowsByRole(role);
  return rows.map(r => String(r.Email || '').trim()).filter(Boolean);
}

// Pas de cache ici (contrairement aux Config* ci-dessus) : ce sont des
// lectures peu fréquentes (connexion + quelques actions admin), la fraîcheur
// immédiate compte plus que le nombre d'appels à l'API Sheets.
export async function getDirectorEmails() {
  return getEmailsByRole('Directeur');
}

// Nom affiché dans le menu ("... merci de contacter <nom>"), stocké dans la
// colonne "Nom" de la ligne "Directeur" de ConfigAdmin. Modifiable depuis
// Administration (voir setDirecteurNom) — null si jamais renseigné, auquel
// cas le frontend garde son texte par défaut ("Mr. LEGER").
export async function getDirecteurNom() {
  const { rows } = await getConfigAdminRowsByRole('Directeur');
  const nom = rows[0] && String(rows[0].Nom || '').trim();
  return nom || null;
}

export async function setDirecteurNom(adminEmail, nom) {
  await requireAdmin(adminEmail);
  await ensureColumns('ConfigAdmin', ['Email', 'Rôle', 'Nom']);
  const { rows, headers, roleHeader } = await getConfigAdminRowsByRole('Directeur');
  if (!roleHeader || !rows.length) {
    const err = new Error('Aucune ligne avec le rôle "Directeur" dans ConfigAdmin. Ajoutez-en une avant de définir un nom affiché.');
    err.status = 400;
    throw err;
  }
  const row = rows[0];
  row.Nom = String(nom || '').trim();
  await updateRow('ConfigAdmin', row.__row, headers, row);
  return 'OK';
}

export async function getDirectionEmails() {
  return getEmailsByRole('Direction');
}

export async function getSecretariatEmails() {
  return getEmailsByRole('Secrétariat');
}

// ---------- Identité / annuaire ----------

export async function getPersonnelForEmail(email) {
  if (!email) return null;
  const { rows, headers } = await readSheetAsObjects('ConfigPersonnel');
  const nomCol = headers[0]; // colonne A = Nom Prénom, colonne B = Email
  const cible = String(email).trim().toLowerCase();
  const row = rows.find(r => String(r.Email || '').trim().toLowerCase() === cible);
  return row ? row[nomCol] : null;
}

export async function getEmailForPersonnel(personnel) {
  if (!personnel) return null;
  const { rows, headers } = await readSheetAsObjects('ConfigPersonnel');
  const nomCol = headers[0];
  const cible = String(personnel).trim().toLowerCase();
  const row = rows.find(r => String(r[nomCol] || '').trim().toLowerCase() === cible);
  return row ? row.Email : null;
}

export async function getMonIdentite(email) {
  return { email, personnel: await getPersonnelForEmail(email) };
}

// ---------- Configs (listes déroulantes), mises en cache 30 min ----------

export async function getConfigHSE() {
  const cached = cacheGet('configHSE');
  if (cached) return cached;
  const { rows } = await readSheetAsObjects('ConfigHSE');
  const result = {};
  rows.forEach(r => {
    const cols = Object.keys(r).filter(k => k !== '__row');
    const cat = r[cols[0]], mission = r[cols[1]];
    if (!cat) return;
    if (!result[cat]) result[cat] = [];
    result[cat].push(mission);
  });
  cacheSet('configHSE', result, 1800);
  return result;
}

export async function getConfigPACTE() {
  const cached = cacheGet('configPACTE');
  if (cached) return cached;
  const { rows, headers } = await readSheetAsObjects('ConfigPACTE');
  const col = headers[0];
  const result = rows.map(r => r[col]).filter(Boolean);
  cacheSet('configPACTE', result, 1800);
  return result;
}

export async function getConfigPersonnel() {
  const cached = cacheGet('configPersonnel');
  if (cached) return cached;
  const { rows, headers } = await readSheetAsObjects('ConfigPersonnel');
  const col = headers[0];
  const result = rows.map(r => r[col]).filter(Boolean);
  cacheSet('configPersonnel', result, 1800);
  return result;
}

export async function getFormBootstrapHSE(email) {
  const [identite, config] = await Promise.all([getMonIdentite(email), getConfigHSE()]);
  return { identite, config };
}

export async function getFormBootstrapPACTE(email) {
  const [identite, config] = await Promise.all([getMonIdentite(email), getConfigPACTE()]);
  return { identite, config };
}

// ---------- Soumissions ----------

async function requirePersonnel(email) {
  const personnel = await getPersonnelForEmail(email);
  if (!personnel) {
    const err = new Error("Votre adresse mail n'est pas reconnue dans l'annuaire (ConfigPersonnel). Contactez un administrateur.");
    err.status = 400;
    throw err;
  }
  return personnel;
}

export async function submitHSE(email, f) {
  const personnel = await requirePersonnel(email);
  const now = new Date();
  const headers = await getHeaders('HSE');
  await appendObjectRow('HSE', headers, {
    ID: uuid(), Date: now, Email: email, Personnel: personnel,
    Categorie: f.categorie, Mission: f.mission,
    NbHSE: parseFloat(f.nbHSE), Commentaire: f.commentaire || '', Statut: 'En attente'
  });
  const details = {
    'Date de saisie': formatValueForDiff(now),
    'Catégorie': f.categorie, 'Mission': f.mission, 'Nb HSE': f.nbHSE,
    'Dates - Commentaires - Précisions': f.commentaire
  };
  await sendConfirmation(email, personnel, 'HSE', details);
  await notifyNewDeclaration(await getDirectorEmails(), personnel, 'HSE', details);
  return 'OK';
}

export async function submitPACTE(email, f) {
  const personnel = await requirePersonnel(email);
  const now = new Date();
  const headers = await getHeaders('PACTE');
  await appendObjectRow('PACTE', headers, {
    ID: uuid(), Date: now, Email: email, Personnel: personnel,
    MissionOfficielle: f.missionOfficielle,
    NbHAnnuel: parseFloat(f.nbHAnnuel), Commentaire: f.commentaire || '', Statut: 'En attente'
  });
  const details = {
    'Date de saisie': formatValueForDiff(now),
    'Mission officielle': f.missionOfficielle, 'Nb h annuel': f.nbHAnnuel,
    'Dates - Commentaires - Précisions': f.commentaire
  };
  await sendConfirmation(email, personnel, 'PACTE', details);
  await notifyNewDeclaration(await getDirectorEmails(), personnel, 'PACTE', details);
  return 'OK';
}

export async function submitHNF(email, f) {
  const personnel = await requirePersonnel(email);
  const now = new Date();
  const headers = await getHeaders('HNF');
  await appendObjectRow('HNF', headers, {
    ID: uuid(), Date: now, Email: email, Personnel: personnel,
    NbHeures: parseFloat(f.nbHeures), RattrapageFait: parseInt(f.rattrapageFait, 10),
    Commentaire: f.commentaire || '', Statut: 'En attente'
  });
  const details = {
    'Date de saisie': formatValueForDiff(now),
    'Nb heures': f.nbHeures, 'Rattrapage fait': f.rattrapageFait,
    'Dates - Commentaires - Précisions': f.commentaire
  };
  await sendConfirmation(email, personnel, 'Heures non faites', details);
  await notifyNewDeclaration(await getDirectorEmails(), personnel, 'Heures non faites', details);
  return 'OK';
}

export async function adminSubmitDeclaration(adminEmail, type, personnel, f) {
  await requireAdmin(adminEmail);
  const email = await getEmailForPersonnel(personnel);
  if (!email) {
    const err = new Error(`Personne introuvable dans l'annuaire (ConfigPersonnel) : ${personnel}`);
    err.status = 400;
    throw err;
  }
  const now = new Date();
  const directorEmails = await getDirectorEmails();

  if (type === 'HSE') {
    await appendObjectRow('HSE', await getHeaders('HSE'), {
      ID: uuid(), Date: now, Email: email, Personnel: personnel,
      Categorie: f.categorie, Mission: f.mission,
      NbHSE: parseFloat(f.nbHSE), Commentaire: f.commentaire || '', Statut: 'En attente'
    });
    const details = {
      'Date de saisie': formatValueForDiff(now),
      'Catégorie': f.categorie, 'Mission': f.mission, 'Nb HSE': f.nbHSE,
      'Dates - Commentaires - Précisions': f.commentaire
    };
    await sendConfirmation(email, personnel, 'HSE', details, adminEmail);
    await notifyNewDeclaration(directorEmails, personnel, 'HSE', details);
  } else if (type === 'PACTE') {
    await appendObjectRow('PACTE', await getHeaders('PACTE'), {
      ID: uuid(), Date: now, Email: email, Personnel: personnel,
      MissionOfficielle: f.missionOfficielle,
      NbHAnnuel: parseFloat(f.nbHAnnuel), Commentaire: f.commentaire || '', Statut: 'En attente'
    });
    const details = {
      'Date de saisie': formatValueForDiff(now),
      'Mission officielle': f.missionOfficielle, 'Nb h annuel': f.nbHAnnuel,
      'Dates - Commentaires - Précisions': f.commentaire
    };
    await sendConfirmation(email, personnel, 'PACTE', details, adminEmail);
    await notifyNewDeclaration(directorEmails, personnel, 'PACTE', details);
  } else if (type === 'HNF') {
    await appendObjectRow('HNF', await getHeaders('HNF'), {
      ID: uuid(), Date: now, Email: email, Personnel: personnel,
      NbHeures: parseFloat(f.nbHeures), RattrapageFait: parseInt(f.rattrapageFait, 10),
      Commentaire: f.commentaire || '', Statut: 'En attente'
    });
    const details = {
      'Date de saisie': formatValueForDiff(now),
      'Nb heures': f.nbHeures, 'Rattrapage fait': f.rattrapageFait,
      'Dates - Commentaires - Précisions': f.commentaire
    };
    await sendConfirmation(email, personnel, 'Heures non faites', details, adminEmail);
    await notifyNewDeclaration(directorEmails, personnel, 'Heures non faites', details);
  } else {
    const err = new Error('Type de déclaration inconnu : ' + type);
    err.status = 400;
    throw err;
  }
  return 'OK';
}

// ---------- Budgets HSE ----------

export async function getBudgetHSE(adminEmail) {
  await requireAdmin(adminEmail);
  if (!(await sheetExists('BudgetHSE'))) return { header: [], rows: [], total: 0 };
  const { headers, rows } = await readSheetAsObjects('BudgetHSE');
  const total = rows.reduce((s, r) => s + (parseFloat(r.Heures) || 0), 0);
  return { header: headers, rows: rows.map(r => headers.map(h => r[h])), total };
}

export async function ajouterBudgetHSE(adminEmail, description, heures) {
  await requireAdmin(adminEmail);
  if (!description || !heures) {
    const err = new Error("Description et nombre d'heures requis.");
    err.status = 400;
    throw err;
  }
  if (!(await sheetExists('BudgetHSE'))) {
    await createSheet('BudgetHSE', ['ID', 'Date', 'Description', 'Heures', 'AjoutePar']);
  }
  await appendObjectRow('BudgetHSE', ['ID', 'Date', 'Description', 'Heures', 'AjoutePar'], {
    ID: uuid(), Date: new Date(), Description: description, Heures: parseFloat(heures), AjoutePar: adminEmail
  });
  return 'OK';
}

export async function supprimerBudgetHSE(adminEmail, id) {
  await requireAdmin(adminEmail);
  const found = await findRowById('BudgetHSE', id);
  if (!found) {
    const err = new Error(`Ligne de budget introuvable (ID: ${id}).`);
    err.status = 404;
    throw err;
  }
  await deleteRow('BudgetHSE', found.rowNumber);
  return 'OK';
}

// ---------- Champs "date pure" envoyés déjà formatés au client ----------

function toClientValue(header, value) {
  if (DATE_ONLY_FIELDS.includes(header) && value instanceof Date) return formatDateISO(value);
  return value;
}

// ---------- Déclarations à traiter ----------

export async function getAllPendingForAdmin(adminEmail) {
  await requireAdmin(adminEmail);
  const result = {};
  for (const type of ['HSE', 'PACTE', 'HNF']) {
    const { headers, rows } = await readSheetAsObjects(type);
    const actionable = rows.filter(r => r.Statut === 'En attente' || r.Statut === 'Modifiée');
    result[type] = actionable.map(r => headers.map(h => toClientValue(h, r[h])));
    result[type + '_header'] = headers;
  }
  return result;
}

function buildRecapDetails(type, row) {
  const details = {};
  (TYPE_COLUMNS[type] || []).forEach(h => {
    if (RECAP_EXCLUDED_FIELDS.includes(h)) return;
    details[FIELD_LABELS[h] || h] = formatValueForDiff(row[h]);
  });
  return details;
}

// action : 'valider' | 'valider_payee' | 'refuser' | 'modifier'
export async function adminTraiterDeclaration(adminEmail, type, id, action, payload) {
  await requireAdmin(adminEmail);
  const found = await findRowById(type, id);
  if (!found) {
    const err = new Error(`Déclaration introuvable (ID: ${id}).`);
    err.status = 404;
    throw err;
  }
  const { headers, row, rowNumber } = found;
  const now = new Date();

  if (action === 'modifier') {
    const changements = [];
    Object.keys(payload || {}).forEach(h => {
      if (h === 'commentaireAdmin' || !headers.includes(h)) return;
      const ancienFmt = formatValueForDiff(row[h]);
      const nouveauFmt = formatValueForDiff(payload[h]);
      if (ancienFmt !== nouveauFmt) {
        changements.push(`${FIELD_LABELS[h] || h} : ${ancienFmt} → ${nouveauFmt}`);
        row[h] = payload[h];
      }
    });
    row.Statut = 'Modifiée';
    row.CommentaireAdmin = changements.length ? changements.join('\n') : 'Modifiée sans changement de valeur';
    row.DateTraitement = now;
    row.TraitePar = adminEmail;
    await updateRow(type, rowNumber, headers, row);
    await sendStatusEmail(row.Email, row.Personnel, type, 'Modifiée', row.CommentaireAdmin);
    if (type === 'HNF') {
      // Pas de bouton "Valider" dédié pour les HNF (voir PendingBlock côté
      // client) : "Modifier" est l'action qui fait office de validation pour
      // ce type. Seuls la Direction (rôle distinct du Directeur) et le
      // Secrétariat sont notifiés ici — le Directeur, lui, n'est notifié pour
      // les HNF qu'en cas de refus (bloc ci-dessous), pas sur "Modifier".
      const [directionEmails, secretariatEmails] = await Promise.all([getDirectionEmails(), getSecretariatEmails()]);
      await notifyDecision([...directionEmails, ...secretariatEmails], row.Personnel, type, 'Validée', row.CommentaireAdmin, buildRecapDetails(type, row));
    }
    return 'OK';
  }

  const statutMap = { valider: 'Validée', valider_payee: 'Validée et payée', refuser: 'Refusée' };
  const suffixMap = { valider: 'APayer', valider_payee: 'Payee', refuser: 'Refus' };
  // PACTE n'a pas d'étape "à payer" intermédiaire : Valider = directement payée
  // (mais affiché "Validée", la notion de "payée" n'y a pas de sens propre).
  if (type === 'PACTE' && action === 'valider') {
    statutMap.valider = 'Validée';
    suffixMap.valider = 'Payee';
  }
  if (!statutMap[action]) {
    const err = new Error('Action inconnue : ' + action);
    err.status = 400;
    throw err;
  }

  row.Statut = statutMap[action];
  row.CommentaireAdmin = (payload && payload.commentaireAdmin) || '';
  row.DateTraitement = now;
  row.TraitePar = adminEmail;

  const cibleNom = type + '_' + suffixMap[action];
  if (!(await sheetExists(cibleNom))) {
    const err = new Error('Onglet cible introuvable : ' + cibleNom);
    err.status = 500;
    throw err;
  }
  const { headers: cibleHeaders } = await readSheetAsObjects(cibleNom);
  await appendObjectRow(cibleNom, cibleHeaders.length ? cibleHeaders : headers, row);
  await deleteRow(type, rowNumber);

  const details = action === 'refuser' ? null : buildRecapDetails(type, row);
  // "Valider et payer" (HSE) doit se lire, par mail, exactement comme
  // "Valider" (statut affiché "Validée") — la distinction "à payer / payée"
  // reste une info de suivi interne (visible dans les onglets Sheets), pas
  // quelque chose à exposer par email au déclarant ou à la direction.
  const statutEmail = action === 'valider_payee' ? 'Validée' : statutMap[action];
  await sendStatusEmail(row.Email, row.Personnel, type, statutEmail, row.CommentaireAdmin, details);
  // La direction est notifiée sur toute décision de validation/refus (mais
  // pas sur "Modifier" pour HSE/PACTE — voir le bloc "modifier" ci-dessus
  // pour le cas particulier des HNF).
  await notifyDecision(await getDirectorEmails(), row.Personnel, type, statutEmail, row.CommentaireAdmin, details);
  return 'OK';
}

export async function getAllToPayForAdmin(adminEmail) {
  await requireAdmin(adminEmail);
  const result = {};
  const { headers, rows } = await readSheetAsObjects('HSE_APayer');
  result.HSE = rows.map(r => headers.map(h => toClientValue(h, r[h])));
  result.HSE_header = headers;
  return result;
}

export async function adminMarquerPayee(adminEmail, type, id) {
  await requireAdmin(adminEmail);
  const found = await findRowById(type + '_APayer', id);
  if (!found) {
    const err = new Error(`Déclaration introuvable (ID: ${id}).`);
    err.status = 404;
    throw err;
  }
  const { headers, row, rowNumber } = found;
  row.Statut = 'Validée et payée';
  row.DateTraitement = new Date();
  row.TraitePar = adminEmail;

  const { headers: cibleHeaders } = await readSheetAsObjects(type + '_Payee');
  await appendObjectRow(type + '_Payee', cibleHeaders.length ? cibleHeaders : headers, row);
  await deleteRow(type + '_APayer', rowNumber);
  // Pas d'email ici : déjà envoyé au moment de la validation.
  return 'OK';
}

// ---------- Statistiques HSE ----------

export async function getStatsHSE(adminEmail) {
  await requireAdmin(adminEmail);
  const parCategorie = {};
  const parMission = {};
  for (const name of ['HSE', 'HSE_APayer', 'HSE_Payee']) {
    const { rows } = await readSheetAsObjects(name);
    rows.forEach(r => {
      const cat = r.Categorie || '(Non renseignée)';
      const mission = r.Mission || '(Non renseignée)';
      const h = parseFloat(r.NbHSE) || 0;
      if (h <= 0) return;
      parCategorie[cat] = (parCategorie[cat] || 0) + h;
      parMission[cat] = parMission[cat] || {};
      parMission[cat][mission] = (parMission[cat][mission] || 0) + h;
    });
  }
  return {
    parCategorie: Object.keys(parCategorie).map(cat => [cat, parCategorie[cat]]),
    parMission: Object.fromEntries(
      Object.keys(parMission).map(cat => [cat, Object.keys(parMission[cat]).map(m => [m, parMission[cat][m]])])
    )
  };
}

// ---------- Dashboard personnel ----------

export async function getMyRecords(email) {
  const result = {};
  const sections = ['HSE', 'HSE_APayer', 'HSE_Payee', 'PACTE', 'PACTE_Payee', 'HNF'];
  for (const key of sections) {
    const { headers, rows } = await readSheetAsObjects(key);
    const mine = rows.filter(r => r.Email === email);
    result[key] = mine.map(r => headers.map(h => toClientValue(h, r[h])));
    result[key + '_header'] = headers;
  }
  return result;
}

// ---------- Installation initiale (équivalent de setupWorkflowSheets) ----------
// À lancer une fois manuellement (node server/setup.js) avant la première
// utilisation, pour créer les onglets manquants sur une feuille neuve.
export async function setupWorkflowSheets() {
  // Colonne "Rôle" (optionnelle) : laissez-la vide pour un admin normal,
  // "Directeur", "Direction" ou "Secrétariat" pour les notifications
  // spéciales (voir getDirectorEmails / getDirectionEmails /
  // getSecretariatEmails ci-dessus — "Directeur" et "Direction" sont deux
  // rôles distincts).
  if (!(await sheetExists('ConfigAdmin'))) {
    await createSheet('ConfigAdmin', ['Email', 'Rôle']);
  } else {
    await ensureColumns('ConfigAdmin', ['Email', 'Rôle']);
  }
  if (!(await sheetExists('BudgetHSE'))) await createSheet('BudgetHSE', ['ID', 'Date', 'Description', 'Heures', 'AjoutePar']);
  if (!(await sheetExists('ConfigPersonnel'))) await createSheet('ConfigPersonnel', ['Nom Prénom', 'Email']);
  if (!(await sheetExists('ConfigHSE'))) await createSheet('ConfigHSE', ['Categorie', 'Mission']);
  if (!(await sheetExists('ConfigPACTE'))) await createSheet('ConfigPACTE', ['Mission']);

  for (const type of Object.keys(TYPE_COLUMNS)) {
    const cols = TYPE_COLUMNS[type];
    if (!(await sheetExists(type))) {
      await createSheet(type, cols);
    } else {
      await ensureColumns(type, cols);
    }
    for (const suffix of WORKFLOW_SUFFIXES[type] || []) {
      const name = `${type}_${suffix}`;
      if (!(await sheetExists(name))) await createSheet(name, cols);
    }
  }
  console.log('Feuilles de workflow prêtes.');
}

export function clearConfigCache() {
  ['configHSE', 'configPACTE', 'configPersonnel'].forEach(cacheDel);
}
