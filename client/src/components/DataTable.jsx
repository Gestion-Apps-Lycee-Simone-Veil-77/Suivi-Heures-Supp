import { headerLabel, formatCell, colonnesVisibles } from '../lib/labels.js';

// Tableau générique avec défilement horizontal sur mobile (le conteneur
// scrolle, pas la page entière) — responsive sans dupliquer le HTML.
export default function DataTable({ header, rows, renderActions }) {
  if (!rows.length) return <p className="px-4 py-3 text-sm italic text-slate-400">Aucune entrée.</p>;
  const visibleIdx = colonnesVisibles(header, rows);
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            {visibleIdx.map(i => (
              <th key={i} className="whitespace-nowrap px-3 py-2">{headerLabel(header[i])}</th>
            ))}
            {renderActions && <th className="px-3 py-2">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-t border-slate-100 hover:bg-slate-50">
              {visibleIdx.map(i => (
                <td key={i} className="whitespace-pre-line break-words px-3 py-2 align-top">{formatCell(r[i])}</td>
              ))}
              {renderActions && <td className="px-3 py-2 align-top">{renderActions(r, header)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
