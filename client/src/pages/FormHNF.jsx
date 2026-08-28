import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import { IdentityBox, StatusBanner, Field, inputClass } from '../components/FormShell.jsx';
import { useShell } from '../App.jsx';

export default function FormHNF() {
  const { api, me } = useShell();
  const [identite, setIdentite] = useState(null);
  const [nbHeures, setNbHeures] = useState('');
  const [rattrapageFait, setRattrapageFait] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [status, setStatus] = useState(null);

  useEffect(() => { api.get('/me').then(setIdentite); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const disabled = identite && !identite.personnel;

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({ type: 'loading', text: 'Envoi en cours...' });
    try {
      await api.post('/submit/hnf', { nbHeures, rattrapageFait, commentaire });
      setStatus({ type: 'success', text: '✅ Déclaration envoyée ! Un mail de confirmation arrive.' });
      setNbHeures('');
      setRattrapageFait('');
      setCommentaire('');
    } catch (err) {
      setStatus({ type: 'error', text: '❌ Erreur : ' + err.message });
    }
  }

  return (
    <Layout back="/">
      <h2 className="page-title">Déclaration Heures non Faites</h2>
      <IdentityBox identite={identite} />

      <form onSubmit={handleSubmit}>
        <Field label="Nombre d'heures à déclarer">
          <input className={inputClass} type="number" step="0.5" min="0.5" required
                 value={nbHeures} onChange={e => setNbHeures(e.target.value)} />
        </Field>

        <Field label="Rattrapage Fait">
          <input className={inputClass} type="number" step="1" min="0" required
                 value={rattrapageFait} onChange={e => setRattrapageFait(e.target.value)} />
        </Field>

        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          ⚠️ Indiquez 0 si aucun rattrapage n'a encore été effectué à ce jour.
        </p>

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
