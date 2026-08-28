import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import { IdentityBox, StatusBanner, Field, inputClass } from '../components/FormShell.jsx';
import { useShell } from '../App.jsx';

export default function FormPACTE() {
  const { api, me } = useShell();
  const [bootstrap, setBootstrap] = useState(null);
  const [missionOfficielle, setMissionOfficielle] = useState('');
  const [nbHAnnuel, setNbHAnnuel] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api.get('/bootstrap/pacte').then(data => {
      setBootstrap(data);
      if (data.config.length) setMissionOfficielle(data.config[0]);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const disabled = bootstrap && !bootstrap.identite.personnel;

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({ type: 'loading', text: 'Envoi en cours...' });
    try {
      await api.post('/submit/pacte', { missionOfficielle, nbHAnnuel, commentaire });
      setStatus({ type: 'success', text: '✅ Déclaration envoyée ! Un mail de confirmation arrive.' });
      setNbHAnnuel('');
      setCommentaire('');
    } catch (err) {
      setStatus({ type: 'error', text: '❌ Erreur : ' + err.message });
    }
  }

  return (
    <Layout back="/">
      <h2 className="page-title">Déclaration PACTE</h2>
      <IdentityBox identite={bootstrap?.identite} />

      <form onSubmit={handleSubmit}>
        <Field label="Nom de mission">
          <select className={inputClass} value={missionOfficielle} onChange={e => setMissionOfficielle(e.target.value)} required>
            {(bootstrap?.config || []).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>

        <Field label="Nombre d'heures à déclarer">
          <input className={inputClass} type="number" step="0.5" min="0" required
                 value={nbHAnnuel} onChange={e => setNbHAnnuel(e.target.value)} />
        </Field>

        <Field label="Dates - Commentaires - Précisions">
          <textarea className={inputClass + ' min-h-[90px]'} required
                    value={commentaire} onChange={e => setCommentaire(e.target.value)} />
        </Field>

        <p className="mb-4 rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm">
          📧 Un message récapitulatif sera envoyé à l'adresse mail suivante : <strong>{me.email}</strong>
        </p>

        <button type="submit" disabled={disabled} className="btn-primary w-full !py-3">
          Envoyer
        </button>
      </form>
      <StatusBanner status={status} />
    </Layout>
  );
}
