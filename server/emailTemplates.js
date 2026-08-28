import { sendEmail } from './mail.js';
import { STATUT_COULEURS } from './constants.js';
import { formatDateTimeFr } from './util.js';

function emailShell(titre, prenom, innerHtml, couleur) {
  return `
<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
<div style="background:${couleur};color:#fff;padding:16px 20px;font-size:18px;font-weight:bold;">${titre}</div>
<div style="padding:20px;">
<p>Bonjour ${prenom},</p>
${innerHtml}
<p style="color:#888;font-size:12px;margin-top:24px;">Cordialement,<br>La direction du Lycée Simone Veil.</p>
</div>
</div>`;
}

// Équivalent de sendConfirmation() côté Apps Script : mail envoyé à la personne
// juste après sa propre saisie (HSE/PACTE/HNF). `createdByAdmin`, si fourni
// (email de l'admin), signale que c'est un administrateur qui a saisi la
// déclaration à la place de la personne — pour éviter toute confusion côté
// destinataire ("je n'ai pourtant rien déclaré").
export async function sendConfirmation(email, prenom, type, details, createdByAdmin) {
  if (!email) return;

  const lignesHtml = Object.keys(details)
    .map(k => `<tr><td style="padding:4px 8px;color:#666;">${k}</td><td style="padding:4px 8px;font-weight:bold;">${details[k]}</td></tr>`)
    .join('');
  const adminNoticeHtml = createdByAdmin
    ? `<p style="background:#fff8e1;border:1px solid #f9ab00;border-radius:6px;padding:10px 14px;">ℹ️ Cette déclaration a été saisie en votre nom par un administrateur (<strong>${createdByAdmin}</strong>).</p>`
    : '';
  const inner = `${adminNoticeHtml}<p>Votre déclaration <strong>${type}</strong> a bien été enregistrée :</p>
<table style="width:100%;border-collapse:collapse;margin:12px 0;">${lignesHtml}</table>`;
  const html = emailShell(`✅ Déclaration ${type} enregistrée`, prenom, inner, '#34a853');

  let text = `Bonjour ${prenom},\n\n`;
  if (createdByAdmin) text += `ℹ️ Cette déclaration a été saisie en votre nom par un administrateur (${createdByAdmin}).\n\n`;
  text += `Votre déclaration "${type}" a bien été enregistrée :\n\n`;
  for (const k in details) text += `- ${k} : ${details[k]}\n`;
  text += `\nCordialement,\nLa direction du Lycée Simone Veil.`;

  await sendEmail({ to: email, subject: `Confirmation - ${type}`, text, html });
}

// Équivalent de sendStatusEmail() : mail envoyé quand un admin valide/modifie/
// refuse une déclaration. `details`, si fourni, ajoute un récap complet (pour
// les validations, pas pour les refus).
export async function sendStatusEmail(email, personnel, type, statut, commentaireAdmin, details) {
  if (!email) return;

  const couleur = STATUT_COULEURS[statut] || '#666';
  let inner = `<p>Votre déclaration <strong>${type}</strong> a été traitée par un administrateur.</p>
<p style="font-size:16px;"><strong>Nouveau statut : ${statut}</strong></p>`;

  if (details && Object.keys(details).length) {
    const lignesHtml = Object.keys(details)
      .map(k => `<tr><td style="padding:4px 8px;color:#666;">${k}</td><td style="padding:4px 8px;font-weight:bold;">${details[k]}</td></tr>`)
      .join('');
    inner += `<p>Récapitulatif de la déclaration :</p><table style="width:100%;border-collapse:collapse;margin:12px 0;">${lignesHtml}</table>`;
  }

  if (commentaireAdmin) {
    const lignes = String(commentaireAdmin).split('\n').filter(l => l.trim());
    if (lignes.length > 1) {
      inner += `<p>Détail :</p><ul style="padding-left:18px;">${lignes.map(l => `<li>${l}</li>`).join('')}</ul>`;
    } else {
      inner += `<p>Commentaire : ${commentaireAdmin}</p>`;
    }
  }
  const html = emailShell(`${type} — ${statut}`, personnel, inner, couleur);

  let text = `Bonjour ${personnel},\n\nVotre déclaration "${type}" a été traitée par un administrateur.\n\nNouveau statut : ${statut}\n`;
  if (details && Object.keys(details).length) {
    text += `\nRécapitulatif :\n`;
    for (const k in details) text += `- ${k} : ${details[k]}\n`;
  }
  if (commentaireAdmin) text += `\nCommentaire :\n${commentaireAdmin}\n`;
  text += `\nCordialement,\nLa direction du Lycée Simone Veil.`;

  await sendEmail({ to: email, subject: `${type} - ${statut}`, text, html });
}

