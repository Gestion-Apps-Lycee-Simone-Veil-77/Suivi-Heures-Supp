export const HEADER_LABELS = {
  Date: 'Date de saisie',
  DateAbsence: "Date d'absence",
  DateActivite: "Date de l'activité",
  DateTraitement: 'Date traitement',
  TraitePar: 'Traité par',
  CommentaireAdmin: 'Commentaire admin',
  MissionOfficielle: 'Mission officielle',
  NbHSE: 'Nb HSE',
  NbHAnnuel: 'Nb h annuel',
  NbHeures: 'Nb heures',
  RattrapageFait: 'Rattrapage fait',
  Commentaire: 'Dates - Commentaires - Précisions'
};

export function headerLabel(h) {
  return HEADER_LABELS[h] || h;
}

export function formatCell(c) {
  if (typeof c === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(c)) {
    const d = new Date(c);
    if (!isNaN(d)) return d.toLocaleDateString('fr-FR');
  }
  return c === null || c === undefined ? '' : c;
}

const HIDDEN_COLS = ['ID'];

// Colonnes visibles = ni dans HIDDEN_COLS, ni vides sur toutes les lignes affichées.
export function colonnesVisibles(header, rows) {
  return header
    .map((h, i) => {
      if (HIDDEN_COLS.includes(h)) return -1;
      const aUneValeur = rows.some(r => r[i] !== '' && r[i] !== null && r[i] !== undefined);
      return aUneValeur ? i : -1;
    })
    .filter(i => i !== -1);
}
