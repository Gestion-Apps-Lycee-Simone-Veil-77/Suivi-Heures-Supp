import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import { IdentityBox, StatusBanner, Field, inputClass } from '../components/FormShell.jsx';
import { useShell } from '../App.jsx';

export default function FormHSE() {
  const { api, me } = useShell();
  const [bootstrap, setBootstrap] = useState(null);
  const [categorie, setCategorie] = useState('');
  const [mission, setMission] = useState('');
  const [nbHSE, setNbHSE] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api.get('/bootstrap/hse').then(data => {
      setBootstrap(data);
      const cats = Object.keys(data.config);
      if (cats.length) {
        setCategorie(cats[0]);
        setMission((data.config[cats[0]] || [])[0] || '');
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (bootstrap && categorie) {
      setMission((bootstrap.config[categorie] || [])[0] || '');
    }
  }, [categorie, bootstrap]);

  const disabled = bootstrap && !bootstrap.identite.personnel;

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({ type: 'loading', text: 'Envoi en cours...' });
    try {
      await api.post('/submit/hse', { categorie, mission, nbHSE, commentaire });
      setStatus({ type: 'success', text: '✅ Déclaration envoyée ! Un mail de confirmation arrive.' });
      setNbHSE('');
      setCommentaire('');
    } catch (err) {
      setStatus({ type: 'error', text: '❌ Erreur : ' + err.message });
    }
  }

  const categories = bootstrap ? Object.keys(bootstrap.config) : [];
  const missions = bootstrap && categorie ? bootstrap.config[categorie] || [] : [];

  return (
    <Layout back="/">
      <h2 className="page-title">Déclaration HSE</h2>
      <IdentityBox identite={bootstrap?.identite} />

      <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        ⚠️ <strong>Important :</strong> merci de déclarer les heures supplémentaires séparément pour chaque catégorie et chaque mission.
        <br />
        Exemple : pour 7 heures au total, dont 4 heures pour une mission A et 3 heures pour une mission B, faites deux déclarations distinctes.
      </p>

      <form onSubmit={handleSubmit}>
        <Field label="Catégorie">
          <select className={inputClass} value={categorie} onChange={e => setCategorie(e.target.value)} required>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <Field label="Mission">
          <select className={inputClass} value={mission} onChange={e => setMission(e.target.value)} required>
            {missions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>

        <Field label="Nombre d'HSE à payer">
          <input className={inputClass} type="number" step="0.5" min="0" required
                 value={nbHSE} onChange={e => setNbHSE(e.target.value)} />
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
