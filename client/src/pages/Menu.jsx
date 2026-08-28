import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { useShell } from '../App.jsx';

const ITEMS = [
  { to: '/hse', icon: '📝', badge: 'bg-primary-50', label: 'Déclarer des HSE', desc: 'Heures supplémentaires effectives' },
  { to: '/pacte', icon: '🎯', badge: 'bg-violet-50', label: 'Déclarer une mission PACTE', desc: 'Mission PACTE annuelle' },
  { to: '/hnf', icon: '🕐', badge: 'bg-amber-50', label: 'Déclarer des heures non faites', desc: 'Heures à rattraper' },
  { to: '/dashboard', icon: '📊', badge: 'bg-sky-50', label: 'Voir ma fiche', desc: 'Historique de mes déclarations' }
];

export default function Menu() {
  const { me } = useShell();

  return (
    <Layout>
      <div className="mb-6 text-center">
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
          🎓 2026-2027
        </span>
        <h1 className="text-lg font-bold text-slate-900 sm:text-xl">Lycée Simone Veil</h1>
        <h2 className="text-sm font-semibold text-slate-500 sm:text-base">Suivi des heures supplémentaires</h2>
      </div>

      <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-slate-700">
        <span>📩</span>
        <span>
          Si vous rencontrez un problème, merci de contacter{' '}
          {me.directeurEmail ? (
            <a href={`mailto:${me.directeurEmail}`} className="font-bold underline decoration-primary-300 underline-offset-2 hover:text-primary-700">
              {me.directeurNom || 'Mr. LEGER'}
            </a>
          ) : (
            <strong>{me.directeurNom || 'Mr. LEGER'}</strong>
          )}
          .
        </span>
      </div>

      <nav className="flex flex-col gap-2.5">
        {ITEMS.map(item => <MenuButton key={item.to} {...item} />)}
        {me.isAdmin && (
          <MenuButton to="/admin" icon="🛠️" badge="bg-emerald-50" label="Administration" desc="Traiter, payer, suivre le budget" />
        )}
      </nav>
    </Layout>
  );
}

function MenuButton({ to, icon, badge, label, desc }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md"
    >
      <span className={`icon-badge ${badge}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-slate-800">{label}</span>
        <span className="block truncate text-xs text-slate-400">{desc}</span>
      </span>
      <span className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-primary-500">→</span>
    </Link>
  );
}
