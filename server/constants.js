// Reprend exactement la structure des données de la version Apps Script, pour
// pouvoir réutiliser la même feuille Google Sheets sans la restructurer.

export const TYPE_COLUMNS = {
  HSE: ['ID', 'Date', 'Email', 'Personnel', 'Categorie', 'Mission', 'DateActivite', 'NbHSE', 'Commentaire', 'Statut', 'CommentaireAdmin', 'DateTraitement', 'TraitePar'],
  PACTE: ['ID', 'Date', 'Email', 'Personnel', 'MissionOfficielle', 'DateActivite', 'NbHAnnuel', 'Commentaire', 'Statut', 'CommentaireAdmin', 'DateTraitement', 'TraitePar'],
  HNF: ['ID', 'Date', 'Email', 'Personnel', 'DateAbsence', 'NbHeures', 'RattrapageFait', 'Commentaire', 'Statut', 'CommentaireAdmin', 'DateTraitement', 'TraitePar']
};

export const WORKFLOW_SUFFIXES = {
  HSE: ['APayer', 'Payee', 'Refus'],
  PACTE: ['Payee', 'Refus'],
  HNF: ['Refus']
};

export const FIELD_LABELS = {
  Date: 'Date de saisie',
  Categorie: 'Catégorie',
  Mission: 'Mission',
  NbHSE: 'Nombre de HSE',
  MissionOfficielle: 'Mission officielle',
  DateActivite: "Date de l'activité",
  NbHAnnuel: "Nombre d'heures annuel",
  DateAbsence: "Date d'absence",
  NbHeures: "Nombre d'heures",
  RattrapageFait: 'Rattrapage fait',
  Commentaire: 'Dates - Commentaires - Précisions'
};

export const STATUT_COULEURS = {
  'Validée': '#34a853',
  'Validée et payée': '#1a73e8',
  'Modifiée': '#f9ab00',
  'Refusée': '#ea4335'
};

export const RECAP_EXCLUDED_FIELDS = ['ID', 'Email', 'Personnel', 'Statut', 'CommentaireAdmin', 'DateTraitement', 'TraitePar', 'DateActivite', 'DateAbsence'];

export const DATE_ONLY_FIELDS = ['DateAbsence', 'DateActivite'];
