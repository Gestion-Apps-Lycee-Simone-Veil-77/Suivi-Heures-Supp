import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import DataTable from '../components/DataTable.jsx';
import { useShell } from '../App.jsx';

const SECTIONS = [
  { key: 'HSE', title: 'HSE', sub: 'en attente / modifiées', color: 'border-amber-400' },
  { key: 'HSE_APayer', title: 'HSE', sub: 'à payer', color: 'border-primary-400' },
  { key: 'HSE_Payee', title: 'HSE', sub: 'payées', color: 'border-emerald-500' },
  { key: 'PACTE', title: 'PACTE', sub: 'en attente / modifiées', color: 'border-amber-400' },
  { key: 'PACTE_Payee', title: 'PACTE', sub: 'validées', color: 'border-emerald-500' },
  { key: 'HNF', title: 'Heures non faites', sub: 'en attente / modifiées', color: 'border-amber-400' }
];

function totalARattraper(header, rows) {
  const nbIdx = header.indexOf('NbHeures');
  if (nbIdx === -1) return null;
  const rattIdx = header.indexOf('RattrapageFait');
  const totalNb = rows.reduce((s, r) => s + (parseFloat(r[nbIdx]) || 0), 0);
  const totalRatt = rattIdx !== -1 ? rows.reduce((s, r) => s + (parseFloat(r[rattIdx]) || 0), 0) : 0;
  return totalNb - totalRatt;
}

export default function Dashboard() {
  const { api } = useShell();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/my-records').then(setData).catch(err => setError(err.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Layout back="/" wide>
      <h2 className="page-title">Ma fiche</h2>
      {error && <p className="text-red-600">Erreur : {error}</p>}
      {!data && !error && <p className="text-slate-400">Chargement...</p>}
      {data && (
        <div className="flex flex-col gap-4">
          {SECTIONS.map(({ key, title, sub, color }) => {
            const rows = data[key] || [];
            const header = data[key + '_header'] || [];
            const total = key === 'HNF' ? totalARattraper(header, rows) : null;
            return (
              <details key={key} open={rows.length > 0} className={`rounded-xl border-l-4 bg-white shadow-sm ${color}`}>
                <summary className="cursor-pointer select-none rounded-t-lg bg-slate-50 px-4 py-3 font-semibold">
                  {title} <span className="ml-1 text-xs font-normal uppercase text-slate-500">{sub}</span>
                  <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-normal">{rows.length}</span>
                </summary>
                <div className="p-3">
                  {total !== null && (
                    <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-900">
                      Total à rattraper : {total} h
                    </p>
                  )}
                  <DataTable header={header} rows={rows} />
                </div>
              </details>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
