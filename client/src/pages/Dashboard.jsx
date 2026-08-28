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

function fmtH(n) {
  const r = Math.round(n * 10) / 10;
  return (Number.isInteger(r) ? r : r.toFixed(1)) + ' h';
}

function sumField(rows, header, field) {
  const idx = header.indexOf(field);
  if (idx === -1) return 0;
  return rows.reduce((s, r) => s + (parseFloat(r[idx]) || 0), 0);
}

// Bandeau récapitulatif en haut de la fiche : une pastille par type de
// déclaration (HSE / PACTE / Heures non faites), avec le total d'heures. HSE
// et PACTE affichent en plus la répartition validées / en attente (ils ont un
// vrai onglet séparé pour les déclarations validées). Les HNF n'affichent que
// le total : leur statut "Modifiée" ne distingue pas fiablement "validée" d'une
// simple correction, donc pas de répartition validées/en attente pour elles.
function computeSummary(data) {
  const hseEnAttente = sumField(data.HSE || [], data.HSE_header || [], 'NbHSE');
  const hseValide = sumField(data.HSE_APayer || [], data.HSE_APayer_header || [], 'NbHSE')
                   + sumField(data.HSE_Payee || [], data.HSE_Payee_header || [], 'NbHSE');

  const pacteEnAttente = sumField(data.PACTE || [], data.PACTE_header || [], 'NbHAnnuel');
  const pacteValide = sumField(data.PACTE_Payee || [], data.PACTE_Payee_header || [], 'NbHAnnuel');

  const hnfTotal = sumField(data.HNF || [], data.HNF_header || [], 'NbHeures');

  return [
    { label: 'HSE', total: hseValide + hseEnAttente, sub: `${fmtH(hseValide)} validées · ${fmtH(hseEnAttente)} en attente` },
    { label: 'PACTE', total: pacteValide + pacteEnAttente, sub: `${fmtH(pacteValide)} validées · ${fmtH(pacteEnAttente)} en attente` },
    { label: 'Heures non faites', total: hnfTotal, sub: null }
  ];
}

function SummaryBanner({ data }) {
  const tiles = computeSummary(data);
  return (
    <div className="mb-5 flex flex-wrap gap-3">
      {tiles.map(({ label, total, sub }) => (
        <div key={label} className="min-w-[150px] flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
          <div className="text-2xl font-bold text-slate-900">{fmtH(total)}</div>
          {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
        </div>
      ))}
    </div>
  );
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
        <>
          <SummaryBanner data={data} />
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
        </>
      )}
    </Layout>
  );
}
