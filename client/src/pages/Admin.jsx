import { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '../components/Layout.jsx';
import DataTable from '../components/DataTable.jsx';
import { headerLabel, colonnesVisibles, formatCell } from '../lib/labels.js';
import { useShell } from '../App.jsx';

const NON_EDITABLE = ['ID', 'Date', 'Email', 'Personnel', 'Statut', 'CommentaireAdmin', 'DateTraitement', 'TraitePar'];
const DATE_FIELDS = ['DateAbsence', 'DateActivite'];
const NUMBER_FIELDS = ['NbHSE', 'NbHAnnuel', 'NbHeures', 'RattrapageFait'];

export default function Admin() {
  const { api, me } = useShell();

  // Re-vérifie les droits admin à chaque visite de cette page (et pas
  // seulement une fois au chargement de l'appli) : sinon, quelqu'un retiré de
  // ConfigAdmin gardait l'accès tant qu'il ne se déconnectait pas manuellement.
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(me.isAdmin);

  const [filtre, setFiltre] = useState('');
  const [personnelList, setPersonnelList] = useState([]);
  const [pending, setPending] = useState(null);
  const [toPay, setToPay] = useState(null);
  const [budget, setBudget] = useState(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [appUrl, setAppUrl] = useState('');

  const reloadPending = () => api.get('/admin/pending').then(setPending);
  const reloadToPay = () => api.get('/admin/to-pay').then(setToPay);
  const reloadBudget = () => api.get('/admin/budget').then(setBudget);

  useEffect(() => {
    api.get('/me').then(fresh => { setAllowed(fresh.isAdmin); setChecking(false); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!allowed) return;
    api.get('/admin/personnel-list').then(setPersonnelList);
    reloadPending();
    reloadToPay();
    reloadBudget();
    setAppUrl(window.location.origin);
    // L'URL de la feuille elle-même n'est pas exposée par l'API (le serveur ne
    // la connaît que par son ID) — configurez SPREADSHEET_ID_URL si besoin, ou
    // laissez ce lien de côté et ouvrez la feuille depuis Drive directement.
    setSpreadsheetUrl(import.meta.env.VITE_SPREADSHEET_URL || '');
  }, [allowed]); // eslint-disable-line react-hooks/exhaustive-deps

  const hnfRestant = useMemo(() => {
    if (!pending) return null;
    const header = pending.HNF_header || [];
    const rows = (pending.HNF || []).filter(r => !filtre || r[header.indexOf('Personnel')] === filtre);
    const nbIdx = header.indexOf('NbHeures');
    if (nbIdx === -1) return null;
    const rattIdx = header.indexOf('RattrapageFait');
    const totalNb = rows.reduce((s, r) => s + (parseFloat(r[nbIdx]) || 0), 0);
    const totalRatt = rattIdx !== -1 ? rows.reduce((s, r) => s + (parseFloat(r[rattIdx]) || 0), 0) : 0;
    return totalNb - totalRatt;
  }, [pending, filtre]);

  if (checking) {
    return <Layout back="/" wide><p className="text-slate-400">Vérification des droits...</p></Layout>;
  }
  if (!allowed) {
    return (
      <Layout back="/" wide>
        <div className="card mx-auto max-w-md text-center">
          <p className="mb-2 text-3xl">⛔</p>
          <h2 className="page-title !mb-2">Accès refusé</h2>
          <p className="text-sm text-slate-500">
            Vous n'avez plus les droits administrateur (adresse retirée de ConfigAdmin). Contactez un autre administrateur si vous pensez qu'il s'agit d'une erreur.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout back="/" wide>
      <h2 className="page-title">Administration</h2>

      <div className="mb-5 flex flex-col gap-2 sm:flex-row">
        {spreadsheetUrl && (
          <a href={spreadsheetUrl} target="_blank" rel="noopener" className="btn-secondary">📊 Ouvrir le Google Sheet</a>
        )}
      </div>

      <ShareLinkBox appUrl={appUrl} api={api} />

      <div className="mb-6 flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-semibold text-slate-700">Filtrer par personne</label>
          <select className="input" value={filtre} onChange={e => setFiltre(e.target.value)}>
            <option value="">— Toutes les personnes —</option>
            {personnelList.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <button
          type="button"
          className="btn-secondary shrink-0"
          title="Si vous venez de modifier ConfigHSE, ConfigPACTE ou ConfigPersonnel directement sur la feuille, les listes déroulantes peuvent mettre jusqu'à 30 min à se mettre à jour — ce bouton force le rafraîchissement immédiat."
          onClick={() => api.post('/admin/clear-cache').then(() => alert('Configs rafraîchies.'))}
        >
          🔄 Rafraîchir les configs
        </button>
      </div>

      <ContactDirecteurSection api={api} currentNom={me.directeurNom} />

      <CreateForPersonSection api={api} personnelList={personnelList} onCreated={reloadPending} />

      <BudgetSection budget={budget} api={api} onChanged={reloadBudget} hnfRestant={filtre ? null : hnfRestant} />

      <Section title="Déclarations à traiter">
        {pending
          ? ['HSE', 'PACTE', 'HNF'].map(type => (
              <PendingBlock
                key={type}
                type={type}
                header={pending[type + '_header'] || []}
                rows={(pending[type] || []).filter(r => !filtre || r[(pending[type + '_header'] || []).indexOf('Personnel')] === filtre)}
                api={api}
                onChanged={() => { reloadPending(); reloadToPay(); }}
              />
            ))
          : <p className="text-slate-400">Chargement...</p>}
      </Section>

      <Section title="Déclarations à payer">
        {toPay ? (
          <ToPayBlock
            header={toPay.HSE_header || []}
            rows={(toPay.HSE || []).filter(r => !filtre || r[(toPay.HSE_header || []).indexOf('Personnel')] === filtre)}
            api={api}
            onChanged={reloadToPay}
          />
        ) : <p className="text-slate-400">Chargement...</p>}
      </Section>

      <StatsSection api={api} />
    </Layout>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h3 className="section-title">{title}</h3>
      {children}
    </div>
  );
}

function ShareLinkBox({ appUrl, api }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(appUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  function notifier() {
    api.post('/admin/notifier-deploiement', { url: appUrl }).then(() => alert('Notification envoyée.'));
  }
  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <label className="mb-1 block text-sm font-semibold text-slate-700">🔗 Lien de l'application (à partager)</label>
      <div className="flex gap-2">
        <input className="input flex-1" readOnly value={appUrl} onClick={e => e.target.select()} />
        <button className="btn-secondary shrink-0" onClick={copy}>{copied ? '✅ Copié' : '📋 Copier'}</button>
      </div>
      <button className="mt-2 text-xs text-slate-400 underline" onClick={notifier}>
        Envoyer la notification de nouveau déploiement
      </button>
    </div>
  );
}

// ---------- Nom de contact affiché dans le menu ----------
// Modifie la colonne "Nom" de la ligne "Directeur" dans ConfigAdmin — c'est ce
// nom qui remplace "Mr. LEGER" dans le bandeau du menu principal.
function ContactDirecteurSection({ api, currentNom }) {
  const [nom, setNom] = useState(currentNom || '');
  const [msg, setMsg] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg({ type: 'loading', text: 'Enregistrement...' });
    try {
      await api.post('/admin/directeur-nom', { nom });
      setMsg({ type: 'success', text: '✅ Nom mis à jour.' });
    } catch (err) {
      setMsg({ type: 'error', text: '❌ Erreur : ' + err.message });
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <label className="mb-1 block text-sm font-semibold text-slate-700">
        👤 Nom de contact affiché dans le menu
      </label>
      <p className="mb-2 text-xs text-slate-400">
        Remplace "Mr. LEGER" dans "Si vous rencontrez un problème, merci de contacter...". Nécessite une ligne avec le rôle "Directeur" dans ConfigAdmin (c'est son adresse email qui reçoit le lien mailto:).
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input className="input flex-1" value={nom} onChange={e => setNom(e.target.value)} placeholder="Mr. LEGER" />
        <button className="btn-secondary shrink-0" type="submit">Enregistrer</button>
      </form>
      {msg && (
        <p className={`mt-2 text-sm font-semibold ${
          msg.type === 'success' ? 'text-emerald-700' : msg.type === 'error' ? 'text-red-600' : 'text-slate-500'
        }`}>{msg.text}</p>
      )}
    </div>
  );
}

// ---------- Créer une déclaration pour une personne ----------
function CreateForPersonSection({ api, personnelList, onCreated }) {
  const [type, setType] = useState('HSE');
  const [personnel, setPersonnel] = useState('');
  const [configHSE, setConfigHSE] = useState({});
  const [configPACTE, setConfigPACTE] = useState([]);
  const [categorie, setCategorie] = useState('');
  const [mission, setMission] = useState('');
  const [missionOfficielle, setMissionOfficielle] = useState('');
  const [nbHSE, setNbHSE] = useState('');
  const [nbHAnnuel, setNbHAnnuel] = useState('');
  const [nbHeures, setNbHeures] = useState('');
  const [rattrapageFait, setRattrapageFait] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api.get('/config/hse').then(c => {
      setConfigHSE(c);
      const cats = Object.keys(c);
      if (cats.length) { setCategorie(cats[0]); setMission((c[cats[0]] || [])[0] || ''); }
    });
    api.get('/config/pacte').then(list => { setConfigPACTE(list); if (list.length) setMissionOfficielle(list[0]); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (categorie) setMission((configHSE[categorie] || [])[0] || '');
  }, [categorie, configHSE]);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg({ type: 'loading', text: 'Envoi en cours...' });
    const payload =
      type === 'HSE' ? { categorie, mission, nbHSE, commentaire } :
      type === 'PACTE' ? { missionOfficielle, nbHAnnuel, commentaire } :
      { nbHeures, rattrapageFait, commentaire };
    try {
      await api.post('/admin/submit', { type, personnel, payload });
      setMsg({ type: 'success', text: `✅ Déclaration créée pour ${personnel}. Le mail de confirmation lui a été envoyé.` });
      setCommentaire('');
      onCreated();
    } catch (err) {
      setMsg({ type: 'error', text: '❌ Erreur : ' + err.message });
    }
  }

  return (
    <Section title="Créer une déclaration pour une personne">
      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label>
            <span className="label">Type de déclaration</span>
            <select className="input" value={type} onChange={e => setType(e.target.value)}>
              <option value="HSE">HSE</option>
              <option value="PACTE">PACTE</option>
              <option value="HNF">Heures non faites</option>
            </select>
          </label>
          <label>
            <span className="label">Pour qui</span>
            <select className="input" value={personnel} onChange={e => setPersonnel(e.target.value)} required>
              <option value="">—</option>
              {personnelList.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        </div>

        {type === 'HSE' && (
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label>
              <span className="label">Catégorie</span>
              <select className="input" value={categorie} onChange={e => setCategorie(e.target.value)}>
                {Object.keys(configHSE).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>
              <span className="label">Mission</span>
              <select className="input" value={mission} onChange={e => setMission(e.target.value)}>
                {(configHSE[categorie] || []).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="label">Nombre d'HSE à payer</span>
              <input className="input" type="number" step="0.5" min="0" value={nbHSE} onChange={e => setNbHSE(e.target.value)} required />
            </label>
          </div>
        )}

        {type === 'PACTE' && (
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="label">Nom de mission</span>
              <select className="input" value={missionOfficielle} onChange={e => setMissionOfficielle(e.target.value)}>
                {configPACTE.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="label">Nombre d'heures</span>
              <input className="input" type="number" step="0.5" min="0" value={nbHAnnuel} onChange={e => setNbHAnnuel(e.target.value)} required />
            </label>
          </div>
        )}

        {type === 'HNF' && (
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label>
              <span className="label">Nombre d'heures</span>
              <input className="input" type="number" step="0.5" min="0.5" value={nbHeures} onChange={e => setNbHeures(e.target.value)} required />
            </label>
            <label>
              <span className="label">Rattrapage déjà fait (0 si aucun)</span>
              <input className="input" type="number" step="1" min="0" value={rattrapageFait} onChange={e => setRattrapageFait(e.target.value)} required />
            </label>
          </div>
        )}

        <label className="mb-3 block">
          <span className="label">Dates - Commentaires - Précisions</span>
          <textarea className="input min-h-[80px]" value={commentaire} onChange={e => setCommentaire(e.target.value)} required />
        </label>

        <button type="submit" className="btn-primary">Créer la déclaration</button>
        {msg && <p className={`mt-3 rounded-xl px-4 py-2 text-sm font-semibold ${
          msg.type === 'success' ? 'bg-emerald-50 text-emerald-800' : msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-primary-50 text-primary-700'
        }`}>{msg.text}</p>}
      </form>
    </Section>
  );
}

// ---------- Budget HSE ----------
function BudgetSection({ budget, api, onChanged, hnfRestant }) {
  const [description, setDescription] = useState('');
  const [heures, setHeures] = useState('');
  const [msg, setMsg] = useState(null);

  async function handleAdd(e) {
    e.preventDefault();
    setMsg({ type: 'loading', text: 'Ajout en cours...' });
    try {
      await api.post('/admin/budget', { description, heures });
      setMsg({ type: 'success', text: '✅ Ligne de budget ajoutée.' });
      setDescription(''); setHeures('');
      onChanged();
    } catch (err) {
      setMsg({ type: 'error', text: '❌ Erreur : ' + err.message });
    }
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer cette ligne de budget ?')) return;
    await api.del('/admin/budget/' + id);
    onChanged();
  }

  const idIdx = budget?.header.indexOf('ID') ?? -1;

  return (
    <Section title="Budgets HSE">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <form onSubmit={handleAdd} className="mb-4 flex flex-col gap-2 sm:flex-row">
          <input className="input flex-[2]" placeholder="Ex : Budget initial, Déplacement sortie janvier..."
                 value={description} onChange={e => setDescription(e.target.value)} required />
          <input className="input flex-1" type="number" step="0.5" min="0" placeholder="Heures"
                 value={heures} onChange={e => setHeures(e.target.value)} required />
          <button className="btn-primary shrink-0" type="submit">Ajouter</button>
        </form>
        {msg && <p className="mb-3 text-sm font-semibold">{msg.text}</p>}

        {!budget ? <p className="text-slate-400">Chargement...</p> : !budget.rows.length ? (
          <p className="text-sm italic text-slate-400">Aucune ligne de budget.</p>
        ) : (
          <>
            <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-900">
              Total budget HSE : {budget.total} h
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    {budget.header.filter(h => h !== 'ID').map(h => <th key={h} className="px-3 py-2">{headerLabel(h)}</th>)}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {budget.rows.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {budget.header.map((h, hi) => h !== 'ID' && <td key={hi} className="px-3 py-2">{formatCell(r[hi])}</td>)}
                      <td className="px-3 py-2">
                        <button className="btn-danger" onClick={() => handleDelete(r[idIdx])}>✖ Supprimer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {hnfRestant !== null && budget && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            Somme des HSE (budget) : <strong>{budget.total} h</strong><br />
            − Somme des HNF (restant à rattraper) : <strong>{hnfRestant} h</strong><br />
            = Solde d'heures supplémentaires restant : <strong>{budget.total - hnfRestant} h</strong>
          </p>
        )}
      </div>
    </Section>
  );
}

// ---------- Déclarations à traiter ----------
function PendingBlock({ type, header, rows, api, onChanged }) {
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  // Ligne en cours de traitement : désactive ses boutons et affiche un état
  // visible pendant l'appel réseau (validation/refus/paiement + envoi de
  // l'email prennent quelques secondes), pour ne plus donner l'impression que
  // rien ne s'est passé et qu'il faut recharger la page.
  const [busyId, setBusyId] = useState(null);

  async function agir(id, action) {
    const commentaireAdmin = prompt(
      action === 'refuser' ? 'Motif du refus (laisser vide si aucun, OK pour confirmer) :' : 'Commentaire pour la personne (laisser vide si aucun, OK pour confirmer) :'
    );
    if (commentaireAdmin === null) return;
    setBusyId(id);
    try {
      await api.post('/admin/traiter', { type, id, action, payload: { commentaireAdmin } });
      onChanged();
    } catch (err) {
      alert('❌ Erreur : ' + err.message);
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(row) {
    const idIdx = header.indexOf('ID');
    setEditingId(row[idIdx]);
    const values = {};
    header.forEach((h, i) => { if (!NON_EDITABLE.includes(h)) values[h] = row[i]; });
    setEditValues(values);
  }

  async function saveEdit(id) {
    setBusyId(id);
    try {
      await api.post('/admin/traiter', { type, id, action: 'modifier', payload: editValues });
      setEditingId(null);
      onChanged();
    } catch (err) {
      alert('❌ Erreur : ' + err.message);
    } finally {
      setBusyId(null);
    }
  }

  const idIdx = header.indexOf('ID');
  const visibleIdx = colonnesVisibles(header, rows);

  return (
    <details open={rows.length > 0} className="mb-3 rounded-xl border-l-4 border-amber-400 bg-white shadow-sm">
      <summary className="cursor-pointer select-none rounded-t-lg bg-slate-50 px-4 py-3 font-semibold">
        {type} <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-normal">{rows.length}</span>
      </summary>
      <div className="overflow-x-auto p-3">
        {!rows.length ? (
          <p className="text-sm italic text-slate-400">Aucune déclaration en attente.</p>
        ) : (
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                {visibleIdx.map(i => <th key={i} className="whitespace-nowrap px-3 py-2">{headerLabel(header[i])}</th>)}
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => {
                const id = r[idIdx];
                const isEditing = editingId === id;
                const busy = busyId === id;
                return (
                  <tr key={ri} className="border-t border-slate-100 align-top">
                    {visibleIdx.map(i => {
                      const h = header[i];
                      if (isEditing && !NON_EDITABLE.includes(h)) {
                        const inputType = DATE_FIELDS.includes(h) ? 'date' : NUMBER_FIELDS.includes(h) ? 'number' : 'text';
                        return (
                          <td key={i} className="px-2 py-2">
                            <input
                              className="input"
                              type={inputType}
                              step={NUMBER_FIELDS.includes(h) ? '0.5' : undefined}
                              value={editValues[h] ?? ''}
                              onChange={e => setEditValues(v => ({ ...v, [h]: e.target.value }))}
                            />
                          </td>
                        );
                      }
                      return <td key={i} className="whitespace-pre-line break-words px-3 py-2">{formatCell(r[i])}</td>;
                    })}
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <div className="flex flex-col gap-1">
                          <button className="btn-success disabled:opacity-50" disabled={busy} onClick={() => saveEdit(id)}>{busy ? '⏳ Enregistrement…' : '✔ Enregistrer'}</button>
                          <button className="btn-secondary" disabled={busy} onClick={() => setEditingId(null)}>↩ Annuler</button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {type !== 'HNF' && (
                            <button className="btn-success disabled:opacity-50" disabled={busy} onClick={() => agir(id, 'valider')}>{busy ? '⏳ Traitement…' : '✅ Valider'}</button>
                          )}
                          {type === 'HSE' && (
                            <button className="btn-info disabled:opacity-50" disabled={busy} onClick={() => agir(id, 'valider_payee')}>{busy ? '⏳ Traitement…' : '💶 Valider et payer'}</button>
                          )}
                          <button className="btn-warning disabled:opacity-50" disabled={busy} onClick={() => startEdit(r)}>✏️ Modifier</button>
                          <button className="btn-danger disabled:opacity-50" disabled={busy} onClick={() => agir(id, 'refuser')}>{busy ? '⏳ Traitement…' : '✖ Refuser'}</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </details>
  );
}

// ---------- Déclarations à payer ----------
function ToPayBlock({ header, rows, api, onChanged }) {
  const idIdx = header.indexOf('ID');
  const [busyId, setBusyId] = useState(null);
  async function payer(id) {
    if (!confirm('Confirmer le paiement de cette déclaration ?')) return;
    setBusyId(id);
    try {
      await api.post('/admin/marquer-payee', { type: 'HSE', id });
      onChanged();
    } finally {
      setBusyId(null);
    }
  }
  return (
    <DataTable
      header={header}
      rows={rows}
      renderActions={(r) => {
        const id = r[idIdx];
        const busy = busyId === id;
        return (
          <button className="btn-info disabled:opacity-50" disabled={busy} onClick={() => payer(id)}>
            {busy ? '⏳ Paiement…' : '💰 Payer'}
          </button>
        );
      }}
    />
  );
}

// ---------- Statistiques HSE ----------
function StatsSection({ api }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [exporting, setExporting] = useState(false);
  const contentRef = useRef(null);

  function openStats() {
    setOpen(true);
    api.get('/admin/stats').then(setData);
  }

  // Capture le contenu (graphiques en barres) en image via html2canvas, puis
  // soit le télécharge tel quel (PNG), soit l'insère dans un PDF d'une page
  // (jsPDF). Les deux librairies sont chargées à la demande (import
  // dynamique) pour ne pas alourdir le chargement initial de l'appli.
  async function exportAs(format) {
    if (!contentRef.current) return;
    setExporting(true);
    try {
      // Attendre que la police (Inter, chargée via Google Fonts) soit
      // réellement appliquée avant la capture : sinon html2canvas peut
      // photographier un instant où le texte utilise encore la police de
      // repli du navigateur, avec une hauteur de ligne différente — d'où le
      // texte qui chevauche les barres sur l'export (visuellement correct à
      // l'écran, faussé seulement sur l'image capturée).
      if (document.fonts?.ready) await document.fonts.ready;

      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(contentRef.current, { backgroundColor: '#ffffff', scale: 2 });
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === 'png') {
        // Le lien doit être inséré dans le DOM avant .click() — dans
        // certains navigateurs, cliquer un <a download> jamais attaché à la
        // page ne déclenche rien (le téléchargement semblait "ne pas marcher").
        const link = document.createElement('a');
        link.download = `statistiques-hse-${stamp}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF({
          orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [canvas.width, canvas.height]
        });
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`statistiques-hse-${stamp}.pdf`);
      }
    } catch (err) {
      alert("Erreur lors de l'export : " + err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Section title="Statistiques">
      <button className="btn-primary" onClick={openStats}>📊 Voir les statistiques HSE</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-bold">Statistiques HSE</h3>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary" disabled={!data || exporting} onClick={() => exportAs('png')}>
                  {exporting ? '⏳ Export…' : '🖼️ Exporter en PNG'}
                </button>
                <button className="btn-secondary" disabled={!data || exporting} onClick={() => exportAs('pdf')}>
                  {exporting ? '⏳ Export…' : '📄 Exporter en PDF'}
                </button>
                <button className="btn-secondary" onClick={() => setOpen(false)}>✖ Fermer</button>
              </div>
            </div>
            {!data ? <p className="text-slate-400">Chargement...</p> : (
              <div ref={contentRef} className="bg-white p-1">
                <BarList title="Répartition des heures HSE par catégorie" entries={data.parCategorie} />
                <h4 className="mb-2 mt-6 font-semibold">Répartition des missions par catégorie</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {Object.keys(data.parMission).map(cat => (
                    <div key={cat} className="rounded-xl border border-slate-200 p-3">
                      <BarList title={cat} entries={data.parMission[cat]} compact />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}

const BAR_COLORS = ['bg-primary-500', 'bg-red-500', 'bg-amber-500', 'bg-emerald-500', 'bg-purple-500', 'bg-teal-500', 'bg-pink-500'];

function BarList({ title, entries, compact }) {
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  return (
    <div>
      {!compact && <h4 className="mb-2 font-semibold">{title}</h4>}
      {compact && <p className="mb-2 text-center text-sm font-semibold">{title}</p>}
      <div className="flex flex-col gap-2">
        {entries.map(([label, value], i) => {
          const pct = Math.round((value / total) * 100);
          return (
            <div key={label}>
              <div className="mb-1.5 flex justify-between text-xs leading-normal text-slate-600">
                <span>{label}</span>
                <span>{pct}% ({value} h)</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full ${BAR_COLORS[i % BAR_COLORS.length]}`} style={{ width: pct + '%' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