// Notifie le directeur (colonne "Rôle" = "Directeur" dans ConfigAdmin) qu'une
// nouvelle déclaration vient d'être soumise (par la personne elle-même ou par
// un admin en son nom).
export async function notifyNewDeclaration(recipients, personnel, type, details) {
  if (!recipients || !recipients.length) return;

  const lignesHtml = Object.keys(details)
    .map(k => `<tr><td style="padding:4px 8px;color:#666;">${k}</td><td style="padding:4px 8px;font-weight:bold;">${details[k]}</td></tr>`)
    .join('');
  const inner = `<p>Nouvelle déclaration <strong>${type}</strong> de <strong>${personnel}</strong> :</p>
<table style="width:100%;border-collapse:collapse;margin:12px 0;">${lignesHtml}</table>`;
  const html = emailShell(`📝 Nouvelle déclaration ${type} — ${personnel}`, 'Madame, Monsieur', inner, '#4f46e5');

  let text = `Nouvelle déclaration "${type}" de ${personnel} :\n\n`;
  for (const k in details) text += `- ${k} : ${details[k]}\n`;
  text += `\nCordialement,\nSuivi Heures Supp.`;

  for (const to of recipients) {
    await sendEmail({ to, subject: `Nouvelle déclaration ${type} — ${personnel}`, text, html });
  }
}

// Notifie le directeur (toujours, sur validation/refus) et, en plus pour les
// heures non faites "validées" (= modifiées par un admin, il n'y a pas de
// bouton "Valider" dédié pour ce type), le secrétariat.
export async function notifyDecision(recipients, personnel, type, statut, commentaireAdmin, details) {
  if (!recipients || !recipients.length) return;

  const couleur = STATUT_COULEURS[statut] || '#666';
  let inner = `<p>La déclaration <strong>${type}</strong> de <strong>${personnel}</strong> a été <strong>${statut}</strong>.</p>`;
  if (details && Object.keys(details).length) {
    const lignesHtml = Object.keys(details)
      .map(k => `<tr><td style="padding:4px 8px;color:#666;">${k}</td><td style="padding:4px 8px;font-weight:bold;">${details[k]}</td></tr>`)
      .join('');
    inner += `<p>Récapitulatif de la déclaration :</p><table style="width:100%;border-collapse:collapse;margin:12px 0;">${lignesHtml}</table>`;
  }
  if (commentaireAdmin) inner += `<p>Commentaire : ${commentaireAdmin}</p>`;
  const html = emailShell(`${type} — ${statut} (${personnel})`, 'Madame, Monsieur', inner, couleur);

  let text = `La déclaration "${type}" de ${personnel} a été ${statut}.\n`;
  if (details && Object.keys(details).length) {
    text += `\nRécapitulatif :\n`;
    for (const k in details) text += `- ${k} : ${details[k]}\n`;
  }
  if (commentaireAdmin) text += `\nCommentaire :\n${commentaireAdmin}\n`;
  text += `\nCordialement,\nSuivi Heures Supp.`;

  for (const to of recipients) {
    await sendEmail({ to, subject: `${type} - ${statut} (${personnel})`, text, html });
  }
}

export async function sendDeployNotification(emails, url) {
  const now = new Date();
  const subject = 'Suivi Heures Supp — nouvelle version déployée';
  const text = `Une nouvelle version de l'application "Suivi Heures Supp" a été déployée.\n\nDate : ${formatDateTimeFr(now)}\nURL : ${url}`;
  for (const email of emails) {
    await sendEmail({ to: email, subject, text, html: `<p>${text.replace(/\n/g, '<br>')}</p>` });
  }
}
